import fsPromises from "fs/promises";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({apiKey: process.env.NEXT_PUBLIC_OPEN_AI_KEY});
const purposeAssistantID = process.env.NEXT_PUBLIC_ASSISTANT_PURPOSE_ID;

async function updateHistory(dataFilePath) {
    try {
        const purposeAssistant = await openai.beta.assistants.retrieve(purposeAssistantID);
        const vectorStoreID = purposeAssistant.tool_resources?.file_search.vector_store_ids[0];
        
        if (!vectorStoreID) {
            throw new Error("Vector store is not available");
        }
        const file = new File([history.join("")], "history.txt");

        async function deleteFiles() {
            try {
                const vectorStoreFiles = await openai.beta.vectorStores.files.list(vectorStoreID);
        
                for (let file of vectorStoreFiles.data) {
                    openai.files.del(file.id)
                    .catch((error) => {
                        openai.beta.vectorStores.files.del(vectorStoreID, file.id)
                        .catch((error) => {
                            console.error(error.error.message, "in vector store");
                        });

                        console.error(error.error.message, "in files");
                    });
                }
            } catch (error) {
                console.error(error);
            }
        }
        deleteFiles();
    
        const historyFile = await openai.files.create({
            file: file,
            purpose: "assistants",
        });
    
        const vfile = await openai.beta.vectorStores.files.create(
            vectorStoreID,
            { file_id: historyFile.id }
        );
    
        return vfile;
    } catch (error) {
        throw error;
    }
}

let historyStatus = "initial";
let history = ["No history"];

export default async function handler(req, res) {
    if (req.method === "GET") {
        res.status(405).send("GET requests are not allowed");
    } else if (req.method === "POST") {
        const dataFilePath = path.join(process.cwd(), `./history.txt`);

        try {
            let action = req.body.action;

            if (action === "clear") {
                if (historyStatus !== "full") {
                    if (historyStatus === "empty") {
                        res.status(200).send("Initial history file already created!");
                    } else {
                        historyStatus = "empty";
                        // await fsPromises.writeFile(dataFilePath, `No history`);
                        history = ["No history"];
                            
                        await updateHistory(dataFilePath);
                        res.status(200).send("Initial history file created!\n" + history.join(""));
                    }
                } else {
                    res.status(200).send("Initial history file already created!");
                }
            } else if (action === "forceClear") {
                historyStatus = "empty";
                // await fsPromises.writeFile(dataFilePath, `No history`);
                history = ["No history"];
                await updateHistory(dataFilePath);

                res.status(200).send("Initial history file created!\n" + history.join(""));
            
            } else if (action === "update") {
                if (historyStatus === "empty") {
                    // await fsPromises.writeFile(dataFilePath, "");
                    history = [];
                    historyStatus = "full";
                }
                let historyEntry = `Annotation Description: ${req.body.annotationDescription}\nPurpose Title: ${req.body.purposeTitle}\nPurpose: ${req.body.purpose}\n\n`;
                
                if (history[0] === "No history") {
                    history.shift();
                }
                // await fsPromises.appendFile(dataFilePath, historyEntry);
                history.push(historyEntry);
                await updateHistory(dataFilePath);
        
                res.status(200).send("History updated!\n" + history.join(""));
            } else if (action === "comment") {
                if (historyStatus === "empty") {
                    // await fsPromises.writeFile(dataFilePath, "");
                    history = [];
                    historyStatus = "full";
                }
                let historyEntry = `Annotator Comments: ${req.body.comment}\nUser Reply: ${req.body.reply}\n\n`;

                if (history[0] === "No history") {
                    history.shift();
                }
                // await fsPromises.appendFile(dataFilePath, historyEntry);
                history.push(historyEntry);
                await updateHistory(dataFilePath);
        
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
                // await fsPromises.rename(dataFilePath, newFilePath);
    
                res.status(200).send("History file moved!");
            } else {
                res.status(400).send("Invalid action");
            }
        } catch (error) {
            res.status(500).send("Error updating history file: " + error);
        }
    }
}