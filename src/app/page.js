"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import * as d3 from 'd3';
import Modal from 'react-modal';
import { ImMail4, ImInfo } from 'react-icons/im';
import { Tooltip } from 'react-tooltip';
import localFont from "next/font/local";

import AnnotateGPT from './components/AnnotateGPT.js';
import Header from './components/Header.js';

import './components/css/Home.css';

export const googleSans = localFont({
    src: "./components/css/googlesans.woff2",
    display: 'swap',
});

Modal.setAppElement('body');

export default function Home() {
    let [ state, setState ] = useState("home");
    let [ modalIsOpen, setModalIsOpen ] = useState(false);
    let [ pid, setPid ] = useState("test");

    let preStudyContent = useRef([]);
    let postTaskContent = useRef([]);
    let postStudyContent = useRef([]);
    
    let [ modalContent, setModalContent ] = useReducer(modalReducer, { mainContent: null, bottomContent: null, modalIndex: 0, studyState: "preStudy" });

    let startStudy = useCallback(() => {
        setState("study");
        setModalIsOpen(true);
        setModalContent({ type: "start" });
    }, []);

    useEffect(() => {
        d3.select("#root")
        .on("scroll.header", () => {
            
            let scroll = d3.select("#root").node().scrollTop;
            
            d3.select("#header")
            .style("--header-inner-height", Math.max(50, 80 - scroll) + "px");
        });

        fetch("/api/storeHistory", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "clear"
            })
        })
        .then((response) => response.text())
        .then((data) => {
            console.log("Success:", data);
        })
        .catch((error) => {
            console.error("Error:", error);
        });

        return () => {
            d3.select("#root").on("scroll.header", null);
        };
    }, []);

    function modalReducer(state, action) {
        function getContent(studyState = "") {
            let content;
            studyState = studyState === "" ? state.studyState : studyState;

            switch (studyState) {
                case "preStudy":
                    content = preStudyContent.current;
                    break;
                case "postTask":
                    content = postTaskContent.current;
                    break;
                case "postStudy":
                    content = postStudyContent.current;
                    break;
                default:
            }
            return content;
        }

        function getNextStudyState() {
            let studyState = "preStudy";

            switch (state.studyState) {
                case "preStudy":
                    studyState = "postTask";
                    break;
                case "postTask":
                    studyState = "postStudy";
                    break;
                case "postStudy":
                    studyState = "finishStudy";
                    break;
                default:
                    studyState = state.studyState;
            }
            return studyState;
        }

        function handleNext(e) {
            d3.select(e.target.closest(".bottom"))
            .selectAll(".modalButton")
            .style("pointer-events", "none");

            d3.select(".contentContainer")
            .transition()
            .duration(500)
            .style("opacity", "0")
            .on("end", () => {
                setModalContent({ type: "next" });
            });
        }

        function handlePrev(e) {
            d3.select(e.target.closest(".bottom"))
            .selectAll(".modalButton")
            .style("pointer-events", "none");

            d3.select(".contentContainer")
            .transition()
            .duration(500)
            .style("opacity", "0")
            .on("end", () => {
                setModalContent({ type: "prev" });
            });
        }

        function generateNextButton(content, index) {
            return <button className={"round modalButton nextButton" + (content?.disableNext ? " disabled" : "") + (content?.confirm ? " confirm" : "")} onClick={handleNext} key={state.studyState + "next" + index}>
                <div id={"cta"}>
                    { content?.confirm ? 
                        <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                            <path className="checkmark__check" fill="none" d="M 17.28 27.76 L 23.37 34.5 L 36.784 19.589"/>
                            <circle r="10" fill="none" stoke="white" cx="50%" cy="50%" strokeWidth={1.6} className="checkmark__circle" />
                        </svg>
                        :
                        <>
                            <span className={"arrow next primera"}></span>
                            <span className={"arrow next segunda"}></span>
                        </>
                    }
                </div>
            </button>;
        }
        
        function generatePrevButton(content, index) {
            return <button className={"round modalButton prevButton"+ (content?.confirm ? " cancel" : "")} onClick={handlePrev} key={state.studyState + "prev" + index}>
                <div id={"cta"}>
                    { content?.confirm ?
                        <div className="close-container">
                            <div className="leftright"></div>
                            <div className="rightleft"></div>
                        </div> :
                        <>
                            <span className={"arrow next primera"}></span>
                            <span className={"arrow next segunda"}></span>
                        </>
                    }
                </div>
            </button>;
        }

        switch (action.type) {
            case "start": {
                let content = getContent("preStudy");

                return {
                    mainContent: content[0].content,
                    bottomContent: [generateNextButton(content[0], 0)],
                    modalIndex: 0,
                    callback: content[0].callback,
                    studyState: "preStudy"
                };
            }
            case "next": {
                let modalIndex = state.modalIndex + 1;

                let content = getContent();

                if (modalIndex < content.length) {
                    let bottomContent = [generateNextButton(content[modalIndex], modalIndex)];
    
                    if (content[modalIndex].prev) {
                        bottomContent.unshift(generatePrevButton(content[modalIndex], modalIndex));
                    }
                    
                    return {
                        ...state,
                        mainContent: content[modalIndex].content,
                        bottomContent: bottomContent,
                        modalIndex: modalIndex,
                        callback: content[modalIndex].callback,
                    };
                } else {
                    // setModalIsOpen(false);
                    let studyState = getNextStudyState();

                    if (studyState === "finishStudy") {
                        setState("home");
                        setModalIsOpen(false);

                        return state;
                    } else {
                        let content = getContent(studyState);

                        return {
                            ...state,
                            mainContent: content[0]?.content,
                            bottomContent: [generateNextButton(content[0], 0)],
                            modalIndex: 0,
                            callback: content[0]?.callback,
                            studyState: studyState,
                        };
                    }
                }
            }
            case "prev": {
                let modalIndex = state.modalIndex - 1;

                let content = getContent();
                let bottomContent = [generateNextButton(content[modalIndex], modalIndex)];

                if (content[modalIndex].prev) {
                    bottomContent.unshift(generatePrevButton(content[modalIndex], modalIndex));
                }
                
                return {
                    ...state,
                    mainContent: content[modalIndex].content,
                    bottomContent: bottomContent,
                    modalIndex: modalIndex,
                    callback: content[modalIndex].callback,
                };
            }
            default:
        }
    };
    
    useEffect(() => {
        preStudyContent.current = [
            {
                "content": <>
                    <h3 style={{width: "100%", textAlign: "center"}}>Pre Study Questionnaire</h3>
                    <iframe src={"https://docs.google.com/forms/d/e/1FAIpQLSfZgJz4b0MjiIblc-hrb4QKoZvQ0S0J9Ddw0xHgqxENAUMQRA/viewform?usp=pp_url&entry.1500102265=" + pid} title="preStudy" />
                </>,
                "prev": false,
            },
            {
                "content": <div style={{ textAlign: "center" }}>
                    Have you submitted the questionnaire?
                </div>,
                "prev": true,
                "confirm": true,
                "disableNext": true,
                "callback": () => {
                    setTimeout(() => {
                        d3.select(".modalButton.disabled")
                        .classed("enable", true);
                    }, 1000);
                },
            },
            {
                "content": 
                <div>
                    <h3 style={{width: "100%", textAlign: "center"}}>Welcome to the Study</h3>
                    <ul> 
                        <li style={{ margin: "30px 0px" }}>Your task is to annotate...</li>
                    </ul>
                </div>,
                "prev": true,
            },
        ];
    }, [pid]);

    let setUp = useCallback(() => {
        d3.select(".contentContainer")
        .interrupt()
        .style("opacity", "0");

        let iframe = d3.select(".contentContainer").select("iframe").node();
        
        let revealContent = () => {
            d3.select(".contentContainer")
            .transition()
            .duration(500)
            .style("opacity", "1");
        };

        if (modalIsOpen) {
            if (iframe && iframe.contentDocument) {
                iframe.addEventListener('load', () => {
                    revealContent();
                });

                iframe.addEventListener('error', (e) => {
                    console.log(e);
                    revealContent();
                });
            } else {
                revealContent();
            }
        }
    }, [modalIsOpen]);

    function setUpButtons() {
        let leave = new Map();
        let animationendForward = new Map();
        let animationendReverse = new Map();
        
        d3.selectAll(".modalButton .arrow")
        .on("animationstart", (e) => {
            animationendForward.set(e.srcElement.closest(".modalButton"), false);
        })
        .on("animationend", (e) => {
            d3.select(e.srcElement.offsetParent)
            .classed("animated", false);

            if (!leave.get(e.srcElement.offsetParent)) {
                setTimeout(() => {
                    d3.select(e.srcElement.offsetParent)
                    .classed("animated", true);
                }, 100);
            }
        });


        d3.selectAll(".modalButton .checkmark .checkmark__check")
        .on("animationstart", (e) => {
            animationendReverse.set(e.srcElement.closest(".modalButton"), false);
        })
        .on("animationend", (e) => {
            if (leave.get(e.srcElement.closest(".modalButton"))) {
                d3.select(e.srcElement.closest(".modalButton"))
                .classed("animated", false);

                d3.select(e.srcElement.closest(".modalButton"))
                .classed("reverse", true);
            }
            animationendForward.set(e.srcElement.closest(".modalButton"), true);
        });

        d3.selectAll(".modalButton .checkmark .checkmark__circle")
        .on("animationstart", (e) => {
            animationendForward.set(e.srcElement.closest(".modalButton"), false);
        })
        .on("animationend", (e) => {
            animationendReverse.set(e.srcElement.closest(".modalButton"), true);

            if (!leave.get(e.srcElement.closest(".modalButton"))) {
                d3.select(e.srcElement.closest(".modalButton"))
                .classed("animated", true);
                
                d3.select(e.srcElement.closest(".modalButton"))
                .classed("reverse", false);
            }
        });

        d3.selectAll(".modalButton .leftright")
        .on("animationstart", (e) => {
            if (e.srcElement.closest(".modalButton").classList.contains("reverse"))
                animationendReverse.set(e.srcElement.closest(".modalButton"), false);
            else
                animationendForward.set(e.srcElement.closest(".modalButton"), false);
        })
        .on("animationend", (e) => {
            if (e.srcElement.closest(".modalButton").classList.contains("reverse"))
                animationendReverse.set(e.srcElement.closest(".modalButton"), true);
            else
                animationendForward.set(e.srcElement.closest(".modalButton"), true);

            if (leave.get(e.srcElement.closest(".modalButton"))) {
                d3.select(e.srcElement.closest(".modalButton"))
                .classed("animated", false);

                d3.select(e.srcElement.closest(".modalButton"))
                .classed("reverse", true);
            } else {
                d3.select(e.srcElement.closest(".modalButton"))
                .classed("animated", true);

                d3.select(e.srcElement.closest(".modalButton"))
                .classed("reverse", false);
            }
        });
        
        d3.selectAll(".modalButton")
        .each((d, i, n) => {
            leave.set(n[i], true);
            animationendForward.set(n[i], true);
            animationendReverse.set(n[i], true);
        })
        .on("pointerenter", (e) => {
            leave.set(e.srcElement, false);

            if (animationendReverse.get(e.srcElement)) {
                d3.select(e.srcElement)
                .classed("animated", true);

                d3.select(e.srcElement)
                .classed("reverse", false);
            }
        })
        .on("pointerleave", (e) => {
            leave.set(e.srcElement, true);
            
            if (animationendForward.get(e.srcElement)) {
                d3.select(e.srcElement)
                .classed("animated", false);

                d3.select(e.srcElement)
                .classed("reverse", true);
            }
        });
    }
    
    useEffect(() => {
        setUp();
        setUpButtons();

        if (modalContent.callback instanceof Function) {
            modalContent.callback();
        }
    }, [modalContent, setUp]);
    
    return (
        <>
            { state === "home" ?
                <>
                    <Header>
                        <div onClick={startStudy}>
                            Start Study
                        </div>
                    </Header>
                    
                    <AnnotateGPT />
                </>
                : <AnnotateGPT />
            }

            <Modal
                isOpen={modalIsOpen}
                className="modal" 
                overlayClassName="overlay"
                closeTimeoutMS={500}
                onRequestClose={() => setModalIsOpen(false)}
                onAfterOpen={() => {setUp(); setUpButtons();}}
                shouldCloseOnEsc={false}
                shouldFocusAfterRender={true}
                shouldCloseOnOverlayClick={false}
            >
                <div className={"contentContainer " + googleSans.className}>
                    <div className="studyInfo" data-tooltip-id="my-tooltip">?</div>
                    { modalContent.mainContent }

                    <div className={"bottom"}>
                        { modalContent.bottomContent }
                    </div>
                </div>
                <Tooltip id="my-tooltip" openEvents={{ click: true }} closeEvents={{ click: true }} globalCloseEvents={{ clickOutsideAnchor: true, resize: true, escape: true, scroll: true }} place='bottom-end'>
                    <div className={googleSans.className} style={{ display: "flex", flexDirection: "column", fontSize: "1em", userSelect: "none", letterSpacing: "0.5px" }}>
                        <span>
                            <b>Project Title:</b>
                        </span>
                        <span style={{ paddingLeft: "10px" }}> AnnotateGPT: </span>
                        <span style={{ paddingLeft: "10px" }}> Implicit Pen Annotation </span>
                        <span style={{ paddingLeft: "10px" }}> Assisted by Large Language Models </span>
                        <span style={{ paddingTop: "10px" }}>
                            <b>REB File #:</b>
                        </span>
                        <span style={{ paddingLeft: "10px" }}> TBD </span>
                        <span style={{ paddingTop: "10px" }}>
                            <b>Supervisors:</b>
                        </span>
                        <span style={{ paddingLeft: "10px", marginBottom: "5px", display: "flex", gap: "5px", alignItems: "center", height: "1.3em" }}>
                            Christopher Collins
                            <a style={{ display: "contents", color: "black" }} href="mailto: christopher.collins@ontariotechu.ca">
                                <ImMail4 style={{ width: "auto", height: "100%", cursor: "pointer", pointerEvents: "visible", color: "white" }} />
                            </a>
                            <a style={{ display: "contents", color: "black" }} href="https://vialab.ca/team/christopher-collins" target="_blank" rel="noreferrer">
                                <ImInfo style={{ width: "auto", height: "100%", cursor: "pointer", pointerEvents: "visible", color: "white" }} />
                            </a>
                        </span>
                        <span style={{ paddingLeft: "10px", display: "flex", gap: "5px", alignItems: "center", height: "1.3em" }}>
                            Mariana Shimabukuro
                            <a style={{ display: "contents", color: "black" }} href="mailto: mariana.shimabukuro@ontariotechu.ca">
                                <ImMail4 style={{ width: "auto", height: "100%", cursor: "pointer", pointerEvents: "visible", color: "white" }} />
                            </a>
                            <a style={{ display: "contents", color: "black" }} href="https://vialab.ca/team/mariana-shimabukuro" target="_blank" rel="noreferrer">
                                <ImInfo style={{ width: "auto", height: "100%", cursor: "pointer", pointerEvents: "visible", color: "white" }} />
                            </a>
                        </span>
                        <span style={{ paddingTop: "10px" }}>
                            <b>Lab:</b>
                        </span>
                        <span style={{ paddingLeft: "10px" }}> <a href="https://vialab.ca" target="_blank" rel="noreferrer" style={{ pointerEvents:"all", color: "white" }}>Vialab</a> (Ontario Tech University, UA 4150) </span>
                    </div>
                </Tooltip>
            </Modal>
        </>
    );
}