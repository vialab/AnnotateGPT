import fsPromises from "fs/promises";
import fs from "fs";

export default async function handler(req, res) {
    let action = req.body.action;
    let pid = req.query.pid;

    if (action === "penStroke") {
        let data = req.body.data;
        let path = `./data/${pid}/penStrokeData.csv`;

        if (!fs.existsSync(path)) {
            await fsPromises.mkdir(`./data/${pid}`, { recursive: true });
            await fsPromises.writeFile(path, "id,action,page,startTime,endTime,type,annotatedText,marginalText,svg\n");
        }
        fsPromises.appendFile(path, data + "\n");

        res.status(200).send("Pen stroke data saved!");
    } else if (action === "eraseStroke") {
        let data = req.body.data;
        let path = `./data/${pid}/penStrokeData.csv`;

        if (!fs.existsSync(path)) {
            await fsPromises.mkdir(`./data/${pid}`, { recursive: true });
            await fsPromises.writeFile(path, "id,action,page,timestamp\n");
        }
        fsPromises.appendFile(path, data + `,,,,,\n`);

        res.status(200).send("Erase stroke data saved!");
    } else if (action === "clusterChange" || action.startsWith("reply")) {
        let data = req.body.data;
        let path = `./data/${pid}/clusterData.json`;

        if (!fs.existsSync(path)) {
            await fsPromises.mkdir(`./data/${pid}`, { recursive: true });
            await fsPromises.writeFile(path, "[]");
        }
        let existingData = await fsPromises.readFile(path);
        let objectData = JSON.stringify([...JSON.parse(existingData), JSON.parse(data)], null, 4);

        await fsPromises.writeFile(path, objectData);

        res.status(200).send("Cluster data saved!");
    } else if (action === "openai") {
        let data = req.body.data;
        let path = `./data/${pid}/openaiData.csv`;

        if (!fs.existsSync(path)) {
            await fsPromises.mkdir(`./data/${pid}`, { recursive: true });
            await fsPromises.writeFile(path, "type,timestamp,rawText,imageWithText,imageWithoutText\n");
        }
        await fsPromises.appendFile(path, data + "\n");

        res.status(200).send("OpenAI data saved!");
    }
}