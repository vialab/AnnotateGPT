import fsPromises from "fs/promises";
import fs from "fs";

let doneCluster = false;
let doneOpenAI = false;
let donePenStroke = false;

export default async function handler(req, res) {
    let action = req.body.action;
    let pid = req.query.pid;

    if (action === "penStroke") {
        while (donePenStroke) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        donePenStroke = true;
        
        let data = req.body.data;
        let path = `./data/${pid}/penStrokeData.csv`;

        if (!fs.existsSync(path)) {
            await fsPromises.mkdir(`./data/${pid}`, { recursive: true });
            await fsPromises.writeFile(path, `${req.body.screen.width} ${req.body.screen.height}\nid,action,page,startTime,endTime,type,annotatedText,marginalText,svg\n`);
        }
        await fsPromises.appendFile(path, data + "\n");
        donePenStroke = false;

        res.status(200).send("Pen stroke data saved!");
    } else if (action === "eraseStroke") {
        while (donePenStroke) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        donePenStroke = true;

        let data = req.body.data;
        let path = `./data/${pid}/penStrokeData.csv`;

        if (!fs.existsSync(path)) {
            await fsPromises.mkdir(`./data/${pid}`, { recursive: true });
            await fsPromises.writeFile(path, `${req.body.screen.width} ${req.body.screen.height}\nid,action,page,startTime,endTime,type,annotatedText,marginalText,svg\n`);
        }
        await fsPromises.appendFile(path, data + `,,,,,\n`);
        donePenStroke = false;

        res.status(200).send("Erase stroke data saved!");
    } else if (action === "clusterChange" || action.startsWith("reply")) {
        while (doneCluster) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        doneCluster = true;

        let data = req.body.data;
        let path = `./data/${pid}/clusterData.json`;

        if (!fs.existsSync(path)) {
            await fsPromises.mkdir(`./data/${pid}`, { recursive: true });
            await fsPromises.writeFile(path, "[]");
        }
        let existingData = await fsPromises.readFile(path);
        let objectData = JSON.stringify([...JSON.parse(existingData), JSON.parse(data)], null, 4);

        await fsPromises.writeFile(path, objectData);
        doneCluster = false;

        res.status(200).send("Cluster data saved!");
    } else if (action === "openai") {
        while (doneOpenAI) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        doneOpenAI = true;

        let data = req.body.data;
        let path = `./data/${pid}/openaiData.csv`;

        if (!fs.existsSync(path)) {
            await fsPromises.mkdir(`./data/${pid}`, { recursive: true });
            await fsPromises.writeFile(path, "clusterID,type,timestamp,rawText,imageWithText,imageWithoutText\n");
        }
        await fsPromises.appendFile(path, data + "\n");
        doneOpenAI = false;

        res.status(200).send("OpenAI data saved!");
    }
}