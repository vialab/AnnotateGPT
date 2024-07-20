"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import localFont from "next/font/local";
import dynamic from 'next/dynamic';
import { parse } from 'csv-parse';
import * as d3 from "d3";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const AnnotateGPT = dynamic(() => import("../app/components/AnnotateGPT.js"), { ssr: false, });

// import AnnotateGPT from "../app/components/AnnotateGPT.js";
import Header from "../app/components/Header.js";
import StudyModal from "../app/components/StudyModal.js";

export const googleSans = localFont({
    src: "./components/css/googlesans.woff2",
    display: "swap",
});

export default function Home() {
    const [state, setState] = useState("home");
    const [svgContent, setSvgContent] = useState([]);
    const [screen, setScreen] = useState({ width: 0, height: 0 });
    const [document, setDocument] = useState("./public/Test 1.pdf");
    const studyModalRef = useRef(null);
    const success = useRef(false);

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
                position: "bottom-center",
                autoClose: false,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
                transition: Flip,
                toastId: "clearStoreHistory"
            });
            success.current = false;
        });
    }

    let startStudy = useCallback(() => {
        setState("study");
        setDocument("./public/Test 1.pdf");
        studyModalRef.current.ifFirst.current = true;

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
                position: "bottom-center",
                autoClose: false,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
                transition: Flip,
                toastId: "clearStoreHistory"
            });
        });
    }, []);

    let onFinish = useCallback(() => {
        let pid = studyModalRef.current?.pid ?? "test";
        setState("home");

        // Move history file to history folder
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
                position: "bottom-center",
                autoClose: false,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
                transition: Flip,
                toastId: "moveHistory"
            });
        });
    }, []);

    let documents = ["./public/Test 1.pdf", "./public/Test 2.pdf"];

    let onNextTask = (taskNum) => {
        setDocument(documents[taskNum]);
    };

    let documentChange = (taskNum) => {
        setDocument(documents[taskNum]);
    };

    let sendData = (body) => {
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
                    position: "bottom-center",
                    autoClose: false,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "dark",
                    transition: Flip,
                    toastId: "sendData"
                });
            });
        }
    };


    let penEndCallback = (param) => {
        let annotatedText = param.stroke.annotatedText.map( element => element.innerText).join(" ").replace(/"/g, `""`);
        let marginalText = param.stroke.marginalText.map( element => element.innerText).join(" ").replace(/"/g, `""`);

        let strokeData = `${param.path.id},createStroke,${param.page},${param.stroke.startTime},${param.stroke.endTime},${param.stroke.type},"${annotatedText}","${marginalText}","${param.path.outerHTML.replace(/"/g, `""`)}"`;
        let bbox = d3.select(".page-container").node().getBoundingClientRect();

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
                        onReplyCallback={onReplyCallback}
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
                    />
                </>
            }
            <StudyModal onNextTask={onNextTask} onFinish={onFinish} documentChange={documentChange} ref={studyModalRef} studyState={state} fileHandler={fileHandler} />
            <ToastContainer />
        </>
    );
}