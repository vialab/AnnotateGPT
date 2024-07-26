"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import localFont from "next/font/local";
import dynamic from 'next/dynamic';
import { parse } from 'csv-parse';
import * as d3 from "d3";
import { ToastContainer, toast, Flip } from "react-toastify";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, addDoc, collection } from "firebase/firestore";

import "react-toastify/dist/ReactToastify.css";

const AnnotateGPT = dynamic(() => import("../app/components/AnnotateGPT.js"), { ssr: false, });

// import AnnotateGPT from "../app/components/AnnotateGPT.js";
import Header from "../app/components/Header.js";
import StudyModal from "../app/components/StudyModal.js";

export const googleSans = localFont({
    src: "./components/css/googlesans.woff2",
    display: "swap",
});

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBFTj4CgTWa3to76N_mk7C4EzUABSP1pLM",
    authDomain: "annotategpt.firebaseapp.com",
    projectId: "annotategpt",
    storageBucket: "annotategpt.appspot.com",
    messagingSenderId: "855106191363",
    appId: "1:855106191363:web:d74b397557f6eac8d84e36"
};
  
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

    const studyModalRef = useRef(null);
    const success = useRef(false);
    const homeLLM = useRef(true);
    const homeDocument = useRef("./public/Test 1.pdf");
    const practiceMessage = useRef([
        [
            "Make an annotation",
            "Activate tooltip",
            "Make annotations using the tooltip",
            "Navigate annotations by hovering or with the arrows",
            "Like or dislike an annotation",
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
            // console.error(err);

            toast.error("clearStoreHistory: " + err.toString().replace("Error: ", ""), {
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
            // console.error(err);

            toast.error("clearStoreHistory: " + err.toString().replace("Error: ", ""), {
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
                        pid: pid
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
                    // console.error(err);

                    toast.error("moveHistory: " + err.toString().replace("Error: ", ""), {
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
                            const userDocRef = collection(db, userRef.current.uid, state, "history");
                            const userData = {
                                history: data,
                                pid: studyModalRef.current?.pid ?? "test",
                            };

                            retry(() => {
                                addDoc(userDocRef, userData)
                                .then(() => {
                                    console.log("User data stored successfully");
                                })
                                .catch((err) => {
                                    toast.error("sendData: " + err.toString().replace("Error: ", ""), {
                                        toastId: "sendData",
                                        containerId: "errorMessage"
                                    });
                                });
                            });
                        }).catch(err => {
                            toast.error("getHistory: " + err.toString().replace("Error: ", ""), {
                                toastId: "getHistory",
                                containerId: "errorMessage"
                            });
                        });
                    } catch (err) {
                        toast.error("sendData: " + err.toString().replace("Error: ", ""), {
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

        console.log(modeRef.current);

        moveHistory();
    }, [moveHistory]);

    const documents = ["./public/Test 1.pdf", "./public/Test 2.pdf"];
    // const llmOrder = [true, false];

    let onNextTask = (taskNum, nextMode) => {
        if (taskNum >= 0 && taskNum < documents.length) {
            setDocument(documents[taskNum]);
            setMode(nextMode);

            setToastMessage(null);
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
            }
        }
        moveHistory();
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

    let sendData = (body) => {
        if (typeof modeRef.current === "string" && !modeRef.current.toLowerCase().includes("practice")) {
            if (!process.env.NEXT_PUBLIC_VERCEL_ENV) {
                let pid = studyModalRef.current?.pid ?? "test";

                fetch("/api/" + pid + "/data", {
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
                    // console.error(err);

                    toast.error("sendData: " + err.toString().replace("Error: ", ""), {
                        toastId: "sendData",
                        containerId: "errorMessage"
                    });
                });
            } else {
                if (userRef.current) {
                    try {
                        const userDocRef = collection(db, userRef.current.uid, state, "data");
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
                                toast.error("sendData: " + err.toString().replace("Error: ", ""), {
                                    toastId: "sendData",
                                    containerId: "errorMessage"
                                });
                            });
                        });
                    } catch (err) {
                        toast.error("sendData: " + err.toString().replace("Error: ", ""), {
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
                setToastMessage("Click the top left button to continue");
                setDisableNext(false);
            }
        }
    };

    let penEndCallback = (param) => {
        let annotatedText = param.stroke.annotatedText.map( element => element.innerText).join(" ").replace(/"/g, `""`);
        let marginalText = param.stroke.marginalText.map( element => element.innerText).join(" ").replace(/"/g, `""`);

        let strokeData = `${param.path.id},createStroke,${param.page},${param.stroke.startTime},${param.stroke.endTime},${param.stroke.type},"${annotatedText}","${marginalText}","${param.path.outerHTML.replace(/"/g, `""`)}"`;
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
            if (key === "annotatedText" || key === "marginalText" || key === "spans") {
                return value.map(element => element.innerText).join(" ");
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
            if (key === "annotatedText" || key === "marginalText" || key === "spans") {
                return value.map(element => element.innerText).join(" ");
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
            if (key === "annotatedText" || key === "marginalText" || key === "spans") {
                return value.map(element => element.innerText).join(" ");
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

    let fileHandler = (file, document) => {
        // Read CSV file
        let reader = new FileReader();

        reader.onload = (e) => {
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

        if (file)
            reader.readAsText(file);

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
                    await signInAnonymously(auth);
                    console.log("Signed in anonymously");
                } catch (error) {
                    console.error("Error signing in anonymously: ", error);
                }
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

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
                        mode={mode}
                        annotateRef={annotationeRef}
                    />
                </> :
                <>
                    <Header>
                        <div onClick={startStudy}>
                            Start Study (Under Maintenance)
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
                    />
                </>
            }
            <StudyModal toastMessage={toastMessage} disableNext={disableNext} onNextTask={onNextTask} onFinish={onFinish} modeChange={modeChange} documentChange={documentChange} ref={studyModalRef} studyState={state} fileHandler={fileHandler} />
            
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