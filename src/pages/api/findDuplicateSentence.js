import { Worker } from 'worker_threads';
import { split } from "sentence-splitter";

export const config = {
    maxDuration: 60,
};

async function runWorker(data) {
    return new Promise((resolve, reject) => {
        let { setUpAnnotatedTokens, lastToken } = data;
        let done2 = 0;
        let executed2 = 0;
        let worker = new Worker("./src/app/components/js/levenshteinDistanceWorker.js");

        const messageQueue = [];
        let activeMessages = 0;
        const maxConcurrentMessages = 4;

        function sendMessageToWorker(message) {
            messageQueue.push({ message });
            processQueue();
        }

        function processQueue() {
            if (activeMessages >= maxConcurrentMessages) {
                return;
            }

            if (messageQueue.length > 0) {
                const { message } = messageQueue.shift();
                activeMessages++;
                worker.postMessage(message);
            }
        }

        worker.on("message", (e) => {
            const distance = e.distance;
            const substring = e.a.length > e.b.length ? e.a : e.b;
            const i = e.i;
            const i2 = e.i2;
            done2++;
            activeMessages--;
            processQueue();
            // console.log("Distance", distance, e.data.a, e.data.b);

            if (distance < substring.length / 2) {
                // console.log("Cut", lastToken.sentence.trim());
                resolve({ duplicate: true, distance, substring, i, i2 });
                worker.terminate();
                return;
            }

            if (done2 === executed2) {
                // console.log("Annotating", lastToken.sentence.trim());
                resolve({ duplicate: false, distance, substring, i, i2 });
                worker.terminate();
            }
        });

        worker.on("error", (error) => {
            worker.terminate();
            reject(error);
        });
        
        for (let i = 0; i < setUpAnnotatedTokens.length - 1; i++) {
            let sentences = setUpAnnotatedTokens[i].sentence.trim();
            let sentencesSplit = split(sentences).map((sentence) => sentence.raw).filter((sentence) => sentence.trim() !== "");
            // console.log("Split", sentencesSplit);

            for (let sentence of sentencesSplit) {
                let sentencesSplit2 = split(lastToken.sentence.trim()).map((sentence) => sentence.raw).filter((sentence) => sentence.trim() !== "");

                for (let sentence2 of sentencesSplit2) {
                    // console.log("Comparing", sentence, "||", sentence2);

                    executed2++;
                    sendMessageToWorker({ a: sentence, b: sentence2, i, i2: setUpAnnotatedTokens.length - 1 });
                }
            }
        }

        if (executed2 === 0) {
            worker.terminate();
        }

        if (setUpAnnotatedTokens.length === 1) {
            resolve({ duplicate: false });
        }
    });
}


export default async function handler(req, res) {
    if (req.method === "POST") {
        let results = await runWorker(req.body.data);
        res.status(200).json(results);
    }
}