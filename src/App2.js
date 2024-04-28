import { useEffect, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import PenAnnotation from './PenAnnotation.js';
import Toolbar from './Toolbar.js';
import NavigateCluster from './NavigateCluster.js';
import * as d3 from 'd3';
import { Comment, MagnifyingGlass } from "react-loader-spinner";
import { findAnnotations } from "./OpenAIUtils.js";
import { pdfjs } from 'react-pdf';
import { Tooltip } from 'react-tooltip';

import 'react-tooltip/dist/react-tooltip.css';
import './css/App.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import Loading from './Loading.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url,
).toString();

export default function App() {
    const defaultColour = "#000000";

    // const [numPages, setNumPages] = useState();
    const [colour, setColour] = useState(defaultColour);
    const [pageContent, setPageContent] = useState([]);
    const [penAnnotation, setPenAnnotation] = useState([]);
    const [tool, setTool] = useState("pen");
    const [activeCluster, setActiveCluster] = useState(null);
    const [getActiveAnnotations, setGetActiveAnnotations] = useState([]);
    const [loading, setLoading] = useState(true);

    const svgContent = useRef([]);
    const annotationToolTipRef = useRef(null);
    
    const textContent = useRef([]);
    const annotatedTokens = useRef([]);
    const rawAnnotationOutput = useRef([]);
    const toolTipRef = useRef("pen");
    const colourRef = useRef(defaultColour);
    const activeClusterRef = useRef(null);

    function onDocumentLoadSuccess(pdf) {
        let numPages = pdf.numPages;
        // numPages = 8;
        // setNumPages(numPages);
        svgContent.current = Array(numPages).fill(null);
        textContent.current = Array(numPages).fill(null);

        let pageContent = Array.from(new Array(numPages), (el, index) =>
            <div className="page-container" key={`pageContainer_${index + 1}`} style={{ position: "relative" }}>
                <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    width={window.innerWidth - 450 * 2}
                    onRenderTextLayerSuccess={() => onLoad(index + 1)}
                    className={`page-${index + 1}`}
                >
                </Page>
                { index !== numPages - 1 ? <hr style={{ width: "100%" }} /> : null }
            </div>
        );

        let penAnnotation = Array.from(new Array(numPages), (el, index) =>
            <PenAnnotation index={index + 1} tool={toolTipRef} colour={colourRef} key={`annotation_${index + 1}`} content={svgContent.current[index + 1]} toolTipRef={annotationToolTipRef} setUpAnnotations={setUpAnnotations} onNewActiveCluster={onNewActiveCluster} onClusterChange={onClusterChange} onErase={onErase} />
        );
        setPageContent(pageContent);
        setPenAnnotation(penAnnotation);
    }

    function onLoad(index) {
        let spanPresentation = d3.select(".react-pdf__Page.page-" + index)
        .select(".textLayer")
        .selectAll("span[role='presentation']")
        .nodes();

        let text = d3.select(".react-pdf__Page.page-" + index)
        .selectAll("span[role='presentation']")
        .nodes();

        let height = d3.select(".page-container").node().getBoundingClientRect().height;

        document.querySelector('.pen-annotation-container').style.setProperty('--annotation-height', height + "px");
        document.querySelector('.screenshot-container').style.setProperty('--annotation-height', height + "px");

        spanPresentation.forEach((span) => {
            let text = span.textContent;
            let leadingSpaces = text.match(/^ */)[0].length;
            let trailingSpaces = text.match(/ *$/)[0].length;
            let words = text.split(" ").filter((word) => word !== "");
            d3.select(span).text("");

            for (let i = 0; i < leadingSpaces; i++) {
                d3.select(span).append("span").text(" ").attr("class", "space").style("user-select", "none");
            }

            words.forEach((word, i) => {
                let characters = word.split("");

                let wordSpan = d3.select(span)
                .append("span")
                .style("position", "relative")
                .style("left", "0px")
                .style("top", "0px")
                .attr("class", "word");

                characters.forEach((character, j) => {
                    wordSpan.append("span")
                    .text(character)
                    .style("position", "relative")
                    .style("left", "0px")
                    .style("top", "0px")
                    .attr("class", "character");
                });

                if (i !== words.length - 1) {
                    d3.select(span).append("span").text(" ").attr("class", "space").style("position", "relative").style("user-select", "none");
                }
            });

            if (words.length !== 0) {
                for (let i = 0; i < trailingSpaces; i++) {
                    d3.select(span).append("span").text(" ").attr("class", "space").style("user-select", "none");
                }
            }
        });


        textContent.current[index - 1] = text;
        
        if (textContent.current.every((text) => text !== null)) {
            d3.select("#loader-container")
            .transition()
            .delay(500)
            .duration(1000)
            .style("opacity", 0)
            .on("end", () => {
                setLoading(false);
            });
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
        }
    }

    function setUpAnnotations(purpose, onDetect, onEnd) {
        rawAnnotationOutput.current.push({ output: "" });
        let index = rawAnnotationOutput.current.length - 1;
        let setUpAnnotatedTokens = [];
        let done = 0;
        let finish = false;

        function handleToken(token) {
            rawAnnotationOutput.current[index].output += token;

            if (token.trim() === `"""` || token.trim().startsWith(`"""`) || token.trim().endsWith(`"""`)){
                let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken?.state === "start") {
                    lastToken.state = "end";
                    // console.log(lastToken.sentence.trim());

                    let callback = (result) => {
                        done++;
                        // console.log(result);
                        // console.log("Done", done, setUpAnnotatedTokens.length, finish);

                        if (result instanceof Array) {
                            lastToken.spans = result;

                            if (onDetect instanceof Function) {
                                onDetect(lastToken);
                            }
                        } else {
                            console.log(result);
                        }

                        if (done === setUpAnnotatedTokens.length && finish) {
                            console.log("Finished annotating", setUpAnnotatedTokens);
                            if (onEnd instanceof Function) {
                                onEnd();
                            }
                        }
                    };

                    // console.log("Last Sentence")
                    // console.log(lastToken.sentence.trim().replace(/[^a-zA-Z0-9\s]/g, ""));

                    for (let i = 0; i < setUpAnnotatedTokens.length - 1; i++) {
                        let sentence = setUpAnnotatedTokens[i].sentence.trim().replace(/[^a-zA-Z0-9\s]/g, "");

                        // console.log("Sentence", sentence.includes(lastToken.sentence.trim().replace(/[^a-zA-Z0-9\s]/g, "")))
                        // console.log(sentence)
                        
                        // Cut any overlapping sentences
                        if (sentence.includes(lastToken.sentence.trim().replace(/[^a-zA-Z0-9\s]/g, ""))) {
                            setUpAnnotatedTokens.splice(setUpAnnotatedTokens.length - 1, 1);
                            return;
                        } else if (lastToken.sentence.trim().replace(/[^a-zA-Z0-9\s]/g, "").includes(sentence)) {
                            lastToken.sentence = lastToken.sentence.replace(/[^a-zA-Z0-9\s]/g, "").replace(sentence, "").trim();
                        }
                    }
                    annotate(lastToken.sentence.trim(), callback);
                } else {
                    setUpAnnotatedTokens.push({ sentence: "", state: "start" });
                }
            } else {
                let lastToken = setUpAnnotatedTokens[setUpAnnotatedTokens.length - 1];

                if (lastToken?.state === "start") {
                    lastToken.sentence += token;
                }
            }
        }

        function handleEnd() {
            if (done === setUpAnnotatedTokens.length) {
                console.log("Finished annotating", setUpAnnotatedTokens);
                if (onEnd instanceof Function) {
                    onEnd();
                }
            }
            annotatedTokens.current.push(setUpAnnotatedTokens);

            console.log(annotatedTokens.current);
            console.log(rawAnnotationOutput.current[index].output);
            finish = true;
        }

        findAnnotations(purpose, handleToken, handleEnd);
    }
    
    function findMostSimilarSubstring() {
        onmessage = function(e) {
            let text = e.data.text;
            let target = e.data.target;
            let sameLength = e.data.sameLength;
            let index = e.data.index;
            let minDistance = Infinity;
            let mostSimilar = '';
            
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
        let sentences = text.split(".").filter((sentence) => sentence.trim().replace(/[^a-zA-Z0-9]/g, "") !== "");

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
                let wordIndex = 0;

                let wordSpans = textContent.current[i].map((span) => d3.select(span).selectAll(".word").nodes()).flat();

                let word = words[wordIndex].replace(/[^a-zA-Z0-9]/g, "");

                loop1: for (let j = 0; j < wordSpans.length; j++) {
                    let wordSpan = wordSpans[j];
                    let wordText = wordSpan.textContent.toLowerCase();

                    if (wordText.endsWith("-")) {
                        let combineWord = wordText.slice(0, -1) + wordSpans[j + 1].textContent.toLowerCase();
                        // console.log(combineWord, word);

                        if (combineWord.replace(/[^a-zA-Z0-9]/g, "") === word) {
                            listOfSpans.push(wordSpan);
                            listOfSpans.push(wordSpans[j + 1]);
                            wordIndex++;

                            if (wordIndex < words.length) {
                                word = words[wordIndex].replace(/[^a-zA-Z0-9]/g, "");
                            } else {
                                found = true;
                                break;
                            }
                            j++;
                            continue;
                        }
                    }
                    let splitDash = wordText.split("-");

                    for (let split of splitDash) {
                        split = split.replace(/[^a-zA-Z0-9]/g, "");

                        if (split.trim() === "" && listOfSpans.length !== 0) {
                            listOfSpans.push(wordSpan);
                            continue;
                        }
                        // console.log(split, word);

                        if (split === word) {
                            listOfSpans.push(wordSpan);
                            wordIndex++;

                            if (wordIndex < words.length) {
                                word = words[wordIndex].replace(/[^a-zA-Z0-9]/g, "");
                            } else {
                                found = true;
                                break loop1;
                            }
                        } else {
                            if (listOfSpans.length !== 0) {
                                j--;
                            }
                            listOfSpans = [];
                            wordIndex = 0;
                            word = words[wordIndex].replace(/[^a-zA-Z0-9]/g, "");
                        }
                    }
                }
                // console.log(listOfSpans);
                
                if (found) {
                    for (let i = 0; i < listOfSpans.length; i++) {
                        let span = listOfSpans[i];
    
                        d3.select(span)
                        .style("background-color", "rgba(252,232,151,1)");
    
                        let space = d3.select(span).node().nextSibling;

                        if (space === null) {
                            space = span.parentNode.nextSibling?.firstChild;
                        }
    
                        if (space !== null && space.classList.contains("space") && i !== listOfSpans.length - 1) {
                            d3.select(space)
                            .style("background-color", "rgba(252,232,151,1)");
                        }
                    }
                    
                    if (callback instanceof Function) {
                        callback(listOfSpans);
                    }
                } else {
                    if (callback instanceof Function) {
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

                executed++;
                worker.postMessage({ text: fullPage, target: text.toLowerCase(), sameLength: false, index: i });
            }
            
            for (let i = 0; i < textContent.current.length; i++) {
                let pageText = textContent.current[i].map((span) => span.textContent).join(" ").toLowerCase().replace(/[^a-zA-Z0-9\s]/g, "");

                if (pageText === "") {
                    continue;
                }
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
                        let sentences = text.split(".").filter((sentence) => sentence.trim().replace(/[^a-zA-Z0-9]/g, "") !== "");

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
                                break;
                            }
                            word = substringWords[wordIndex].replace(/[^a-zA-Z0-9]/g, "");
                        }
                        // console.log(listOfSpans);

                        for (let span of listOfSpans) {
                            d3.select(span)
                            .style("background-color", "rgba(252,232,151,1)");
        
                            let space = d3.select(span).node().nextSibling;

                            if (space === null) {
                                space = span.parentNode.nextSibling?.firstChild;
                            }
        
                            if (space !== null && (space.classList.contains("space")) && span !== listOfSpans[listOfSpans.length - 1]) {
                                d3.select(space)
                                .style("background-color", "rgba(252,232,151,1)");
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

                            if (textContent === word || (wordIndex === 0 && textContent.includes(word)) || (wordIndex === words.length - 1 && textContent.includes(word))) {
                                wordIndex++;

                                if (!(substring.length !== text.length && !text.toLowerCase().replace(/[^a-zA-Z0-9]/g, "").includes(textContent))) {
                                    highLightSpans.push(span);

                                    if (wordIndex === substringWords.length) {
                                        break;
                                    }
                                }
                            }
                        }
                        
                        for (let span of highLightSpans) {
                            d3.select(span)
                            .style("background-color", "rgba(252,232,151,1)");
    
                            let space = d3.select(span).node().nextSibling;
    
                            if (space !== null && space.classList.contains("space")) {
                                d3.select(space)
                                .style("background-color", "rgba(252,232,151,1)");
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
            activeClusterRef.current = cluster;
            setActiveCluster(cluster);
            setGetActiveAnnotations(cluster.annotationsFound ? [...cluster.annotationsFound] : []);
        } else {
            activeClusterRef.current = null;
            setActiveCluster(null);
            setGetActiveAnnotations([]);
        }
    }

    function onClusterChange(cluster) {
        if (cluster) {
            let activeStrokes = activeClusterRef.current?.strokes.map(stroke => stroke.id);
            let equal = activeStrokes?.every((stroke, i) => stroke === cluster.strokes[i].id);

            if (equal) {
                setGetActiveAnnotations(activeClusterRef.current.annotationsFound ? [...activeClusterRef.current.annotationsFound] : []);
                setActiveCluster(cluster);
            }
        }
    }

    function onErase(cluster) {
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

    // useEffect(() => {
    //     function onScroll() {
    //         if (lastCluster !== null) {
    //             let lastStroke = lastCluster.strokes[lastCluster.strokes.length - 1];
    //             let lastStrokeID = lastStroke.id;

    //             if (!d3.select(`path[id="${lastStrokeID}"]`).empty()) {
    //                 let lastStrokeBbox = d3.select(`path[id="${lastStrokeID}"]`).node().getBoundingClientRect();
    //                 let right = d3.select(".react-pdf__Page__canvas")
    //                 .node()
    //                 .getBoundingClientRect().right;

    //                 d3.select("#toolTipcanvas")
    //                 .select("rect")
    //                 .attr("x", right + 12)
    //                 .attr("y", (lastStrokeBbox.y + (lastStrokeBbox.height) / 2) - 12);
    //             }
    //         }
    //     }
    //     document.addEventListener("scroll", onScroll);

    //     return () => {
    //         d3.select("#toolTipcanvas")
    //         .select("rect")
    //         .on("pointerover", null)
    //         .on("pointerout", null);

    //         document.removeEventListener("scroll", onScroll);
    //     };
    // }, [lastCluster]);

    return (
        <>
            <Document file="./leu2022a.pdf" onLoadSuccess={onDocumentLoadSuccess}>
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
            
            <NavigateCluster cluster={activeCluster} annotations={getActiveAnnotations} />

            <Tooltip 
                // id="annotationDescription"
                style={{ zIndex: "1000" }}
                place={"left"}
                ref={annotationToolTipRef}
                imperativeModeOnly={true}
            />
            { loading ? <Loading /> : null}
        </>
    );
}