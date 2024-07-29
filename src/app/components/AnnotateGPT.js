"use client";

import { createRef, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image.js";
import { Document, Page } from "react-pdf";
import * as d3 from "d3";
import { Comment, MagnifyingGlass } from "react-loader-spinner";
import { pdfjs } from "react-pdf";
import { Tooltip } from "react-tooltip";
import {autoPlacement} from "@floating-ui/dom";
// import { RxCheck, RxCross2 } from "react-icons/rx";
import { FaThumbsUp, FaThumbsDown } from "react-icons/fa";
import { split } from "sentence-splitter";
import { toast } from "react-toastify";

import PenAnnotation from "./PenAnnotation.js";
import Toolbar from "./Toolbar.js";
import NavigateCluster from "./NavigateCluster.js";
import Loading from "./Loading.js";
import { findAnnotations } from "./js/OpenAIUtils.js";
import { googleSans } from "@/app/page.js";

import "react-tooltip/dist/react-tooltip.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./css/AnnotateGPT.css";

// pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
).toString();

let workerLevenshteinDistance = () => {
    // https://github.com/ka-weihe/fastest-levenshtein
    onmessage = function(e) {
        const a = e.data.a;
        const b = e.data.b;
        const i = e.data.i;
        const i2 = e.data.i2;
        const peq = new Uint32Array(0x10000);

        const myers_32 = (a, b) => {
            const n = a.length;
            const m = b.length;
            const lst = 1 << (n - 1);
            let pv = -1;
            let mv = 0;
            let sc = n;
            let i = n;
            while (i--) {
                peq[a.charCodeAt(i)] |= 1 << i;
            }
            for (i = 0; i < m; i++) {
                let eq = peq[b.charCodeAt(i)];
                const xv = eq | mv;
                eq |= ((eq & pv) + pv) ^ pv;
                mv |= ~(eq | pv);
                pv &= eq;
                if (mv & lst) {
                    sc++;
                }
                if (pv & lst) {
                    sc--;
                }
                mv = (mv << 1) | 1;
                pv = (pv << 1) | ~(xv | mv);
                mv &= xv;
            }
            i = n;
            while (i--) {
                peq[a.charCodeAt(i)] = 0;
            }
            return sc;
        };

        const myers_x = (b, a) => {
            const n = a.length;
            const m = b.length;
            const mhc = [];
            const phc = [];
            const hsize = Math.ceil(n / 32);
            const vsize = Math.ceil(m / 32);
            for (let i = 0; i < hsize; i++) {
                phc[i] = -1;
                mhc[i] = 0;
            }
            let j = 0;
            for (; j < vsize - 1; j++) {
                let mv = 0;
                let pv = -1;
                const start = j * 32;
                const vlen = Math.min(32, m) + start;
                for (let k = start; k < vlen; k++) {
                    peq[b.charCodeAt(k)] |= 1 << k;
                }
                for (let i = 0; i < n; i++) {
                    const eq = peq[a.charCodeAt(i)];
                    const pb = (phc[(i / 32) | 0] >>> i) & 1;
                    const mb = (mhc[(i / 32) | 0] >>> i) & 1;
                    const xv = eq | mv;
                    const xh = ((((eq | mb) & pv) + pv) ^ pv) | eq | mb;
                    let ph = mv | ~(xh | pv);
                    let mh = pv & xh;
                    if ((ph >>> 31) ^ pb) {
                        phc[(i / 32) | 0] ^= 1 << i;
                    }
                    if ((mh >>> 31) ^ mb) {
                        mhc[(i / 32) | 0] ^= 1 << i;
                    }
                    ph = (ph << 1) | pb;
                    mh = (mh << 1) | mb;
                    pv = mh | ~(xv | ph);
                    mv = ph & xv;
                }
                for (let k = start; k < vlen; k++) {
                    peq[b.charCodeAt(k)] = 0;
                }
            }
            let mv = 0;
            let pv = -1;
            const start = j * 32;
            const vlen = Math.min(32, m - start) + start;
            for (let k = start; k < vlen; k++) {
                peq[b.charCodeAt(k)] |= 1 << k;
            }
            let score = m;
            for (let i = 0; i < n; i++) {
                const eq = peq[a.charCodeAt(i)];
                const pb = (phc[(i / 32) | 0] >>> i) & 1;
                const mb = (mhc[(i / 32) | 0] >>> i) & 1;
                const xv = eq | mv;
                const xh = ((((eq | mb) & pv) + pv) ^ pv) | eq | mb;
                let ph = mv | ~(xh | pv);
                let mh = pv & xh;
                score += (ph >>> (m - 1)) & 1;
                score -= (mh >>> (m - 1)) & 1;
                if ((ph >>> 31) ^ pb) {
                    phc[(i / 32) | 0] ^= 1 << i;
                }
                if ((mh >>> 31) ^ mb) {
                    mhc[(i / 32) | 0] ^= 1 << i;
                }
                ph = (ph << 1) | pb;
                mh = (mh << 1) | mb;
                pv = mh | ~(xv | ph);
                mv = ph & xv;
            }
            for (let k = start; k < vlen; k++) {
                peq[b.charCodeAt(k)] = 0;
            }
            return score;
        };

        const distance = (a, b) => {
            if (a.length < b.length) {
                const tmp = b;
                b = a;
                a = tmp;
            }
            if (b.length === 0) {
                return a.length;
            }
            if (a.length <= 32) {
                return myers_32(a, b);
            }
            return myers_x(a, b);
        };

        postMessage({distance: distance(a, b), a, b, i, i2});
    };
};

