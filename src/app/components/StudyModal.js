import { useState, useRef, useReducer, useEffect, useCallback, useImperativeHandle } from "react";
import Image from "next/image";

import Modal from "react-modal";
import Player from "./Player";
import { ImMail4, ImInfo, ImExit } from "react-icons/im";
import { FaThumbsUp, FaThumbsDown, FaExclamation } from "react-icons/fa";
import { HiOutlineChevronDoubleRight } from "react-icons/hi";
import { Tooltip } from "react-tooltip";
import { toast, cssTransition } from "react-toastify";
import * as d3 from "d3";

import { googleSans } from "@/app/page.js";
import "./css/StudyModal.css";

Modal.setAppElement("body");

function StudyModal({ toastMessage, disableNext, checkTask, onNextTask, onFinish, studyState, fileHandler, modeChange, documentChange, handinessChange, disabledChange, disabled, ref }) {
    let [ pid, setPid ] = useState("test");
    let [ modalIsOpen, setModalIsOpen ] = useState(false);
    let [ ifFirst, setIfFirst ] = useState(true);
    let [ llmFirst, setLlmFirst ] = useState(true);
    let [ handiness, setHandiness ] = useState("right");
    
    let preStudyContent = useRef([]);
    let preTaskContent = useRef([]);
    let instructionTaskContent = useRef([]);
    let postTaskContent = useRef([]);
    let postStudyContent = useRef([]);
    let disabledRef = useRef(disabled);

    let onSettings = useRef(false);
    let onConfirm = useRef(false);

    let [ modalContent, setModalContent ] = useReducer(modalReducer, { mainContent: null, bottomContent: null, modalIndex: 0, studyState: "preStudy", currentTask: 0 });

    let withdraw = useCallback(() => {
        setModalContent({ type: "withdraw" });
    }, []);

    let continueStudy = useCallback((_, force = false) => {
        let continueModal = () => {
            setModalContent({ type: "show" });
            setModalIsOpen(true);
        };

        if (modalContent.currentTask <= 1 && (modalContent.studyState === "instructionTask" || modalContent.studyState === "postTask")) {
            let taskNum = modalContent.studyState === "postTask" ? modalContent.currentTask + 1 : modalContent.currentTask;
            let currentMode = (taskNum === 0 && llmFirst) || (taskNum === 1 && !llmFirst) ? "llm" : "base";

            if (modalContent.studyState === "postTask") {
                setModalIsOpen(true);
                
                if (force) {
                    setModalContent({ type: "nextTask" });
                    continueModal();
                    
                    if (onNextTask instanceof Function && modalContent.currentTask < 1) {
                        onNextTask(-1, currentMode);
                    }
                } else {
                    setModalContent({ type: "confirmContinue" });
                }
            } else {
                if (onNextTask instanceof Function) {
                    let documentIndex = (taskNum === 0 && ifFirst) || (taskNum === 1 && !ifFirst) ? 0 : 1;
                    onNextTask(documentIndex, currentMode);
                    continueModal();
                }
            }
        } else {
            continueModal();
        }
    }, [modalContent.currentTask, modalContent.studyState, onNextTask, ifFirst, llmFirst]);

    useEffect(() => {
        if (studyState === "study") {
            setModalContent({ type: "start" });
            setModalIsOpen(true);
        }
    }, [studyState]);

    useEffect(() => {
        d3.select(document)
        .on("keydown", (e) => {
            if (e.key === "y" && e.ctrlKey && !onSettings.current) {
                onSettings.current = true;
                
                if (modalIsOpen) {
                    d3.select(".contentContainer")
                    .interrupt("revealContent")
                    .interrupt("hideContent")
                    .transition("hideContent")
                    .duration(500)
                    .style("opacity", "0")
                    .on("end", () => {
                        setModalContent({ type: "settings" });
                    });
                } else {
                    setModalContent({ type: "settings" });
                }
            } else if (e.key === "F5" || (e.key === "r" && e.ctrlKey)) {
                e.preventDefault();
            }
        });

        return () => {
            d3.select(document).on("keydown", null);
        };
    }, [modalIsOpen]);

    function modalReducer(state, action) {
        function getContent(studyState = "") {
            let content;
            studyState = studyState === "" ? state.studyState : studyState;

            switch (studyState) {
                case "preStudy":
                    content = preStudyContent.current;
                    break;
                case "preTask":
                    content = preTaskContent.current;
                    break;
                case "instructionTask":
                    content = instructionTaskContent.current;
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
                case "preStudy": {
                    studyState = "preTask";
                    break;
                } case "preTask": {
                    setModalIsOpen(false);
                    studyState = "instructionTask";
                    break;
                } case "instructionTask": {
                    setModalIsOpen(false);
                    studyState = "postTask";
                    break;
                } case "postTask": {
                    if (state.currentTask > 1) {
                        setModalIsOpen(true);
                        studyState = "postStudy";
                    } else {
                        studyState = "preTask";
                    }
                    break;
                } case "postStudy": {
                    setModalIsOpen(false);
                    studyState = "finishStudy";
                    break;
                } default:
                    studyState = state.studyState;
            }
            return studyState;
        }

        let clicked = false;

        function handleNext(callback) {
            if (!clicked) {
                clicked = true;

                d3.select(".contentContainer")
                .interrupt("revealContent")
                .transition("hideContent")
                .duration(500)
                .style("opacity", "0")
                .on("end", () => {
                    setModalContent({ type: "next" });
                });

                if (callback instanceof Function) {
                    callback();
                }
            }
        }

        function handlePrev() {
            if (!clicked) {
                clicked = true;

                d3.select(".contentContainer")
                .interrupt("revealContent")
                .transition("hideContent")
                .duration(500)
                .style("opacity", "0")
                .on("end", () => {
                    setModalContent({ type: "prev" });
                });
            }
        }

        function generateNextButton(content, index, callback) {
            return <button className={"round modalButton nextButton" + (content?.disableNext ? " disabled" : "") + (content?.confirm ? " confirm" : "") + (content?.class ? " " + content.class : "")} onClick={callback} key={state.studyState + "next" + index + action.type}>
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
        
        function generatePrevButton(content, index, callback) {
            return <button className={"round modalButton prevButton"+ (content?.confirm ? " cancel" : "")} onClick={callback} key={state.studyState + "prev" + index + action.type}>
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

                let bottomContent = [generateNextButton(content[0], 0, () => handleNext(content[0]?.nextCallback))];

                if (content[0]?.prev) {
                    bottomContent.unshift(generatePrevButton(content[0], 0, handlePrev));
                }

                return {
                    mainContent: content[0]?.content,
                    bottomContent: bottomContent,
                    modalIndex: 0,
                    callback: content[0]?.callback,
                    studyState: "preStudy",
                    currentTask: 0,
                };
            } case "show": {
                if (!onConfirm.current) {
                    let modalIndex = state.modalIndex;
                    let content = getContent();

                    let bottomContent = [generateNextButton(content[modalIndex], modalIndex, () => handleNext(content[0]?.nextCallback))];

                    if (content[modalIndex]?.prev) {
                        bottomContent.unshift(generatePrevButton(content[modalIndex], modalIndex, handlePrev));
                    }

                    return {
                        ...state,
                        mainContent: content[modalIndex]?.content,
                        bottomContent: bottomContent,
                        callback: content[modalIndex]?.callback,
                    };
                } else {
                    return modalReducer(state, { type: "confirmContinue" });
                }
            } case "nextTask": {
                return {
                    ...state,
                    currentTask: state.currentTask + 1
                };
            } case "next": {
                let modalIndex = state.modalIndex + 1;

                let content = getContent();

                if (modalIndex < content.length) {
                    let bottomContent = [generateNextButton(content[modalIndex], modalIndex, () => handleNext(content[0]?.nextCallback))];
    
                    if (content[modalIndex]?.prev) {
                        bottomContent.unshift(generatePrevButton(content[modalIndex], modalIndex, handlePrev));
                    }
                    
                    return {
                        ...state,
                        mainContent: content[modalIndex]?.content,
                        bottomContent: bottomContent,
                        modalIndex: modalIndex,
                        callback: content[modalIndex]?.callback,
                    };
                } else {
                    let studyState = getNextStudyState();

                    if (studyState === "finishStudy") {
                        setModalIsOpen(false);

                        return {
                            ...state,
                            mainContent: null,
                            bottomContent: null,
                            modalIndex: 0,
                            callback: null,
                            studyState: "finishStudy",
                            currentTask: 0,
                        };
                    } else {
                        let content = getContent(studyState);

                        return {
                            ...state,
                            mainContent: content[0]?.content,
                            bottomContent: [generateNextButton(content[0], 0, () => handleNext(content[0]?.nextCallback))],
                            modalIndex: 0,
                            callback: content[0]?.callback,
                            studyState: studyState,
                        };
                    }
                }
            } case "prev": {
                let modalIndex = Math.max(state.modalIndex - 1, 0);

                let content = getContent();
                let bottomContent = [generateNextButton(content[modalIndex], modalIndex, () => handleNext(content[0]?.nextCallback))];

                if (content[modalIndex].prev) {
                    bottomContent.unshift(generatePrevButton(content[modalIndex], modalIndex, handlePrev));
                }
                
                return {
                    ...state,
                    mainContent: content[modalIndex]?.content,
                    bottomContent: bottomContent,
                    modalIndex: modalIndex,
                    callback: content[modalIndex]?.callback,
                };
            } case "settings": {
                let ifModalIsOpen = modalIsOpen;

                let fileChangeHandler = (id) => {
                    let file = d3.select(`#${id}File`).node().files[0];

                    if (file)
                        d3.select(`#${id}FileName`).text(file.name);
                    else
                        d3.select(`#${id}FileName`).text("No file selected");
                };

                let settingsContent = <>
                    <h3>Settings</h3>
                    <div style={{ width: "100%", display: "flex", gap: "20px", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                        
                        { studyState === "study" ? 
                            <>
                                <div className="field">
                                    <input id="pid" name="pid" required defaultValue={pid}/>
                                    <label htmlFor="pid">Participant ID</label>
                                </div>
                                <div className="settingsContainer"> 
                                    <p>Document Order</p>
                                    <div className="settings">
                                        <div>
                                            <input type="radio" id="firstDocument" name="documentOrder" value="firstDocument" defaultChecked={ifFirst}/>
                                            <label htmlFor="firstDocument">
                                                First 
                                                <svg stroke="currentColor" style={{ marginLeft: "5px", marginRight: "5px" }} fill="none" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                                                Second

                                            </label>
                                        </div>
                                        <div>
                                            <input type="radio" id="secondDocument" name="documentOrder" value="secondDocument" defaultChecked={!ifFirst}/>
                                            <label htmlFor="secondDocument">
                                                Second 
                                                <svg stroke="currentColor" style={{ marginLeft: "5px", marginRight: "5px" }} fill="none" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                                                First
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div className="settingsContainer"> 
                                    <p>LLM Order</p>
                                    <div className="settings">
                                        <div>
                                            <input type="radio" id="llmFirst" name="llmOrder" value="llmFirst" defaultChecked={llmFirst}/>
                                            <label htmlFor="llmFirst">LLM First</label>
                                        </div>
                                        <div>
                                            <input type="radio" id="llmSecond" name="llmOrder" value="llmSecond" defaultChecked={!llmFirst}/>
                                            <label htmlFor="llmSecond">Baseline First</label>
                                        </div>
                                    </div>
                                </div>
                                <div className="settingsContainer"> 
                                    <p>Data Upload</p>
                                    <div className="settings">
                                        <div style={{ gap: "10px", flexDirection: "column", marginTop: "10px" }}>
                                            <input type="file" id="strokeDataFile" name="strokeDataFile" accept=".csv" style={{ display: "none" }} onChange={() => fileChangeHandler("strokeData")} required="required" />
                                            <label htmlFor="strokeDataFile">Pen Stroke Upload File</label>
                                            <p id="strokeDataFileName">No file selected</p>
                                        </div>
                                        <div style={{ gap: "10px", flexDirection: "column", marginTop: "10px" }}>
                                            <input type="file" id="clusterDataFile" name="clusterDataFile" accept=".json" style={{ display: "none" }} onChange={() => fileChangeHandler("clusterData")} required="required" />
                                            <label htmlFor="clusterDataFile">Cluster Upload File</label>
                                            <p id="clusterDataFileName">No file selected</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="settingsContainer"> 
                                    <div className="settings" style={{ justifyContent: "space-evenly" }}>
                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                            <p>Handiness</p>
                                            <div style={{ display: "flex", alignItems: "center" }}>
                                                <p style={{ display: "inline", margin: 0 }}>Left</p>
                                                <label className="switch" style={{ border: "none", padding: 0 }}>
                                                    <input type="checkbox" defaultChecked={handiness === "right"} onChange={e => {
                                                        handinessChange(e.target.checked ? "right" : "left");
                                                        setHandiness(e.target.checked ? "right" : "left");
                                                    }} />
                                                    <span className="slider round"></span>
                                                </label>
                                                <p style={{ display: "inline", margin: 0 }}>Right</p>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                            <p>Enable/Disable</p>
                                            <div style={{ display: "flex", alignItems: "center" }}>
                                                <p style={{ display: "inline", margin: 0 }}>Disabled</p>
                                                <label className="switch" style={{ border: "none", padding: 0 }}>
                                                    <input type="checkbox" defaultChecked={!disabledRef.current} onChange={e => {
                                                        disabledChange(!e.target.checked);
                                                    }} />
                                                    <span className="slider round"></span>
                                                </label>
                                                <p style={{ display: "inline", margin: 0 }}>Enabled</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                            :
                            <>
                                <div className="settingsContainer"> 
                                    <p>LLM</p>
                                    <div className="settings">
                                        <div>
                                            <input type="radio" id="llmFirst" name="llmOrder" value="llmFirst" defaultChecked={llmFirst}/>
                                            <label htmlFor="llmFirst">LLM</label>
                                        </div>
                                        <div>
                                            <input type="radio" id="llmSecond" name="llmOrder" value="llmSecond" defaultChecked={!llmFirst}/>
                                            <label htmlFor="llmSecond">No LLM</label>
                                        </div>
                                    </div>
                                </div>
                                <div className="settingsContainer"> 
                                    <p>Data Upload</p>
                                    <div className="settings">
                                        <div style={{ gap: "10px", flexDirection: "column", marginTop: "10px" }}>
                                            <input type="file" id="strokeDataFile" name="strokeDataFile" accept=".csv" style={{ display: "none" }} onChange={() => fileChangeHandler("strokeData")} required="required" />
                                            <label htmlFor="strokeDataFile">Pen Stroke Upload File</label>
                                            <p id="strokeDataFileName">No file selected</p>
                                        </div>
                                        <div style={{ gap: "10px", flexDirection: "column", marginTop: "10px" }}>
                                            <input type="file" id="clusterDataFile" name="clusterDataFile" accept=".json" style={{ display: "none" }} onChange={() => fileChangeHandler("clusterData")} required="required" />
                                            <label htmlFor="clusterDataFile">Cluster Upload File</label>
                                            <p id="clusterDataFileName">No file selected</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="settingsContainer"> 
                                    <p>Document Upload</p>
                                    <div className="settings">
                                        <div style={{ gap: "10px", flexDirection: "column", marginTop: "10px" }}>
                                            
                                            <div style={{ gap: "20px", flexDirection: "row", marginTop: "10px" }}>
                                                <div>
                                                    <input type="radio" id="firstDocument" name="documentOrder" value="firstDocument" defaultChecked={ifFirst}/>
                                                    <label htmlFor="firstDocument">First Document</label>
                                                </div>
                                                <div>
                                                    <input type="radio" id="secondDocument" name="documentOrder" value="secondDocument" defaultChecked={!ifFirst}/>
                                                    <label htmlFor="secondDocument">Second Document</label>
                                                </div>
                                            </div>
                                            <hr style={{ width: "100%" }} />
                                            <i style={{ color: "#E58F65" }}>Make sure words are &quot;words&quot; <br/> Not images of words</i>
                                            <input type="file" id="documentFile" name="documentFile" accept=".pdf" style={{ display: "none" }} onChange={() => fileChangeHandler("document")} required="required" />
                                            <label htmlFor="documentFile">Upload File</label>
                                            <p id="documentFileName">No file selected</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="settingsContainer"> 
                                    <div className="settings" style={{ justifyContent: "space-evenly" }}>
                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                            <p>Handiness</p>
                                            <div style={{ display: "flex", alignItems: "center" }}>
                                                <p style={{ display: "inline", margin: 0 }}>Left</p>
                                                <label className="switch" style={{ border: "none", padding: 0 }}>
                                                    <input type="checkbox" defaultChecked={handiness === "right"} onChange={e => {
                                                        handinessChange(e.target.checked ? "right" : "left");
                                                        setHandiness(e.target.checked ? "right" : "left");
                                                    }} />
                                                    <span className="slider round"></span>
                                                </label>
                                                <p style={{ display: "inline", margin: 0 }}>Right</p>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                            <p>Enable/Disable</p>
                                            <div style={{ display: "flex", alignItems: "center" }}>
                                                <p style={{ display: "inline", margin: 0 }}>Disabled</p>
                                                <label className="switch" style={{ border: "none", padding: 0 }}>
                                                    <input type="checkbox" defaultChecked={!disabledRef.current} onChange={e => {
                                                        disabledChange(!e.target.checked);
                                                    }} />
                                                    <span className="slider round"></span>
                                                </label>
                                                <p style={{ display: "inline", margin: 0 }}>Enabled</p>
                                            </div>
                                        </div>
                                        
                                    </div>
                                </div>
                            </>
                        }
                    </div>
                </>;

                let exitTransitionStudy = (e, callback) => {
                    if (!ifModalIsOpen) {
                        setModalIsOpen(ifModalIsOpen);
                    }
                    d3.select(e.target.closest(".bottom"))
                    .selectAll(".modalButton")
                    .style("pointer-events", "none");

                    d3.select(".contentContainer")
                    .interrupt("revealContent")
                    .transition("hideContent")
                    .duration(500)
                    .style("opacity", "0")
                    .on("end", () => {
                        setModalContent({ type: "show" });
                        setModalIsOpen(ifModalIsOpen);

                        if (callback instanceof Function) {
                            callback();
                        }
                    });
                };

                let exitTransitionHome = (e) => {
                    setModalIsOpen(false);
                };

                let bottomContent = studyState === "study" ? 
                    [
                        generatePrevButton({ confirm: true }, 0, (e) => {
                            exitTransitionStudy(e);
                            onSettings.current = false;
                        }),
                        generateNextButton({ confirm: true }, 0, (e) => {
                            exitTransitionStudy(e);
                            onSettings.current = false;
                            setPid(document.getElementById("pid").value);

                            let currentIfFirst = d3.select("input[name='documentOrder']:checked").node().value === "firstDocument";
                            let currentLlmFirst = d3.select("input[name='llmOrder']:checked").node().value === "llmFirst";

                            setIfFirst(currentIfFirst);
                            setLlmFirst(currentLlmFirst);

                            if ((modalContent.studyState === "postTask" && !modalIsOpen) || (modalContent.studyState === "instructionTask" && modalIsOpen)) {
                                if (documentChange instanceof Function) {
                                    let currentDocument = (state.currentTask === 0 && currentIfFirst) || (state.currentTask === 1 && !currentIfFirst) ? 0 : 1;
                                    documentChange(currentDocument);
                                }
                                    
                                if (modeChange instanceof Function) {
                                    let currentMode = (state.currentTask === 0 && currentLlmFirst) || (state.currentTask === 1 && !currentLlmFirst) ? "llm" : "base";
                                    modeChange(currentMode);
                                }

                                if (fileHandler instanceof Function) {
                                    fileHandler(d3.select("#strokeDataFile").node().files[0], d3.select("#clusterDataFile").node().files[0]);
                                }
                            } else {
                                if (modeChange instanceof Function) {
                                    let currentMode = (state.currentTask === 0 && currentLlmFirst) || (state.currentTask === 1 && !currentLlmFirst) ? "llm" : "base";
                                    modeChange("practice" + currentMode);
                                }
                            }
                        }),
                        <hr key={"vr"} />,
                        generateNextButton({class: "skip"}, "skip", (e) => {
                            ifModalIsOpen = true;
                            onSettings.current = false;
                            onConfirm.current = false;

                            exitTransitionStudy(e, () => {
                                continueStudy(e, true);
                            });
                        }),
                    ] :
                    [
                        generatePrevButton({ confirm: true }, 0, (e) => {
                            exitTransitionHome(e);
                            onSettings.current = false;
                        }),
                        generateNextButton({ confirm: true }, 0, (e) => {
                            exitTransitionHome(e);
                            onSettings.current = false;
                            
                            let currentIfFirst = d3.select("input[name='documentOrder']:checked").node().value === "firstDocument";
                            let currentLlmFirst = d3.select("input[name='llmOrder']:checked").node().value === "llmFirst";

                            setIfFirst(currentIfFirst);
                            setLlmFirst(currentLlmFirst);

                            if (modeChange instanceof Function) {
                                modeChange(currentLlmFirst ? "llm" : "base");
                            }

                            if (documentChange instanceof Function) {
                                documentChange(currentIfFirst ? 0 : 1);
                            }

                            if (fileHandler instanceof Function) {
                                fileHandler(d3.select("#strokeDataFile").node().files[0], d3.select("#clusterDataFile").node().files[0], d3.select("#documentFile").node().files[0]);
                            }
                        }),
                    ];

                setModalIsOpen(true);

                return {
                    ...state,
                    mainContent: settingsContent,
                    bottomContent: bottomContent,
                };
            } 
            case "uncomplete": {
                let ifModalIsOpen = modalIsOpen;
                
                let message = <>
                    <div style={{ width: "100%", display: "flex", gap: "20px", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                        { action.message }
                    </div>
                </>;

                let exitTransition = (e, callback) => {
                    if (!ifModalIsOpen) {
                        setModalIsOpen(ifModalIsOpen);
                    }
                    d3.select(e.target.closest(".bottom"))
                    .selectAll(".modalButton")
                    .style("pointer-events", "none");

                    d3.select(".contentContainer")
                    .interrupt("revealContent")
                    .transition("hideContent")
                    .duration(500)
                    .style("opacity", "0")
                    .on("end", () => {
                        callback();
                    });
                };

                let bottomContent = [
                    generateNextButton({ confirm: true }, 0, (e) => {
                        exitTransition(e, () => {
                            setModalIsOpen(false);
                            onConfirm.current = false;
                        });
                    }),
                ];

                setModalIsOpen(true);

                return {
                    ...state,
                    mainContent: message,
                    bottomContent: bottomContent,
                };
            } case "confirmContinue": {
                onConfirm.current = true;
                let taskNum = state.studyState === "postTask" ? state.currentTask + 1 : state.currentTask;
                let currentMode = (taskNum === 0 && llmFirst) || (taskNum === 1 && !llmFirst) ? "llm" : "base";
                setModalIsOpen(true);
                
                if (state.currentTask <= 1 && checkTask instanceof Function) {
                    let ifContinue = checkTask();

                    if (ifContinue === true) {
                        let withdrawContent = <>
                            <div style={{ width: "100%", display: "flex", gap: "20px", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                                <p>Are you ready to continue?</p>
                            </div>
                        </>;

                        let exitTransition = (e, callback) => {
                            d3.select(e.target.closest(".bottom"))
                            .selectAll(".modalButton")
                            .style("pointer-events", "none");

                            d3.select(".contentContainer")
                            .interrupt("revealContent")
                            .transition("hideContent")
                            .duration(500)
                            .style("opacity", "0")
                            .on("end", () => {
                                callback();
                            });
                        };

                        let bottomContent = [
                            generatePrevButton({ confirm: true }, 0, (e) => {
                                exitTransition(e, () => {
                                    setModalIsOpen(false);
                                    onConfirm.current = false;
                                });
                            }),
                            generateNextButton({ confirm: true }, 0, (e) => {
                                exitTransition(e, () => {
                                    setModalIsOpen(true);
                                    setModalContent({ type: "nextTask" });
                                    setModalContent({ type: "show" });
                                    
                                    if (onNextTask instanceof Function) {
                                        onNextTask(-1, currentMode);
                                    }
                                    onConfirm.current = false;
                                });
                            }),
                        ];

                        return {
                            ...state,
                            mainContent: withdrawContent,
                            bottomContent: bottomContent,
                        };
                    } else {
                        return modalReducer(state, { type: "uncomplete", message: ifContinue });
                    }
                } else {
                    return modalReducer(state, { type: "nextTask" });
                }
            } case "withdraw": {
                let ifModalIsOpen = modalIsOpen;
                
                let withdrawContent = <>
                    <div style={{ width: "100%", display: "flex", gap: "20px", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                        <p>Are you sure you want to withdraw?</p>
                    </div>
                </>;

                let exitTransition = (e, callback) => {
                    if (!ifModalIsOpen) {
                        setModalIsOpen(ifModalIsOpen);
                    }
                    d3.select(e.target.closest(".bottom"))
                    .selectAll(".modalButton")
                    .style("pointer-events", "none");

                    d3.select(".contentContainer")
                    .interrupt("revealContent")
                    .transition("hideContent")
                    .duration(500)
                    .style("opacity", "0")
                    .on("end", () => {
                        callback();
                    });
                };

                let bottomContent = [
                    generatePrevButton({ confirm: true }, 0, (e) => {
                        exitTransition(e, () => {
                            setModalContent({ type: "show" });
                            setModalIsOpen(ifModalIsOpen);
                        });
                    }),
                    generateNextButton({ confirm: true }, 0, (e) => {
                        exitTransition(e, () => {
                            setModalIsOpen(false);

                            if (onFinish instanceof Function) {
                                onFinish("withDraw");
                            }
                        });
                    }),
                ];

                setModalIsOpen(true);

                return {
                    ...state,
                    mainContent: withdrawContent,
                    bottomContent: bottomContent,
                };
            }
            default:
        }
    };
    
    useEffect(() => {
        preStudyContent.current = [
            {
                "content": <>
                    <h3 style={{width: "100%", textAlign: "center"}}>Pre-Study Questionnaire</h3>
                    <iframe src={"https://docs.google.com/forms/d/e/1FAIpQLScgmHDH7qSFIwq9FuaU9Wen7tTIRU-OLhTl1E5eA3GloANh6A/viewform?usp=pp_url&entry.1005799276=" + pid} title="preStudy" />
                </>,
                "prev": false,
            },
            {
                "content": <div style={{ textAlign: "center" }}>
                    Have you click this <div className={"googleSubmit " + googleSans.className}><div className="buttonOverlay"></div><span>Submit</span></div> button on the Google Form? <br />
                    (Not this <button className={"round modalButton nextButton"}>
                        <div id={"cta"}>
                            <span className={"arrow next primera"} style={{ fontSize: "20px" }}>&nbsp;</span>
                            <span className={"arrow next segunda"}></span>
                        </div>
                    </button> button)
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
                    <h3 style={{ width: "100%", textAlign: "center" }}>Welcome to the Study</h3>
                    <ul> 
                        <li style={{ margin: "30px 0px" }}>Your task is to evaluate our annotation tools.</li>
                        <li style={{ margin: "30px 0px" }}>If you have any question at any point, please ask.</li>
                    </ul>
                </div>,
                "prev": true,
            },
        ];

        
        let currentMode = (modalContent.currentTask === 0 && llmFirst) || (modalContent.currentTask === 1 && !llmFirst) ? "LLM" : "Baseline";
        let modeOrder = modalContent.currentTask === 0 ? "First" : "Second";

        let instructionContent;

        if (currentMode === "Baseline" && modeOrder === "Second") {
            instructionContent = <ul> 
                <li style={{ margin: "30px 0px" }}>You will be annotating the document without assistance</li>
                <li style={{ margin: "30px 0px" }}>You can practice the interface yourself</li>
            </ul>;
        } else {
            instructionContent = <Player src={`./tutorial/${currentMode}%20${modeOrder}.mp4`} track={`./tutorial/${currentMode}%20${modeOrder}.vtt`}/>;
        }

        preTaskContent.current = [
            {
                "content": 
                <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
                    <h3 style={{width: "100%", textAlign: "center"}}>Tutorial</h3>
                    { instructionContent }
                </div>,
            },
        ];

        if (currentMode === "LLM") {
            preTaskContent.current.push({
                "content": <div style={{ textAlign: "center" }}>
                    <h3>Scrollbar Info</h3>

                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px" }}>
                        <Image src="/tutorial/Scrollbar.png" alt="logo" width={740 * 0.7} height={752 * 0.7} />
                        <div style={{ textAlign: "left", width: "50%" }}>
                            A specialized scrollbar with three columns to help you navigate the annotations:
                            <br /><br />
                            <b>Left Column</b>: Position of your annotations.
                            <br /><br />
                            <b>Center Column</b>: Position and state of the assistant markers. 
                            <br /><span style={{ color: "#06D6A0" }} >Green</span>: Assistant is done annotating.
                            <br /><span style={{ color: "#FFFD82" }} >Yellow</span>: Assistant is waiting for you to pick a purpose.
                            <br /><span style={{ color: "#F96900" }} >Orange</span>: Assistant is processing.
                            <br /><br />
                            <b>Right Column</b>: Position of the assistant&apos;s annotations.
                            <br /><span style={{ color: "#06D6A0" }} >Green</span>: Accepted sentence.
                            <br /><span style={{ color: "#FFFD82" }} >Yellow</span>: Unrated sentence.
                        </div>
                    </div>
                </div>,
                "prev": true,
            });
        }

        preTaskContent.current.push({
            "content": <div style={{ textAlign: "center" }}>
                Are you ready to practice? (This is not the actual task)
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
        });
        
        instructionTaskContent.current = [
            {
                "content": 
                <div>
                    <h3 style={{ width: "100%", textAlign: "center" }}>Instructions</h3>
                    <ul style={{ width: "80%", margin: "auto" }}> 
                        <li style={{ margin: "30px 0px" }}>Your task is to give feedback on an English test.</li>
                        <li style={{ margin: "30px 0px" }}>Annotate any issues you see (e.g. grammar, sentence structure, clarity, etc.)</li>
                        <li style={{ margin: "30px 0px" }}>You must make at least one annotation.</li>
                        { currentMode === "LLM" ? 
                            <>
                                <li style={{ margin: "30px 0px" }}>You must use the assistance at least once (activating and annotating with marker).</li>
                                <li style={{ margin: "30px 0px" }}>You must rate all annotations by:
                                    <ul style={{ width: "90%", margin: "auto" }}>
                                        <li>
                                            Accepting (
                                            <div className="rateContainer" style={{ display: "inline-flex", verticalAlign: "middle" }}>
                                                <div className="rateButton">
                                                    <FaThumbsUp size={20} style={{ color: "#2eb086", strokeWidth: "1", transform: "translateY(-3px)" }} />
                                                </div>
                                            </div>
                                            ) if the sentence matches the purpose of the annotation.
                                        </li>
                                        <li>
                                            Rejecting (
                                            <div className="rateContainer" style={{ display: "inline-flex", verticalAlign: "middle" }} >
                                                <div className="rateButton" >
                                                    <FaThumbsDown size={20} style={{ color: "#b8405e", strokeWidth: "1" }} />
                                                </div>
                                            </div>
                                            ) if the annotations does not match the purpose of the annotation.
                                        </li>
                                        <li>
                                            Helpful (
                                            <div className="rateContainer" style={{ display: "inline-flex", verticalAlign: "middle" }} >
                                                <div className="rateButton">
                                                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 192 752" height="30" width="20" xmlns="http://www.w3.org/2000/svg" style={{ color: "rgb(234, 196, 53)", strokeWidth: 1, transform: "translateY(-5px)" }}>
                                                        <path d="m93.489 144.6292c10.3435 5.5885 21.039 10.4645 32.0016 14.7095 5.9986 2.323 12.1322 4.2685 17.6396-.3986 2.0394-1.7284 3.4942-4.1222 5.0213-6.2952 1.7157-2.4406 3.4223-4.8877 5.1202-7.3415 13.2973-19.2186 26.0387-38.8224 38.2-58.7794 6.9002-11.3235 13.6097-22.7616 20.1392-34.3031 2.6225-4.6353-.1204-9.2534-4.606-11.0101-22.3522-8.7539-44.2964-19.4234-65.2243-31.4952-4.571-2.6368-9.3254.121-11.0101 4.606-14.3497 38.1965-27.636 76.787-39.8419 115.7212-2.0148 7.8671-1.137 12.5886 2.5604 14.5864l0 0zm83.815 29.5603c-3.822-2.6968-8.7492-3.1426-11.576-.0935-2.6749 2.8851-3.1362 7.737-.0763 10.6092 7.6256 7.1572 15.2434 14.3226 22.8773 21.4713 4.2742 4.0029 9.3572 7.4439 15.4962 5.6068 4.9748-1.4885 8.736-5.6332 12.4995-8.9948 15.8644-14.1709 31.7294-28.3419 47.5942-42.5125 15.8648-14.1706 31.7294-28.3419 47.5942-42.5125 7.9325-7.0855 15.8644-14.1709 23.7969-21.2564 3.9027-3.4856 8.8843-6.864 11.7341-11.3171 3.3591-5.2492 2.2091-11.3114-1.6419-15.8771-3.491-4.1384-8.7635-7.1011-13.1133-10.2672-4.8262-3.5127-9.6679-7.0038-14.5247-10.4735-9.714-6.9398-19.4908-13.791-29.3239-20.5605-2.5296-1.7416-6.9789-1.1581-9.0161 1.1523-30.1597 34.2041-59.6849 68.9663-88.544 104.2747-8.1559 9.9784-16.2567 20.0013-24.3074 30.0647-2.4402 3.0506-3.2857 7.6339-.0763 10.6092 2.6877 2.4933 7.9868 3.353 10.6075.0769l0 0zm70.8467 57.5819c-7.204-8.5683-12.4795-9.5489-15.7657-7.6761-3.7997 2.1652-4.4743 6.5308-2.8007 10.232 4.8742 10.7787 9.7488 21.5576 14.623 32.3362 1.3114 2.8997 5.5047 4.4425 8.4571 3.5288 20.783-6.4322 41.5663-12.8649 62.3493-19.2972 5.8156-1.7999 6.8694-8.0752 3.4016-12.5108-11.3759-14.5503-19.5134-32.4987-23.4172-51.2313-.9202-4.4151-7.1129-7.2971-10.9603-4.5751-16.4399 11.6308-31.9934 24.4552-46.421 38.5075-2.8086 2.7357-3.034 7.867-.0763 10.6092 2.9979 2.7786 7.6022 3.0068 10.6102.0768l0 0zm-72.1507 430.2286c0 44.112-35.888 80-80 80s-80-35.888-80-80 35.888-80 80-80 80 35.888 80 80zm-150.74-406.801 13.6 272c.639 12.773 11.181 22.801 23.97 22.801h66.34c12.789 0 23.331-10.028 23.97-22.801l13.6-272c.685-13.709-10.244-25.199-23.97-25.199h-93.54c-13.726 0-24.655 11.49-23.97 25.199z"/>
                                                    </svg>
                                                </div>
                                            </div>
                                            ) if the annotation does not match the purpose, but provided good feedback.
                                        </li>
                                    </ul>
                                </li>
                                <li style={{ margin: "30px 0px" }}>You have 30 minutes to complete the tasks. The pen and the assistant will be disabled during the last 5 minutes to finalize your ratings.</li>
                            </>
                            :
                            <>
                                <li style={{ margin: "30px 0px" }}>You have 30 minutes to complete the tasks.</li>
                            </>
                        }
                    </ul>
                </div>,
                "nextCallback": () => {
                    let sendToast = (message) => {
                        let options = {
                            autoClose: false,
                            closeButton: true,
                            closeOnClick: false,
                            pauseOnFocusLoss: false,
                            draggable: false,
                            theme: "dark",
                            transition: cssTransition({
                                enter: "jello-horizontal",
                                exit: "flip-out-hor-top",
                            }),
                            style: { pointerEvents: "all" }
                        };

                        let messageContainer = <div id={"prompt"} style={{ textAlign: "center", width: "100%" }}>
                            {message}
                        </div>;

                        if (!toast.isActive("remindMessage")) {
                            toast(messageContainer, {
                                containerId: "studyMessage",
                                toastId: "remindMessage",
                                ...options,
                                transition: cssTransition({
                                    enter: "flip-in-hor-bottom",
                                    exit: "flip-out-hor-top",
                                }),
                            });
                        } else {
                            toast.update("remindMessage", {
                                containerId: "studyMessage",
                                render: messageContainer,
                                ...options,
                            });
                        }
                    };
                    let twentyMinutes = 20 * 60 * 1000;
                    let twentyFiveMinutes = 25 * 60 * 1000;
                    let thirtyMinutes = 30 * 60 * 1000;

                    if (currentMode === "LLM") {
                        setTimeout(() => {
                            sendToast(<>{"You have 5 minutes left to annotate the document. Afterwards, you will need to rate all annotations."}</>);
                        }, twentyMinutes);
                        
                        setTimeout(() => {
                            if (disabledChange instanceof Function) {
                                disabledChange(true);
                            }
                            sendToast(<>{"The annotation tool is disabled."} <br /> {"Please rate all annotations."}</>);
                        }, twentyFiveMinutes);

                        setTimeout(() => {
                            sendToast(<>{"30 minutes have passed."} <br /> {" Please finish up and proceed by clicking the green arrow."}</>);
                        }, thirtyMinutes);
                    } else {
                        setTimeout(() => {
                            sendToast("You have 5 minutes left to annotate the document.");
                        }, twentyFiveMinutes);

                        setTimeout(() => {
                            if (disabledChange instanceof Function) {
                                disabledChange(true);
                            }
                            sendToast(<>{"30 minutes have passed."} <br /> {"The annotation tool is disabled."} <br /> {"Please proceed by clicking the green arrow."}</>);
                        }, thirtyMinutes);
                    }
                },
            },
        ];

        postTaskContent.current = [
            {
                "content": <>
                    <h3 style={{width: "100%", textAlign: "center"}}>Post-Task Questionnaire</h3>
                    <iframe src={`https://docs.google.com/forms/d/e/1FAIpQLSdB6cL-3ku9O4mDSkaZPK_Sm_RLe0W1737jSVM0ac5QsYgGHA/viewform?usp=pp_url&entry.1937451035=${pid}&entry.1042914034=${currentMode === "LLM" ? "With+Assistance" : "Without+Assistance"}`} title="postTask" />
                </>,
                "prev": false,
            },
            {
                "content": <div style={{ textAlign: "center" }}>
                    Have you click this <div className={"googleSubmit " + googleSans.className}><div className="buttonOverlay"></div><span>Submit</span></div> button on the Google Form? <br />
                    (Not this <button className={"round modalButton nextButton"}>
                        <div id={"cta"}>
                            <span className={"arrow next primera"} style={{ fontSize: "20px" }}>&nbsp;</span>
                            <span className={"arrow next segunda"}></span>
                        </div>
                    </button> button)
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
        ];

        postStudyContent.current = [
            {
                "content": <div style={{ textAlign: "center" }}>
                    This is the end of the study. We will ask you some questions now...
                </div>,
                "prev": false,
                "confirm": true,
                "disableNext": true,
                "callback": () => {
                    setTimeout(() => {
                        d3.select(".modalButton.disabled")
                        .classed("enable", true);
                    }, 1000);
                },
            },
        ];
    }, [disabledChange, llmFirst, modalContent.currentTask, pid]);

    let setUp = useCallback(() => {
        if (modalIsOpen) {
            let iframe = d3.select(".contentContainer").select("iframe").node();
            let reveal = false;
            
            let revealContent = () => {
                if (!reveal) {
                    reveal = true;

                    d3.select(".contentContainer")
                    .interrupt("revealContent")
                    .transition("revealContent")
                    .duration(500)
                    .style("opacity", "1");
                }
            };

            if (iframe || iframe?.contentDocument) {
                iframe.addEventListener("load", () => {
                    if (!onSettings.current) {
                        revealContent();
                    }
                });

                iframe.addEventListener("error", (e) => {
                    if (!onSettings.current) {
                        revealContent();
                    }
                });

                setTimeout(() => {
                    if (!onSettings.current) {
                        revealContent();
                    }
                }, 3000);
            } else {
                revealContent();
            }
        }
    }, [modalIsOpen]);

    function setUpButtons() {
        let leave = new Map();
        let animationendForward = new Map();
        let animationendReverse = new Map();

        d3.select(".contentContainer")
        .select(".bottom")
        .selectAll(".modalButton:not(.disabled)")
        .style("pointer-events", "all");
        
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
        
        d3.selectAll(".modalButton.nextButton:not(.confirm), .modalButton.prevButton:not(.cancel)")
        .each((d, i, n) => {
            leave.set(n[i], true);
            animationendForward.set(n[i], true);
            animationendReverse.set(n[i], true);
        })
        .on("pointerenter", (e) => {
            leave.set(e.srcElement, false);

            if (animationendReverse.get(e.srcElement)) {
                d3.select(e.srcElement)
                .classed("animated", true)
                .classed("reverse", false);

                animationendReverse.set(e.srcElement.closest(".modalButton"), true);
                animationendForward.set(e.srcElement.closest(".modalButton"), false);
            } else {
                animationendReverse.set(e.srcElement.closest(".modalButton"), false);
                animationendForward.set(e.srcElement.closest(".modalButton"), true);
            }
        })
        .on("pointerleave", (e) => {
            leave.set(e.srcElement, true);
            
            if (animationendForward.get(e.srcElement)) {
                d3.select(e.srcElement)
                .classed("animated", false)
                .classed("reverse", true);

                animationendReverse.set(e.srcElement.closest(".modalButton"), false);
                animationendForward.set(e.srcElement.closest(".modalButton"), true);
            } else {
                animationendReverse.set(e.srcElement.closest(".modalButton"), true);
                animationendForward.set(e.srcElement.closest(".modalButton"), false);
            }
        });
    }
    
    useEffect(() => {
        setUp();
        setUpButtons();

        if (modalContent.callback instanceof Function) {
            modalContent.callback();
        }

        if (modalContent.studyState === "finishStudy" && onFinish instanceof Function) {
            onFinish("finishStudy");
            setModalContent({ type: "start" });
        }
    }, [modalContent, setUp, onFinish]);

    useEffect(() => {
        if (studyState === "study" && toastMessage && toastMessage !== "") {
            let messageContainer = <div id={"prompt"} style={{ textAlign: "center", width: "100%" }}>
                {toastMessage}
            </div>;

            let options = {
                autoClose: false,
                closeButton: false,
                closeOnClick: false,
                pauseOnFocusLoss: false,
                draggable: false,
                theme: "dark",
                transition: cssTransition({
                    enter: "jello-horizontal",
                    exit: "flip-out-hor-top",
                }),
            };

            if (!toast.isActive("practiceMessage")) {
                toast(messageContainer, {
                    containerId: "studyMessage",
                    toastId: "practiceMessage",
                    ...options,
                    transition: cssTransition({
                        enter: "flip-in-hor-bottom",
                        exit: "flip-out-hor-top",
                    }),
                });
            } else {
                toast.update("practiceMessage", {
                    render: messageContainer,
                    containerId: "studyMessage",
                    ...options,
                });
            }
        } else {
            toast.dismiss({
                id: "practiceMessage"
            });
        }
    }, [toastMessage, studyState]);

    useEffect(() => {
        disabledRef.current = disabled;
    }, [disabled]);

    useImperativeHandle(ref, () => ({
        pid: pid,
        ifFirst: ifFirst,
        llmFirst: llmFirst,
        setIfFirst: setIfFirst,
        setLlmFirst: setLlmFirst,
        setModalIsOpen: setModalIsOpen,
        setModalContent: setModalContent,
    }), [pid, ifFirst, llmFirst, setIfFirst, setLlmFirst]);

    return (
        <>
            {
                studyState === "study" ? 
                    <div className={"studyMenu " + handiness}>
                        <div className="withdraw" onClick={withdraw}>
                            <ImExit />
                        </div>
                        <div className={"continue disabled " + (disableNext ? "" : "enable")} onClick={continueStudy}>
                            <HiOutlineChevronDoubleRight />
                        </div>
                    </div>
                    :
                    null
            }
            <Modal
                isOpen={modalIsOpen}
                className="modal"
                overlayClassName="overlay"
                closeTimeoutMS={500}
                onRequestClose={() => setModalIsOpen(false)}
                onAfterOpen={() => { setUp(); setUpButtons(); }}
                shouldCloseOnEsc={false}
                shouldFocusAfterRender={true}
                shouldCloseOnOverlayClick={false}
            >
                <div className={"contentContainer " + googleSans.className}>
                    <div className="studyInfo" data-tooltip-id="my-tooltip"><span>?</span></div>
                    {modalContent.mainContent}

                    <div className={"bottom"}>
                        {modalContent.bottomContent}
                    </div>
                </div>
                <Tooltip style={{ padding: "16px", borderRadius: "8px", background: "#22262b" }} id="my-tooltip" openEvents={{ click: true }} closeEvents={{ click: true }} globalCloseEvents={{ clickOutsideAnchor: true, resize: true, escape: true, scroll: true }} place="bottom-end">
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
                        <span style={{ paddingLeft: "10px" }}> #18136 </span>
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
                        <span style={{ paddingLeft: "10px" }}> <a href="https://vialab.ca" target="_blank" rel="noreferrer" style={{ pointerEvents: "all", color: "white", textDecoration: "underline" }}>Vialab</a> (Ontario Tech University, UA 4150) </span>
                    </div>
                </Tooltip>
            </Modal>
        </>
        
    );
};

export default StudyModal;