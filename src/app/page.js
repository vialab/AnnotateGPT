"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import localFont from "next/font/local";
import dynamic from "next/dynamic";
import { parse } from "csv-parse";
import * as d3 from "d3";
import { ToastContainer, toast, Flip } from "react-toastify";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, inMemoryPersistence } from "firebase/auth";
import { getFirestore, addDoc, collection } from "firebase/firestore";
import AnimatedCursor from "react-animated-cursor";
import AnnotateGPT from "./components/AnnotateGPT.js";

import { Cluster } from "./components/js/PenCluster.js";

// const AnnotateGPT = dynamic(() => import("../app/components/AnnotateGPT.js"), { ssr: false, });

// import AnnotateGPT from "../app/components/AnnotateGPT.js";
import Header from "../app/components/Header.js";
import StudyModal from "../app/components/StudyModal.js";

export const googleSans = localFont({
    src: "./components/css/googlesans.woff2",
    display: "swap",
});

const firebaseConfig = {
    apiKey: "AIzaSyBFTj4CgTWa3to76N_mk7C4EzUABSP1pLM",
    authDomain: "annotategpt.firebaseapp.com",
    projectId: "annotategpt",
    storageBucket: "annotategpt.appspot.com",
    messagingSenderId: "855106191363",
    appId: "1:855106191363:web:d74b397557f6eac8d84e36"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

setPersistence(auth, inMemoryPersistence);

const MAX_RETRIES = 3;

const retry = async (fn, retriesLeft = MAX_RETRIES, interval = 500) => {
    try {
        return await fn();
    } catch (error) {
        if (retriesLeft === 0) 
            throw error;
        console.log(`Retrying... attempts left: ${retriesLeft}`);
        await new Promise(res => setTimeout(res, interval));
        return retry(fn, retriesLeft - 1, interval);
    }
};

export default function Home() {
    const [state, setState] = useState("home");
    const [svgContent, setSvgContent] = useState([]);
    const [screen, setScreen] = useState({ width: 0, height: 0 });
    const [document, setDocument] = useState("./public/Test 1.pdf");
    const [mode, setMode] = useState("llm");
    const [disableNext, setDisableNext] = useState(true);
    const [toastMessage, setToastMessage] = useState("");
    const [handiness, setHandiness] = useState("right");
    const [disabled, setDisabled] = useState(false);

    const studyModalRef = useRef(null);
    const success = useRef(false);
    const homeLLM = useRef(true);
    const homeDocument = useRef("./public/Test 1.pdf");
    const practiceMessage = useRef([
        [
            "Make an annotation",
            "Activate assistant by tapping the annotation with your finger",
            "Generate annotations using your assistant (You can hover the options for an explanation with the pen)",
            "Tap the annotations with your finger to navigate them or use the arrows",
            "Accept or reject an annotation",
        ],
        [
            "Make an annotation",
        ]
    ]);
    const practiceMessageIndex = useRef(0);
    const modeRef = useRef(mode);
    const annotationeRef = useRef(null);
    const userRef = useRef(null);

    if (!success.current && typeof window !== "undefined") {
        success.current = true;

        fetch("/api/storeHistory", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "clear",
            })
        })
        .then(res => {
            if (!res.ok)
                return res.text().then(text => { throw new Error(text); });
            return res.text();
        })
        .then(data => {
            console.log(data);
        })
        .catch(err => {
            console.error("clearStoreHistory:", err);

            toast.error("clearStoreHistory: " + err.toString().replaceAll("Error: ", ""), {
                toastId: "clearStoreHistory",
                containerId: "errorMessage"
            });
            success.current = false;
        });
    }

    let startStudy = useCallback(() => {
        setState("study");
        setDocument("./public/Practice.pdf");
        setMode("practiceLLM");
        practiceMessageIndex.current = 0;
        setToastMessage(practiceMessage.current[0][0]);

        studyModalRef.current?.setIfFirst(true);
        studyModalRef.current?.setLlmFirst(true);

        fetch("/api/storeHistory", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "forceClear",
            })
        })
        .then(res => {
            if (!res.ok)
                return res.text().then(text => { throw new Error(text); });
            return res.text();
        })
        .then(data => {
            console.log(data);
        })
        .catch(err => {
            console.error("clearStoreHistory:", err);

            toast.error("clearStoreHistory: " + err.toString().replaceAll("Error: ", ""), {
                toastId: "clearStoreHistory",
                containerId: "errorMessage"
            });
        });
    }, []);

    let moveHistory = useCallback(() => {
        if (typeof modeRef.current === "string" && modeRef.current.toLowerCase() === "llm") {
            if (!process.env.NEXT_PUBLIC_VERCEL_ENV) {
                let pid = studyModalRef.current?.pid ?? "test";

                fetch("/api/storeHistory", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        action: "move",
                        pid: state + modeRef.current.toLowerCase() + pid
                    })
                })
                .then(res => {
                    if (!res.ok)
                        return res.text().then(text => { throw new Error(text); });
                    return res.text();
                })
                .then(data => {
                    console.log(data);
                })
                .catch(err => {
                    console.error("moveHistory:", err);

                    toast.error("moveHistory: " + err.toString().replaceAll("Error: ", ""), {
                        toastId: "moveHistory",
                        containerId: "errorMessage"
                    });
                });
            } else {
                if (userRef.current) {
                    try {
                        fetch("/api/storeHistory", {
                            method: "GET",
                        }).then(res => {
                            if (!res.ok)
                                return res.text().then(text => { throw new Error(text); });
                            return res.text();
                        }).then(data => {
                            const pid = studyModalRef.current?.pid ?? "test";
                            const userDocRef = collection(db, userRef.current.uid, state + modeRef.current.toLowerCase() + pid, "history");
                            const userData = {
                                history: data,
                                pid: studyModalRef.current?.pid ?? "test",
                                timestamp: Date.now()
                            };

                            retry(() => {
                                addDoc(userDocRef, userData)
                                .then(() => {
                                    console.log("User data stored successfully");
                                })
                                .catch((err) => {
                                    console.error("sendData:", err);

                                    toast.error("sendData: " + err.toString().replaceAll("Error: ", ""), {
                                        toastId: "sendData",
                                        containerId: "errorMessage"
                                    });
                                });
                            });
                        }).catch(err => {
                            console.error("getHistory:", err);

                            toast.error("getHistory: " + err.toString().replaceAll("Error: ", ""), {
                                toastId: "getHistory",
                                containerId: "errorMessage"
                            });
                        });
                    } catch (err) {
                        console.error("sendData:", err);

                        toast.error("sendData: " + err.toString().replaceAll("Error: ", ""), {
                            toastId: "sendData",
                            containerId: "errorMessage"
                        });
                    }
                }
            }
        }
    }, [state]);

    let onFinish = useCallback(() => {
        setState("home");

        moveHistory();
    }, [moveHistory]);

    const documents = ["./public/Test 1.pdf", "./public/Test 2.pdf"];
    // const llmOrder = [true, false];

    let checkTask = () => {
        let continueStudy = true;

        if (typeof modeRef.current === "string" && !modeRef.current.toLowerCase().includes("practice")) {
            let strokesFound = false;
            let annotationsFound = false;
            let annotating = false;
            let uncompletedPages = new Set();

            for (let i = 0; i < annotationeRef.current.penAnnotation.length; i++) {
                let penAnnotation = annotationeRef.current?.penAnnotation[i]?.current;
                
                if (penAnnotation.clusters?.current && penAnnotation.lockClusters?.current) {
                    for (let cluster of [...penAnnotation.clusters.current, ...penAnnotation.lockClusters.current]) {

                        if (cluster.strokes.length > 1 || (cluster.strokes.length > 0 && cluster.strokes[0].id !== "initial")) {
                            strokesFound = true;
                        }

                        if (cluster.annotating) {
                            annotating = true;
                        }

                        if (cluster.annotationsFound) {
                            annotationsFound = true;

                            for (let annotation of cluster.annotationsFound) {
                                if (annotation.accepted === undefined || annotation.accepted === null) {
                                    for (let span of annotation.spans) {
                                        let pageContainer = span.closest(".react-pdf__Page");

                                        if (pageContainer) {
                                            let pageNumber = d3.select(pageContainer).attr("data-page-number");
                                            uncompletedPages.add(pageNumber);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            if (strokesFound && (annotationsFound || !modeRef.current.toLowerCase().includes("llm")) && !annotating && uncompletedPages.size === 0) {
                continueStudy = true;
            } else {
                continueStudy = <>
                    <h3 style={{ textAlign: "center" }}>Uncompleted tasks:</h3>
                    <ul>
                        { strokesFound ? null : <li>Must make at least one annotation</li> }
                        { (annotationsFound || !modeRef.current.toLowerCase().includes("llm")) ? null : <li>Must use the assistance at least once</li> }
                        { annotating ? <li>Assistance is still annotating</li> : null }
                        { (uncompletedPages.size > 0 && modeRef.current.toLowerCase().includes("llm")) ? <li>You did not rate all annotations on page: {[...uncompletedPages].sort((a, b) => a - b).join(", ")}</li> : null }
                    </ul>
                </>;
            }
        }
        return continueStudy;
    };

    let onNextTask = (taskNum, nextMode) => {
        moveHistory();
        setDisabled(false);
        toast.dismiss({
            id: "remindMessage"
        });
        
        if (taskNum >= 0 && taskNum < documents.length) {
            setDocument(documents[taskNum]);
            setMode(nextMode);

            setToastMessage(null);
            
            setDisableNext(false);
            // practiceMessageIndex.current = 0;
            // console.log("Test")
        } else {
            setDocument("./public/Practice.pdf");
            setMode("practice" + nextMode);
            
            practiceMessageIndex.current = 0;

            if (typeof mode === "string") {
                let messages;
                
                if (mode.toLowerCase().includes("llm")) {
                    messages = practiceMessage.current[0];
                } else {
                    messages = practiceMessage.current[1];
                }
                setToastMessage(messages[0]);
                setDisableNext(true);
            }
        }
    };

    let documentChange = (taskNum) => {
        setDocument(documents[taskNum]);
    };

    let modeChange = (mode) => {
        setMode(mode);

        practiceMessageIndex.current = 0;

        if (typeof mode === "string" && mode.toLowerCase().includes("practice")) {
            let messages;
            
            if (mode.toLowerCase().includes("llm")) {
                messages = practiceMessage.current[0];
            } else {
                messages = practiceMessage.current[1];
            }
            setToastMessage(messages[0]);
            setDisableNext(true);
        }
        modeRef.current = mode;
    };

    let handinessChange = (handiness) => {
        setHandiness(handiness);
    };

    let disabledChange = (disabled) => {
        setDisabled(disabled);
    };

    let sendData = (body) => {
        if (typeof modeRef.current === "string" && !modeRef.current.toLowerCase().includes("practice")) {
            if (!process.env.NEXT_PUBLIC_VERCEL_ENV) {
                let pid = studyModalRef.current?.pid ?? "test";

                fetch("/api/" + state + modeRef.current.toLowerCase() + pid + "/data", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: body
                })
                .then(res => {
                    if (!res.ok)
                        return res.text().then(text => { throw new Error(text); });
                    return res.text();
                })
                .then(data => {
                    console.log(data);
                })
                .catch(err => {
                    console.error("sendData:", err);

                    toast.error("sendData: " + err.toString().replaceAll("Error: ", ""), {
                        toastId: "sendData",
                        containerId: "errorMessage"
                    });
                });
            } else {
                if (userRef.current) {
                    try {
                        const pid = studyModalRef.current?.pid ?? "test";
                        const userDocRef = collection(db, userRef.current.uid, state + modeRef.current.toLowerCase() + pid, "data");

                        const userData = {
                            ...JSON.parse(body),
                            pid: studyModalRef.current?.pid ?? "test",
                        };

                        retry(() => {
                            addDoc(userDocRef, userData)
                            .then(() => {
                                console.log("User data stored successfully");
                            })
                            .catch((err) => {
                                console.error("sendData:", err);

                                toast.error("sendData: " + err.toString().replaceAll("Error: ", ""), {
                                    toastId: "sendData",
                                    containerId: "errorMessage"
                                });
                            });
                        });
                    } catch (err) {
                        console.error("sendData:", err);

                        toast.error("sendData: " + err.toString().replaceAll("Error: ", ""), {
                            toastId: "sendData",
                            containerId: "errorMessage"
                        });
                    }
                }
            }
        };
    };

    let updatePracticeMessages = (currentIndex) => {
        if (typeof modeRef.current === "string" && modeRef.current.toLowerCase().includes("practice") && practiceMessageIndex.current === currentIndex) {
            let messages;
            
            if (modeRef.current.toLowerCase().includes("llm")) {
                messages = practiceMessage.current[0];
            } else {
                messages = practiceMessage.current[1];
            }

            if (practiceMessageIndex.current + 1 < messages.length) {
                setToastMessage(messages[practiceMessageIndex.current + 1]);
                practiceMessageIndex.current += 1;
            } else {
                setToastMessage("Click the top left button to continue, or continue practicing");
                setDisableNext(false);
            }
        }
    };

    let penEndCallback = (param) => {
        let annotatedText = param.stroke.annotatedText.map(element => element.textContent).join(" ").replace(/"/g, `""`);
        let marginalText = param.stroke.marginalText.map(element => element.textContent).join(" ").replace(/"/g, `""`);

        let strokeData = `${param.path.id},createStroke,${param.page},${param.stroke.startTime},${param.stroke.endTime},${param.stroke.type},"${annotatedText}","${marginalText}","${JSON.stringify(param.stroke.textBbox).replace(/"/g, `""`)}","${JSON.stringify(param.stroke.marginalTextBbox).replace(/"/g, `""`)}","${JSON.stringify(param.stroke.lineBbox).replace(/"/g, `""`)}","${param.path.outerHTML.replace(/"/g, `""`)}"`;
        let bbox = d3.select(".page-container").node().getBoundingClientRect();

        updatePracticeMessages(0);

        sendData(JSON.stringify({
            action: "penStroke",
            data: strokeData,
            screen: {
                width: bbox.width,
                height: bbox.height
            }
        }));
    };

    let onEraseCallback = (param) => {
        let strokeData = `${param.id},eraseStroke,${param.page},${Date.now()}`;

        sendData(JSON.stringify({
            action: "eraseStroke",
            data: strokeData
        }));
    };

    let onInferenceCallback = (startTimetamp, cluster, rawText, images) => {
        let timestamp = Date.now();

        let clusterData = JSON.stringify(cluster, (key, value) => {
            if (key === "annotatedText" || key === "marginalText" || key === "spans" || key === "targetSpans") {
                return typeof value === "string" ? value : value.map(element => element.textContent).join(" ");
            } else {
                return value;
            }
        });
        clusterData = JSON.stringify({...JSON.parse(clusterData), actionType: "inference", actionTimestamp: timestamp});

        updatePracticeMessages(1);

        sendData(JSON.stringify({
            action: "clusterChange",
            data: clusterData
        }));

        let inferenceData = `${startTimetamp},${cluster.strokes[cluster.strokes.length - 1].id},inference,${timestamp},"${rawText.replace(/"/g, `""`)}","${images[0]}","${images[1]}"`;

        sendData(JSON.stringify({
            action: "openai",
            data: inferenceData
        }));
    };

    let onEndAnnotateCallback = (startTimetamp, cluster, rawText) => {
        let timestamp = Date.now();

        let clusterData = JSON.stringify(cluster, (key, value) => {
            if (key === "annotatedText" || key === "marginalText" || key === "spans" || key === "targetSpans") {
                return typeof value === "string" ? value : value.map(element => element.textContent).join(" ");
            } else {
                return value;
            }
        });
        clusterData = JSON.stringify({...JSON.parse(clusterData), actionType: "annotate", actionTimestamp: timestamp});

        updatePracticeMessages(2);

        sendData(JSON.stringify({
            action: "clusterChange",
            data: clusterData
        }));

        let annotateData = `${startTimetamp},${cluster.strokes[cluster.strokes.length - 1].id},annotate,${timestamp},"${rawText.replace(/"/g, `""`)}",,`;

        sendData(JSON.stringify({
            action: "openai",
            data: annotateData
        }));
    };

    let navigateCallback = () => {
        updatePracticeMessages(3);
    };
    
    let onReplyCallback = (cluster, type) => {
        let timestamp = Date.now();

        let clusterData = JSON.stringify(cluster, (key, value) => {
            if (key === "annotatedText" || key === "marginalText" || key === "spans" || key === "targetSpans") {
                return typeof value === "string" ? value : value.map(element => element.textContent).join(" ");
            } else {
                return value;
            }
        });
        clusterData = JSON.stringify({...JSON.parse(clusterData), actionType: "reply " + type, actionTimestamp: timestamp});

        if (type.includes("accept") || type.includes("reject")) {
            updatePracticeMessages(4);
        }

        sendData(JSON.stringify({
            action: "clusterChange",
            data: clusterData
        }));
    };

    let fileHandler = (strokeFile, clusterFile, document) => {
        let initiateProcessStrokes = () => {
            let strokeReader = new FileReader();

            strokeReader.onload = (e) => {
                let lines = e.target.result.split("\n");
                let [width, height] = lines[0].split(" ");
                let csv = lines.slice(1);
    
                parse(csv.join("\n"), {
                    delimiter: ",",
                    skip_records_with_error: true,
                }, function(err, records){
                    let headers = records[0];
                    let svgContent = [];
                    
                    for (let i = 1; i < records.length; i++) {
                        let record = records[i];
                        let data = {};
    
                        for (let j = 0; j < headers.length; j++) {
                            data[headers[j]] = record[j];
                        }
    
                        if (data.action === "createStroke") {
                            svgContent.push(data);
                        }
                    }
                    setScreen({ width: width, height: height });
                    setSvgContent(svgContent);
                });
            };
            strokeReader.readAsText(strokeFile);
        };

        if (strokeFile && !clusterFile) {
            initiateProcessStrokes();
        }

        if (clusterFile) {
            let clusterReader = new FileReader();
            let newClusters = new Map();
            let newPageClusters = new Map();

            let getTargetSpans = (lastToken) => {
                let targetWords = lastToken.targetWords.split(",").map(r => r.trim());
                let listOfSpans = [];

                for (let targetWord of targetWords) {
                    let filterTarget = targetWord.replace(/[^a-zA-Z0-9]/g, "").trim().toLowerCase();
                    let resultContent = lastToken.spans.map(r => r.textContent).join(" ").replace(/[^a-zA-Z0-9]/g, "").trim().toLowerCase();
                    
                    if (resultContent.includes(filterTarget)) {
                        let tempTarget = filterTarget;
                        let targetSpans = [];

                        for (let span of lastToken.spans) {
                            let content = span.textContent.replace(/[^a-zA-Z0-9]/g, "").trim().toLowerCase();
                            
                            if (tempTarget.startsWith(content)) {
                                targetSpans.push(span);
                                tempTarget = tempTarget.slice(content.length).trim();

                                if (tempTarget === "") {
                                    listOfSpans = listOfSpans.concat(targetSpans);
                                    targetSpans = [];
                                    tempTarget = filterTarget;
                                } else {
                                    let space = d3.select(span).node().nextSibling;

                                    if (!space) {
                                        space = span.parentNode.nextSibling?.firstChild;
                                    }

                                    if (space && space.classList.contains("space")) {
                                        targetSpans.push(space);
                                    }
                                }
                            } else {
                                targetSpans = [];
                                tempTarget = filterTarget;
                            }
                        }
                    }
                }
                lastToken.targetSpans = listOfSpans;
            };

            clusterReader.onload = async (e) => {
                let clustersData = JSON.parse(e.target.result);

                // for (let clusterData of clustersData) {
                for (let i = 0; i < clustersData.length; i++) {
                    let clusterData = clustersData[i];
                    let lastStroke = clusterData.strokes[clusterData.strokes.length - 1];

                    if (lastStroke.type !== "initial") {
                        newClusters.set(lastStroke.id, clusterData);
                        
                        if (clusterData["actionType"] === "annotate") {
                            fetch("/api/storeHistory", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    purpose: clusterData.searching.purpose,
                                    purposeTitle: clusterData.searching.purposeTitle,
                                    annotationDescription: clusterData.purpose.annotationDescription,
                                    action: "update2"
                                })
                            })
                            .then(res => {
                                if (!res.ok)
                                    return res.text().then(text => { throw new Error(text); });
                                return res.text();
                            })
                            .then((data) => {
                                console.log("Success:", data);
                            })
                            .catch((error) => {
                                console.error("updatePurpose:", error);
                
                                toast.error("updatePurpose: " + error.toString().replaceAll("Error: ", ""), {
                                    toastId: "updatePurpose",
                                    containerId: "errorMessage"
                                });
                            });
                        } else if (clusterData["actionType"].includes("comment")) {
                            let index = clusterData["actionType"].split(" ")[2];

                            if (!clusterData.annotationsFound[index]) {
                                continue;
                            }
                            let reply = clusterData.annotationsFound[index].explanation[clusterData.annotationsFound[index].explanation.length - 1];

                            let annotatedSentence = clusterData.annotationsFound[index].spans;
                            let annotatorComments = ["- " + clusterData.annotationsFound[index].explanation[0]];
                            
                            for (let j = i + 1; j < clustersData.length; j++) {
                                let nextCluster = clustersData[j];

                                if (nextCluster["actionType"].includes("comment")) {
                                    let nextIndex = nextCluster["actionType"].split(" ")[2];
                                    let nextAnnotatedSentence = nextCluster.annotationsFound[nextIndex].spans;

                                    if (annotatedSentence === nextAnnotatedSentence) {
                                        annotatorComments.push("- " + nextCluster.annotationsFound[nextIndex].explanation[0]);
                                        i++;
                                    } else {
                                        break;
                                    }
                                } else {
                                    break;
                                }
                            }
                            
                            fetch("/api/storeHistory", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    reply: reply,
                                    comment: annotatorComments.join("\n"),
                                    action: "comment2"
                                })
                            })
                            .then(res => {
                                if (!res.ok)
                                    return res.text().then(text => { throw new Error(text); });
                                return res.text();
                            })
                            .then((data) => {
                                console.log("Success:", data);
                            })
                            .catch((error) => {
                                console.error("storeCommentHistory:", error);
        
                                toast.error("storeCommentHistory: " + error.toString().replaceAll("Error: ", ""), {
                                    toastId: "storeCommentHistory",
                                    containerId: "errorMessage"
                                });
                            });
                        }
                    }
                }

                fetch("/api/storeHistory", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        action: "upload"
                    })
                })
                .then(res => {
                    if (!res.ok)
                        return res.text().then(text => { throw new Error(text); });
                    return res.text();
                })
                .then((data) => {
                    console.log("Success:", data);
                })
                .catch((error) => {
                    console.error("uploadHistory:", error);

                    toast.error("uploadHistory: " + error.toString().replaceAll("Error: ", ""), {
                        toastId: "uploadHistory",
                        containerId: "errorMessage"
                    });
                });

                for (let clusterData of newClusters.values()) {
                    let cluster = new Cluster([]);
                    
                    for (let property in clusterData) {
                        cluster[property] = clusterData[property];
                    }
                    let lastStroke = cluster.strokes[cluster.strokes.length - 1];
                    let pageNumber = lastStroke.page;

                    if (!newPageClusters.has(pageNumber)) {
                        newPageClusters.set(pageNumber, []);
                    }
                    newPageClusters.get(pageNumber).push(cluster);
                }

                for (let [pageNumber, clusters] of newPageClusters) {
                    let mergedClusters = annotationeRef.current?.penAnnotation[pageNumber - 1]?.current?.lockClusters.current.concat(clusters);
                    annotationeRef.current.penAnnotation[pageNumber - 1].current.lockClusters.current = mergedClusters;
                    annotationeRef.current?.penAnnotation[pageNumber - 1]?.current?.updateLockCluster(mergedClusters);

                    for (let cluster of clusters) {
                        for (let lockCluster of annotationeRef.current?.penAnnotation[pageNumber - 1]?.current?.clusters.current) {
                            let strokeID;

                            if (lockCluster.strokes.some(stroke => cluster.strokes.some(s => {
                                strokeID = s.id;
                                return s.id === stroke.id && s.id !== "initial";
                            }))) {
                                lockCluster.strokes = [...lockCluster.strokes.filter(stroke => stroke.id !== strokeID)];                                
                                annotationeRef.current?.penAnnotation[pageNumber - 1]?.current?.penCluster.remove(strokeID);
                            }
                        }
                        let [clusters, stopIteration] = annotationeRef.current?.penAnnotation[pageNumber - 1]?.current?.penCluster.update();
                        annotationeRef.current?.penAnnotation[pageNumber - 1]?.current?.clusterStrokes(clusters, stopIteration);
                    }
                    
                    for (let cluster of clusters) {
                        if (cluster.annotationsFound) {
                            annotationeRef.current?.annotatedTokens?.push({
                                annotationDescription: cluster.purpose?.annotationDescription, 
                                purposeTitle: cluster.searching?.purposeTitle,
                                purpose: cluster.searching?.purpose,
                                annotations: cluster.annotationsFound,
                                ref: annotationeRef.current?.penAnnotation[pageNumber - 1]
                            });

                            for (let annotation of cluster.annotationsFound) {
                                const currentAnnotation = annotation;

                                annotationeRef.current?.annotate(currentAnnotation.sentence, (results) => {
                                    currentAnnotation.spans = results;

                                    if (results instanceof Array && results.filter(r => r instanceof Element && r.textContent.replace(/[^a-zA-Z0-9]/g, "").trim() !== "").length !== 0) {
                                        if (currentAnnotation.accepted !== false) {
                                            let spaces = [];

                                            for (let span of currentAnnotation.spans) {
                                                let space = d3.select(span).node()?.nextSibling;
                                    
                                                if (!space) {
                                                    space = span.parentNode.nextSibling?.firstChild;
                                                }
                                    
                                                if (space && space.classList.contains("space")) {
                                                    spaces.push(space);
                                                }
                                            }
                                            d3.selectAll(spaces.concat(currentAnnotation.spans))
                                            .classed("highlighted", true)
                                            .classed("accept", currentAnnotation.accepted);
                                        }
                                        getTargetSpans(currentAnnotation);
                                    }
                                });
                            }
                        }
                    }
                }

                if (strokeFile) {
                    initiateProcessStrokes();
                }
            };
            clusterReader.readAsText(clusterFile);
        }

        if (document)
            setDocument(document);
    };

    // console.log(annotationeRef)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                userRef.current = user;
                console.log("Signed in anonymously");
            } else {
                try {
                    let user = await signInAnonymously(auth);
                    userRef.current = user.user;
                } catch (error) {
                    console.error("Error signing in anonymously: ", error);

                    toast.error("Error signing in anonymously: " + error.toString().replaceAll("Error: ", ""), {
                        toastId: "signInAnonym",
                        containerId: "errorMessage"
                    });
                }
            }
        });

        let handleVisibilityChange = async (event) => {
            if (!event.persisted && auth.currentUser) {
                const headers = {
                    type: "application/json",
                };
                const blob = new Blob([JSON.stringify({id: auth.currentUser.uid})], headers);
                navigator.sendBeacon("/api/cleanUp", blob);
            }
        };

        window.addEventListener("pagehide", handleVisibilityChange);

        return () => {
            unsubscribe();
            window.removeEventListener("pagehide", handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    // let disabled = useRef(false);

    // useEffect(() => {
    //     const handleClick = (e) => {
    //         if (disabled.current) {
    //             return;
    //         }

    //         // Left click
    //         if (e.button === 0) {
    //             d3.select(":root").style("--cursor-color-inner", "#fd373732");
    //             d3.select(":root").style("--cursor-color-outer", "#fd3737");
    //         } else if (e.button === 2) {
    //             d3.select(":root").style("--cursor-color-inner", "#3696e232");
    //             d3.select(":root").style("--cursor-color-outer", "#3696e2");
    //         }
    //     };
        
    //     const handleMouseUp = () => {
    //         if (disabled.current) {
    //             return;
    //         }
    //         d3.select(":root").style("--cursor-color-inner", "#ffa00032");
    //         d3.select(":root").style("--cursor-color-outer", "#ffa000");
    //     };

    //     const handleKeyDown = (event) => {
    //         if (event.ctrlKey && event.key === "c") {
    //             d3.select(":root").style("--cursor-color-inner", d3.select(":root").style("--cursor-color-inner") === "none" ? "#ffa00032" : "none");
    //             d3.select(":root").style("--cursor-color-outer", d3.select(":root").style("--cursor-color-outer") === "none" ? "#ffa000" : "none");
    //             disabled.current = !disabled.current;
    //         }
    //     };
        
    //     window.addEventListener("mousedown", handleClick);
    //     window.addEventListener("mouseup", handleMouseUp);
    //     window.addEventListener("keydown", handleKeyDown);

    //     return () => {
    //         window.removeEventListener("mousedown", handleClick);
    //         window.removeEventListener("mouseup", handleMouseUp);
    //         window.removeEventListener("keydown", handleKeyDown);
    //     };
    // }, []);

    return (
        <>
            { state === "study" ?
                <>
                    <AnnotateGPT
                        documentPDF={document}
                        pEndCallback={penEndCallback}
                        onECallback={onEraseCallback}
                        onInferenceCallback={onInferenceCallback}
                        onEndAnnotateCallback={onEndAnnotateCallback}
                        navigateCallback={navigateCallback}
                        onReplyCallback={onReplyCallback}
                        svgContent={svgContent}
                        mode={mode}
                        annotateRef={annotationeRef}
                        handiness={handiness}
                        disabled={disabled}
                    />
                </> :
                <>
                    <Header>
                        <div onClick={startStudy}>
                            Start Study
                        </div>
                    </Header>

                    <AnnotateGPT
                        documentPDF={document}
                        pEndCallback={penEndCallback}
                        onECallback={onEraseCallback}
                        onInferenceCallback={onInferenceCallback}
                        onEndAnnotateCallback={onEndAnnotateCallback}
                        onReplyCallback={onReplyCallback}
                        svgContent={svgContent}
                        screen={screen}
                        mode={mode}
                        annotateRef={annotationeRef}
                        handiness={handiness}
                        disabled={disabled}
                    />
                </>
            }
            <StudyModal
                toastMessage={toastMessage}
                disableNext={disableNext}
                checkTask={checkTask}
                onNextTask={onNextTask}
                onFinish={onFinish}
                modeChange={modeChange}
                documentChange={documentChange}
                handinessChange={handinessChange}
                disabledChange={disabledChange}
                ref={studyModalRef}
                disabled={disabled}
                studyState={state}
                fileHandler={fileHandler}
            />
            {/* <AnimatedCursor 
                color="193, 11, 111, 1"
                innerSize={30}
                outerSize={32}
                innerScale={0.7}
                outerScale={0.7}
                outerAlpha={0}
                trailingSpeed={1}
                hasBlendMode={true}
                showSystemCursor={true}
                innerStyle={{
                    border: "5px solid var(--cursor-color-inner)",
                    borderRadius: "40%",
                    willChange: "top, left"
                }}
                outerStyle={{
                    border: "3px solid var(--cursor-color-outer)",
                    borderRadius: "40%",
                    willChange: "top, left"
                }}
                clickables={["a"]}
            /> */}
            <ToastContainer
                containerId="studyMessage"
                position="top-center"
                autoClose={false}
                // limit={1}
                closeButton={false}
                newestOnTop
                closeOnClick={false}
                rtl={false}
                pauseOnFocusLoss={false}
                draggable={false}
                theme="dark"
                transition= {Flip}
            />

            <ToastContainer 
                containerId="errorMessage"
                position="bottom-right"
                autoClose={false}
                newestOnTop
                closeOnClick={false}
                rtl={false}
                pauseOnFocusLoss
                draggable
                theme="colored"
                transition={Flip}
                stacked
            />
        </>
    );
}