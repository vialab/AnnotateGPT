// "use client";

import { useState, useRef, useReducer, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

import Modal from "react-modal";
import { ImMail4, ImInfo } from "react-icons/im";
import { Tooltip } from "react-tooltip";
import * as d3 from 'd3';

import { googleSans } from "@/app/page.js";
import "./css/StudyModal.css";

Modal.setAppElement("body");

const StudyModal = forwardRef(({ onFinish }, ref) => {
    let [ pid, setPid ] = useState("test");
    let [ modalIsOpen, setModalIsOpen ] = useState(false);
    
    let preStudyContent = useRef([]);
    let postTaskContent = useRef([]);
    let postStudyContent = useRef([]);

    let onSettings = useRef(false);

    let [ modalContent, setModalContent ] = useReducer(modalReducer, { mainContent: null, bottomContent: null, modalIndex: 0, studyState: "preStudy", currentTask: 0 });

    useEffect(() => {
        setModalContent({ type: "start" });
        setModalIsOpen(true);
    }, []);

    useEffect(() => {
        d3.select(document).on("keydown", (e) => {
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
                    setModalIsOpen(false);
                    studyState = "postTask";
                    break;
                } case "postTask": {
                    if (state.currentTask === 1) {
                        setModalIsOpen(true);
                        studyState = "postStudy";
                    } else {
                        setModalIsOpen(false);
                        studyState = "postTask";
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

        function handleNext() {
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
            return <button className={"round modalButton nextButton" + (content?.disableNext ? " disabled" : "") + (content?.confirm ? " confirm" : "")} onClick={callback} key={state.studyState + "next" + index}>
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
            return <button className={"round modalButton prevButton"+ (content?.confirm ? " cancel" : "")} onClick={callback} key={state.studyState + "prev" + index}>
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
                    mainContent: content[0]?.content,
                    bottomContent: [generateNextButton(content[0], 0, handleNext)],
                    modalIndex: 0,
                    callback: content[0]?.callback,
                    studyState: "preStudy",
                    currentTask: 0,
                };
            } case "show": {
                let modalIndex = state.modalIndex;
                let content = getContent();

                let bottomContent = [generateNextButton(content[modalIndex], modalIndex, handleNext)];

                if (content[modalIndex]?.prev) {
                    bottomContent.unshift(generatePrevButton(content[modalIndex], modalIndex, handlePrev));
                }

                return {
                    ...state,
                    mainContent: content[modalIndex]?.content,
                    bottomContent: bottomContent,
                    callback: content[modalIndex]?.callback,
                };
            } case "next": {
                let modalIndex = state.modalIndex + 1;

                let content = getContent();

                if (modalIndex < content.length) {
                    let bottomContent = [generateNextButton(content[modalIndex], modalIndex, handleNext)];
    
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
                    let currentTask = state.currentTask;

                    if (state.studyState === "postTask") {
                        currentTask++;
                    }
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
                            bottomContent: [generateNextButton(content[0], 0, handleNext)],
                            modalIndex: 0,
                            callback: content[0]?.callback,
                            studyState: studyState,
                            currentTask: currentTask,
                        };
                    }
                }
            } case "prev": {
                let modalIndex = Math.max(state.modalIndex - 1, 0);

                let content = getContent();
                let bottomContent = [generateNextButton(content[modalIndex], modalIndex, handleNext)];

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

                let settingsContent = <>
                    <h3>Settings</h3>
                    <div style={{ width: "100%", display: "flex", gap: "20px", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                        
                        <div className="field">
                            <input id="pid" name="pid" required defaultValue={pid}/>
                            <label htmlFor="pid">Participant ID</label>
                        </div>
                    </div>
                </>;

                let exitTransition = (e) => {
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
                    });
                };

                let bottomContent = [
                    generatePrevButton({ confirm: true }, 0, (e) => {
                        exitTransition(e);

                        onSettings.current = false;
                    }),
                    generateNextButton({ confirm: true }, 0, (e) => {
                        exitTransition(e);

                        onSettings.current = false;
                        setPid(document.getElementById("pid").value);
                    }),
                ];

                setModalIsOpen(true);

                return {
                    ...state,
                    mainContent: settingsContent,
                    bottomContent: bottomContent,
                };
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
                                onFinish();
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
            // {
            //     "content": <>
            //         <h3 style={{width: "100%", textAlign: "center"}}>Pre Study Questionnaire</h3>
            //         <iframe src={"https://docs.google.com/forms/d/e/1FAIpQLSfZgJz4b0MjiIblc-hrb4QKoZvQ0S0J9Ddw0xHgqxENAUMQRA/viewform?usp=pp_url&entry.1500102265=" + pid} title="preStudy" />
            //     </>,
            //     "prev": false,
            // },
            // {
            //     "content": <div style={{ textAlign: "center" }}>
            //         Have you submitted the questionnaire?
            //     </div>,
            //     "prev": true,
            //     "confirm": true,
            //     "disableNext": true,
            //     "callback": () => {
            //         setTimeout(() => {
            //             d3.select(".modalButton.disabled")
            //             .classed("enable", true);
            //         }, 1000);
            //     },
            // },
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

        postTaskContent.current = [
            {
                "content": 
                <div>
                    <h3 style={{width: "100%", textAlign: "center"}}>Post Task Questionnaire</h3>
                    <ul> 
                        <li style={{ margin: "30px 0px" }}>Bla bla bla</li>
                    </ul>
                </div>,
            },
        ];

        postStudyContent.current = [
            {
                "content": 
                <div>
                    <h3 style={{width: "100%", textAlign: "center"}}>Post Study Questionnaire</h3>
                    <ul> 
                        <li style={{ margin: "30px 0px" }}>Bla bla bla</li>
                    </ul>
                </div>,
            },
        ];
    }, [pid]);

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
                iframe.addEventListener('load', () => {
                    if (!onSettings.current) {
                        revealContent();
                    }
                });

                iframe.addEventListener('error', (e) => {
                    console.log(e);

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
            if (e.srcElement.closest(".modalButton").classList.contains("reverse")) {
                animationendReverse.set(e.srcElement.closest(".modalButton"), false);
                animationendForward.set(e.srcElement.closest(".modalButton"), true);
            } else {
                animationendReverse.set(e.srcElement.closest(".modalButton"), true);
                animationendForward.set(e.srcElement.closest(".modalButton"), false);
            }
        })
        .on("animationend", (e) => {
            if (e.srcElement.closest(".modalButton").classList.contains("reverse"))
                animationendReverse.set(e.srcElement.closest(".modalButton"), true);
            else
                animationendForward.set(e.srcElement.closest(".modalButton"), true);

            if (leave.get(e.srcElement.closest(".modalButton"))) {
                d3.select(e.srcElement.closest(".modalButton"))
                .classed("animated", false)
                .classed("reverse", true);
            } else {
                d3.select(e.srcElement.closest(".modalButton"))
                .classed("animated", true)
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
            onFinish();
        }
    }, [modalContent, setUp, onFinish]);

    useImperativeHandle(ref, () => ({
        pid: pid,
        setModalIsOpen: setModalIsOpen,
        setModalContent: setModalContent,
    }), [pid]);

    return (
        <>
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
                        <span style={{ paddingLeft: "10px" }}> <a href="https://vialab.ca" target="_blank" rel="noreferrer" style={{ pointerEvents: "all", color: "white", textDecoration: "underline" }}>Vialab</a> (Ontario Tech University, UA 4150) </span>
                    </div>
                </Tooltip>
            </Modal>
        </>
        
    );
});

StudyModal.displayName = "StudyModal";
export default StudyModal;