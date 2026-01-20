import { createReadStream } from "fs";
import OpenAI from "openai";
import path from "path";

const openai = new OpenAI({apiKey: process.env.NEXT_PUBLIC_OPEN_AI_KEY});
const vectorStoreID = process.env.NEXT_PUBLIC_ANNOTATE_VECTOR_STORE;
let document1ID = process.env.NEXT_PUBLIC_DOCUMENT_ONE_ID, document2ID = process.env.NEXT_PUBLIC_DOCUMENT_TWO_ID, practiceDocumentID = process.env.NEXT_PUBLIC_PRACTICE_DOCUMENT_ID;

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
                waitInterval++;
                await new Promise(r => setTimeout(r, 500));
            }
            loading = true;
            
            try {
                const vectorStoreFiles = await openai.vectorStores.files.list(vectorStoreID);
                const promises = [];
        
                for (let file of vectorStoreFiles.data) {
                    let p;

                    if ((document1ID && file.id === document1ID) || (document2ID && file.id === document2ID) || (practiceDocumentID && file.id === practiceDocumentID)) {
                        if (documentID !== file.id) {
                            p = openai.vectorStores.files.delete(file.id, { vector_store_id: vectorStoreID })
                            .catch((error) => {
                                console.error(error.error.message, "in vector store");
                            });
                        }
                    } else {
                        openai.files.delete(file.id)
                        .catch((error) => {
                            p = openai.vectorStores.files.delete(file.id, { vector_store_id: vectorStoreID })
                            .catch((error) => {
                                console.error(error.error.message, "in vector store");
                            });
        
                            console.error(error.error.message, "in files");
                        });
                    }
                    promises.push(p);
                }
                await Promise.all(promises);
                let vectorStore = await openai.vectorStores.retrieve(vectorStoreID);
            
                while (vectorStore.status !== "completed") {
                    await new Promise(r => setTimeout(r, 1000));
                    vectorStore = await openai.vectorStores.retrieve(vectorStoreID);
                }
                let fileID;
                
                if (documentID) {
                    fileID = documentID;
                } else {
                    const file = await openai.files.create({
                        file: processDocument,
                        purpose: "user_data",
                    });
                    fileID = file.id;
                }
                
                const processedFile = await openai.vectorStores.files.createAndPoll(
                    vectorStoreID, 
                    { file_id: fileID },
                    { pollIntervalMs: 500 }
                );
                loading = false;
    
                if (processedFile.status !== "completed") {
                    throw new Error("Document processing failed");
                } else {
                    let files = await openai.vectorStores.files.list(vectorStoreID);
                    let emptyRetry = 0;

                    while (files.data.length !== 1) {
                        await new Promise(r => setTimeout(r, 1000));
                        files = await openai.vectorStores.files.list(vectorStoreID);
                        emptyRetry++;
            
                        if (emptyRetry > 30) {
                            break;
                        }

                        if (files.data.length === 0) {
                            throw new Error("Vector store empty");
                        }
                    }
                    res.status(200).send("Updated document!");
                }
                return fileID;
            } catch (error) {
                loading = false;

                if (retry > 0) {
                    console.error(error.toString());
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
                                } else if (filePath.endsWith("Practice.pdf") && practiceDocumentID) {
                                    currentDocumentID = practiceDocumentID;
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

                                if (fileID && (!document1ID || !document2ID || !practiceDocumentID)) {
                                    if (filePath.endsWith("Test 1.pdf")) {
                                        document1ID = fileID;
                                    } else if (filePath.endsWith("Test 2.pdf")) {
                                        document2ID = fileID;
                                    } else if (filePath.endsWith("Practice.pdf")) {
                                        practiceDocumentID = fileID;
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