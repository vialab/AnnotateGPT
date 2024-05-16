"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import localFont from "next/font/local";
import useSWR from "swr";

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

    const options =  {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            action: "clear"
        })
    };
    const fetcher = (...args) => fetch(...args, options).then(res => res.text());
    const { data, error, } = useSWR("/api/storeHistory", fetcher);

    useEffect(() => {
        if (data)
            console.log("Success:", data);
    }, [data]);

    useEffect(() => {
        if (error) {
            console.error("Error:", error);
        }
    }, [error]);

    let startStudy = useCallback(() => {
        setState("study");
        console.log(studyModalRef);
    }, []);

    let onFinish = useCallback(() => {
        setState("home");
    }, []);

    return (
        <>
            { state === "study" ?
                <>
                    <AnnotateGPT />
                    <StudyModal onFinish={onFinish} ref={studyModalRef} />
                </> :
                <>
                    <Header>
                        <div onClick={startStudy}>
                            Start Study
                        </div>
                    </Header>

                    <AnnotateGPT />
                </>
            }
        </>
    );
}