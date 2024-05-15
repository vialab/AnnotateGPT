import * as mupdf from "mupdf";
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = 8080;
const HOST = "http://localhost";

// cache fetched documents in memory for at least 5 minutes
const FETCH_CACHE_EXPIRES = 5 * 60 * 1000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.listen(PORT, () => {
    console.log(`Server started on ${PORT}`);
});

const fetchCache = new Map();
function cachedCetch(url) {
    let item = fetchCache.get(url);
    if (!item) fetchCache.set(url, (item = { promise: fetch(url), expires: Date.now() + FETCH_CACHE_EXPIRES }));
    return item.promise;
}

const responseCache = new Map();
function cachedResponseArrayBuffer(url, res) {
    let item = responseCache.get(url);
    if (!item) responseCache.set(url, (item = { promise: res.arrayBuffer(), expires: Date.now() + FETCH_CACHE_EXPIRES }));
    return item.promise;
}

setInterval(function () {
    let now = Date.now();
    fetchCache.forEach((value, key, map) => {
        if (value.expires > now) map.delete(key);
    });
    responseCache.forEach((value, key, map) => {
        if (value.expires > now) map.delete(key);
    });
}, FETCH_CACHE_EXPIRES);

// Helper function to load document from URL
async function loadDocumentFromUrl(url) {
    const response = await cachedCetch(url);
    const buffer = await cachedResponseArrayBuffer(url, response);
    return mupdf.Document.openDocument(buffer, "application/pdf");
}

// GET /document/needs-password
app.get("/document/needs-password", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const needsPassword = document.needsPassword();
    res.json({ needsPassword });
});

// POST /document/authenticate-password
app.post("/document/authenticate-password", async (req, res) => {
    const { url, password } = req.body;
    if (!url || !password) {
        return res.status(400).send("URL and password are required");
    }

    const document = await loadDocumentFromUrl(url);
    const result = document.authenticatePassword(password);
    res.json({ result });
});

// GET /document/metadata
app.get("/document/metadata", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const format = document.getMetaData("format");
    const modificationDate = document.getMetaData("info:ModDate");
    const author = document.getMetaData("info:Author");

    res.json({ format, modificationDate, author });
});

// TODO: SetMetaData is not working
// POST /document/metadata
app.post("/document/metadata", async (req, res) => {
    const { url, key, value } = req.body;
    if (!url || !key || !value) {
        return res.status(400).send("URL, key, and value are required");
    }

    const document = (await loadDocumentFromUrl(url));
    document.setMetaData(key, value);
    const outputBuffer = document.saveToBuffer("incremental");
    const outputPath = path.join("public", `output-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBuffer.asUint8Array());
    res.json({ url: `${HOST}:${PORT}/${path.basename(outputPath)}` });
});

// GET /document/page-count
app.get("/document/page-count", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const pageCount = document.countPages();
    res.json({ pageCount });
});

// GET /document/page/:pageNumber
app.get("/document/page/:pageNumber", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const pageNumber = parseInt(req.params.pageNumber);
    const page = document.loadPage(pageNumber);
    res.json(page);
});

// GET /document/structured-text
app.get("/document/structured-text", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const result = [];
    let i = 0;
    while (i < document.countPages()) {
        const page = document.loadPage(i);
        const json = page.toStructuredText("preserve-whitespace").asJSON();
        result.push(json);
        i++;
    }

    res.json(result);
});

// GET /document/images
app.get("/document/images", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const result = [];
    let i = 0;
    while (i < document.countPages()) {
        const page = document.loadPage(i);
        page.toStructuredText("preserve-images").walk({
            onImageBlock(bbox, matrix, image) {
                result.push({ bbox, matrix, image });
            },
        });
        i++;
    }

    res.json(result);
});

// GET /document/annotations
app.get("/document/annotations", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const result = [];
    let i = 0;
    while (i < document.countPages()) {
        const page = document.loadPage(i);
        const annots = page.getAnnotations();
        result.push(...annots);
        i++;
    }

    res.json(result);
});

// POST /document/bake
app.post("/document/bake", async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const pdfDocument = document;
    pdfDocument.bake();
    const outputBuffer = pdfDocument.saveToBuffer("incremental");
    const outputPath = path.join("public", `output-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBuffer.asUint8Array());
    res.json({ url: `${HOST}:${PORT}/${path.basename(outputPath)}` });
});

// POST /document/search
app.post("/document/search", async (req, res) => {
    const { url, searchTerm } = req.body;
    if (!url || !searchTerm) {
        return res.status(400).send("URL and searchTerm are required");
    }

    const document = await loadDocumentFromUrl(url);
    const results = [];
    let i = 0;
    while (i < document.countPages()) {
        const page = document.loadPage(i);
        const pageResults = page.search(searchTerm);
        results.push(pageResults);
        i++;
    }

    res.json(results);
});

// GET /document/links
app.get("/document/links", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const links = [];
    let i = 0;
    while (i < document.countPages()) {
        const page = document.loadPage(i);
        const pageLinks = page.getLinks();
        links.push(...pageLinks);
        i++;
    }

    res.json(links);
});

