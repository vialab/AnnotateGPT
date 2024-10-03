import { createReadStream } from "fs";
import OpenAI from "openai";
import path from "path";

const openai = new OpenAI({apiKey: process.env.NEXT_PUBLIC_OPEN_AI_KEY});
const assistantAnnotateID = process.env.NEXT_PUBLIC_ASSISTANT_ANNOTATE_ID;
let document1ID = process.env.NEXT_PUBLIC_DOCUMENT_ONE_ID, document2ID = process.env.NEXT_PUBLIC_DOCUMENT_TWO_ID;

let loading = false;

export const config = {
    api: {
        bodyParser: false,
    },
    maxDuration: 60,
};

export default async function handler(req, res) {
    if (req.method === "GET") {
        res.status(405).send("GET requests are not allowed");
    } else if (req.method === "POST") {
        let processDocument;
        
        let uploadFile = async (documentID = null, retry = 3) => {
            let waitInterval = 0;

            while (loading && waitInterval < 40) {
                console.log("Waiting...", waitInterval);
                waitInterval++;
                await new Promise(r => setTimeout(r, 500));
            }
            loading = true;
            
            try {
                const annotateAssistant = await openai.beta.assistants.retrieve(assistantAnnotateID);
                let vectorStoreID = annotateAssistant.tool_resources.file_search.vector_store_ids[0];
                
                if (!vectorStoreID) {
                    console.log("Creating vector store...");
    
                    let vectorStore = await openai.beta.vectorStores.create({
                        name: "Pen Annotation vector store",
                    });
                    vectorStoreID = vectorStore.id;
    
                    await openai.beta.assistants.update(annotateAssistant.id, {
                        tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
                    });
                }
                console.log("Deleting document...");
    
                const vectorStoreFiles = await openai.beta.vectorStores.files.list(vectorStoreID);
        
                for (let file of vectorStoreFiles.data) {
                    if ((document1ID && file.id === document1ID) || (document2ID && file.id === document2ID)) {
                        openai.beta.vectorStores.files.del(vectorStoreID, file.id)
                        .catch((error) => {
                            console.error(error.error.message, "in vector store");
                        });
                    } else {
                        openai.files.del(file.id)
                        .catch((error) => {
                            openai.beta.vectorStores.files.del(vectorStoreID, file.id)
                            .catch((error) => {
                                console.error(error.error.message, "in vector store");
                            });
        
                            console.error(error.error.message, "in files");
                        });
                    }
                }
                let fileID;
                
                if (documentID) {
                    console.log("Swapping document...");
                    fileID = documentID;
                } else {
                    console.log("Indexing document...");
                    const file = await openai.files.create({
                        file: processDocument,
                        purpose: "assistants",
                    });
                    fileID = file.id;
                }
                
                const processedFile = await openai.beta.vectorStores.files.createAndPoll(
                    vectorStoreID, 
                    { file_id: fileID },
                    { pollIntervalMs: 500 }
                );
                console.log("Done creating document...");
                loading = false;
    
                if (processedFile.status !== "completed") {
                    throw new Error("Document processing failed");
                } else {
                    res.status(200).send("Updated document!");
                }
                return fileID;
            } catch (error) {
                loading = false;

                if (retry > 0) {
                    console.error("Retrying updateDocument...", retry);
                    console.error(error);
                    return uploadFile(documentID, retry - 1);
                } else {
                    throw error;
                }
            }
        };
        
        try {
            if (req.headers["content-type"] === "application/json") {
                let data = "";
    
                req.on("data", chunk => {
                    data += chunk;
                });

                await new Promise((resolve, reject) => {
                    req.on("end", async () => {
                        try {
                            const jsonData = JSON.parse(data);
        
                            if (typeof jsonData["document"] === "string") {
                                let filePath = jsonData["document"];
                                filePath = filePath.startsWith("./public") ? "./" + filePath.slice(8) : filePath;
                                let currentDocumentID = null;

                                if (filePath.endsWith("Test 1.pdf") && document1ID) {
                                    currentDocumentID = document1ID;
                                } else if (filePath.endsWith("Test 2.pdf") && document2ID) {
                                    currentDocumentID = document2ID;
                                } else {
                                    processDocument = createReadStream(path.resolve("./public", filePath));
                                }

                                let fileID = await uploadFile(currentDocumentID)
                                .catch((error) => {
                                    loading = false;

                                    if (error.error?.message) {
                                        throw new Error("OpenAI: " + error.error?.message);
                                    } else {
                                        throw new Error(error);
                                    }
                                });

                                if (fileID && (!document1ID || !document2ID)) {
                                    if (filePath.endsWith("Test 1.pdf")) {
                                        document1ID = fileID;
                                    } else if (filePath.endsWith("Test 2.pdf")) {
                                        document2ID = fileID;
                                    }
                                }
                            } else {
                                const fileName = jsonData.fileName;
                                const uint8Array = new Uint8Array(jsonData.data);
                                let file = new File([new Blob([uint8Array], { type: "application/pdf" })], fileName);
                                
                                processDocument = file;
                                
                                await uploadFile()
                                .catch((error) => {
                                    loading = false;

                                    if (error.error?.message) {
                                        throw new Error("OpenAI: " + error.error?.message);
                                    } else {
                                        throw new Error(error);
                                    }
                                });
                            }
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });
                });

            } else {
                throw new Error("Not JSON");
            }
        } catch (error) {
            loading = false;
            res.status(500).send("Error updating document: " + error);
        }
    }
}