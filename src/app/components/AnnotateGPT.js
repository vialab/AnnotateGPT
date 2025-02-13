"use client";

import { createRef, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image.js";
import { Document, Page } from "react-pdf";
import * as d3 from "d3";
import { Comment, MagnifyingGlass } from "react-loader-spinner";
import { pdfjs } from "react-pdf";
import { Tooltip } from "react-tooltip";
import { autoPlacement } from "@floating-ui/dom";
// import { RxCheck, RxCross2 } from "react-icons/rx";
import { FaThumbsUp, FaThumbsDown, FaExclamation  } from "react-icons/fa";
import { split } from "sentence-splitter";
import { toast } from "react-toastify";
import axios from "axios";

import PenAnnotation from "./PenAnnotation.js";
import Toolbar from "./Toolbar.js";
import NavigateCluster from "./NavigateCluster.js";
import Loading from "./Loading.js";
import { findAnnotations } from "./js/OpenAIUtils.js";
import { googleSans } from "@/app/page.js";
import Minimap from "./Minimap.js";

import "react-tooltip/dist/react-tooltip.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./css/AnnotateGPT.css";
// import PathExtras from "./js/PathExtras.js";

// pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
).toString();

export default function AnnotateGPT({ documentPDF, pEndCallback, onECallback, onInferenceCallback, onEndAnnotateCallback, navigateCallback, onReplyCallback, svgContent, screen, mode, annotateRef, handiness, disabled }) {
    const defaultColour = "#3f51b5";

    // const [numPages, setNumPages] = useState();
    const [colour, setColour] = useState(defaultColour);
    const [pageContent, setPageContent] = useState([]);
    const [penAnnotation, setPenAnnotation] = useState([]);
    const [tool, setTool] = useState("pen");
    const [activeCluster, setActiveCluster] = useState(null);
    const [getActiveAnnotations, setGetActiveAnnotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingDocument, setLoadingDocument] = useState(true);
    const [dismiss, setDismiss] = useState(false);
    const [progress, setProgress] = useState(0);
    const [minimapHeight, setMinimapHeight] = useState(0);

    const svgContentRef = useRef([]);
    const annotationToolTipRef = useRef(null);
    const explanationToolTipRef = useRef(null);
    
    const textContent = useRef([]);
    const annotatedTokens = useRef([]);
    const rawAnnotationOutput = useRef([]);
    const toolTipRef = useRef("pen");
    const colourRef = useRef(defaultColour);
    const activeClusterRef = useRef(null);
    const penAnnotationRef = useRef([]);
    const modeRef = useRef(mode);
    const miniMapRef = useRef(null);
    const handinessRef = useRef(handiness);
    const numPagesRef = useRef(0);
    const disableRef = useRef(disabled);

    if (annotateRef)
        annotateRef.current = {
            penAnnotation: penAnnotationRef.current,
            annotate: annotate,
            annotatedTokens: annotatedTokens.current,
        };

    const textRenderer = useCallback((textItem) => {
        let text = textItem.str;
        let leadingSpaces = text.match(/^ */)[0].length;
        let trailingSpaces = text.match(/ *$/)[0].length;
        let words = text.split(" ").filter((word) => word !== "");
        let content = "";

        for (let i = 0; i < leadingSpaces; i++) {
            content += `<span class="space"> </span>`;
            // d3.select(span).append("span").text(" ").attr("class", "space").style("user-select", "none");
        }

        words.forEach((word, i) => {
            let characters = word.split("");

            content += `<span class="word">`;

            characters.forEach((character) => {
                content += `<span class="character">${character}</span>`;
            });

            content += `</span>`;

            if (i !== words.length - 1) {
                content += `<span class="space"> </span>`;
            }
        });

        if (words.length !== 0) {
            for (let i = 0; i < trailingSpaces; i++) {
                content += `<span class="space"> </span>`;
            }
        }
        return content;
    }, []);

    async function onDocumentLoadSuccess(pdf) {
        let numPages = pdf.numPages;
        // numPages = 8;
        // setNumPages(numPages);
        numPagesRef.current = numPages;
        svgContentRef.current = Array(numPages).fill(null);
        textContent.current = Array(numPages).fill(null);

        let pageContent = Array.from(new Array(numPages), (el, index) =>
            <div className="page-container" key={`pageContainer_${index + 1}`} style={{ position: "relative" }}>
                <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    width={window.innerWidth - window.innerWidth * 0.45}
                    customTextRenderer={textRenderer}
                    onRenderTextLayerSuccess={() => onLoad(index + 1)}
                    className={`page-${index + 1}`}
                >
                </Page>
                { index !== numPages - 1 ? <hr style={{ width: "100%" }} /> : null }
            </div>
        );
        resetToolTips();
        setPageContent(pageContent);
    }

    useEffect(() => {
        if (!loading && !loadingDocument) {
            d3.select("#loader-container")
            .style("pointer-events", "none")
            .transition("loadingDocument")
            .delay(500)
            .duration(1000)
            .style("opacity", 0)
            .on("end", () => {
                setDismiss(true);
            });
        } else {
            setDismiss(false);
        }
    }, [loading, loadingDocument]);

    useEffect(() => {
        modeRef.current = mode;
        // console.log(mode);

        for (let penAnnotation of penAnnotationRef.current) {
            penAnnotation.current?.setMode(mode);
        }

        if (typeof mode === "string" && !mode.toLowerCase().includes("llm")) {
            resetToolTips();
        }
    }, [mode]);

    useEffect(() => {
        if (svgContent instanceof Array && !loading) {
            d3.selectAll(".page-container").style("content-visibility", "visible");
            let newStrokes = new Map();

            for (let svg of svgContent) {
                let page = svg.page;
                let svgContent = svg.svg;
                let strokeID = svg.id;

                if (page && svgContent && strokeID) {
                    // let penAnnnotationRef = penAnnotationRef.current[page - 1];
                    // d3.select(penAnnnotationRef.current.svgRef).html(d3.select(penAnnnotationRef.current.svgRef).html() + svgContent.replace("lineDraw", ""));
                    // let pathD = svgContent.match(/d="[^"]*"/g);
                    
                    // console.log(PathExtras.getStrokeFromSvgPath(pathD));
                    
                    if (newStrokes.has(page)) {
                        newStrokes.get(page).push([strokeID, svg]);
                    } else {
                        newStrokes.set(page, [[strokeID, svg]]);
                    }
                }
            }
            // console.log(newStrokes);

            for (let [page, svgContent] of newStrokes) {
                let penAnnnotationRef = penAnnotationRef.current[page - 1];
                d3.select(penAnnnotationRef.current.svgRef).html(d3.select(penAnnnotationRef.current.svgRef).html() + svgContent.map((svg) => svg[1].svg).join(""));
            }

            for (let [page, svgContent] of newStrokes) {
                let clusters, stopIteration, strokeAdded = false;
                let penAnnnotationRef = penAnnotationRef.current[page - 1];

                loop1: for (let [id, svg] of svgContent) {
                    for (let cluster of penAnnnotationRef.current.lockClusters.current) {
                        for (let stroke of cluster.strokes) {
                            if (stroke.id === id) {
                                continue loop1;
                            }
                        }
                    }
                    strokeAdded = true;

                    let path = d3.select(`.lineDraw[id="${id}"]`);
                    let pageTop = d3.select(".pen-annotation-layer#layer-" + page).node().getBoundingClientRect().top;
                    let outLinePath = d3.select(penAnnnotationRef.current.svgRef).append("path");

                    if (path.empty()) {
                        continue loop1;
                    }

                    outLinePath
                    .attr("d", path.attr("d"))
                    .attr("class", "lineDrawOutline")
                    .style("fill", "none")
                    .style("stroke", "none")
                    .style("opacity", "0")
                    .style("stroke-width", 30)
                    .attr("id", path.attr("id") + "Outline");

                    let bbox = path.node().getBoundingClientRect();
                    let height = d3.select(".pen-annotation-layer#layer-" + page).node().getBoundingClientRect().height || window.innerHeight;
                    bbox.y -= pageTop;

                    let standardBBox = (bbox) => {
                        if (!bbox.x) {
                            bbox.x = Infinity;
                            bbox.y = Infinity;
                            bbox.width = -Infinity;
                            bbox.height = -Infinity;
                            bbox.top = Infinity;
                            bbox.right = -Infinity;
                            bbox.bottom = -Infinity;
                            bbox.left = Infinity;
                            return;
                        }
                        bbox.x *= window.innerWidth;
                        bbox.y *= height;
                        bbox.width *= window.innerWidth;
                        bbox.height *= height;
                        bbox.top *= height;
                        bbox.right *= window.innerWidth;
                        bbox.bottom *= height;
                        bbox.left *= window.innerWidth;
                    };

                    let textBBox = JSON.parse(svg.textBbox);
                    let marginalTextBbox = JSON.parse(svg.marginalTextBbox);
                    let lineBbox = JSON.parse(svg.lineBbox);
                    standardBBox(textBBox);
                    standardBBox(marginalTextBbox);
                    standardBBox(lineBbox);

                    [clusters, stopIteration] = penAnnnotationRef.current?.penCluster.add(
                        id,
                        bbox,
                        svg.type,
                        svg.startTime,
                        svg.annotatedText,
                        svg.marginalText,
                        textBBox,
                        marginalTextBbox,
                        lineBbox,
                        page,
                        svg.endTime
                    );

                    console.log(penAnnnotationRef.current.penCluster);
                }

                if (strokeAdded) {
                    penAnnnotationRef.current.clusterStrokes(clusters, stopIteration);
                }
            }
            d3.selectAll(".page-container").style("content-visibility", "auto");
        }
    }, [svgContent, loading]);

    let initCanvas = useRef(null);

    useEffect(() => {
        initCanvas.current = (width) => {
            svgContentRef.current = Array(numPagesRef.current).fill(null);
            textContent.current = Array(numPagesRef.current).fill(null);
            d3.selectAll(".page-container").style("content-visibility", "visible");
    
            let pageContent = Array.from(new Array(numPagesRef.current), (el, index) =>
                <div className="page-container" key={`pageContainer_${index + 1}`} style={{ position: "relative" }}>
                    <Page
                        key={`page_${index + 1}`}
                        pageNumber={index + 1}
                        width={width - width * 0.45}
                        customTextRenderer={textRenderer}
                        onRenderTextLayerSuccess={() => onLoad(index + 1)}
                        className={`page-${index + 1}`}
                    >
                    </Page>
                    { index !== numPagesRef.current - 1 ? <hr style={{ width: "100%" }} /> : null }
                </div>
            );
            setPageContent(pageContent);
        };
    });

    useEffect(() => {
        if (screen?.width && screen?.height && !loading) {
            let widthOffset = (window.innerWidth - screen.width) / 2;

            for (let penAnnnotationRef of penAnnotationRef.current) {
                d3.select(penAnnnotationRef.current.svgRef)
                .attr("width", screen.width)
                .attr("height", screen.height)
                .attr("viewBox", `${-widthOffset} ${0} ${screen.width} ${screen.height}`);
            }
            initCanvas.current(screen.width);
        }
    }, [screen, loading]);

    function onLoad(index) {
        // let spanPresentation = d3.select(".react-pdf__Page.page-" + index)
        // .select(".textLayer")
        // .selectAll("span[role='presentation']")
        // .nodes();

        let text = d3.select(".react-pdf__Page.page-" + index)
        .selectAll("span[role='presentation']")
        .nodes();

        let height = d3.select(".page-container").node().getBoundingClientRect().height;
        let width = d3.select(".page-container").node().getBoundingClientRect().width;
        // let top = d3.select(".annotateContainer").node().getBoundingClientRect().top;

        // if (top >= 0)
        setMinimapHeight(window.innerHeight);

        d3.select(".pen-annotation-container").style("--annotation-height", height + "px");
        d3.select(".pen-annotation-container").style("--annotation-width", width + "px");

        // spanPresentation.forEach((span) => {
        //     let text = span.textContent;
        //     let leadingSpaces = text.match(/^ */)[0].length;
        //     let trailingSpaces = text.match(/ *$/)[0].length;
        //     let words = text.split(" ").filter((word) => word !== "");
        //     d3.select(span).text("");

        //     for (let i = 0; i < leadingSpaces; i++) {
        //         d3.select(span).append("span").text(" ").attr("class", "space").style("user-select", "none");
        //     }

        //     words.forEach((word, i) => {
        //         let characters = word.split("");

        //         let wordSpan = d3.select(span)
        //         .append("span")
        //         .style("position", "relative")
        //         .style("left", "0px")
        //         .style("top", "0px")
        //         .attr("class", "word");

        //         characters.forEach((character, j) => {
        //             wordSpan.append("span")
        //             .text(character)
        //             .style("position", "relative")
        //             .style("left", "0px")
        //             .style("top", "0px")
        //             .attr("class", "character");
        //         });

        //         if (i !== words.length - 1) {
        //             d3.select(span).append("span").text(" ").attr("class", "space").style("position", "relative").style("user-select", "none");
        //         }
        //     });

        //     if (words.length !== 0) {
        //         for (let i = 0; i < trailingSpaces; i++) {
        //             d3.select(span).append("span").text(" ").attr("class", "space").style("user-select", "none");
        //         }
        //     }
        // });

        textContent.current[index - 1] = text;
        
        if (textContent.current.every((text) => text !== null)) {
            let penAnnotation = [];
            penAnnotationRef.current = [];
    
            for (let index = 0; index < numPagesRef.current; index++) {
                let ref = createRef();
                penAnnotationRef.current.push(ref);
    
                penAnnotation.push(<PenAnnotation 
                    mode={mode}
                    index={index + 1}
                    tool={toolTipRef}
                    colour={colourRef}
                    key={`annotation_${index + 1}`}
                    content={svgContentRef.current[index + 1]}
                    toolTipRef={annotationToolTipRef}
                    handiness={handinessRef}
                    disabled={disableRef}
                    setUpAnnotations={setUpAnnotations}
                    onNewActiveCluster={onNewActiveCluster}
                    onClusterChange={onClusterChange}
                    onEraseCallback={onEraseCallback}
                    penStartCallback={penStartCallback}
                    penEndCallback={penEndCallback}
                    eraseStartCallback={eraseStartCallback}
                    eraseEndCallback={eraseEndCallback}
                    onInferenceCallback={onInference}
                    onEndAnnotateCallback={endAnnotateCallback}
                    ref={ref}
                />);
            }
            setPenAnnotation(penAnnotation);
            setProgress(100);
            setLoading(false);

            d3.selectAll(".page-container").style("content-visibility", "auto");
            // setUpAnnotations("")
            // setUpAnnotations("");
            // setUpAnnotations(""); 

            // annotate("Brain-computer interfaces acquire the wearer’s brain signals and analyze them to execute the desired action")
            // annotate("As technology becomes more integrated into our lives");
            // annotate("The optimal method when adding another device is to integrate it with the mounted camera rather than wearing two separate devices.");
            // annotate("Touch-less gestures were used to interact with the camera minimizing the user touching the device");
            // annotate("Selecting different objects with just our eyes alone can be difficult as unintentional fixations and arbitrary dwell times can occur when users are engaged in another activity also know as the Midas Touch problem [12]. To remove these false positives a BCI was used to replace dwell times with a mental command. There are three different types of BCIs [12]: Active BCI: Derives its outputs from brain activity that is directly consciously controlled by the user independently from external events for controlling an application. Reactive BCI: Derives its outputs from brain activity arising in reaction to external stimulation which is indirectly modulated by the user for controlling an application. Passive BCI: Derives its outputs from arbitrary brain activity without the purpose of voluntary control for enriching an HCI with implicit information. Active BCIs was used in this work as well combining eye-tracking as the second input modality creating a hybrid BCI [12].");
            // annotate("The effectivenes of the hybrid BCI has been evaluated by comparing past methods of search and selecting methods [10 12]. Giving voluntary control when the selection happens gives more accurate selections [12]. Although hybrid BCIs performed slower than stand-alone eye-tracking devices [12] hybrid BCIs outperformed in terms of user-friendliness and more users achieved reliable control than pure eye-tracking [10]. This work uses search and select methods proposed by hybrid BCIs to ensure the users have reliable control while maintaining user-friendliness and touch-free interactions with the device");
            // annotate("Hand gestures have been used to interact with software applications [1 9]. Alkemade Verbeek and Lukosch [1] used hand gestures to select what tools the user wants from the CAD software in a virtual environment. They have also explored in choosing natural gestures to relate with the conceptual design so that it establishes a useful set of gestures to improve the efficiency of the gesture-based interface [1]. Hand gestures are very flexible and can be distinct from each other with little changes to our hands. For example, the number of fingers held up and orientation of the hand [9]. This relates to the work on how gestures were chosen and how they can interact with the camera");
            // annotate("Audio feedback allows the system to ask users questions about the mode or describe further details about the photo taken");
            // annotate("The effectivenes of the hybrid BCI has been evaluated by comparing past methods of search and selecting methods [10 12].");
            // annotate("Although hybrid BCIs performed slower than standalone eye-tracking devices, hybrid BCIs outperformed in terms of user-friendliness and more users achieved reliable control than pure eye-tracking.");
        } else {
            let progress = textContent.current.filter((text) => text !== null).length / textContent.current.length;
            setProgress(Math.floor(progress * 100));
        }
    }

    async function setUpAnnotations(annotationDescription, purposeTitle, purpose, onDetect, onEnd, forwardRef, secondRun = false, filter = []) {
        rawAnnotationOutput.current.push({ output: "" });
        let index = rawAnnotationOutput.current.length - 1;
        let setUpAnnotatedTokens = [].concat(filter);
        let cutIndex = [];
        let done = 0;
        let finish = false;
        let prevToken = "";
        let buffer = "";

        miniMapRef.current?.synchronize();

        annotatedTokens.current.push({annotationDescription: annotationDescription, purposeTitle: purposeTitle, purpose: purpose, annotations: setUpAnnotatedTokens, ref: forwardRef});

        let getTargetSpans = (lastToken) => {
            if (lastToken.targetWords !== "" && lastToken.targetSpans.length === 0 && lastToken.target === false) {
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
            }
        };

        let callback = (result, lastToken) => {
            done++;
            // console.log(result);
            // console.log("Done", done, cutIndex.length, setUpAnnotatedTokens.length, finish);
            // console.log(setUpAnnotatedTokens);

            if (result instanceof Array && result.filter(r => r instanceof Element && r.textContent.replace(/[^a-zA-Z0-9]/g, "").trim() !== "").length !== 0) {
                result = result.filter(r => r instanceof Element);
                let spaces = [];

                for (let span of result) {
                    let space = d3.select(span).node().nextSibling;

                    if (!space) {
                        space = span.parentNode.nextSibling?.firstChild;
                    }

                    if (space && (space.classList.contains("space")) && span !== result[result.length - 1]) {
                        spaces.push(space);
                    }
                }
                d3.selectAll(spaces.concat(result))
                .classed("highlighted", true)
                .classed("accept", false)
                .classed("fade", activeAnnotation.current && !(activeAnnotation.current instanceof Element) && !activeAnnotation.current.spans.some((r) => result.includes(r)));

                lastToken.spans = result;

                // loop1: for (let i = 0; i < setUpAnnotatedTokens.length; i++) {
                //     for (let j = i + 1; j < setUpAnnotatedTokens.length; j++) {
                //         let spans1 = setUpAnnotatedTokens[i].spans;
                //         let spans2 = setUpAnnotatedTokens[j].spans;
                        
                //         for (let span1 of spans1) {
                //             for (let span2 of spans2) {
                //                 if (span1 === span2) {
                //                     let cut = spans1.length > spans2.length ? [j, i] : [i, j];
                //                     cutIndex.push(cut);
                //                     setUpAnnotatedTokens[cut[1]].accepted = false;
                //                     done--;
                //                     break loop1;
                //                 }
                //             }
                //         }
                //     }
                // }
                getTargetSpans(lastToken);

                if (onDetect instanceof Function) {
                    onDetect([...setUpAnnotatedTokens].filter(annotation => annotation.spans.filter(r => r instanceof Element && r.textContent.replace(/[^a-zA-Z0-9]/g, "").trim() !== "").length !== 0));
                }
            } else {
                console.log(result);
            }

            if (done + cutIndex.length === setUpAnnotatedTokens.length && finish) {
                handleEnd();
            }
        };

        let handleAnnotate = (lastToken) => {
            // lastToken.state = "end";
            // console.log(lastToken.sentence.trim().split(" "));

            if (lastToken.sentence.trim().split(" ").length <= 2) {
                setUpAnnotatedTokens.splice(setUpAnnotatedTokens.indexOf(lastToken), 1);

                if (done + cutIndex.length === setUpAnnotatedTokens.length && finish) {
                    handleEnd();
                }
                return;
            }

            if (setUpAnnotatedTokens.length === 1) {
                console.log("Annotating", lastToken.sentence.trim());
                annotate(lastToken.sentence.trim(), r => callback(r, lastToken));

                if (done + cutIndex.length === setUpAnnotatedTokens.length && finish) {
                    handleEnd();
                }
            } else {
                axios.post("./api/findDuplicateSentence", {
                    // method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    data: { setUpAnnotatedTokens, lastToken },
                })
                // .then((response) => response.json())
                .then((response) => {
                    let { i, i2, duplicate } = response.data;
                    
                    if (duplicate) {
                        console.log("Cut", lastToken.sentence.trim());
                        cutIndex.push([i, i2]);
                        setUpAnnotatedTokens[i2].accepted = false;

                        // if (i > i2) {
                        //     done--;
                        //     annotate(lastToken.sentence.trim(), r => callback(r, lastToken));
                        // }
                    } else {
                        console.log("Annotating", lastToken.sentence.trim());
                        annotate(lastToken.sentence.trim(), r => callback(r, lastToken));
                    }

                    if (done + cutIndex.length === setUpAnnotatedTokens.length && finish) {
                        handleEnd();
                    }
                })
                .catch((error) => {
                    console.error("Error:", error);

                    toast.error("An error occurred while looking for duplicates.", {
                        toastId: "duplicateError",
                        containerId: "errorMessage"
                    });
                });
            }
        };

        function handleToken(token) {
            rawAnnotationOutput.current[index].output += token;

            if (token.trim().startsWith(`***`) || token.trim().endsWith(`***`)) {
                prevToken = "";
                let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken?.state === "start") {
                    // handleAnnotate(lastToken);
                    lastToken.state = "end";
                    buffer = "";
                } else {
                    if (lastToken?.explain === undefined) {
                        setUpAnnotatedTokens.splice(setUpAnnotatedTokens.length - 1, 1);
                    } else if (lastToken?.explain === true) {
                        lastToken.explain = false;
                        lastToken.explanation[0] = lastToken.explanation[0].trim();
                        handleAnnotate(lastToken);
                    }
                    setUpAnnotatedTokens.push({ sentence: "", state: "start", explanation: ["Generating explanation..."], spans: [], targetWords: "", targetSpans: [] });
                }
            } else if (token.trim().startsWith(`{{`) || token.trim().endsWith(`{{`)) {
                let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken.state === "start" && lastToken.sentence.replaceAll("[^a-zA-Z0-9]", "").trim() === "") {
                    setUpAnnotatedTokens.splice(setUpAnnotatedTokens.length - 1, 1);
                    setUpAnnotatedTokens.push({ sentence: buffer, state: "end", explanation: ["Generating explanation..."], spans: [], targetWords: "", targetSpans: [] });
                    // handleAnnotate(setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1]);
                }
                lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken) {
                    lastToken.explain = true;
                    lastToken.explanation[0] = "";
                }
                prevToken = "";
                buffer = "";
            } else if (token.trim().startsWith(`}}`) || token.trim().endsWith(`}}`)) {
                let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken) {
                    lastToken.explain = false;

                    if ((lastToken.explanation[0] + token).trim().endsWith("}}")) {
                        lastToken.explanation[0] = (lastToken.explanation[0] + token).trim().slice(0, -2);
                    }
                    lastToken.explanation[0] = lastToken.explanation[0].trim();
                    // .replace(/^\"+|\"+$/g, "");
                    handleAnnotate(setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1]);
                }

                for (let index of cutIndex) {
                    if (setUpAnnotatedTokens[index[0]]?.explanation[0] === "Generating explanation...") {
                        setUpAnnotatedTokens[index[0]].explanation[0] = setUpAnnotatedTokens[index[1]]?.explanation[0];
                    }
                }
                prevToken = "";
            } else if (token.trim().startsWith(`"""`) || token.trim().endsWith(`"""`)) { 
                let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken.state === "start" && lastToken.sentence.replaceAll("[^a-zA-Z0-9]", "").trim() === "") {
                    setUpAnnotatedTokens.splice(setUpAnnotatedTokens.length - 1, 1);
                    setUpAnnotatedTokens.push({ sentence: buffer, state: "end", explanation: ["Generating explanation..."], spans: [], targetWords: "", targetSpans: [] });
                    // handleAnnotate(setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1]);
                }
                lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken?.target) {
                    lastToken.target = false;
                } else {
                    lastToken.target = true;

                    if ((lastToken.targetWords + token).trim().endsWith(`"""`)) {
                        lastToken.targetWords = (lastToken.targetWords + token).trim().slice(0, -3);
                    }
                    lastToken.targetWords = lastToken.targetWords.trim();
                }
                prevToken = "";
                buffer = "";
            } else {
                let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken?.state === "start") {
                    lastToken.sentence += token;
                } else if (lastToken?.explain === true) {
                    lastToken.explanation[0] += token;
                } else if (lastToken?.target === true) {
                    lastToken.targetWords += token;
                } else {
                    buffer += token;
                }
                prevToken = token;
            }
        }

        function handleEnd() {
            finish = true;
            let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

            if (lastToken?.explain === undefined) {
                setUpAnnotatedTokens.splice(setUpAnnotatedTokens.length - 1, 1);
            } else if (lastToken?.explain === true) {
                lastToken.explain = false;
                lastToken.explanation[0] = lastToken.explanation[0].trim();
                handleAnnotate(lastToken);
            }

            if (done + cutIndex.length === setUpAnnotatedTokens.length) {
                cutIndex = cutIndex.sort((a, b) => b[1] - a[1]);
                cutIndex = cutIndex.filter((index, i) => i === 0 || index[1] !== cutIndex[i - 1][1]);

                for (let index of cutIndex) {
                    if (setUpAnnotatedTokens[index[0]]?.explanation[0] === "Generating explanation...") {
                        setUpAnnotatedTokens[index[0]].explanation[0] = setUpAnnotatedTokens[index[1]]?.explanation[0];
                    }
                }
                let cutElements = [];
                let highlightElements = [];
                
                for (let index of cutIndex) {
                    for (let span of setUpAnnotatedTokens[index[1]].spans) {
                        if (span instanceof Element) {
                            cutElements.push(span);
                            let space = d3.select(span).node().nextSibling;

                            if (!space) {
                                space = span.parentNode.nextSibling?.firstChild;
                            }
        
                            if (space && space.classList.contains("space")) {
                                cutElements.push(space);
                            }
                        }
                    }

                    for (let i = 0; i < setUpAnnotatedTokens[index[0]].spans.length; i++) {
                        if (setUpAnnotatedTokens[index[0]].accepted !== false) {
                            let span = setUpAnnotatedTokens[index[0]].spans[i];

                            if (span instanceof Element) {
                                highlightElements.push(span);
                                let space = d3.select(span).node().nextSibling;

                                if (!space) {
                                    space = span.parentNode.nextSibling?.firstChild;
                                }
            
                                if (space && space.classList.contains("space") && i !== setUpAnnotatedTokens[index[0]].spans.length - 1) {
                                    highlightElements.push(space);
                                }
                            }
                        }
                    }
                }
                // console.log("Cut Elements", cutElements);
                // console.log("Highlight Elements", highlightElements);

                for (let i = 0; i < annotatedTokens.current.length; i++) {
                    for (let j = 0; j < annotatedTokens.current[i].annotations.length; j++) {
                        let annotation = annotatedTokens.current[i].annotations[j];

                        if (setUpAnnotatedTokens !== annotatedTokens.current[i].annotations) {
                            for (let k = 0; k < cutElements.length; k++) {
                                if (annotation.spans.includes(cutElements[k]) && annotation.accepted !== false) {
                                    if (cutElements[k + 1] && cutElements[k + 1].classList.contains("space")) {
                                        cutElements.splice(k + 1, 1);
                                    }
                                    cutElements.splice(k, 1);
                                    k--;
                                }
                            }
                        }
                    }
                }

                d3.selectAll(cutElements)
                .style("background", null)
                .classed("highlighted", false);

                d3.selectAll(highlightElements)
                .classed("accept", false)
                .classed("highlighted", true);
                // console.log("Cut Index", cutIndex);

                for (let index of cutIndex) {
                    setUpAnnotatedTokens.splice(index[1], 1);
                }
                // setUpAnnotatedTokens = setUpAnnotatedTokens.filter(annotation => annotation.spans.filter(r => r instanceof Element).length !== 0);

                for (let i = 0; i < setUpAnnotatedTokens.length; i++) {
                    let annotation = setUpAnnotatedTokens[i];
                    
                    if (annotation.spans.filter(r => r instanceof Element && r.textContent.replace(/[^a-zA-Z0-9]/g, "").trim() !== "").length === 0) {
                        setUpAnnotatedTokens.splice(i, 1);
                        i--;
                    }

                    if (annotation.explanation[0] === "Generating explanation...") {
                        annotation.explanation[0] = "Error: No explanation generated.";
                    }
                }

                for (let token of setUpAnnotatedTokens) {
                    token.target = false;
                    getTargetSpans(token);
                }

                if (onDetect instanceof Function) {
                    onDetect([...setUpAnnotatedTokens]);
                }
                console.log("Finished annotating", setUpAnnotatedTokens);

                if (onEnd instanceof Function) {
                    let p = `${purposeTitle}: "${purpose}"`;
                    onEnd(p + "\n" + rawAnnotationOutput.current[index].output);
                }
                console.log(annotatedTokens.current);
                // console.log(rawAnnotationOutput.current[index].output);
            }
        }

        // if (typeof mode === "string" && mode.toLowerCase().includes("practice")) {
        //     await new Promise(r => setTimeout(r, 2000));
        //     let message = "";
        //     // let testData = `*** Suspendisse quis lorem sed est blandit sodales. ***
        //     // {{ Test Explanation }}
        //     // *** Sed sit amet rutrum metus. Integer in erat tellus. ***
        //     // {{ Test Explanation }}
        //     // *** Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. ***
        //     // {{ Test Explanation }}
        //     // *** Cras auctor faucibus lectus, a semper enim. Phasellus pellentesque tellus ut neque maximus dictum. ***
        //     // {{ Test Explanation }}
        //     // *** Duis molestie velit in auctor interdum. ***
        //     // {{ Test Explanation }}
        //     // `;
            
        //     let testData = `*** Then you show your little light, ***
        //     {{ Test Explanation (Results Faked) }}
        //     *** Then the traveler in the dark ***
        //     {{ Test Explanation (Results Faked) }}
        //     *** Often through my curtains peep ***
        //     {{ Test Explanation (Results Faked) }}
        //     *** For you never shut your eye ***
        //     {{ Test Explanation (Results Faked) }}
        //     *** Like a diamond in the sky ***
        //     {{ Test Explanation (Results Faked) }}
        //     `;

        //     for (let token of testData.split(" ")) {
        //         // console.log(token);
        //         await new Promise(r => setTimeout(r, 10));
        //         token = " " + token;
        //         message += token;

        //         handleToken(token);
        //     }
        //     handleEnd();
        // } else {
        let p = `${purposeTitle}: "${purpose}"`;

        if (purpose.trim() === "") {
            p = `${annotationDescription}${annotationDescription[annotationDescription.length - 1] === "." ? "" : "." } However, the user said "${purposeTitle}" as the purpose of the annotation.`;
        }
        findAnnotations(p, handleToken, handleEnd, (typeof mode === "string" && mode.toLowerCase().includes("practice") ? 1 : 8));
        // }
    }

    function annotate(text, callback) {
        let sentences = split(text).map((sentence) => sentence.raw).filter((sentence) => sentence.trim() !== "");

        if (sentences.length > 1) {
            let results = Array(sentences.length).fill(0);

            for (let i = 0; i < sentences.length; i++) {
                let sentence = sentences[i];

                annotate(sentence, (result) => {
                    results[i] = result;
                    
                    if (results.every((result) => result !== 0)) {
                        if (callback instanceof Function) {
                            callback(results.flat());
                        }
                    }
                });
            }
            return;
        }
        let words = text.toLowerCase().split(/-| /).filter((word) => word !== "");
        let found = false;

        let workerCode = function() {
            onmessage = function(e) {
                let currPage = e.data.currPage;
                let text = e.data.text;
                let i = e.data.index;

                if (currPage.includes(text)) {
                    postMessage([true, i]);
                } else {
                    postMessage([false, i]);
                }
            };
        };
        let worker = new Worker(URL.createObjectURL(new Blob([`(${workerCode})()`])));
        let filterText = text.toLowerCase().replace(/[^a-zA-Z0-9]/g, "").trim();
        let executed = 0;
        let done = 0;

        for (let i = 0; i < textContent.current.length; i++) {
            let currPage = textContent.current[i].map((span) => span.textContent).join(" ").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().trim();
            // console.log(currPage, filterText);

            if (currPage !== "") {
                executed++;
                worker.postMessage({ currPage, text: filterText, index: i });
            }
        }

        worker.onmessage = (e) => {
            let result = e.data[0];
            let i = e.data[1];
            done++;

            if (result) {
                worker.terminate();
                // console.log("Found text, page", i);
                let listOfSpans = [];
                let wordSpans = textContent.current[i].map((span) => d3.select(span).selectAll(".word").nodes()).flat();
                let processedText = text.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");

                for (let j = 0; j < wordSpans.length; j++) {
                    let span = wordSpans[j];
                    let textContent = span.textContent.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");

                    // console.log(processedText, textContent);

                    if (processedText.startsWith(textContent)) {
                        processedText = processedText.slice(textContent.length);
                        listOfSpans.push(span);

                        if (processedText === "") {
                            found = true;
                            break;
                        }
                    } else {
                        if (listOfSpans.length !== 0) {
                            j--;
                        }
                        listOfSpans = [];
                        processedText = text.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
                    }
                }

                if (found) {
                    if (callback instanceof Function) {
                        callback(listOfSpans);
                    }
                } else {
                    if (callback instanceof Function) {
                        console.log("Not found: " + text);
                        callback("Not found: " + text);
                    }
                }
            } else if (done === executed) {
                worker.terminate();
                
                axios.post("api/findSimilarString", {
                    // method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    data: {
                        text: text.toLowerCase(),
                        textContent: textContent.current.map((page) => page.map((span) => span.textContent).join(" ").toLowerCase().replace(/[^a-zA-Z0-9\s]/g, ""))
                    }
                })
                // .then((response) => response.json())
                .then((response) => {
                    const { substring, minDistance, pageNumber, ifSinglePage } = response.data;

                    if (minDistance > text.length / 2) {
                        let sentences = split(text).map((sentence) => sentence.raw).filter((sentence) => sentence.trim() !== "");

                        if (sentences.length > 1) {
                            let results = Array(sentences.length).fill(0);

                            for (let i = 0; i < sentences.length; i++) {
                                let sentence = sentences[i];
            
                                annotate(sentence, (result) => {
                                    results[i] = result;
                                    
                                    if (results.every((result) => result !== 0)) {
                                        if (callback instanceof Function) {
                                            callback(results.flat());
                                        }
                                    }
                                });
                            }
                        } else {
                            if (callback instanceof Function) {
                                // console.log("Not found: " + text);
                                callback("Not found: " + text);
                            }
                        }
                        return;
                    }

                    if (ifSinglePage) {
                        let listOfSpans = [];
                        let wordIndex = 0;
                        let substringWords = substring.split(" ").filter((word) => word !== "");
                        
                        if (substringWords[1] === words[0]) {
                            substringWords = substringWords.slice(1);
                        }
                        let wordSpans = textContent.current[pageNumber].map((span) => d3.select(span).selectAll(".word").nodes()).flat();
                        let word = substringWords[wordIndex].replace(/[^a-zA-Z0-9]/g, "");

                        for (let i = 0; i < wordSpans.length; i++) {
                            let span = wordSpans[i];
                            let textContent = span.textContent.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
                            // console.log(textContent, word);

                            if (textContent.trim() === "" && listOfSpans.length !== 0) {
                                listOfSpans.push(span);
                                continue;
                            }
                            
                            if ((wordIndex === 0 && textContent.endsWith(word)) || (wordIndex === substringWords.length - 1 && textContent.startsWith(word)) || textContent === word) {
                                if (!(wordIndex === substringWords.length - 1 && (/,|\.|;|:|\?|!/).test(listOfSpans[listOfSpans.length - 1]?.textContent.slice(-1)))) {
                                    listOfSpans.push(span);
                                }
                                wordIndex++;
                            } else {
                                if (listOfSpans.length !== 0) {
                                    i--;
                                }
                                listOfSpans = [];
                                wordIndex = 0;
                            }

                            if (wordIndex === substringWords.length) {
                                for (let j = i + 1; j < wordSpans.length; j++) {
                                    let nextSpan = wordSpans[j];
                                    let nextTextContent = nextSpan.textContent.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");

                                    if (nextTextContent.trim() === "") {
                                        break;
                                    }

                                    if (text.includes(nextTextContent)) {
                                        listOfSpans.push(nextSpan);
                                    } else {
                                        break;
                                    }
                                }
                                break;
                            }
                            word = substringWords[wordIndex].replace(/[^a-zA-Z0-9]/g, "");
                        }
                        // console.log(listOfSpans);
                        
                        if (callback instanceof Function) {
                            callback(listOfSpans);
                        }
                    } else {
                        let currPage = textContent.current[pageNumber];
                        let nextPage = textContent.current[pageNumber + 1];
        
                        let currPageSpans = [];
                        let currTextLength = 0;
                        let nextTextLength = 0;
                        let nextPageSpans = [];
        
                        loop: for (let i = currPage.length - 1; i >= 0; i--) {
                            let span = currPage[i];
                            let spanWords = d3.select(span).selectAll(".word").nodes().reverse();
        
                            for (let word of spanWords) {
                                let wordText = word.textContent;
        
                                if (currTextLength + wordText.length < text.length) {
                                    currPageSpans.push(word);
                                    currTextLength += wordText.length;
                                } else {
                                    currPageSpans.push(word);
                                    break loop;
                                }
                            }
                        }
        
                        loop: for (let i = 0; i < nextPage.length; i++) {
                            let span = nextPage[i];
                            let spanWords = d3.select(span).selectAll(".word").nodes();
        
                            for (let word of spanWords) {
                                let wordText = word.textContent;
        
                                if (nextTextLength + wordText.length < text.length) {
                                    nextPageSpans.push(word);
                                    nextTextLength += wordText.length;
                                } else {
                                    nextPageSpans.push(word);
                                    break loop;
                                }
                            }
                        }
                        let listOfSpans = currPageSpans.reverse().concat(nextPageSpans);
                        let wordIndex = 0;
                        let highLightSpans = [];
                        let substringWords = substring.split(" ").filter((word) => word !== "");
        
                        for (let i = 0; i < listOfSpans.length; i++) {
                            let span = listOfSpans[i];
                            let textContent = span.textContent.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
                            let word = substringWords[wordIndex].toLowerCase().replace(/[^a-zA-Z0-9]/g, "");

                            if (textContent === word || (wordIndex === 0 && textContent.endsWith(word)) || (wordIndex === words.length - 1 && textContent.startsWith(word))) {
                                wordIndex++;

                                if (filterText.includes(textContent)) {
                                    highLightSpans.push(span);

                                    if (wordIndex === substringWords.length || highLightSpans.map(s => s.textContent).join(" ").length === text.length) {
                                        break;
                                    }
                                }
                            } else {
                                for (let textSpan of listOfSpans.slice(i + 1)) {
                                    let textContent = textSpan.textContent.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");

                                    if (textContent === substringWords[0].toLowerCase().replace(/[^a-zA-Z0-9]/g, "")) {
                                        highLightSpans = [];
                                        wordIndex = 0;
                                    }
                                }
                            }
                        }
                        
                        if (callback instanceof Function) {
                            callback(highLightSpans);
                        }
                    }
                })
                .catch((error) => {
                    console.error("Error:", error);

                    toast.error("An error occurred while annotating text.", {
                        toastId: "annotatingError",
                        containerId: "errorMessage"
                    });
                });
            }
        };
    }

    function onChange(colour, event) {
        setColour(colour.hex);
    }

    function onToolChange(tool) {
        setTool(tool);
    }

    function onNewActiveCluster(cluster, filter = true) {
        miniMapRef.current?.synchronize();

        if (cluster) {
            let ref = penAnnotationRef.current.find(ref => ref.current.lockClusters.current.find(lockCluster => lockCluster === cluster));
            let clusterToolTip = d3.select("#toolTip" + cluster.strokes[cluster.strokes.length - 1].id).node();
    
            let onNavigateCallback = (annotation) => {
                let annotations = annotatedTokens.current.find(groupAnnotations => groupAnnotations.annotations.find(annotated => annotated === annotation));
                hoverGroupAnnotationRef.current = annotations;
    
                if (annotation.spans[0] instanceof Element && annotation.spans[0].classList.contains("toolTip")) {
                    cluster.open = true;
                    ref?.current.updateLockCluster([...ref?.current.lockClusters.current]);
    
                    let content = <div className={"annotationMessageContainer " + googleSans.className}>
                        <NavigateCluster filter={false} handiness={handinessRef.current} cluster={cluster} annotations={annotatedTokens.current.map(groupAnnotations => groupAnnotations.annotations).flat()} currentAnnotation={clusterToolTip} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={undefined} />
                    </div>;
                    // explanationToolTipRef.current?.close();
                    fadeDisplayExplanation(content, annotation, false);
                } else {
                    cluster.open = false;
                    ref?.current.updateLockCluster([...ref?.current.lockClusters.current]);
                    let [content, overlappingAnnotations] = generateContent(annotation, annotations);
                    overlappingAnnotationRef.current = overlappingAnnotations;
    
                    fadeDisplayExplanation(content, annotation, true, overlappingAnnotations);
                }
                activeAnnotation.current = annotation;
                miniMapRef.current?.synchronize();

                if (navigateCallback instanceof Function) {
                    navigateCallback(annotation);
                }
            };
            // activeClusterRef.current = cluster;
            // setActiveCluster(cluster);
            // setGetActiveAnnotations(cluster.annotationsFound ? [...cluster.annotationsFound] : []);
            if (cluster.open) {
                if (cluster.annotationsFound?.length > 0) {
                    let content = <div className={"annotationMessageContainer " + googleSans.className}>
                        <NavigateCluster filter={filter} handiness={handinessRef.current} cluster={cluster} annotations={annotatedTokens.current.map(groupAnnotations => groupAnnotations.annotations).flat()} currentAnnotation={clusterToolTip} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={undefined} />
                    </div>;
                    // // explanationToolTipRef.current?.close();
                    fadeDisplayExplanation(content, {spans: [ clusterToolTip ]}, false);
                } else {
                    activeAnnotation.current = d3.select("#toolTip" + cluster.strokes[cluster.strokes.length - 1].id).node();
                }
                let ref = penAnnotationRef.current.find(ref => ref.current.lockClusters.current.find(lockCluster => lockCluster === cluster));

                let processClusters = (clusters) => {
                    let changed = false;

                    for (let c of clusters) {
                        if (c === cluster) {
                            continue;
                        }

                        if (c.open) {
                            changed = true;
                        }
                        c.open = false;
                    }
                    return changed;
                };
                let lockClusters = [...ref.current.lockClusters.current];
                let clusters = [...ref.current.clusters.current];
    
                if (processClusters(lockClusters)) {
                    ref.current.updateLockCluster(lockClusters);
                }
    
                if (processClusters(clusters)) {
                    ref.current.updateClusters(clusters);
                }
            } else {
                let ref = penAnnotationRef.current.find(ref => ref.current.lockClusters.current.find(lockCluster => lockCluster === cluster) || ref.current.clusters.current.find(cluster => cluster === cluster));

                let processClusters = (clusters) => {
                    let changed = false;

                    for (let cluster of clusters) {
                        if (cluster.open) {
                            changed = true;
                        }
                        cluster.open = false;
                    }

                    return changed;
                };
                let lockClusters = [...ref.current.lockClusters.current];
                let clusters = [...ref.current.clusters.current];

                if (processClusters(lockClusters)) {
                    ref.current.updateLockCluster(lockClusters);
                }

                if (processClusters(clusters)) {
                    ref.current.updateClusters(clusters);
                }
                explanationToolTipRef.current?.close();
            }
        } else {
            explanationToolTipRef.current?.close();
            // resetToolTips();
            // activeClusterRef.current = null;
            // setActiveCluster(null);
            // setGetActiveAnnotations([]);
        }
    }

    function onClusterChange(cluster) {
        // if (cluster) {
        //     let activeStrokes = activeClusterRef.current?.strokes.map(stroke => stroke?.id);
        //     let equal = activeStrokes?.every((stroke, i) => stroke === cluster.strokes[i]?.id);

        //     if (equal) {
        //         setGetActiveAnnotations(activeClusterRef.current.annotationsFound ? [...activeClusterRef.current.annotationsFound] : []);
        //         setActiveCluster(cluster);
        //     }
        // }
        miniMapRef.current?.synchronize();

        if (cluster) {
            let ref = penAnnotationRef.current.find(ref => ref.current?.lockClusters.current.find(lockCluster => lockCluster === cluster));
            let clusterToolTip = d3.select("#toolTip" + cluster.strokes[cluster.strokes.length - 1].id).node();

            let onNavigateCallback = (annotation) => {
                let annotations = annotatedTokens.current.find(groupAnnotations => groupAnnotations.annotations.find(annotated => annotated === annotation));
                hoverGroupAnnotationRef.current = annotations;

                if (annotation.spans[0] instanceof Element && annotation.spans[0].classList.contains("toolTip")) {
                    cluster.open = true;
                    ref?.current.updateLockCluster([...ref?.current.lockClusters.current]);

                    let content = <div className={"annotationMessageContainer " + googleSans.className}>
                        <NavigateCluster filter={false} handiness={handinessRef.current} cluster={cluster} annotations={annotatedTokens.current.map(groupAnnotations => groupAnnotations.annotations).flat()} currentAnnotation={clusterToolTip} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={undefined} />
                    </div>;
                    // explanationToolTipRef.current?.close();
                    fadeDisplayExplanation(content, annotation, false);
                } else {
                    cluster.open = false;
                    ref?.current.updateLockCluster([...ref?.current.lockClusters.current]);
                    let [content, overlappingAnnotations] = generateContent(annotation, annotations);
                    overlappingAnnotationRef.current = overlappingAnnotations;

                    fadeDisplayExplanation(content, annotation, true, overlappingAnnotations);
                }
                activeAnnotation.current = annotation;
                miniMapRef.current?.synchronize();

                if (navigateCallback instanceof Function) {
                    navigateCallback(annotation);
                }
            };

            let showTooltipContent = () => {
                if (clusterToolTip){
                    let content = <div className={"annotationMessageContainer " + googleSans.className}>
                        <NavigateCluster filter={false} handiness={handinessRef.current} cluster={cluster} annotations={annotatedTokens.current.map(groupAnnotations => groupAnnotations.annotations).flat()} currentAnnotation={activeAnnotation.current} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={undefined} />
                    </div>;

                    let closestTextLayer = d3.select(".textLayer").node();

                    d3.select(".explanation-tooltip")
                    .style("top", clusterToolTip.getBoundingClientRect().top + clusterToolTip.getBoundingClientRect().height / 2 - containerRef.current.getBoundingClientRect().top + "px")
                    .style("left", handinessRef.current === "right" ? closestTextLayer.getBoundingClientRect().right + 10 + "px" : closestTextLayer.getBoundingClientRect().left - 10 + "px");

                    explanationToolTipRef.current?.open({
                        anchorSelect: ".explanation-tooltip",
                        content: content,
                        place: "left",
                    });
                    
                    setTimeout(() => {
                        d3.select(".react-tooltip#annotationExplanation")
                        .style("background", "rgba(34, 38, 43, 0)");
                    }, 10);
                }
            };

            if (cluster.annotationsFound?.length > 0 && activeAnnotation.current) {
                if (cluster.annotationsFound?.find(annotation => annotation === activeAnnotation.current)) {
                    if (activeAnnotation.current.spans[0] instanceof Element && activeAnnotation.current.spans[0].classList.contains("toolTip")) {
                        showTooltipContent();
                    } else if (explanationToolTipRef.current?.isOpen && activeAnnotation.current?.accepted !== false) {
                        let annotations = annotatedTokens.current.find(groupAnnotations => groupAnnotations.annotations.find(annotated => annotated === activeAnnotation.current));
                        let [content, ] = generateContent(activeAnnotation.current, annotations);

                        explanationToolTipRef.current?.open({
                            anchorSelect: ".explanation-tooltip",
                            content: content,
                            place: "left",
                        });
                    }
                } else if (activeAnnotation.current instanceof Element && activeAnnotation.current.classList.contains("toolTip") && activeAnnotation.current.id === "toolTip" + cluster.strokes[cluster.strokes.length - 1].id) {
                    showTooltipContent();
                }
            }
        }
    }

    function onEraseCallback(cluster, pathID, page) {
        if (cluster) {
            let activeStrokes = activeClusterRef.current?.strokes.map(stroke => stroke.id);
            let equal = activeStrokes?.every((stroke, i) => stroke === cluster.strokes[i]?.id);

            if (equal) {
                let strokes = cluster.strokes.filter(stroke => stroke.id !== "initial");

                if (strokes.length === 0) {
                    setGetActiveAnnotations([]);
                    setActiveCluster(null);
                }
            }

            if (onECallback instanceof Function) {
                onECallback({ cluster, id: pathID, page });
            }
        }
    }

    function resetToolTips() {
        d3.select(".react-tooltip#annotationExplanation")
        .transition()
        .duration(200)
        .style("opacity", 0)
        .on("end", () => {
            explanationToolTipRef.current?.close();
        });

        d3.selectAll(".word.highlighted, .space.highlighted")
        .classed("target", false)
        .classed("fade", false);
        
        hoverAnnotation.current = null;
        activeAnnotation.current = null;
        overlappingAnnotationRef.current = [];

        for (let penAnnotation of penAnnotationRef.current) {
            let lockClusters = [...penAnnotation.current.lockClusters.current];
            let clusters = [...penAnnotation.current.clusters.current];
            let changed = false;
            let changedLock = false;

            for (let lockCluster of lockClusters) {
                if (lockCluster.open || !lockCluster.disabled) {
                    changedLock = true;
                }
                lockCluster.open = false;
                lockCluster.disabled = true;
            }

            for (let cluster of clusters) {
                if (cluster.open || !cluster.disabled) {
                    changed = true;
                }
                cluster.open = false;
                cluster.disabled = true;
            }

            if (changedLock) {
                penAnnotation.current.updateLockCluster(lockClusters);
            }

            if (changed) {
                penAnnotation.current.updateClusters(clusters);
            }
        }
    }

    function penStartCallback() {
        resetToolTips();
        miniMapRef.current?.synchronize();
    }

    function penEndCallback(param) {
        // explanationToolTipRef.current?.close();
        // hoverAnnotation.current = null;

        miniMapRef.current?.synchronize();

        if (pEndCallback instanceof Function) {
            pEndCallback(param);
        }
    }

    function eraseStartCallback() {
        resetToolTips();
        miniMapRef.current?.synchronize();
    }

    function eraseEndCallback() {
        // explanationToolTipRef.current?.close();
        // hoverAnnotation.current = null;
        miniMapRef.current?.synchronize();
    }

    function onInference(startTimetamp, cluster, rawText, images) {
        miniMapRef.current?.synchronize();

        if (onInferenceCallback instanceof Function) {
            onInferenceCallback(startTimetamp, cluster, rawText, images);
        }
    }

    function endAnnotateCallback(startTimetamp, cluster, rawText) {
        miniMapRef.current?.synchronize();

        if (onEndAnnotateCallback instanceof Function) {
            onEndAnnotateCallback(startTimetamp, cluster, rawText);
        }
    }

    let generateContent = useCallback((annotation, annotations) => {
        function acceptAnnotation(e, a, j, overlappingAnnotations, filterSpans=[]) {
            a.accepted = true;
            let target = e.target;
            let rateContainer = target.closest(".rateContainer");
            let [newContent, ] = generateContent(annotation, annotations);
    
            d3.select(rateContainer)
            .selectAll(".rateButton")
            .style("pointer-events", "none")
            .transition()
            .duration(200)
            .style("opacity", 0)
            .on("end", () => {
                explanationToolTipRef.current?.open({
                    anchorSelect: ".explanation-tooltip",
                    content: newContent,
                    place: "left",
                });
            });

            if (overlappingAnnotations.every(a => a.annotation.accepted !== undefined)) {
                let spans = [];

                for (let i = 0; i < a.spans.length; i++) {
                    let span = a.spans[i];

                    if (filterSpans.length > 0 && filterSpans.includes(span)) {
                        continue;
                    }
                    spans.push(span);
        
                    let space = d3.select(span).node().nextSibling;
        
                    if (!space) {
                        space = span.parentNode.nextSibling?.firstChild;
                    }
            
                    if (space && space.classList.contains("space") && i !== a.spans.length - 1) {
                        spans.push(space);
                    }
                }
                d3.selectAll(spans)
                .classed("highlighted", true)
                .classed("accept", true);

                miniMapRef.current?.synchronize();
            }
    
            // let ref = penAnnotationRef.current.find(ref => ref.current.lockClusters.current.find(lockCluster => lockCluster.annotationsFound?.includes(a)));
            // let cluster = ref?.current.lockClusters.current.find(cluster => cluster.annotationsFound?.includes(a));
            let cluster = null;

            penAnnotationRef.current.some(ref => {
                const foundCluster = ref.current.lockClusters.current.find(lockCluster => lockCluster.annotationsFound?.includes(a));

                if (foundCluster) {
                    cluster = foundCluster;
                    return true;
                }
                return false;
            });
                    
            if (cluster) {
                if (onReplyCallback instanceof Function) {
                    onReplyCallback(cluster, "accept " + j);
                }
            }
        }

        function eitherAnnotation(e, a, j, overlappingAnnotations, filterSpans=[]) {
            a.either = true;
            acceptAnnotation(e, a, j, overlappingAnnotations, filterSpans);
        }
    
        function rejectAnnotation(e, a, j, overlappingAnnotations, filterSpans=[], convertFilterSpans=[]) {
            a.accepted = false;
            let target = e.target;
            let rateContainer = target.closest(".rateContainer");
            // let newContent = generateContent(annotation, annotations);
            // console.log(overlappingAnnotations);
    
            d3.select(rateContainer)
            .selectAll(".rateButton")
            .style("pointer-events", "none")
            .transition()
            .duration(200)
            .style("opacity", 0);
            // .on("end", () => {
            //     explanationToolTipRef.current?.open({
            //         anchorSelect: ".explanation-tooltip",
            //         content: newContent,
            //         place: "left",
            //     });
            // });
            let acceptedSpans = [];
            let rejectedSpans = [];
    
            loop1: for (let span of a.spans) {
                for (let overlappingAnnotation of overlappingAnnotations) {
                    if (overlappingAnnotation.annotation !== a && overlappingAnnotation.annotation.accepted !== false) {
                        for (let overlappingSpan of overlappingAnnotation.annotation.spans) {
                            if (span === overlappingSpan) {
                                continue loop1;
                            }
                        }
                    }
                }

                if (filterSpans.length > 0 && filterSpans.includes(span)) {
                    continue;
                }
                
                if (convertFilterSpans.length > 0 && convertFilterSpans.includes(span)) {
                    acceptedSpans.push(span);
                } else {
                    rejectedSpans.push(span);
                }
                let space = d3.select(span).node().nextSibling;
    
                if (!space) {
                    space = span.parentNode.nextSibling?.firstChild;
                }
    
                if (space && space.classList.contains("space")) {
                    if (convertFilterSpans.length > 0 && convertFilterSpans.includes(span)) {
                        acceptedSpans.push(space);
                    } else {
                        rejectedSpans.push(space);
                    }
                }
            }
            d3.selectAll(rejectedSpans)
            .classed("highlighted", false);

            d3.selectAll(acceptedSpans)
            .classed("highlighted", true)
            .classed("accept", true);

            miniMapRef.current?.synchronize();
    
            // for (let i = 0; i < annotations.annotations.length; i++) {
            //     if (annotations.annotations[i] === a) {
            //         annotations.annotations.splice(i, 1);
            //         break;
            //     }
            // }

            // let ref = penAnnotationRef.current.find(ref => ref.current.lockClusters.current.find(lockCluster => lockCluster.annotationsFound?.includes(a)));
            // let cluster = ref?.current.lockClusters.current.find(cluster => cluster.annotationsFound?.includes(a));
            let cluster = null, clusterRef = null;

            penAnnotationRef.current.some(ref => {
                const foundCluster = ref.current.lockClusters.current.find(lockCluster => lockCluster.annotationsFound?.includes(a));

                if (foundCluster) {
                    clusterRef = ref;
                    cluster = foundCluster;
                    return true;
                }
                return false;
            });

            if (overlappingAnnotations.every(a => a.annotation.accepted === false)) {
                // let height = d3.select(".react-tooltip#annotationExplanation .annotationMessageContainer").node().getBoundingClientRect().height;
            
                // let newContent = <div className={"annotationMessageContainer " + googleSans.className} style={{ height: height + "px", pointerEvents: "none" }}>
                //     <NavigateCluster filter={true} handiness={handinessRef.current} cluster={cluster} annotations={cluster.annotationsFound} currentAnnotation={annotation} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={true} />
                // </div>;

                d3.selectAll(".react-tooltip#annotationExplanation .annotationMessageContainer")
                .selectAll("div:not(.navigateContainer):not(.navigationContainer), textarea")
                .style("pointer-events", "none")
                .transition()
                .duration(600)
                .style("opacity", 0);

                d3.selectAll(".word.highlighted, .space.highlighted")
                .classed("target", false)
                .classed("fade", false);

                d3.selectAll(".react-tooltip#annotationExplanation .annotationMessageContainer textarea")
                .node()
                .blur();

                d3.select(".react-tooltip#annotationExplanation")
                .style("pointer-events", "none")
                .transition()
                .duration(600)
                .style("background", "rgba(34, 38, 43, 0)");
                // .on("end", () => {
                //     explanationToolTipRef.current?.open({
                //         anchorSelect: ".explanation-tooltip",
                //         content: newContent,
                //         place: "left",
                //     });
                // });
                hoverAnnotation.current = null;
                activeAnnotation.current = null;
                overlappingAnnotationRef.current = [];
            } else {
                let [content, ] = generateContent(annotation, annotations);
                let messageContainer = rateContainer.closest(".annotationMessageHeader").parentNode;

                d3.select(messageContainer)
                .style("pointer-events", "none")
                .style("overflow", "hidden")
                .style("height", messageContainer.getBoundingClientRect().height + "px")
                .transition()
                .duration(600)
                .style("height", "0px")
                .style("margin-bottom", "-15px")
                .on("end", () => {
                    explanationToolTipRef.current?.open({
                        anchorSelect: ".explanation-tooltip",
                        content: content,
                        place: "left",
                    });
                });

                if (overlappingAnnotations.every(a => a.annotation.accepted !== undefined)) {
                    let spans = [];

                    for (let overlappingAnnotation of overlappingAnnotations) {
                        let a = overlappingAnnotation.annotation;

                        if (a.accepted === true) {
                            for (let span of a.spans) {
                                spans.push(span);
                    
                                let space = d3.select(span).node().nextSibling;
                        
                                if (!space) {
                                    space = span.parentNode.nextSibling?.firstChild;
                                }
                        
                                if (space && space.classList.contains("space") && span !== a.spans[a.spans.length - 1]) {
                                    spans.push(space);
                                }
                            }
                        }
                    }
                    d3.selectAll(spans)
                    .classed("accept", true);
                }       
            }
            // console.log(annotations.ref?.current.lockClusters.current);
    
            clusterRef?.current.updateLockCluster([...clusterRef?.current.lockClusters.current]);
                    
            if (cluster) {
                if (onReplyCallback instanceof Function) {
                    onReplyCallback(cluster, "reject " + j);
                }
            }
        }
    
        function auto_grow(e) {
            let element = e.target;
            element.style.height = "5px";
            element.style.height = (element.scrollHeight) + "px";
        }
    
        function onKeyDown(e, overlappingAnnotations) {
            if (e.key === "Enter") {
                e.preventDefault();
                let value = e.target.value.trim();
    
                if (value !== "") {
                    for (let overlappingAnnotation of overlappingAnnotations) {
                        let a = overlappingAnnotation.annotation;
                        a.explanation.push(value);
                        
                        let cluster = overlappingAnnotation.groupAnnotation.ref?.current.lockClusters.current.find(cluster => cluster.annotationsFound?.includes(a));
                        
                        if (cluster && a.accepted !== false) {
                            if (onReplyCallback instanceof Function) {
                                onReplyCallback(cluster, "comment " + overlappingAnnotation.index);
                            }
                        }
                    }
                    e.target.value = "";
                    
                    let [content, ] = generateContent(annotation, annotations);
    
                    explanationToolTipRef.current?.open({
                        anchorSelect: ".explanation-tooltip",
                        content: content,
                        place: "left",
                    });

                    let annotatorComments = [];

                    for (let comment of overlappingAnnotations) {
                        annotatorComments.push("- " + comment.annotation.explanation[0].trim());
                    }
    
                    fetch("/api/storeHistory", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            reply: value,
                            comment: annotatorComments.join("\n"),
                            action: "comment"
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
        let annotationMessages = [];
        let acceptFilterSpans = [];
        let rejectFilterSpans = [];
        let convertRejectFilterSpans = [];

        let overlappingAnnotations = [{groupIndex: annotatedTokens.current.findIndex(group => group === annotations), index: annotations.annotations.findIndex(a => a === annotation), annotation: annotation, groupAnnotation: annotations}];
        // console.log(overlappingAnnotations[0]);
        // console.log(hoverGroupAnnotationRef.current);
        for (let i = 0; i < annotatedTokens.current.length; i++) {
            let searchAnnotations = annotatedTokens.current[i];
            
            if (hoverGroupAnnotationRef.current !== searchAnnotations) {
                loop: for (let j = 0; j < searchAnnotations.annotations.length; j++) {
                    let searchAnnotation = searchAnnotations.annotations[j];

                    if (searchAnnotation.accepted !== false) {
                        if (annotation.spans instanceof Array && searchAnnotation.spans instanceof Array && !overlappingAnnotations.find(a => a.groupIndex === i && a.index === j)) {
                            if (searchAnnotation.spans.every((searchSpan) => annotation.spans.includes(searchSpan))) {
                                if (searchAnnotation.spans.length < annotation.spans.length) {
                                    acceptFilterSpans = acceptFilterSpans.concat(searchAnnotation.spans);
                                    rejectFilterSpans = rejectFilterSpans.concat(annotation.spans.filter(span => searchAnnotation.spans.includes(span)));
                                }
                                if (searchAnnotation.spans.length === annotation.spans.length) {   
                                    overlappingAnnotations.push({groupIndex: i, index: j, annotation: searchAnnotation, groupAnnotation: searchAnnotations});
                                    break loop;
                                }
                            } else if (annotation.spans.every((searchSpan) => searchAnnotation.spans.includes(searchSpan))) {
                                if (annotation.spans.length < searchAnnotation.spans.length && searchAnnotation.accepted === true) {
                                    convertRejectFilterSpans = convertRejectFilterSpans.concat(annotation.spans);
                                }

                                if (annotation.spans.length < searchAnnotation.spans.length && searchAnnotation.accepted !== true) {
                                    rejectFilterSpans = rejectFilterSpans.concat(annotation.spans);
                                }
                            }
                        }
                    }
                }
            }
        }
        // console.log(acceptFilterSpans);
        // console.log(rejectFilterSpans);
        // console.log(convertRejectFilterSpans);
        // console.log(overlappingAnnotations)

        for (let overlappingAnnotation of overlappingAnnotations) {
            let a = overlappingAnnotation.annotation;

            if (a.accepted !== false) {
                let message = a.explanation && a.explanation[0].trim() !== "" ? a.explanation[0] : ``;

                annotationMessages.push(
                    <div style={{ fontSize: "15px", letterSpacing: "0.2px", fontWeight: "400", color: "#E8EDED"}} key={"annotateMessage0" + overlappingAnnotation.groupIndex + overlappingAnnotation.index}>
                        <div className="annotationMessageHeader">
                            <div style={{ display: "flex"}}>
                                <Image src={"/AnnotateGPT.jpg"} alt="icon" width={32} height={32} style={{ marginTop: "8px", marginBottom: "8px", marginRight: "12px", borderRadius: "50%", userSelect: "none" }} />
                                <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "10px"}}>
                                    <div style={{ width: "-webkit-fill-available" }} >{"AnnotateGPT"}</div>
                                    
                                    { a.explanation[0] !== "Generating explanation..." && (a.accepted !== false && a.accepted !== true)?
                                        <div className="rateContainer">
                                            <div className="rateButton" >
                                                <FaThumbsUp size={20} style={{ color: "#2eb086", strokeWidth: "1", marginBottom: "5px" }} onClick={(e) => acceptAnnotation(e, a, overlappingAnnotation.index, overlappingAnnotations, acceptFilterSpans) } />
                                            </div>
                                            <div className="rateButton" >
                                                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 192 752" height="30" width="20" xmlns="http://www.w3.org/2000/svg" style={{ color: "rgb(234, 196, 53)", strokeWidth: 1, marginBottom: "5px" }} onClick={(e) => eitherAnnotation(e, a, overlappingAnnotation.index, overlappingAnnotations, acceptFilterSpans)}>
                                                    <path d="m93.489 144.6292c10.3435 5.5885 21.039 10.4645 32.0016 14.7095 5.9986 2.323 12.1322 4.2685 17.6396-.3986 2.0394-1.7284 3.4942-4.1222 5.0213-6.2952 1.7157-2.4406 3.4223-4.8877 5.1202-7.3415 13.2973-19.2186 26.0387-38.8224 38.2-58.7794 6.9002-11.3235 13.6097-22.7616 20.1392-34.3031 2.6225-4.6353-.1204-9.2534-4.606-11.0101-22.3522-8.7539-44.2964-19.4234-65.2243-31.4952-4.571-2.6368-9.3254.121-11.0101 4.606-14.3497 38.1965-27.636 76.787-39.8419 115.7212-2.0148 7.8671-1.137 12.5886 2.5604 14.5864l0 0zm83.815 29.5603c-3.822-2.6968-8.7492-3.1426-11.576-.0935-2.6749 2.8851-3.1362 7.737-.0763 10.6092 7.6256 7.1572 15.2434 14.3226 22.8773 21.4713 4.2742 4.0029 9.3572 7.4439 15.4962 5.6068 4.9748-1.4885 8.736-5.6332 12.4995-8.9948 15.8644-14.1709 31.7294-28.3419 47.5942-42.5125 15.8648-14.1706 31.7294-28.3419 47.5942-42.5125 7.9325-7.0855 15.8644-14.1709 23.7969-21.2564 3.9027-3.4856 8.8843-6.864 11.7341-11.3171 3.3591-5.2492 2.2091-11.3114-1.6419-15.8771-3.491-4.1384-8.7635-7.1011-13.1133-10.2672-4.8262-3.5127-9.6679-7.0038-14.5247-10.4735-9.714-6.9398-19.4908-13.791-29.3239-20.5605-2.5296-1.7416-6.9789-1.1581-9.0161 1.1523-30.1597 34.2041-59.6849 68.9663-88.544 104.2747-8.1559 9.9784-16.2567 20.0013-24.3074 30.0647-2.4402 3.0506-3.2857 7.6339-.0763 10.6092 2.6877 2.4933 7.9868 3.353 10.6075.0769l0 0zm70.8467 57.5819c-7.204-8.5683-12.4795-9.5489-15.7657-7.6761-3.7997 2.1652-4.4743 6.5308-2.8007 10.232 4.8742 10.7787 9.7488 21.5576 14.623 32.3362 1.3114 2.8997 5.5047 4.4425 8.4571 3.5288 20.783-6.4322 41.5663-12.8649 62.3493-19.2972 5.8156-1.7999 6.8694-8.0752 3.4016-12.5108-11.3759-14.5503-19.5134-32.4987-23.4172-51.2313-.9202-4.4151-7.1129-7.2971-10.9603-4.5751-16.4399 11.6308-31.9934 24.4552-46.421 38.5075-2.8086 2.7357-3.034 7.867-.0763 10.6092 2.9979 2.7786 7.6022 3.0068 10.6102.0768l0 0zm-72.1507 430.2286c0 44.112-35.888 80-80 80s-80-35.888-80-80 35.888-80 80-80 80 35.888 80 80zm-150.74-406.801 13.6 272c.639 12.773 11.181 22.801 23.97 22.801h66.34c12.789 0 23.331-10.028 23.97-22.801l13.6-272c.685-13.709-10.244-25.199-23.97-25.199h-93.54c-13.726 0-24.655 11.49-23.97 25.199z"/>
                                                </svg>
                                                {/* <FaExclamation size={20} style={{ color: "#eac435", strokeWidth: "1" }} onClick={(e) => eitherAnnotation(e, a, overlappingAnnotation.index, overlappingAnnotations, acceptFilterSpans)} /> */}
                                            </div>
                                            <div className="rateButton" >
                                                <FaThumbsDown size={20} style={{ color: "#b8405e", strokeWidth: "1", marginTop: "5px" }} onClick={(e) => rejectAnnotation(e, a, overlappingAnnotation.index, overlappingAnnotations, rejectFilterSpans, convertRejectFilterSpans)} />
                                            </div>
                                        </div>
                                        : null
                                    }
                                </div>
                            </div>
                        </div>
                        {message}
                        <div style={{ fontSize: "small", marginTop: "10px" }} >
                            <i>Purpose: { overlappingAnnotation.groupAnnotation.purposeTitle }</i>
                        </div>
                    </div>
                );
            }
        }
        // console.log(overlappingAnnotations);

        let a = overlappingAnnotations[0].annotation;

        for (let k = 1; k < a.explanation.length; k++) {
            annotationMessages.push(
                <div style={{ fontSize: "15px", letterSpacing: "0.2px", fontWeight: "400", color: "#E8EDED"}} key={"annotateMessage" + k + overlappingAnnotations[0].groupIndex + overlappingAnnotations[0].index}>
                    <div className="annotationMessageHeader">
                        <div style={{ display: "flex"}}>
                            <Image src={"/user.jpg"} alt="icon" width={32} height={32} style={{ marginRight: "12px", borderRadius: "50%", userSelect: "none" }} />
                            <div style={{ display: "flex", alignItems: "center" }}>
                                {"You"}
                            </div>
                        </div>
                    </div>
                    {a.explanation[k]}
                </div>
            );
        }
        
        // let cluster = penAnnotationRef.current.find(ref => ref.current.lockClusters.current.find(lockCluster => lockCluster.annotationsFound?.includes(annotation)));
        // let cluster = annotations.ref?.current.lockClusters.current.find(cluster => cluster.annotationsFound?.includes(annotation));
        let cluster = null;

        penAnnotationRef.current.some(ref => {
            const foundCluster = ref.current.lockClusters.current.find(lockCluster => lockCluster.annotationsFound?.includes(a));

            if (foundCluster) {
                cluster = foundCluster;
                return true;
            }
            return false;
        });

        // let activeAnnotationsFound = cluster?.annotationsFound ? [...cluster.annotationsFound] : [];

        let onNavigateCallback = (annotation) => {
            let annotations = annotatedTokens.current.find(groupAnnotations => groupAnnotations.annotations.find(annotated => annotated === annotation));
            hoverGroupAnnotationRef.current = annotations;

            if (annotation.spans[0] instanceof Element && annotation.spans[0].classList.contains("toolTip")) {
                cluster.open = true;
                annotations.ref?.current.updateLockCluster([...annotations.ref?.current.lockClusters.current]);
                // let activeAnnotationsFound = cluster?.annotationsFound ? [...cluster.annotationsFound] : [];

                let content = <div className={"annotationMessageContainer " + googleSans.className}>
                    <NavigateCluster filter={false} handiness={handinessRef.current} cluster={cluster} annotations={annotatedTokens.current.map(groupAnnotations => groupAnnotations.annotations).flat()} currentAnnotation={annotation} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={false} />
                </div>;
                // explanationToolTipRef.current?.close();
                fadeDisplayExplanation(content, annotation, false);
            } else {
                cluster.open = false;
                annotations.ref?.current.updateLockCluster([...annotations.ref?.current.lockClusters.current]);
                
                let [content, overlappingAnnotations] = generateContent(annotation, annotations);
                overlappingAnnotationRef.current = overlappingAnnotations;

                fadeDisplayExplanation(content, annotation, true, overlappingAnnotations);
            }
            activeAnnotation.current = annotation;
            miniMapRef.current?.synchronize();

            if (navigateCallback instanceof Function) {
                navigateCallback(annotation);
            }
        };

        let content = 
        <div className={"annotationMessageContainer " + googleSans.className}>
            { annotationMessages }
            { annotation.explanation[0] !== "Generating explanation..." ? <textarea className={googleSans.className} onInput={auto_grow} onKeyDown={(e) => onKeyDown(e, overlappingAnnotations, annotation)} placeholder="Reply" /> : null }
            
            <NavigateCluster filter={true} handiness={handinessRef.current} cluster={cluster} annotations={annotatedTokens.current.map(groupAnnotations => groupAnnotations.annotations).flat()} currentAnnotation={annotation} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={undefined}/>
        </div>;

        return [content, overlappingAnnotations];
    }, [navigateCallback, onReplyCallback]);
    
    function fadeDisplayExplanation(content, annotation, overrideDisplay = true, overlappingAnnotations = []) {
        let closestTextLayer = d3.select(".textLayer").node();
        let highlighAnnotation = annotation.spans.filter(span => span instanceof Element && !span.classList.contains("toolTip"));
        window.getSelection().removeAllRanges();

        if (highlighAnnotation.length === 0) {
            d3.selectAll(".word.highlighted, .space.highlighted")
            .classed("target", false)
            .classed("fade", false);
        } else {
            d3.selectAll(".word.highlighted, .space.highlighted")
            .classed("target", false)
            .classed("fade", true);
        }
        let spans = [];

        for (let i = 0; i < highlighAnnotation.length; i++) {
            let span = highlighAnnotation[i];
            let space = d3.select(span).node().nextSibling;
            spans.push(span);

            if (!space) {
                space = span.parentNode.nextSibling?.firstChild;
            }

            if (space && space.classList.contains("space") && i !== highlighAnnotation.length - 1) {
                spans.push(space);
            }
        }
        d3.selectAll(spans)
        .classed("highlighted", true)
        .classed("fade", false);

        for (let a of overlappingAnnotations) {
            let targetWords = a.annotation.targetSpans.filter(span => span instanceof Element && !span.classList.contains("toolTip"));
            let targetSpans = [];

            for (let i = 0; i < targetWords.length; i++) {
                let span = targetWords[i];
                targetSpans.push(span);
            }
            d3.selectAll(targetSpans)
            .classed("target", true);
        }

        if (!explanationToolTipRef.current?.isOpen) {
            d3.select(".explanation-tooltip")
            .style("top", d3.mean(annotation.spans.filter(span => span).map(span => span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2)) - containerRef.current.getBoundingClientRect().top + "px")
            .style("left", handinessRef.current === "right" ? closestTextLayer.getBoundingClientRect().right + 10 + "px" : closestTextLayer.getBoundingClientRect().left - 10 + "px");

            explanationToolTipRef.current?.open({
                anchorSelect: ".explanation-tooltip",
                content: content,
                place: "left",
            });
            
            setTimeout(() => {
                d3.select(".react-tooltip#annotationExplanation")
                .style("background", overrideDisplay ? "rgba(34, 38, 43, 1)" : "rgba(34, 38, 43, 0)")
                .select("textarea")
                .style("pointer-events", "auto")
                .style("opacity", 1);
            }, 10);
        } else {
            d3.select(".react-tooltip#annotationExplanation")
            .transition()
            .duration(300)
            .style("opacity", 0)
            .on("end", () => {
                setTimeout(() => {
                    explanationToolTipRef.current?.open({
                        position: { x: -1000, y: -1000 },
                        content: content,
                        place: "left",
                    });

                    d3.select(".explanation-tooltip")
                    .style("top", d3.mean(annotation.spans.filter(span => span).map(span => span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2)) - containerRef.current.getBoundingClientRect().top + "px")
                    .style("left", handinessRef.current === "right" ? closestTextLayer.getBoundingClientRect().right + 10 + "px" : closestTextLayer.getBoundingClientRect().left - 10 + "px");
                    
                    setTimeout(() => {
                        d3.select(".react-tooltip#annotationExplanation")
                        .style("background", overrideDisplay ? "rgba(34, 38, 43, 1)" : "rgba(34, 38, 43, 0)")
                        .select("textarea")
                        .style("pointer-events", "auto")
                        .style("opacity", 1);
                    }, 10);

                    d3.select(".react-tooltip#annotationExplanation")
                    .style("background", overrideDisplay ? "rgba(34, 38, 43, 1)" : "rgba(34, 38, 43, 0)")
                    .transition()
                    .delay(300)
                    .duration(300)
                    .style("opacity", 1)
                    .on("start", () => {
                        explanationToolTipRef.current?.open({
                            anchorSelect: ".explanation-tooltip",
                            content: content,
                            place: "left",
                        });
                    });
                }, 200);
            });
        }
    }

    useEffect(() => {
        toolTipRef.current = tool;

        return () => {
            toolTipRef.current = null;
        };
    }, [tool]);

    useEffect(() => {
        colourRef.current = colour;

        return () => {
            colourRef.current = null;
        };
    }, [colour]);

    useEffect(() => {
        activeClusterRef.current = activeCluster;

        return () => {
            activeClusterRef.current = null;
        };
    }, [activeCluster]);

    useEffect(() => {
        handinessRef.current = handiness;
    }, [handiness]);

    useEffect(() => {
        disableRef.current = disabled;

        if (disabled) {
            resetToolTips();
        }
    }, [disabled]);

    const explainTooltipTimeout = useRef(null);
    const highlightTimeout = useRef(null);
    const hoverAnnotation = useRef(null);
    const hoverGroupAnnotationRef = useRef(null);
    const overlappingAnnotationRef = useRef(null);
    const activeAnnotation = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        let hasTouchScreen = navigator.maxTouchPoints > 0;

        d3.select(".annotateContainer")
        .on(hasTouchScreen ? "touchstart" : "pointermove", (e) => {
        // .on("pointermove", (e) => {
            // if (hasTouchScreen && e.pointerType !== "touch") {
            //     return;
            // }

            if (e.buttons !== 0 && !hasTouchScreen) {
                clearTimeout(explainTooltipTimeout.current);
                clearTimeout(highlightTimeout.current);
                return;
            }

            // let [x, y] = [e.clientX, e.clientY];
            let [x, y] = hasTouchScreen ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY];
            let annotations, annotation;
            let i, j;
            let found = false, hoverFound = false;

            loop1: for (i = 0; i < annotatedTokens.current.length; i++) {
                annotations = annotatedTokens.current[i];

                for (j = 0; j < annotations.annotations.length; j++) {
                    annotation = annotations.annotations[j];

                    if (annotation === activeAnnotation.current) {
                        continue;
                    }

                    // console.log(annotation.spans);
                    if (annotation.spans) {
                        for (let span of annotation.spans) {
                            if (span instanceof Element) {
                                let rect = span.getBoundingClientRect();
                                let x1 = rect.left - 5;
                                let x2 = rect.right + 5;
                                let y1 = rect.top - 5;
                                let y2 = rect.bottom + 5;
        
                                if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
                                    hoverFound = true;

                                    if (hoverAnnotation.current !== annotation && annotation.accepted !== false && activeAnnotation.current !== annotation && 
                                        (hoverAnnotation.current?.spans?.length !== annotation.spans.length || !hoverAnnotation.current?.spans?.every(s => annotation.spans.includes(s))) &&
                                        (activeAnnotation.current?.spans?.length !== annotation.spans.length || !activeAnnotation.current?.spans?.every(s => annotation.spans.includes(s))) &&
                                        (!hoverAnnotation.current?.spans?.includes(span)  || !hoverAnnotation.current || hoverAnnotation.current?.spans?.length >= annotation.spans.length) && 
                                        (!activeAnnotation.current?.spans?.includes(span) || !activeAnnotation.current || activeAnnotation.current?.spans?.length >= annotation.spans.length)
                                    ) {
                                        hoverAnnotation.current = annotation;
                                        hoverGroupAnnotationRef.current = annotations;
                                        found = true;

                                        clearTimeout(explainTooltipTimeout.current);
                                        clearTimeout(highlightTimeout.current);
                                        break loop1;
                                    } else if (activeAnnotation.current === annotation) {
                                        hoverAnnotation.current = annotation;
                                        
                                        clearTimeout(explainTooltipTimeout.current);
                                        clearTimeout(highlightTimeout.current);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (!hoverFound) {
                clearTimeout(explainTooltipTimeout.current);
                clearTimeout(highlightTimeout.current);
                hoverAnnotation.current = null;

                if (hasTouchScreen) {
                    if (e.target.parentNode.classList.contains("pen-annotation-layer")) {
                        resetToolTips();
                    }
                }
                // d3.selectAll(".word.highlighted, .space.highlighted")
                // .classed("fade", false);
            }

            if (found) {
                // highlightTimeout.current = setTimeout(() => {
                //     d3.selectAll(".word.highlighted, .space.highlighted")
                //     .classed("target", false)
                //     .classed("fade", true);

                //     let spans = [];

                //     for (let i = 0; i < annotation.spans.length; i++) {
                //         let span = annotation.spans[i];
                //         spans.push(span);

                //         let space = d3.select(span).node().nextSibling;

                //         if (!space) {
                //             space = span.parentNode.nextSibling?.firstChild;
                //         }
    
                //         if (space && space.classList.contains("space") && i !== annotation.spans.length - 1) {
                //             spans.push(space);
                //         }
                //     }
                //     d3.selectAll(spans)
                //     .classed("highlighted", true)
                //     .classed("fade", false);

                //     let targetWords = annotation.targetSpans.filter(span => span instanceof Element && !span.classList.contains("toolTip"));
                //     let targetSpans = [];

                //     for (let i = 0; i < targetWords.length; i++) {
                //         let span = targetWords[i];
                //         targetSpans.push(span);
                //     }
                //     d3.selectAll(targetSpans)
                //     .classed("target", true);
                // }, 1000);

                explainTooltipTimeout.current = setTimeout(() => {
                    let [content, overlappingAnnotations] = generateContent(annotation, annotations);

                    fadeDisplayExplanation(content, annotation, true, overlappingAnnotations);
                    activeAnnotation.current = annotation;
                    overlappingAnnotationRef.current = overlappingAnnotations;
                    
                    for (let a of annotatedTokens.current) {
                        if (a.ref?.current.lockClusters.current) {
                            for (let cluster of a.ref.current.lockClusters.current) {
                                if (cluster.open) {
                                    cluster.open = false;
                                    a.ref.current.updateLockCluster([...a.ref.current.lockClusters.current]);
                                }
                            }
                        }
                    }
                    miniMapRef.current?.synchronize();

                    if (navigateCallback instanceof Function) {
                        navigateCallback(annotation);
                    }
                }, hasTouchScreen ? 0 : 500);
            }
            // explanationToolTipRef.current?.close();
        });

        return () => {
            d3.select(".annotateContainer")
            .on("click", null)
            .on("touchstart", null)
            .on("pointermove", null);
        };
    }, [onReplyCallback, generateContent, navigateCallback]);

    let prevDocumentPDF = useRef(null);
    let loadBuffer = useRef(false);

    useEffect(() => {
        setLoading(true);
        setProgress(0);

        // if (typeof modeRef.current === "string" && modeRef.current.toLowerCase().includes("practice")) {
        //     setLoadingDocument(false);
        //     return;
        // }
        setLoadingDocument(true);

        let payload;
        let headers;

        let sendFile = () => {
            fetch("/api/updateDocument", {
                method: "POST",
                headers: headers,
                body: payload
            })
            .then(res => {
                if (!res.ok)
                    return res.text().then(text => { throw new Error(text); });
                return res.text();
            })
            .then((data) => {
                console.log("Success:", data);
                setLoadingDocument(false);
            })
            .catch((error) => {
                console.error("documentUpload:", error);

                toast.error("documentUpload: " + error.toString().replaceAll("Error: ", ""), {
                    toastId: "fileUpload",
                    containerId: "errorMessage"
                });
                setLoadingDocument(false);
            });
        };

        let intiatePayload = () => {
            if (typeof documentPDF === "string" || !documentPDF) {
                payload = JSON.stringify({
                    document: documentPDF ?? "./public/Test 1.pdf"
                });
    
                headers = {
                    "Content-Type": "application/json"
                };
                sendFile();            
            } else {
                const formData = new FormData();
                formData.append("file", documentPDF);
    
                headers = {
                    "Content-Type": "application/json",
                };
    
                payload = documentPDF.arrayBuffer().then(buff => {
                    let x = new Uint8Array(buff);
    
                    payload = JSON.stringify({
                        fileName: documentPDF.name,
                        data: Array.from(x)
                    });
                    sendFile();
                });
            }
        };

        while (loadBuffer.current) {
            continue;
        }

        if (documentPDF instanceof File && prevDocumentPDF.current instanceof Buffer) {
            loadBuffer.current = true;

            documentPDF.arrayBuffer()
            .then(buffer => {
                let newBuffer = Buffer.from(buffer);

                if (!newBuffer.equals(prevDocumentPDF.current)) {
                    intiatePayload();
                    prevDocumentPDF.current = newBuffer;
                }
                loadBuffer.current = false;
            })
            .catch(() => {
                loadBuffer.current = false;
            });
        } else if (typeof documentPDF === "string" && typeof prevDocumentPDF.current === "string") {
            if (documentPDF !== prevDocumentPDF.current) {
                intiatePayload();
                prevDocumentPDF.current = documentPDF;
            }
        } else {
            intiatePayload();

            if (documentPDF instanceof File) {
                loadBuffer.current = true;

                documentPDF.arrayBuffer()
                .then(buffer => {
                    let newBuffer = Buffer.from(buffer);
                    prevDocumentPDF.current = newBuffer;
                    
                    loadBuffer.current = false;
                })
                .catch(() => {
                    loadBuffer.current = false;
                });
            } else if (typeof documentPDF === "string") {
                prevDocumentPDF.current = documentPDF;
            }
        }
    }, [documentPDF]);

    let filterDocument = typeof documentPDF === "string" && documentPDF.startsWith("./public") ? "." + documentPDF.slice(8) : documentPDF;

    let renderChild = ({ width, height, left, top, node }) => {
        if (node.classList.contains("lineDraw")) {
            return <div
                style={{
                    position: "absolute",
                    width: "25%",
                    height: Math.max(2, height),
                    left: handiness === "right" ? 0 : "75%",
                    top,
                    backgroundColor: node.style.fill
                }}
            />;
        } else if (node.classList.contains("word") || node.classList.contains("space")) {
            return <div
                className={node.classList.contains("accept") ? "accept" : "highlight"}
                style={{
                    position: "absolute",
                    width: "25%",
                    height: Math.max(2, height),
                    left: handiness === "right" ? "75%" : 0,
                    top,
                    backgroundColor: node.classList.contains("accept") ? "#a7f1a7" : "#fce897",
                }}
            />;
        } else {
            let background, className;

            if (node.parentNode.classList.contains("exit")) {
                return;
            }

            if (node.parentNode.classList.contains("inferring") || node.parentNode.classList.contains("annotating")) {
                background = "#F96900";
                className = "busy";
            } else if (node.parentNode.classList.contains("done")) {
                background = "#06D6A0";
                className = "done";
            } else if (node.parentNode.classList.contains("havePurpose")) {
                background = "#FFFD82";
                className = "attention";
            }

            let id = node.parentNode.id.startsWith("toolTip") ? node.parentNode.id.slice(7) : node.parentNode.id;
            let opacity = className === "done" ? 1 : 0.8;
            let getActiveCluster = [];
            let overlappingAnnotations = overlappingAnnotationRef.current.map(a => a.annotation);

            for (let ref of penAnnotationRef.current) {
                for (let lockCluster of ref.current?.lockClusters.current) {
                    if (lockCluster.annotationsFound?.includes(activeAnnotation.current) || lockCluster.annotationsFound?.some(a => overlappingAnnotations.includes(a))) {
                        getActiveCluster.push(lockCluster);
                    }
                }
            }
            
            if (getActiveCluster.length > 0) {
                let found = getActiveCluster.find(cluster => cluster.strokes[cluster.strokes.length - 1].id === id);

                if (!found) {
                    opacity = 0.2;
                }
            }

            return <div
                className={className}
                id={"marker" + id}
                style={{
                    position: "absolute",
                    width: "50%",
                    height: "auto",
                    aspectRatio: 1,
                    left: "50%",
                    transform: "translateX(-50%)",
                    top,
                    backgroundColor: background,
                    borderRadius: "50%",
                    opacity: opacity,
                    transition: "opacity 0.5s"
                }}
            />;
        }
    };

    return (
        <>
            <Minimap selector=".toolTip rect:first-child, .lineDraw, .highlighted" scrollContainer={"#root"} childComponent={renderChild} height={minimapHeight} width={20} ref={miniMapRef} className={handiness}/>
        
            <div className="annotateContainer" ref={containerRef}>
                <div className="explanation-tooltip" style={{ opacity: "0", zIndex: "1000", position: "absolute" }} />

                <Document 
                    file={filterDocument ?? "./Test 1.pdf"}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div className="shimmerBGContainer" ><div className="shimmerBG" /></div>}
                >
                    {pageContent}

                    <div className="pen-annotation-container">
                        {penAnnotation}
                    </div>
                </Document>
                
                <Comment
                    visible={true}
                    height="80"
                    width="80"
                    wrapperStyle={{ opacity: "0", position: "absolute", top: 0 }}
                    wrapperClass="comment-wrapper"
                    color="#fff"
                    backgroundColor="#F4442E"
                />
                <MagnifyingGlass
                    visible={true}
                    height="80"
                    width="80"
                    wrapperStyle={{ opacity: "0", position: "absolute", top: 0 }}
                    wrapperClass="glass-wrapper"
                    glassColor="#c0efff"
                    color="#e15b64"
                />
                <Toolbar tool={tool} onToolChange={onToolChange} onColourChange={onChange} defaultColour={defaultColour} handiness={handiness} />

                <Tooltip 
                    // id="annotationDescription"
                    style={{ zIndex: "5", padding: "16px", borderRadius: "8px", background: "#22262b" }}
                    place={"top"}
                    ref={annotationToolTipRef}
                    imperativeModeOnly={true}
                    closeEvents={{
                        "mouseout": false,
                    }}
                />

                <Tooltip 
                    id="annotationExplanation"
                    style={{ zIndex: "5", padding: "16px", borderRadius: "8px", background: "rgba(34, 38, 43, 1)" }}
                    place={handiness}
                    ref={explanationToolTipRef}
                    imperativeModeOnly={true}
                    
                    middlewares={[
                        autoPlacement({
                            allowedPlacements: [handiness],
                        }),
                    ]}
                />
                { !dismiss ? <Loading progress={loadingDocument ? Math.max(progress - 1, 0) : progress} /> : null}
            </div>
        </>
            
    );
}