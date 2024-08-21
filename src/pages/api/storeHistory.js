import fsPromises from "fs/promises";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({apiKey: process.env.NEXT_PUBLIC_OPEN_AI_KEY});
const purposeAssistantID = process.env.NEXT_PUBLIC_ASSISTANT_PURPOSE_ID;

async function updateHistory(retry = 3) {
    try {
        const purposeAssistant = await openai.beta.assistants.retrieve(purposeAssistantID);
        let vectorStoreID = purposeAssistant.tool_resources?.file_search.vector_store_ids[0];
        
        if (!vectorStoreID) {
            console.log("Creating vector store...");
            
            let vectorStore = await openai.beta.vectorStores.create({
                name: "Pen Purpose vector store",
            });
            vectorStoreID = vectorStore.id;

            await openai.beta.assistants.update(purposeAssistant.id, {
                tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
            });
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
        deleteFiles()
        .catch((error) => {
            console.error(error);
        });
    
        const historyFile = await openai.files.create({
            file: file,
            purpose: "assistants",
        });
    
        const vfile = await openai.beta.vectorStores.files.createAndPoll(
            vectorStoreID,
            { file_id: historyFile.id },
            { pollIntervalMs: 500 }
        );

        if (vfile.status !== "completed") {
            throw new Error("Vector file not completed");
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

        while (done) {
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
                        // await fsPromises.writeFile(dataFilePath, `No history`);
                        history = ["No history"];
                            
                        await updateHistory();
                        res.status(200).send("Initial history file created!\n" + history.join(""));
                    }
                } else {
                    res.status(200).send("Initial history file already created!");
                }
            } else if (action === "forceClear") {
                historyStatus = "empty";
                // await fsPromises.writeFile(dataFilePath, `No history`);
                history = ["No history"];
                await updateHistory();

                res.status(200).send("Initial history file created!\n" + history.join(""));
            
            } else if (action === "update" || action === "update2") {
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

                if (action === "update") {
                    await updateHistory();
                }
                res.status(200).send("History updated!\n" + history.join(""));
            } else if (action === "comment" || action === "comment2") {
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
                // await fsPromises.rename(dataFilePath, newFilePath);
    
                res.status(200).send("History file moved!");
            } else if (action === "upload") {
                await updateHistory();
                res.status(200).send("History file uploaded!\n" + history.join(""));
            } else {
                res.status(400).send("Invalid action");
            }
            done = false;
        } catch (error) {
            console.log(history);
            done = false;
            
            res.status(500).send("Error updating history file: " + error);
        }
    }
}