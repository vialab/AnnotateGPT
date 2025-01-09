const { parentPort, Worker } = require("worker_threads");
const path = require("path");

const workerUrl = path.resolve("./src/workers/levenshteinDistanceWorker.js");

parentPort.on("message", (e) => {
    let text = e.text;
    let target = e.target;
    let sameLength = e.sameLength;
    let index = e.index;
    let minDistance = Infinity;
    let mostSimilar = "";
    
    let done = 0;
    let executed = 0;
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

    if (text.length < target.length) {
        worker.terminate();
        parentPort.postMessage(null);
    }
    
    if (sameLength) {
        for (let i = 0; i <= text.length - target.length; i++) {
            let substring = text.substring(i, i + target.length);
            
            if ((i !== 0 && text[i - 1] !== " ") || substring[0] === " ") {
                continue;
            }
            executed++;
            sendMessageToWorker({ a: substring, b: target });
        }
    } else {
        for (let length = target.length; length <= text.length; length++) {
            for (let i = 0; i <= text.length - length; i++) {
                const substring = text.substring(i, i + length);
                
                if ((i !== 0 && text[i - 1] !== " ") || substring[0] === " ") {
                    continue;
                }
                executed++;
                sendMessageToWorker({ a: substring, b: target });
            }
        }
    }

    worker.on("message", (e) => {
        activeMessages--;
        processQueue();
        const distance = e.distance;
        const substring = e.a;
        // const target = e.data.b;
        
        if (distance < minDistance) {
            minDistance = distance;
            mostSimilar = substring;
        }
        done++;

        if (!sameLength && done === executed) {
            worker.terminate();
            parentPort.postMessage([mostSimilar, minDistance, index, sameLength]);
        } else if (sameLength && done === executed) {
            worker.terminate();
            parentPort.postMessage([mostSimilar, minDistance, index, sameLength]);
        }
    });

    worker.on("error", (error) => {
        worker.terminate();
        console.error(error);
    });
});