// POST /document/embed-file
app.post("/document/embed-file", async (req, res) => {
    const { url, embedUrl } = req.body;
    if (!url || !embedUrl) {
        return res.status(400).send("URL and embedUrl are required");
    }

    const document = await loadDocumentFromUrl(url);
    const pdfDocument = document;

    const embedMe = (await loadDocumentFromUrl(embedUrl));
    const page = pdfDocument.loadPage(0);
    const annotation = page.createAnnotation("FileAttachment");

    annotation.setRect([50, 50, 100, 100]);

    const buffer = embedMe.saveToBuffer("compress");

    const fileSpecObject = pdfDocument.addEmbeddedFile(path.basename(embedUrl), "application/pdf", buffer, new Date(), new Date(), false);
    annotation.setFileSpec(fileSpecObject);
    const outputBuffer = pdfDocument.saveToBuffer("incremental");
    const outputPath = path.join("public", `output-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBuffer.asUint8Array());
    res.json({ url: `${HOST}:${PORT}/${path.basename(outputPath)}` });
});

// GET /document/page/:pageNumber/bounds
app.get("/document/page/:pageNumber/bounds", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const pageNumber = parseInt(req.params.pageNumber);
    const page = document.loadPage(pageNumber);
    const bounds = page.getBounds();

    res.json({ bounds });
});

// GET /document/page/:pageNumber/pixmap
app.get("/document/page/:pageNumber/pixmap", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const pageNumber = parseInt(req.params.pageNumber);
    const page = document.loadPage(pageNumber);
    const pixmap = page.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false, true);
    const pngImage = pixmap.asPNG();
    const base64Image = Buffer.from(pngImage).toString("base64");

    res.json({ base64Image });
});

// GET /document/page/:pageNumber/structured-text
app.get("/document/page/:pageNumber/structured-text", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const pageNumber = parseInt(req.params.pageNumber);
    const page = document.loadPage(pageNumber);
    const json = page.toStructuredText("preserve-whitespace").asJSON();

    res.json(json);
});

// GET /document/page/:pageNumber/images
app.get("/document/page/:pageNumber/images", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const document = await loadDocumentFromUrl(url);
    const pageNumber = parseInt(req.params.pageNumber);
    const page = document.loadPage(pageNumber);

    const images = [];

    page.toStructuredText("preserve-images").walk({
        onImageBlock(bbox, matrix, image) {
            images.push({ bbox, matrix, image });
        },
    });

    res.json(images);
});

// POST /document/page/:pageNumber/add-text
app.post("/document/page/:pageNumber/add-text", async (req, res) => {
    const { url, text, x, y, fontFamily, fontSize } = req.body;
    if (!url || !text || !x || !y || !fontFamily || !fontSize) {
        return res.status(400).send("URL, text, x, y, fontFamily, and fontSize are required");
    }

    const document = await loadDocumentFromUrl(url);
    const pageNumber = parseInt(req.params.pageNumber);
    const page = document.loadPage(pageNumber);
    const pageObj = page.getObject();

    const pdfDocument = document;

    const font = pdfDocument.addSimpleFont(new mupdf.Font(fontFamily));

    let resources = pageObj.get("Resources");
    if (!resources.isDictionary()) pageObj.put("Resources", (resources = pdfDocument.newDictionary()));

    let resFonts = resources.get("Font");
    if (!resFonts.isDictionary()) resources.put("Font", (resFonts = pdfDocument.newDictionary()));

    resFonts.put("F1", font);

    // TODO: .addStream API type is not correct
    // const extra_contents = pdfDocument.addStream()

    const outputBuffer = pdfDocument.saveToBuffer("incremental");
    const outputPath = path.join("public", `output-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBuffer.asUint8Array());
    res.json({ url: `${HOST}:${PORT}/${path.basename(outputPath)}` });
});

// POST /document/page/:pageNumber/add-image
app.post("/document/page/:pageNumber/add-image", async (req, res) => {
    const { url, imageUrl, x, y, width, height } = req.body;
    if (!url || !imageUrl || !x || !y || !width || !height) {
        return res.status(400).send("URL, imageUrl, x, y, width, and height are required");
    }

    const document = await loadDocumentFromUrl(url);
    const pdfDocument = document;

    const pageNumber = parseInt(req.params.pageNumber);
    const page = pdfDocument.loadPage(pageNumber);
    const pageObj = page.getObject();

    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    const image = pdfDocument.addImage(new mupdf.Image(new Uint8Array(imageBuffer)));

    let resources = pageObj.get("Resources");
    if (!resources.isDictionary()) pageObj.put("Resources", (resources = pdfDocument.newDictionary()));

    let resXobj = resources.get("XObject");
    if (!resXobj.isDictionary()) resources.put("XObject", (resXobj = pdfDocument.newDictionary()));

    resXobj.put("Image", image);

    // TODO: .addStream API type is not correct
    // const extra_contents = pdfDocument.addStream()

    const outputBuffer = pdfDocument.saveToBuffer("incremental");
    const outputPath = path.join("public", `output-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBuffer.asUint8Array());
    res.json({ url: `${HOST}:${PORT}/${path.basename(outputPath)}` });
});

// POST /document/page/:pageNumber/copy
app.post("/document/page/:pageNumber/copy", async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).send("URL is required");
    }
    const pdfDocument = (await loadDocumentFromUrl(url));

    const pageNumber = parseInt(req.params.pageNumber);

    const newDocument = new mupdf.PDFDocument();
    newDocument.graftPage(0, pdfDocument, pageNumber);

    const buffer = newDocument.saveToBuffer("compress");
    const outputPath = path.join("public", `copied-page-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, buffer.asUint8Array());
    res.json({ url: `${HOST}:${PORT}/${path.basename(outputPath)}` });
});

