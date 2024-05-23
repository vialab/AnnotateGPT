import fsPromises from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import OpenAI from "openai";

const dataFilePath = path.join(process.cwd(), "./history.txt");

const openai = new OpenAI({apiKey: process.env.NEXT_PUBLIC_OPEN_AI_KEY});
const purposeAssistantID = process.env.NEXT_PUBLIC_ASSISTANT_PURPOSE_ID;

async function updateHistory() {
    try {
        const purposeAssistant = await openai.beta.assistants.retrieve(purposeAssistantID);
        const vectorStoreID = purposeAssistant.tool_resources?.file_search.vector_store_ids[0];
        
        if (!vectorStoreID) {
            throw new Error("Vector store is not available");
        }
        const file = createReadStream(dataFilePath);

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

export default async function handler(req, res) {
    if (req.method === "GET") {
        res.status(405).send("GET requests are not allowed");
    } else if (req.method === "POST") {
        try {
            let action = req.body.action;

            if (action === "clear") {
                if (historyStatus !== "full") {
                    if (historyStatus === "empty") {
                        res.status(200).send("Initial history file already created!");
                    } else {
                        historyStatus = "empty";
                        await fsPromises.writeFile("history.txt", `No history`);
                            
                        await updateHistory();
                        res.status(200).send("Initial history file created!");
                    }
                } else {
                    res.status(200).send("Initial history file created!");
                }
            } else if (action === "update") {
                if (historyStatus === "empty") {
                    await fsPromises.writeFile("history.txt", "");
                    historyStatus = "full";
                }
                let historyEntry = `Annotation Description: ${req.body.annotationDescription}\nPurpose Title: ${req.body.purposeTitle}\nPurpose: ${req.body.purpose}\n\n`;
        
                await fsPromises.appendFile(dataFilePath, historyEntry);
                await updateHistory();
        
                res.status(200).send("History updated!");
            } else {
                res.status(400).send("Invalid action");
            }
        } catch (error) {
            res.status(500).send("Error updating history file: " + error);
        }
    }
}