export default function AnnotateGPT({ documentPDF, pEndCallback, onECallback, onInferenceCallback, onEndAnnotateCallback, navigateCallback, onReplyCallback, svgContent, screen, mode, annotateRef }) {
    const defaultColour = "#000000";

    const [numPages, setNumPages] = useState();
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

            characters.forEach((character, j) => {
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
        setNumPages(numPages);
          
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
        let penAnnotation = [];
        penAnnotationRef.current = [];
        resetToolTips();

        for (let index = 0; index < numPages; index++) {
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
        setPageContent(pageContent);
        setPenAnnotation(penAnnotation);
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
        if (svgContent instanceof Array) {
            for (let svg of svgContent) {
                let page = svg.page;
                let svgContent = svg.svg;

                if (page && svgContent) {
                    let penAnnnotationRef = penAnnotationRef.current[page - 1];
                    d3.select(penAnnnotationRef.current.svgRef).html(d3.select(penAnnnotationRef.current.svgRef).html() + svgContent.replace("lineDraw", ""));
                }
            }
        }
    }, [svgContent]);

    let initCanvas = useRef(null);

    useEffect(() => {
        initCanvas.current = (width) => {
            svgContentRef.current = Array(numPages).fill(null);
            textContent.current = Array(numPages).fill(null);
    
            let pageContent = Array.from(new Array(numPages), (el, index) =>
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
                    { index !== numPages - 1 ? <hr style={{ width: "100%" }} /> : null }
                </div>
            );
            let penAnnotation = [];
            penAnnotationRef.current = [];
    
            for (let index = 0; index < numPages; index++) {
                let ref = createRef();
                penAnnotationRef.current.push(ref);
    
                penAnnotation.push(<PenAnnotation 
                    index={index + 1}
                    tool={toolTipRef}
                    colour={colourRef}
                    key={`annotation_${index + 1}`}
                    content={svgContentRef.current[index + 1]}
                    toolTipRef={annotationToolTipRef}
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
            setPageContent(pageContent);
            setPenAnnotation(penAnnotation);
        };
    });

    useEffect(() => {
        if (screen?.width && screen?.height) {
            for (let penAnnnotationRef of penAnnotationRef.current) {
                d3.select(penAnnnotationRef.current.svgRef)
                .attr("viewBox", `${0} ${0} ${screen.width} ${screen.height}`);
            }
            initCanvas.current(screen.width);
        }
    }, [screen]);

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

        d3.select(".pen-annotation-container").style("--annotation-height", height + "px");
        d3.select(".screenshot-container1").style("--annotation-width", width + "px");
        d3.select(".screenshot-container1").style("--annotation-height", height + "px");
        d3.select(".screenshot-container2").style("--annotation-width", width + "px");
        d3.select(".screenshot-container2").style("--annotation-height", height + "px");

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
            setProgress(100);
            setLoading(false);

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

    async function setUpAnnotations(annotationDescription, purposeTitle, purpose, onDetect, onEnd, forwardRef) {
        rawAnnotationOutput.current.push({ output: "" });
        let index = rawAnnotationOutput.current.length - 1;
        let setUpAnnotatedTokens = [];
        let cutIndex = [];
        let done = 0;
        let finish = false;
        let prevToken = "";

        annotatedTokens.current.push({annotationDescription: annotationDescription, purposeTitle: purposeTitle, purpose: purpose, annotations: setUpAnnotatedTokens, ref: forwardRef});

        function handleToken(token) {
            rawAnnotationOutput.current[index].output += token;

            if (token.trim().startsWith(`***`) || token.trim().endsWith(`***`) || (prevToken + token).trim().startsWith(`***`) || (prevToken + token).trim().endsWith(`***`)) {
                prevToken = "";
                let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken?.state === "start") {
                    lastToken.state = "end";
                    // console.log(lastToken.sentence.trim().split(" "));

                    if (lastToken.sentence.trim().split(" ").length <= 2) {
                        return;
                    }

                    let callback = (result) => {
                        done++;
                        // console.log(result);
                        // console.log("Done", done, cutIndex.length, setUpAnnotatedTokens.length, finish);
                        // console.log(setUpAnnotatedTokens);

                        if (result instanceof Array) {
                            lastToken.spans = result;

                            loop1: for (let i = 0; i < setUpAnnotatedTokens.length; i++) {
                                for (let j = i + 1; j < setUpAnnotatedTokens.length; j++) {
                                    let spans1 = setUpAnnotatedTokens[i].spans;
                                    let spans2 = setUpAnnotatedTokens[j].spans;
                                    
                                    for (let span1 of spans1) {
                                        for (let span2 of spans2) {
                                            if (span1 === span2) {
                                                cutIndex.push(spans1.length > spans2.length ? [j, i] : [i, j]);
                                                done--;
                                                break loop1;
                                            }
                                        }
                                    }
                                }
                            }

                            if (onDetect instanceof Function) {
                                onDetect([...setUpAnnotatedTokens].filter(annotation => annotation.spans.filter(r => r instanceof Element).length !== 0));
                            }
                        } else {
                            console.log(result);
                        }
                        
                        if (done + cutIndex.length === setUpAnnotatedTokens.length && finish) {
                            handleEnd();
                        }
                    };

                    let done2 = 0;
                    let executed2 = 0;
                    let worker = new Worker(URL.createObjectURL(new Blob([`(${workerLevenshteinDistance})()`])));

                    worker.onmessage = (e) => {
                        const distance = e.data.distance;
                        const substring = e.data.a.length > e.data.b.length ? e.data.a : e.data.b;
                        const i = e.data.i;
                        const i2 = e.data.i2;
                        done2++;

                        // console.log("Distance", distance, e.data.a, e.data.b);
                        
                        if (distance < substring.length / 2) {
                            // console.log("Cut", lastToken.sentence.trim());
                            cutIndex.push([i, i2]);

                            if (done + cutIndex.length === setUpAnnotatedTokens.length && finish) {
                                handleEnd();
                            }
                            worker.terminate();
                            return;
                        }

                        if (done2 === executed2) {
                            console.log("Annotating", lastToken.sentence.trim());
                            annotate(lastToken.sentence.trim(), callback);
                            worker.terminate();
                        }
                    };

                    for (let i = 0; i < setUpAnnotatedTokens.length - 1; i++) {
                        let sentences = setUpAnnotatedTokens[i].sentence.trim();
                        let sentencesSplit = split(sentences).map((sentence) => sentence.raw).filter((sentence) => sentence.trim() !== "");
                        // console.log("Split", sentencesSplit);

                        for (let sentence of sentencesSplit) {
                            let sentencesSplit2 = split(lastToken.sentence.trim()).map((sentence) => sentence.raw).filter((sentence) => sentence.trim() !== "");

                            for (let sentence2 of sentencesSplit2) {
                                // console.log("Comparing", sentence, "||", sentence2);

                                executed2++;
                                worker.postMessage({ a: sentence, b: sentence2, i, i2: setUpAnnotatedTokens.length - 1 });
                            }
                        }
                    }

                    if (executed2 === 0) {
                        worker.terminate();
                    }

                    if (setUpAnnotatedTokens.length === 1) {
                        // console.log("Annotating", lastToken.sentence.trim());
                        annotate(lastToken.sentence.trim(), callback);
                    }
                } else {
                    setUpAnnotatedTokens.push({ sentence: "", state: "start", explanation: ["Generating explanation..."], explain: false, spans: []});
                }
            } else if (token.trim().startsWith(`{{`) || token.trim().endsWith(`{{`) || (prevToken + token).trim().startsWith(`{{`) || (prevToken + token).trim().endsWith(`{{`)) {
                let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken) {
                    lastToken.explain = true;
                    lastToken.explanation[0] = "";
                }
                prevToken = "";
            } else if (token.trim().startsWith(`}}`) || token.trim().endsWith(`}}`) || (prevToken + token).trim().startsWith(`}}`) || (prevToken + token).trim().endsWith(`}}`)) {
                let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken) {
                    lastToken.explain = false;

                    if ((lastToken.explanation[0] + token).trim().endsWith("}}}")) {
                        lastToken.explanation[0] = (lastToken.explanation[0] + token).trim().slice(0, -3);
                    }
                    lastToken.explanation[0] = lastToken.explanation[0].trim();
                    // .replace(/^\"+|\"+$/g, "");
                }

                for (let index of cutIndex) {
                    if (setUpAnnotatedTokens[index[0]]?.explanation[0] === "Generating explanation...") {
                        setUpAnnotatedTokens[index[0]].explanation[0] = setUpAnnotatedTokens[index[1]]?.explanation[0];
                    }
                }
                prevToken = "";
            } else {
                let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken?.state === "start") {
                    lastToken.sentence += token;
                } else if (lastToken?.explain === true) {
                    lastToken.explanation[0] += token;
                }
                prevToken = token;
            }
        }

        function handleEnd() {
            finish = true;

            if (done + cutIndex.length === setUpAnnotatedTokens.length) {
                // FIlter out repeated cut indexes
                cutIndex = cutIndex.sort((a, b) => b[1] - a[1]);
                cutIndex = cutIndex.filter((index, i) => i === 0 || index[1] !== cutIndex[i - 1][1]);

                for (let index of cutIndex) {
                    if (setUpAnnotatedTokens[index[0]]?.explanation[0] === "Generating explanation...") {
                        setUpAnnotatedTokens[index[0]].explanation[0] = setUpAnnotatedTokens[index[1]]?.explanation[0];
                    }
                }
                
                for (let index of cutIndex) {
                    for (let span of setUpAnnotatedTokens[index[1]].spans) {
                        if (span instanceof Element) {
                            d3.select(span)
                            .style("background", null)
                            .classed("highlighted", false);

                            let space = d3.select(span).node().nextSibling;

                            if (!space) {
                                space = span.parentNode.nextSibling?.firstChild;
                            }
        
                            if (space && space.classList.contains("space")) {
                                d3.select(space)
                                .classed("highlighted", false)
                                .style("background", null);
                            }
                        }
                    }

                    // for (let span of setUpAnnotatedTokens[index[0]].spans) {
                    for (let i = 0; i < setUpAnnotatedTokens[index[0]].spans.length; i++) {
                        let span = setUpAnnotatedTokens[index[0]].spans[i];

                        if (span instanceof Element) {
                            d3.select(span)
                            .classed("highlighted", true);

                            let space = d3.select(span).node().nextSibling;

                            if (!space) {
                                space = span.parentNode.nextSibling?.firstChild;
                            }
        
                            if (space && space.classList.contains("space") && i !== setUpAnnotatedTokens[index[0]].spans.length - 1) {
                                d3.select(space)
                                .classed("highlighted", true);
                            }
                        }
                    }
                }
                // console.log("Cut Index", cutIndex);

                for (let index of cutIndex) {
                    setUpAnnotatedTokens.splice(index[1], 1);
                }
                // setUpAnnotatedTokens = setUpAnnotatedTokens.filter(annotation => annotation.spans.filter(r => r instanceof Element).length !== 0);

                for (let i = 0; i < setUpAnnotatedTokens.length; i++) {
                    let annotation = setUpAnnotatedTokens[i];
                    
                    if (annotation.spans.filter(r => r instanceof Element).length === 0) {
                        setUpAnnotatedTokens.splice(i, 1);
                        i--;
                    }
                }

                if (onDetect instanceof Function) {
                    onDetect([...setUpAnnotatedTokens]);
                }
                console.log("Finished annotating", setUpAnnotatedTokens);

                for (let token of setUpAnnotatedTokens) {
                    if (token.explanation[0] === "Generating explanation...") {
                        token.explanation[0] = "";
                    }
                }

                if (onEnd instanceof Function) {
                    onEnd(rawAnnotationOutput.current[index].output);
                }
                console.log(annotatedTokens.current);
                // console.log(rawAnnotationOutput.current[index].output);
            }
        }

        if (typeof mode === "string" && mode.toLowerCase().includes("practice")) {
            await new Promise(r => setTimeout(r, 2000));
            let message = "";
            let testData = `*** Suspendisse quis lorem sed est blandit sodales. ***
            {{ Test Explanation }}
            
            *** Sed sit amet rutrum metus. Integer in erat tellus. ***
            {{ Test Explanation }}

            *** Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. ***
            {{ Test Explanation }}

            *** Cras auctor faucibus lectus, a semper enim. Phasellus pellentesque tellus ut neque maximus dictum. ***
            {{ Test Explanation }}

            *** Duis molestie velit in auctor interdum. ***
            {{ Test Explanation }}
            `;

            for (let token of testData.split(" ")) {
                // console.log(token);
                // await new Promise(r => setTimeout(r, 30));
                token = " " + token;
                message += token;

                handleToken(token);
            }
            handleEnd();
        } else {
            let p = `${annotationDescription}${annotationDescription.trim().endsWith(".") ? "" : "."} "${purposeTitle}"`;

            if (purpose.trim() !== "") {
                p += `: "${purpose}"`;
            }
            findAnnotations(p, handleToken, handleEnd);
        }
    }
    
    function findMostSimilarSubstring() {
        onmessage = function(e) {
            let text = e.data.text;
            let target = e.data.target;
            let sameLength = e.data.sameLength;
            let index = e.data.index;
            let minDistance = Infinity;
            let mostSimilar = "";
            
            let workerLevenshteinDistance = () => {
                // https://github.com/ka-weihe/fastest-levenshtein
                onmessage = function(e) {
                    const a = e.data.a;
                    const b = e.data.b;
                    const peq = new Uint32Array(0x10000);

                    const myers_32 = (a, b) => {
                        const n = a.length;
                        const m = b.length;
                        const lst = 1 << (n - 1);
                        let pv = -1;
                        let mv = 0;
                        let sc = n;
                        let i = n;
                        while (i--) {
                            peq[a.charCodeAt(i)] |= 1 << i;
                        }
                        for (i = 0; i < m; i++) {
                            let eq = peq[b.charCodeAt(i)];
                            const xv = eq | mv;
                            eq |= ((eq & pv) + pv) ^ pv;
                            mv |= ~(eq | pv);
                            pv &= eq;
                            if (mv & lst) {
                                sc++;
                            }
                            if (pv & lst) {
                                sc--;
                            }
                            mv = (mv << 1) | 1;
                            pv = (pv << 1) | ~(xv | mv);
                            mv &= xv;
                        }
                        i = n;
                        while (i--) {
                            peq[a.charCodeAt(i)] = 0;
                        }
                        return sc;
                    };

                    const myers_x = (b, a) => {
                        const n = a.length;
                        const m = b.length;
                        const mhc = [];
                        const phc = [];
                        const hsize = Math.ceil(n / 32);
                        const vsize = Math.ceil(m / 32);
                        for (let i = 0; i < hsize; i++) {
                            phc[i] = -1;
                            mhc[i] = 0;
                        }
                        let j = 0;
                        for (; j < vsize - 1; j++) {
                            let mv = 0;
                            let pv = -1;
                            const start = j * 32;
                            const vlen = Math.min(32, m) + start;
                            for (let k = start; k < vlen; k++) {
                                peq[b.charCodeAt(k)] |= 1 << k;
                            }
                            for (let i = 0; i < n; i++) {
                                const eq = peq[a.charCodeAt(i)];
                                const pb = (phc[(i / 32) | 0] >>> i) & 1;
                                const mb = (mhc[(i / 32) | 0] >>> i) & 1;
                                const xv = eq | mv;
                                const xh = ((((eq | mb) & pv) + pv) ^ pv) | eq | mb;
                                let ph = mv | ~(xh | pv);
                                let mh = pv & xh;
                                if ((ph >>> 31) ^ pb) {
                                    phc[(i / 32) | 0] ^= 1 << i;
                                }
                                if ((mh >>> 31) ^ mb) {
                                    mhc[(i / 32) | 0] ^= 1 << i;
                                }
                                ph = (ph << 1) | pb;
                                mh = (mh << 1) | mb;
                                pv = mh | ~(xv | ph);
                                mv = ph & xv;
                            }
                            for (let k = start; k < vlen; k++) {
                                peq[b.charCodeAt(k)] = 0;
                            }
                        }
                        let mv = 0;
                        let pv = -1;
                        const start = j * 32;
                        const vlen = Math.min(32, m - start) + start;
                        for (let k = start; k < vlen; k++) {
                            peq[b.charCodeAt(k)] |= 1 << k;
                        }
                        let score = m;
                        for (let i = 0; i < n; i++) {
                            const eq = peq[a.charCodeAt(i)];
                            const pb = (phc[(i / 32) | 0] >>> i) & 1;
                            const mb = (mhc[(i / 32) | 0] >>> i) & 1;
                            const xv = eq | mv;
                            const xh = ((((eq | mb) & pv) + pv) ^ pv) | eq | mb;
                            let ph = mv | ~(xh | pv);
                            let mh = pv & xh;
                            score += (ph >>> (m - 1)) & 1;
                            score -= (mh >>> (m - 1)) & 1;
                            if ((ph >>> 31) ^ pb) {
                                phc[(i / 32) | 0] ^= 1 << i;
                            }
                            if ((mh >>> 31) ^ mb) {
                                mhc[(i / 32) | 0] ^= 1 << i;
                            }
                            ph = (ph << 1) | pb;
                            mh = (mh << 1) | mb;
                            pv = mh | ~(xv | ph);
                            mv = ph & xv;
                        }
                        for (let k = start; k < vlen; k++) {
                            peq[b.charCodeAt(k)] = 0;
                        }
                        return score;
                    };

                    const distance = (a, b) => {
                        if (a.length < b.length) {
                            const tmp = b;
                            b = a;
                            a = tmp;
                        }
                        if (b.length === 0) {
                            return a.length;
                        }
                        if (a.length <= 32) {
                            return myers_32(a, b);
                        }
                        return myers_x(a, b);
                    };

                    postMessage({distance: distance(a, b), a, b});
                };
            };
            let done = 0;
            let executed = 0;
            let worker = new Worker(URL.createObjectURL(new Blob([`(${workerLevenshteinDistance})()`])));
            
            worker.onmessage = (e) => {
                const distance = e.data.distance;
                const substring = e.data.a;
                // const target = e.data.b;
                
                if (distance < minDistance) {
                    minDistance = distance;
                    mostSimilar = substring;
                }
                done++;

                if (!sameLength && done === executed) {
                    worker.terminate();
                    postMessage([mostSimilar, minDistance, index, sameLength]);
                } else if (sameLength && done === executed) {
                    worker.terminate();
                    postMessage([mostSimilar, minDistance, index, sameLength]);
                }
            };

            if (text.length < target.length) {
                worker.terminate();
                postMessage(null);
            }

            if (sameLength) {
                for (let i = 0; i <= text.length - target.length; i++) {
                    let substring = text.substring(i, i + target.length);
                    
                    if ((i !== 0 && text[i - 1] !== " ") || substring[0] === " ") {
                        continue;
                    }
                    executed++;
                    worker.postMessage({ a: substring, b: target });
                }
            } else {
                for (let length = target.length; length <= text.length; length++) {
                    for (let i = 0; i <= text.length - length; i++) {
                        const substring = text.substring(i, i + length);
                        
                        if ((i !== 0 && text[i - 1] !== " ") || substring[0] === " ") {
                            continue;
                        }
                        executed++;
                        worker.postMessage({ a: substring, b: target });
                    }
                }
            }
        };
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
                    for (let i = 0; i < listOfSpans.length; i++) {
                        let span = listOfSpans[i];
    
                        d3.select(span)
                        .classed("highlighted", true);
    
                        let space = d3.select(span).node().nextSibling;

                        if (!space) {
                            space = span.parentNode.nextSibling?.firstChild;
                        }
    
                        if (space && space.classList.contains("space") && i !== listOfSpans.length - 1) {
                            d3.select(space)
                            .classed("highlighted", true);
                        }
                    }
                    
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
                getClosestSubstring();
            }
        };

        function getClosestSubstring() {
            // console.log("Running getClosestSubstring...");
            let minDistance = Infinity;
            let done = 0;
            let executed = 0;
            let pageNumber = 0;
            let substring = "";
            let ifSinglePage = true;

            let worker = new Worker(URL.createObjectURL(new Blob([`(${findMostSimilarSubstring})()`])));

            for (let i = 0; i < textContent.current.length - 1; i++) {
                if (textContent.current[i].length === 0 || textContent.current[i + 1].length === 0) {
                    continue;
                }
                let currPage = textContent.current[i].map((span) => span.textContent).join(" ").toLowerCase();
                let currPageSlice = currPage.slice(-text.length);
                let nextPage = textContent.current[i + 1].map((span) => span.textContent).join(" ").toLowerCase();
                let nextPageSlice = nextPage.slice(0, text.length);
                let fullPage = currPageSlice + " " + nextPageSlice;
                // console.log(fullPage);
                fullPage = fullPage.replace(/[^a-zA-Z0-9\s]/g, "");

                executed++;
                worker.postMessage({ text: fullPage, target: text.toLowerCase(), sameLength: false, index: i });
            }
            
            for (let i = 0; i < textContent.current.length; i++) {
                let pageText = textContent.current[i].map((span) => span.textContent).join(" ").toLowerCase().replace(/[^a-zA-Z0-9\s]/g, "");

                if (pageText === "") {
                    continue;
                }
                pageText = pageText.replace(/\s+/g, " ");

                executed++;
                worker.postMessage({ text: pageText, target: text.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, ""), sameLength: true, index: i });
            }

            worker.onmessage = (e) => {
                let result = e.data;
                done++;

                if (result !== null) {
                    let distance = result[1];

                    if (distance < minDistance) {
                        minDistance = distance;
                        substring = result[0];
                        pageNumber = result[2];
                        ifSinglePage = result[3];

                    }
                }

                if (done === executed) {
                    worker.terminate();
                    console.log(text, minDistance, substring);

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
                                console.log("Not found: " + text);
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

                        for (let span of listOfSpans) {
                            d3.select(span)
                            .classed("highlighted", true);
        
                            let space = d3.select(span).node().nextSibling;

                            if (!space) {
                                space = span.parentNode.nextSibling?.firstChild;
                            }
        
                            if (space && (space.classList.contains("space")) && span !== listOfSpans[listOfSpans.length - 1]) {
                                d3.select(space)
                                .classed("highlighted", true);
                            }
                        }
                        
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
                        
                        for (let span of highLightSpans) {
                            d3.select(span)
                            .classed("highlighted", true);
    
                            let space = d3.select(span).node().nextSibling;

                            if (!space) {
                                space = span.parentNode.nextSibling?.firstChild;
                            }
    
                            if (space && space.classList.contains("space")) {
                                d3.select(space)
                                .classed("highlighted", true);
                            }
                        }
                        
                        if (callback instanceof Function) {
                            callback(highLightSpans);
                        }
                    }
                }
            };
        }
    }

    function onChange(colour, event) {
        setColour(colour.hex);
    }

    function onToolChange(tool) {
        setTool(tool);
    }

    function onNewActiveCluster(cluster) {
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
                        <NavigateCluster cluster={cluster} annotations={cluster.annotationsFound} currentAnnotation={clusterToolTip} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={undefined} />
                    </div>;
                    // explanationToolTipRef.current?.close();
                    fadeDisplayExplanation(content, annotation, false);
                } else {
                    let content = generateContent(annotation, annotations);
    
                    fadeDisplayExplanation(content, annotation);
                }
                activeAnnotation.current = annotation;

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
                        <NavigateCluster cluster={cluster} annotations={cluster.annotationsFound} currentAnnotation={clusterToolTip} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={undefined} />
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
                        <NavigateCluster cluster={cluster} annotations={cluster.annotationsFound} currentAnnotation={clusterToolTip} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={undefined} />
                    </div>;
                    // explanationToolTipRef.current?.close();
                    fadeDisplayExplanation(content, annotation, false);
                } else {
                    cluster.open = false;
                    ref?.current.updateLockCluster([...ref?.current.lockClusters.current]);
                    let content = generateContent(annotation, annotations);

                    fadeDisplayExplanation(content, annotation);
                }
                activeAnnotation.current = annotation;

                if (navigateCallback instanceof Function) {
                    navigateCallback(annotation);
                }
            };

            let showTooltipContent = () => {
                if (clusterToolTip){
                    let content = <div className={"annotationMessageContainer " + googleSans.className}>
                        <NavigateCluster cluster={cluster} annotations={cluster.annotationsFound} currentAnnotation={activeAnnotation.current} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={undefined} />
                    </div>;

                    let closestTextLayer = d3.select(".textLayer").node();

                    d3.select(".explanation-tooltip")
                    .style("top", clusterToolTip.getBoundingClientRect().top + clusterToolTip.getBoundingClientRect().height / 2 - containerRef.current.getBoundingClientRect().top + "px")
                    .style("left", closestTextLayer.getBoundingClientRect().left - 10 + "px");

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
                    } else if (explanationToolTipRef.current?.isOpen) {
                        let annotations = annotatedTokens.current.find(groupAnnotations => groupAnnotations.annotations.find(annotated => annotated === activeAnnotation.current));
                        let content = generateContent(activeAnnotation.current, annotations);

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
        .classed("fade", false);
        
        hoverAnnotation.current = null;
        activeAnnotation.current = null;

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
    }

    function penEndCallback(param) {
        // explanationToolTipRef.current?.close();
        // hoverAnnotation.current = null;
        if (pEndCallback instanceof Function) {
            pEndCallback(param);
        }
    }

    function eraseStartCallback() {
        resetToolTips();
    }

    function eraseEndCallback() {
        // explanationToolTipRef.current?.close();
        // hoverAnnotation.current = null;
    }

    function onInference(startTimetamp, cluster, rawText, images) {
        if (onInferenceCallback instanceof Function) {
            onInferenceCallback(startTimetamp, cluster, rawText, images);
        }
    }

    function endAnnotateCallback(startTimetamp, cluster, rawText) {
        if (onEndAnnotateCallback instanceof Function) {
            onEndAnnotateCallback(startTimetamp, cluster, rawText);
        }
    }

    let generateContent = useCallback((annotation, annotations) => {
        function acceptAnnotation(e, a, j) {
            a.accepted = true;
            let target = e.target;
            let rateContainer = target.closest(".rateContainer");
            let newContent = generateContent(annotation, annotations);
    
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
    
            for (let span of a.spans) {
                d3.select(span)
                .classed("highlighted", true)
                .classed("accept", true);
    
                let space = d3.select(span).node().nextSibling;
    
                if (!space) {
                    space = span.parentNode.nextSibling?.firstChild;
                }
        
                if (space && space.classList.contains("space")) {
                    d3.select(space)
                    .classed("highlighted", true)
                    .classed("accept", true);
                }
            }
    
            let cluster = annotations.ref?.current.lockClusters.current.find(cluster => cluster.annotationsFound.includes(a));
                    
            if (cluster) {
                if (onReplyCallback instanceof Function) {
                    onReplyCallback(cluster, "accept " + j);
                }
            }
        }
    
        function rejectAnnotation(e, a, j, overlappingAnnotations) {
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
    
            loop1: for (let span of a.spans) {
                for (let overlappingAnnotation of overlappingAnnotations) {
                    if (overlappingAnnotation.annotation !== a) {
                        for (let overlappingSpan of overlappingAnnotation.annotation.spans) {
                            if (span === overlappingSpan) {
                                continue loop1;
                            }
                        }
                    }
                }
    
                d3.select(span)
                .classed("highlighted", false);
    
                let space = d3.select(span).node().nextSibling;
    
                if (!space) {
                    space = span.parentNode.nextSibling?.firstChild;
                }
    
                if (space && space.classList.contains("space")) {
                    d3.select(space)
                    .classed("highlighted", false);
                }
            }
    
            for (let i = 0; i < annotations.annotations.length; i++) {
                if (annotations.annotations[i] === a) {
                    annotations.annotations.splice(i, 1);
                    break;
                }
            }
            let cluster = annotations.ref?.current.lockClusters.current.find(cluster => cluster.annotationsFound.includes(a));
    
            if (overlappingAnnotations.length === 1) {
                let height = d3.select(".react-tooltip#annotationExplanation .annotationMessageContainer").node().getBoundingClientRect().height;
            
                let newContent = <div className={"annotationMessageContainer " + googleSans.className} style={{ height: height + "px", pointerEvents: "none" }}>
                    <NavigateCluster cluster={cluster} annotations={cluster.annotationsFound} currentAnnotation={annotation} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={true} />
                </div>;

                d3.selectAll(".react-tooltip#annotationExplanation .annotationMessageContainer")
                .selectAll("div:not(.navigateContainer), textarea")
                .transition()
                .duration(200)
                .style("opacity", 0)
                .style("pointer-events", "none");

                d3.selectAll(".word.highlighted, .space.highlighted")
                .classed("fade", false);

                d3.selectAll(".react-tooltip#annotationExplanation .annotationMessageContainer textarea")
                .node()
                .blur();

                d3.select(".react-tooltip#annotationExplanation")
                .transition()
                .duration(200)
                .style("background", "rgba(34, 38, 43, 0)")
                .style("pointer-events", "none")
                .on("end", () => {
                    explanationToolTipRef.current?.open({
                        anchorSelect: ".explanation-tooltip",
                        content: newContent,
                        place: "left",
                    });
                });
            } else {
                let content = generateContent(annotation, annotations);

                explanationToolTipRef.current?.open({
                    anchorSelect: ".explanation-tooltip",
                    content: content,
                    place: "left",
                });
            }
            // console.log(annotations.ref?.current.lockClusters.current);
    
            annotations.ref?.current.updateLockCluster([...annotations.ref?.current.lockClusters.current]);
                    
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
                        
                        let cluster = overlappingAnnotation.groupAnnotation.ref?.current.lockClusters.current.find(cluster => cluster.annotationsFound.includes(a));
                        
                        if (cluster) {
                            if (onReplyCallback instanceof Function) {
                                onReplyCallback(cluster, "comment " + overlappingAnnotation.index);
                            }
                        }
                    }
                    e.target.value = "";
                    
                    let content = generateContent(annotation, annotations);
    
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

                        toast.error("storeCommentHistory: " + error.toString().replace("Error: ", ""), {
                            toastId: "storeCommentHistory",
                            containerId: "errorMessage"
                        });
                    });
                }
            }
        }
        let annotationMessages = [];

        let overlappingAnnotations = [{groupIndex: annotatedTokens.current.findIndex(group => group === annotations), index: annotations.annotations.findIndex(a => a === annotation), annotation: annotation, groupAnnotation: annotations}];
        // console.log(overlappingAnnotations[0]);
        // console.log(hoverGroupAnnotationRef.current);
        for (let i = 0; i < annotatedTokens.current.length; i++) {
            let searchAnnotations = annotatedTokens.current[i];
            
            if (hoverGroupAnnotationRef.current !== searchAnnotations) {
                loop: for (let j = 0; j < searchAnnotations.annotations.length; j++) {
                    let searchAnnotation = searchAnnotations.annotations[j];

                    if (searchAnnotation.accepted !== false) {
                        if (annotation.spans instanceof Array && searchAnnotation.spans instanceof Array && searchAnnotation.spans.every((searchSpan) => annotation.spans.includes(searchSpan)) &&
                            !overlappingAnnotations.find(a => a.groupIndex === i && a.index === j)
                        ) {
                            overlappingAnnotations.push({groupIndex: i, index: j, annotation: searchAnnotation, groupAnnotation: searchAnnotations});
                            break loop;
                        }
                    }
                }
            }
        }

        // console.log(overlappingAnnotations)

        for (let overlappingAnnotation of overlappingAnnotations) {
            let a = overlappingAnnotation.annotation;

            if (a.accepted !== false) {
                let message = a.explanation && a.explanation[0].trim() !== "" ? a.explanation[0] : `${a.annotationDescription}${a.annotationDescription.endsWith(".") ? "" : "."} ${a.purpose}`;

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
                                                <FaThumbsUp size={20} style={{ color: "#2eb086", strokeWidth: "1", marginBottom: "5px" }} onClick={(e) => acceptAnnotation(e, a, overlappingAnnotation.index, annotation, annotations) } />
                                            </div>
                                            <div className="rateButton" >
                                                <FaThumbsDown size={20} style={{ color: "#b8405e", strokeWidth: "1", marginTop: "5px" }} onClick={(e) => rejectAnnotation(e, a, overlappingAnnotation.index, overlappingAnnotations, annotation, annotations)} />
                                            </div>
                                        </div>
                                        : null
                                    }
                                </div>
                            </div>
                        </div>
                        {message}
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
        let cluster = annotations.ref?.current.lockClusters.current.find(cluster => cluster.annotationsFound?.includes(annotation));
        let activeAnnotationsFound = cluster.annotationsFound ? [...cluster.annotationsFound] : [];

        let onNavigateCallback = (annotation) => {
            if (annotation.spans[0] instanceof Element && annotation.spans[0].classList.contains("toolTip")) {
                cluster.open = true;
                annotations.ref?.current.updateLockCluster([...annotations.ref?.current.lockClusters.current]);
                let activeAnnotationsFound = cluster.annotationsFound ? [...cluster.annotationsFound] : [];

                let content = <div className={"annotationMessageContainer " + googleSans.className}>
                    <NavigateCluster cluster={cluster} annotations={activeAnnotationsFound} currentAnnotation={annotation} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={false} />
                </div>;
                // explanationToolTipRef.current?.close();
                fadeDisplayExplanation(content, annotation, false);
            } else {
                cluster.open = false;
                annotations.ref?.current.updateLockCluster([...annotations.ref?.current.lockClusters.current]);
                
                let content = generateContent(annotation, annotations);

                fadeDisplayExplanation(content, annotation);
            }
            activeAnnotation.current = annotation;

            if (navigateCallback instanceof Function) {
                navigateCallback(annotation);
            }
        };

        let content = 
        <div className={"annotationMessageContainer " + googleSans.className}>
            { annotationMessages }
            { annotation.explanation[0] !== "Generating explanation..." ? <textarea className={googleSans.className} onInput={auto_grow} onKeyDown={(e) => onKeyDown(e, overlappingAnnotations, annotation)} placeholder="Reply" /> : null }
            
            <NavigateCluster cluster={cluster} annotations={activeAnnotationsFound} currentAnnotation={annotation} onPrevCallback={onNavigateCallback} onNextCallback={onNavigateCallback} removed={undefined}/>
        </div>;

        return content;
    }, [navigateCallback, onReplyCallback]);
    
    function fadeDisplayExplanation(content, annotation, overrideDisplay = true) {
        let closestTextLayer = d3.select(".textLayer").node();

        let highlighAnnotation = annotation.spans.filter(span => span instanceof Element && !span.classList.contains("toolTip"));

        if (highlighAnnotation.length === 0) {
            d3.selectAll(".word.highlighted, .space.highlighted")
            .classed("fade", false);
        } else {
            d3.selectAll(".word.highlighted, .space.highlighted")
            .classed("fade", true);
        }

        for (let i = 0; i < highlighAnnotation.length; i++) {
            let span = highlighAnnotation[i];

            d3.select(span)
            .classed("fade", false);

            let space = d3.select(span).node().nextSibling;

            if (!space) {
                space = span.parentNode.nextSibling?.firstChild;
            }

            if (space && space.classList.contains("space") && i !== highlighAnnotation.length - 1) {
                d3.select(space)
                .classed("highlighted", true)
                .classed("fade", false);
            }
        }

        if (!explanationToolTipRef.current?.isOpen) {
            d3.select(".explanation-tooltip")
            .style("top", d3.mean(annotation.spans.filter(span => span).map(span => span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2)) - containerRef.current.getBoundingClientRect().top + "px")
            .style("left", closestTextLayer.getBoundingClientRect().left - 10 + "px");

            explanationToolTipRef.current?.open({
                anchorSelect: ".explanation-tooltip",
                content: content,
                place: "left",
            });
            
            setTimeout(() => {
                d3.select(".react-tooltip#annotationExplanation")
                .style("background", overrideDisplay ? "rgba(34, 38, 43, 1)" : "rgba(34, 38, 43, 0)");
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
                    .style("left", closestTextLayer.getBoundingClientRect().left - 10 + "px");
                    
                    setTimeout(() => {
                        d3.select(".react-tooltip#annotationExplanation")
                        .style("background", overrideDisplay ? "rgba(34, 38, 43, 1)" : "rgba(34, 38, 43, 0)");
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

    const explainTooltipTimeout = useRef(null);
    const highlightTimeout = useRef(null);
    const hoverAnnotation = useRef(null);
    const hoverGroupAnnotationRef = useRef(null);
    const activeAnnotation = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        d3.select("body")
        .on("pointermove", (e) => {
            let [x, y] = [e.clientX, e.clientY];
            let annotations, annotation;
            let i, j;
            let found = false, hoverFound = false;

            loop1: for (i = 0; i < annotatedTokens.current.length; i++) {
                annotations = annotatedTokens.current[i];

                for (j = 0; j < annotations.annotations.length; j++) {
                    annotation = annotations.annotations[j];

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
                                        !hoverAnnotation.current?.spans?.every(s => annotation.spans.includes(s)) && !activeAnnotation.current?.spans?.every(s => annotation.spans.includes(s))
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

                // d3.selectAll(".word.highlighted, .space.highlighted")
                // .classed("fade", false);
            }

            if (found) {
                highlightTimeout.current = setTimeout(() => {
                    d3.selectAll(".word.highlighted, .space.highlighted")
                    .classed("fade", true);

                    for (let i = 0; i < annotation.spans.length; i++) {
                        let span = annotation.spans[i];

                        d3.select(span)
                        .classed("fade", false);

                        let space = d3.select(span).node().nextSibling;

                        if (!space) {
                            space = span.parentNode.nextSibling?.firstChild;
                        }
    
                        if (space && space.classList.contains("space") && i !== annotation.spans.length - 1) {
                            d3.select(space)
                            .classed("highlighted", true)
                            .classed("fade", false);
                        }
                    }
                }, 1000);

                let content = generateContent(annotation, annotations);
                
                explainTooltipTimeout.current = setTimeout(() => {
                    fadeDisplayExplanation(content, annotation);
                    activeAnnotation.current = annotation;

                    let cluster = annotations.ref?.current.lockClusters.current.find(cluster => cluster.annotationsFound.includes(annotation));
                    cluster.open = false;
                    annotations.ref?.current.updateLockCluster([...annotations.ref?.current.lockClusters.current]);

                    if (navigateCallback instanceof Function) {
                        navigateCallback(annotation);
                    }
                }, 500);
            }
            // explanationToolTipRef.current?.close();
        });

        return () => {
            d3.select("body")
            .on("pointermove", null);
        };
    }, [onReplyCallback, generateContent, navigateCallback]);

    let prevDocumentPDF = useRef(null);
    let loadBuffer = useRef(false);

    useEffect(() => {
        setLoading(true);
        setProgress(0);

        if (typeof modeRef.current === "string" && modeRef.current.toLowerCase().includes("practice")) {
            setLoadingDocument(false);
            return;
        }
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

                toast.error("documentUpload: " + error.toString().replace("Error: ", ""), {
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

    return (
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
            <Toolbar tool={tool} onToolChange={onToolChange} onColourChange={onChange} defaultColour={defaultColour} />

            <Tooltip 
                // id="annotationDescription"
                style={{ zIndex: "5", padding: "16px", borderRadius: "8px", background: "#22262b" }}
                place={"left"}
                ref={annotationToolTipRef}
                imperativeModeOnly={true}
            />

            <Tooltip 
                id="annotationExplanation"
                style={{ zIndex: "5", padding: "16px", borderRadius: "8px", background: "rgba(34, 38, 43, 1)" }}
                place={"left"}
                ref={explanationToolTipRef}
                imperativeModeOnly={true}
                
                middlewares={[
                    autoPlacement({
                        allowedPlacements: ["left"],
                    }),
                ]}
            />
            { !dismiss ? <Loading progress={loadingDocument ? Math.max(progress - 1, 0) : progress} /> : null}
        </div>
    );
}