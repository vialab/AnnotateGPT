import { createReadStream } from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({apiKey: process.env.NEXT_PUBLIC_OPEN_AI_KEY});
const assistantAnnotateID = process.env.NEXT_PUBLIC_ASSISTANT_ANNOTATE_ID;

let loading = false;

export default async function handler(req, res) {
    if (req.method === "GET") {
        res.status(405).send("GET requests are not allowed");
    } else if (req.method === "POST") {
        try {
            while (loading) {
                await new Promise(r => setTimeout(r, 500));
            }
            loading = true;
            let document = req.body.document;

            const annotateAssistant = await openai.beta.assistants.retrieve(assistantAnnotateID);
            let vectorStoreID = annotateAssistant.tool_resources.file_search.vector_store_ids[0];
            let vectorStore;
            
            if (vectorStoreID) {
                vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreID);
            } else {
                vectorStore = await openai.beta.vectorStores.create({
                    name: "Pen Annotation vector store",
                });
            }
            const vectorStoreFiles = await openai.beta.vectorStores.files.list(vectorStoreID);

            for (let file of vectorStoreFiles.data) {
                openai.files.del(file.id)
                .catch((error) => {
                    console.error(error.error.message, "in files");
                });
            }
            
            const file = await openai.files.create({
                file: createReadStream(document),
                purpose: "assistants",
            });

            await openai.beta.vectorStores.files.createAndPoll(
                vectorStoreID, {
                    file_id: file.id
                }
            );
            loading = false;
            res.status(200).send("Updated document!");
        } catch (error) {
            res.status(500).send("Error updating document: " + error);
        }
        
    }
}