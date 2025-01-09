import { Worker } from "worker_threads";
import path from "path";

export const config = {
    maxDuration: 60,
};

const workerUrl = path.resolve("./src/workers/findSimilarStringWorker.js");

function runWorker(data) {
    let { text, textContent } = data;

    return new Promise((resolve, reject) => {
        const target = text;

        let minDistance = Infinity;
        let done = 0;
        let executed = 0;
        let pageNumber = 0;
        let substring = "";
        let ifSinglePage = true;

        let worker = new Worker(workerUrl);

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

        for (let i = 0; i < textContent.length - 1; i++) {
            if (textContent[i].length === 0 || textContent[i + 1].length === 0) {
                continue;
            }
            let currPageSlice = textContent[i].slice(-text.length);
            let nextPageSlice = textContent[i + 1].slice(0, text.length);
            let fullPage = currPageSlice + " " + nextPageSlice;
            fullPage = fullPage.replace(/\s+/g, " ");

            executed++;
            sendMessageToWorker({ text: fullPage, target: target, sameLength: false, index: i });
        }
        
        for (let i = 0; i < textContent.length; i++) {
            let pageText = textContent[i];

            if (pageText === "") {
                continue;
            }
            pageText = pageText.replace(/\s+/g, " ");

            executed++;
            sendMessageToWorker({ text: pageText, target: target, sameLength: true, index: i });
        }
        
        worker.on("message", (result) => {
            activeMessages--;
            processQueue();
            done++;

            if (result !== null) {
                let distance = result[1];

                if (distance < minDistance) {
                    minDistance = distance;
                    substring = result[0];
                    pageNumber = result[2];
                    ifSinglePage = result[3];
                }
            }
            
            if (done === executed) {
                worker.terminate();
                resolve({substring, minDistance, pageNumber, ifSinglePage});
            }
        });

        worker.on("error", (error) => {
            worker.terminate();
            reject(error);
        });
    });
}

export default async function handler(req, res) {
    if (req.method === "POST") {
        const result = await runWorker(req.body.data);
        res.status(200).json(result);
    }
} 