// DELETE /document/page/:pageNumber/delete
app.delete("/document/page/:pageNumber/delete", async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).send("URL is required");
    }
    const pdfDocument = (await loadDocumentFromUrl(url));

    const pageNumber = parseInt(req.params.pageNumber);
    pdfDocument.deletePage(pageNumber);

    const outputBuffer = pdfDocument.saveToBuffer("incremental");
    const outputPath = path.join("public", `output-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBuffer.asUint8Array());
    res.json({ url: `${HOST}:${PORT}/${path.basename(outputPath)}` });
});

// POST /document/page/:pageNumber/rotate
app.post("/document/page/:pageNumber/rotate", async (req, res) => {
    const { url, degrees } = req.body;
    if (!url || !degrees) {
        return res.status(400).send("URL and degrees are required");
    }

    const document = await loadDocumentFromUrl(url);
    const pageNumber = parseInt(req.params.pageNumber);
    const page = document.loadPage(pageNumber);
    const pageObj = page.getObject();

    const rotate = pageObj.getInheritable("Rotate");
    pageObj.put("Rotate", rotate + degrees);

    const outputBuffer = (document).saveToBuffer("incremental");
    const outputPath = path.join("public", `output-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBuffer.asUint8Array());
    res.json({ url: `${HOST}:${PORT}/${path.basename(outputPath)}` });
});

// POST /document/page/:pageNumber/crop
app.post("/document/page/:pageNumber/crop", async (req, res) => {
    const { url, x, y, width, height } = req.body;

    if (!url || x === undefined || y === undefined || !width || !height) {
        return res.status(400).send("URL, x, y, width, and height are required");
    }

    const document = await loadDocumentFromUrl(url);
    const pageNumber = parseInt(req.params.pageNumber);
    const page = document.loadPage(pageNumber);

    page.setPageBox("CropBox", [x, y, x + width, y + height]);

    const outputBuffer = (document).saveToBuffer("incremental");
    const outputPath = path.join("public", `output-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBuffer.asUint8Array());
    res.json({ url: `${HOST}:${PORT}/${path.basename(outputPath)}` });
});

// POST /document/split
app.post("/document/split", async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).send("URL is required");
    }

    const pdfDocument = (await loadDocumentFromUrl(url));

    const splitDocuments = [];

    for (let i = 0; i < pdfDocument.countPages(); i++) {
        const newDoc = new mupdf.PDFDocument();
        newDoc.graftPage(0, pdfDocument, i);
        const buffer = newDoc.saveToBuffer("compress");
        const outputPath = path.join("public", `split-${i}-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, buffer.asUint8Array());
        splitDocuments.push(`${HOST}:${PORT}/${path.basename(outputPath)}`);
    }

    res.json({ urls: splitDocuments });
});

// POST /document/merge
app.post("/document/merge", async (req, res) => {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length < 2) {
        return res.status(400).send("At least two URLs are required");
    }

    const dstDoc = new mupdf.PDFDocument();

    for (const url of urls) {
        const srcDoc = (await loadDocumentFromUrl(url));
        const dstFromSrc = dstDoc.newGraftMap();

        for (let i = 0; i < srcDoc.countPages(); i++) {
            const srcPage = srcDoc.findPage(i);
            const dstPage = dstDoc.newDictionary();

            dstPage.put("Type", dstDoc.newName("Page"));
            if (srcPage.get("MediaBox")) dstPage.put("MediaBox", dstFromSrc.graftObject(srcPage.get("MediaBox")));
            if (srcPage.get("Rotate")) dstPage.put("Rotate", dstFromSrc.graftObject(srcPage.get("Rotate")));
            if (srcPage.get("Resources")) dstPage.put("Resources", dstFromSrc.graftObject(srcPage.get("Resources")));
            if (srcPage.get("Contents")) dstPage.put("Contents", dstFromSrc.graftObject(srcPage.get("Contents")));

            dstDoc.insertPage(-1, dstDoc.addObject(dstPage));
        }
    }

    const buffer = dstDoc.saveToBuffer("compress");
    const outputPath = path.join("public", `merged-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, buffer.asUint8Array());
    res.json({ url: `${HOST}:${PORT}/${path.basename(outputPath)}` });
});
