import fsPromises from "fs/promises";
import path from "path";
import OpenAI from "openai";

export const config = {
    maxDuration: 60,
};

const openai = new OpenAI({apiKey: process.env.NEXT_PUBLIC_OPEN_AI_KEY});
const vectorStoreID = process.env.NEXT_PUBLIC_PURPOSE_VECTOR_STORE;

async function updateHistory(retry = 3) {
    try {
        const file = new File([history.join("")], "history.txt");

        async function deleteFiles() {
            try {
                const vectorStoreFiles = await openai.vectorStores.files.list(vectorStoreID);
                const promises = [];
        
                for (let file of vectorStoreFiles.data) {
                    let p = openai.vectorStores.files.delete(file.id, { vector_store_id: vectorStoreID })
                    .catch((error) => {
                        console.error(error.error.message, "in vector store");
                    });
                    promises.push(p);

                    p = openai.files.delete(file.id)
                    .catch((error) => {
                        console.error(error.error.message, "in files");
                    });
                    promises.push(p);
                }
                await Promise.all(promises);
            } catch (error) {
                console.error(error);
            }
        }
        await deleteFiles()
        .catch((error) => {
            console.error(error);
        });

        let files = await openai.vectorStores.files.list(vectorStoreID);
        let emptyRetry = 0;

        while (files.data.length !== 0) {
            await new Promise(r => setTimeout(r, 1000));
            files = await openai.vectorStores.files.list(vectorStoreID);
            emptyRetry++;

            if (emptyRetry > 30) {
                console.error("Failed to delete history files");
                break;
            }
        }
        let vectorStore = await openai.vectorStores.retrieve(vectorStoreID);
    
        while (vectorStore.status !== "completed") {
            await new Promise(r => setTimeout(r, 1000));
            vectorStore = await openai.vectorStores.retrieve(vectorStoreID);
            console.log("Checking history vector store status...", vectorStore.status);
        }
    
        const historyFile = await openai.files.create({
            file: file,
            purpose: "user_data",
        });
    
        const vfile = await openai.vectorStores.files.createAndPoll(
            vectorStoreID,
            { file_id: historyFile.id },
            { pollIntervalMs: 500 }
        );

        if (vfile.status !== "completed") {
            throw new Error("History not completed");
        }
        return vfile;
    } catch (error) {
        if (retry > 0) {
            console.error("Retrying updateHistory...", retry);
            return await updateHistory(retry - 1);
        } else {
            throw error;
        }
    }
}

let historyStatus = "initial";
let history = ["No history"];
let done = false;

export default async function handler(req, res) {
    if (req.method === "GET") {
        res.status(200).send(history.join(""));
    } else if (req.method === "POST") {
        const dataFilePath = path.join(process.cwd(), `./history.txt`);
        let waitInterval = 0;

        while (done && waitInterval < 40) {
            waitInterval++;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        done = true;

        try {
            let action = req.body.action;

            if (action === "clear") {
                if (historyStatus !== "full") {
                    if (historyStatus === "empty") {
                        res.status(200).send("Initial history file already created!");
                    } else {
                        historyStatus = "empty";
                        history = ["No history"];
                            
                        await updateHistory();
                        res.status(200).send("Initial history file created!\n" + history.join(""));
                    }
                } else {
                    res.status(200).send("Initial history file already created!");
                }
            } else if (action === "forceClear") {
                historyStatus = "empty";
                history = ["No history"];
                await updateHistory();

                res.status(200).send("Initial history file created!\n" + history.join(""));
            
            } else if (action === "update" || action === "update2") {
                if (historyStatus === "empty") {
                    history = [];
                    historyStatus = "full";
                }
                let historyEntry = `Annotation Description: ${req.body.annotationDescription}\nPurpose Title: ${req.body.purposeTitle}\nPurpose: ${req.body.purpose}\n\n`;
                
                if (history[0] === "No history") {
                    history.shift();
                }
                history.push(historyEntry);

                if (action === "update") {
                    await updateHistory();
                }
                res.status(200).send("History updated!\n" + history.join(""));
            } else if (action === "comment" || action === "comment2") {
                if (historyStatus === "empty") {
                    history = [];
                    historyStatus = "full";
                }
                let historyEntry = `Annotator Comments: ${req.body.comment}\nUser Reply: ${req.body.reply}\n\n`;

                if (history[0] === "No history") {
                    history.shift();
                }
                history.push(historyEntry);

                if (action === "comment") {
                    await updateHistory();
                }
                res.status(200).send("History updated!\n" + history.join(""));
            } else if (action === "move") {
                const pid = req.body.pid;
                let fileName = "history";
                let fileExists = false;
                let i = 1;
                let newFileName = fileName;

                while (!fileExists) {
                    try {
                        await fsPromises.access(path.join(process.cwd(), `./data/${pid}/${newFileName}.txt`));
                        newFileName = `${fileName} (${i})`;
                        i++;
                    } catch (error) {
                        fileExists = true;
                    }
                }
                const newFilePath = path.join(process.cwd(), `./data/${pid}/${newFileName}.txt`);
                await fsPromises.writeFile(newFilePath, history.join(""));
    
                res.status(200).send("History file moved!");
            } else if (action === "upload") {
                await updateHistory();
                res.status(200).send("History file uploaded!\n" + history.join(""));
            } else {
                res.status(400).send("Invalid action");
            }
            done = false;
        } catch (error) {
            done = false;
            
            res.status(500).send("Error updating history file: " + error);
        }
    }
}