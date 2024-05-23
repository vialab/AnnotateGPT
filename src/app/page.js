"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import localFont from "next/font/local";
import useSWR from "swr";
import { HiOutlineChevronDoubleRight } from "react-icons/hi";
import { ImExit } from "react-icons/im";

import AnnotateGPT from "../app/components/AnnotateGPT.js";
import Header from "../app/components/Header.js";
import StudyModal from "../app/components/StudyModal.js";

export const googleSans = localFont({
    src: "./components/css/googlesans.woff2",
    display: "swap",
});

export default function Home() {
    const [state, setState] = useState("home");
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
                action: "clear"
            })
        })
        .then(res => res.text())
        .then(data => {
            console.log(data);
        })
        .catch(err => {
            console.error(err);
            success.current = false;
        });
    }

    let startStudy = useCallback(() => {
        setState("study");
    }, []);

    let onFinish = useCallback(() => {
        setState("home");
    }, []);

    let withdraw = useCallback(() => {
        studyModalRef.current?.setModalContent({ type: "withdraw" });
    }, []);

    let continueStudy = useCallback(() => {
        studyModalRef.current?.setModalContent({ type: "show" });
        studyModalRef.current?.setModalIsOpen(true);
    }, []);

    let sendData = (body) => {
        let pid = studyModalRef.current?.pid ?? "test";
    
        fetch("/api/" + pid + "/data", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: body
        })
        .then(res => res.text())
        .then(data => {
            console.log(data);
        })
        .catch(err => {
            console.error(err);
        });
    };


    let penEndCallback = (param) => {
        let annotatedText = param.stroke.annotatedText.map( element => element.innerText).join(" ").replace(/"/g, `""`);
        let marginalText = param.stroke.marginalText.map( element => element.innerText).join(" ").replace(/"/g, `""`);

        let strokeData = `${param.path.id},createStroke,${param.page},${param.stroke.startTime},${param.stroke.endTime},${param.stroke.type},"${annotatedText}","${marginalText}","${param.path.outerHTML.replace(/"/g, `""`)}"`;

        sendData(JSON.stringify({
            action: "penStroke",
            data: strokeData
        }));
    };

    let onEraseCallback = (param) => {
        let strokeData = `${param.id},eraseStroke,${param.page},${Date.now()}`;

        sendData(JSON.stringify({
            action: "eraseStroke",
            data: strokeData
        }));
    };

    let onInferenceCallback = (cluster, rawText, images) => {
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

        let inferenceData = `inference,${timestamp},"${rawText.replace(/"/g, `""`)}","${images[0]}","${images[1]}"`;

        sendData(JSON.stringify({
            action: "openai",
            data: inferenceData
        }));
    };

    let onEndAnnotateCallback = (cluster, rawText) => {
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

        let annotateData = `annotate,${timestamp},"${rawText.replace(/"/g, `""`)}",,`;

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

    return (
        <>
            { state === "study" ?
                <>
                    <AnnotateGPT 
                        pEndCallback={penEndCallback}
                        onECallback={onEraseCallback}
                        onInferenceCallback={onInferenceCallback}
                        onEndAnnotateCallback={onEndAnnotateCallback}
                        onReplyCallback={onReplyCallback}
                    />
                    <StudyModal onFinish={onFinish} ref={studyModalRef} />
                    
                    <div className="studyMenu">
                        <div className="withdraw" onClick={withdraw}>
                            <ImExit />
                        </div>
                        <div className="continue" onClick={continueStudy}>
                            <HiOutlineChevronDoubleRight />
                        </div>
                    </div>
                </> :
                <>
                    <Header>
                        <div onClick={startStudy}>
                            Start Study
                        </div>
                    </Header>
                    <AnnotateGPT 
                        pEndCallback={penEndCallback}
                        onECallback={onEraseCallback}
                        onInferenceCallback={onInferenceCallback}
                        onEndAnnotateCallback={onEndAnnotateCallback}
                        onReplyCallback={onReplyCallback}
                    />
                </>
            }
        </>
    );
}