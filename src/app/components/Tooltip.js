import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

// use vite
import { createContext, destroyContext, domToCanvas } from "modern-screenshot";
import { makeInference } from "./js/OpenAIUtils";
import { googleSans } from "../page";
import { toast } from "react-toastify";

function wrap(text, width = -1) {
    if (d3.select(".react-pdf__Page__canvas").empty())
        return;

    if (width === -1) {
        width = window.innerWidth - d3.select(".react-pdf__Page__canvas").node().getBoundingClientRect().right - 12 - 36;
        width = width / 2 - 12;
    }

    text.each(function() {
        let text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1, // ems
            y = text.attr("y"),
            x = text.attr("x"),
            dy = parseFloat(text.attr("dy")) || 0,
            tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");

        while ((word = words.pop())) {
            line.push(word);
            tspan.text(line.join(" "));
            
            if (tspan.node().getComputedTextLength() > width - 10) {
                line.pop();
                tspan.text(line.join(" "));

                if (tspan.text() === "") {
                    tspan.remove();
                    lineNumber--;
                }
                line = [word];
                tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
            }
        }

        d3.select(this)
        .selectAll("tspan")
        .style("pointer-events", "none")
        .attr("y", function() {
            let height = this.getBBox().height;
            return y - lineNumber * height / 3;
        });
    });
}

export default function Tooltip({ mode, clusters, index, handinessRef, onClick, onInference, onNewActiveCluster, onClusterChange, toolTipRef, setUpAnnotations, penAnnnotationRef, onEndAnnotate }) {
    let ref = useRef(null);
    let openTimeout = useRef(null);
    let closeTimeout = useRef(null);
    let clusterRef = useRef(clusters);
    const toolTipSize = 27;

    const sendHistory = useCallback((data) => {
        if (typeof mode === "string" && !mode.toLowerCase().includes("practice")) {
            fetch("/api/storeHistory", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
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
                console.error("updatePurpose:", error);

                toast.error("updatePurpose: " + error.toString().replaceAll("Error: ", ""), {
                    toastId: "updatePurpose",
                    containerId: "errorMessage"
                });
            });
        }
    }, [mode]);

    const inferPurpose = useCallback(async (lastCluster) => {
        // if (typeof mode === "string" && mode.toLowerCase().includes("practice")) {
        //     return new Promise(
        //         resolve => {
        //             setTimeout(() => {
        //                 console.log("Resolving promise...");
                        
        //                 // resolve({
        //                 //     rawText: "Bla bla bla...",
        //                 //     result: JSON.parse(`{
        //                 //         "annotationDescription": "Test",
        //                 //         "pastAnnotationHistory": "Test",
        //                 //         "purpose": [
        //                 //             {
        //                 //                 "persona": "Persona 1",
        //                 //                 "purpose": "Purpose 1",
        //                 //                 "purposeTitle": "Purpose 1"
        //                 //             },
        //                 //             {
        //                 //                 "persona": "Persona 2",
        //                 //                 "purpose": "Purpose 2",
        //                 //                 "purposeTitle": "Purpose 2"
        //                 //             },
        //                 //             {
        //                 //                 "persona": "Persona 3",
        //                 //                 "purpose": "Purpose 3",
        //                 //                 "purposeTitle": "Purpose 3"
        //                 //             },
        //                 //             {
        //                 //                 "persona": "Persona 4",
        //                 //                 "purpose": "Purpose 4",
        //                 //                 "purposeTitle": "Purpose 4"
        //                 //             }
        //                 //         ]
        //                 //     }`),
        //                 //     images: ["test image 1", "test image 2"]
        //                 // });
        //                 resolve({
        //                     rawText: "Bla bla bla...",
        //                     result: JSON.parse(`{
        //                         "annotationDescription": "test",
        //                         "pastAnnotationHistory": "test.",
        //                         "purpose": [
        //                             {
        //                                 "persona": "Literary Critic",
        //                                 "purpose": "You may underline this line to mark a transition point or symbolic imagery pivotal to the poem’s theme. (Results Faked)",
        //                                 "purposeTitle": "Marking Symbolic Imagery (Results Faked)"
        //                             },
        //                             {
        //                                 "persona": "Student",
        //                                 "purpose": "You could underline this line to prepare for an exam where understanding key literary elements or transitions is crucial. (Results Faked)",
        //                                 "purposeTitle": "Highlighting Key Literary Element (Results Faked)"
        //                             },
        //                             {
        //                                 "persona": "Poetry Enthusiast",
        //                                 "purpose": "You underline this line to revisit an emotionally impactful moment that resonates personally within the poem. (Results Faked)",
        //                                 "purposeTitle": "Emphasizing Emotional Impact (Results Faked)"
        //                             },
        //                             {
        //                                 "persona": "Teacher",
        //                                 "purpose": "You underline this line to indicate it should be discussed in class for its metaphorical value and connection. (Results Faked)",
        //                                 "purposeTitle": "Indicating Discussion Point (Results Faked)"
        //                             }
        //                         ]
        //                     }`),
        //                     images: ["test image 1", "test image 2"]
        //                 });
                            
        //             }, 1000);
        //         } 
        //     );
        // }
        let bbox = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
        let annotationBBox = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };

        let reactPdfPage = d3.select(".react-pdf__Page.page-" + index);
        let layerNode = d3.select("#layer-" + index).node();

        let annotationPage = layerNode.cloneNode(true);
        let page = reactPdfPage.node().cloneNode();
        let canvasPage = reactPdfPage.select("canvas").node().cloneNode();
        let annotationPages = d3.select(annotationPage);
        let container = document.createElement("div");

        function renderInSteps(steps, onComplete = () => {}, index = 0) {
            if (index >= steps.length) {
                onComplete();
                return; 
            }

            requestAnimationFrame(() => {
                steps[index]();
                renderInSteps(steps, onComplete, index + 1);
            });
        }

        let renderSteps = [
            () => {
                d3.select(container)
                .attr("class", "screenshot-container")
                .style("position", "absolute")
                .style("top", "0")
                .style("left", "0")
                .style("width", "var(--annotation-width)")
                .style("height", "var(--annotation-height)")
                .style("--annotation-width", d3.select(".pen-annotation-container").style("--annotation-width"))
                .style("--annotation-height", d3.select(".pen-annotation-container").style("--annotation-height"))
                .style("display", "flex")
                .style("justify-content", "center");

                annotationPages
                .style("position", "absolute")
                .style("width", "100%")
                .style("height", "var(--annotation-height)")
                .style("top", "0")
                .style("left", "0")
                .style("overflow", "hidden")
                .selectAll("#toolTipcanvas")
                .remove();
                
                annotationPages
                .select(".pageNumber")
                .style("position", "absolute")
                .style("left", "0")
                .style("right", "0")
                .style("bottom", "24px")
                .style("font-size", "1rem")
                .style("color", "black")
                .style("text-align", "center");

                annotationPages
                .selectAll("path")
                .attr("filter", null)
                .style("fill", "red")
                .attr("class", null)
                .attr("opacity", null);

                page.appendChild(canvasPage);

                const fragment = document.createDocumentFragment();
                fragment.appendChild(page);
                fragment.appendChild(annotationPage);
                container.appendChild(fragment);

                let sourceCanvas = reactPdfPage.select("canvas").node();
                let context = d3.select(container).select("canvas").node().getContext("2d");
                context.drawImage(sourceCanvas, 0, 0);
            },
        ];

        return new Promise((resolve) => {
            renderInSteps(renderSteps, async () => {
                let ids = lastCluster.strokes.map(stroke => stroke.id);

                const createC1 = createContext(container, {
                    workerUrl: "./Worker.js",
                    workerNumber: 1,
                    width: d3.select(".pen-annotation-container").style("--annotation-width").split("px")[0],
                    height: d3.select(".pen-annotation-container").style("--annotation-height").split("px")[0],
                    filter: (node) => {
                        if (node.tagName === "path") {
                            let id = node.id;
                            return ids.includes(id);
                        }
                        return true;
                    }
                });

                const createC2 = createContext(container, {
                    workerUrl: "./Worker.js",
                    workerNumber: 1,
                    width: d3.select(".pen-annotation-container").style("--annotation-width").split("px")[0],
                    height: d3.select(".pen-annotation-container").style("--annotation-height").split("px")[0],
                    filter: (node) => {
                        if (node.tagName && node.tagName.toLowerCase() === "div" && node.classList.contains("react-pdf__Page")) {
                            return false;
                        }

                        if (node.tagName === "path") {
                            let id = node.id;
                            return ids.includes(id);
                        }
                        return true;
                    }
                });
                
                let circle = lastCluster.strokes.find(stroke => stroke.type.startsWith("circled"));
                let underline = lastCluster.strokes.find(stroke => stroke.type.startsWith("underlined"));
                let highlighted = lastCluster.strokes.find(stroke => stroke.type.startsWith("highlighted"));
                let crossed = lastCluster.strokes.find(stroke => stroke.type.startsWith("crossed"));
                let annotated = lastCluster.strokes.find(stroke => stroke.type.startsWith("annotated"));
                let word = lastCluster.strokes.find(stroke => stroke.type.endsWith("words"));
                
                let sortedStrokes = [...lastCluster.strokes].sort((a, b) => {
                    if (a.bbox.y === b.bbox.y) {
                        return a.bbox.x - b.bbox.x;
                    }
                    return a.bbox.y - b.bbox.y;
                });
                // let annotatedText = sortedStrokes.map(stroke => stroke.annotatedText).join("");
                let annotatedText = [];
                let specific = false;
                let type = [];

                let extractText = (type) => {
                    return new Set(sortedStrokes.map(stroke => {
                        if (stroke.annotatedText?.length <= 2 && stroke.annotatedText?.length > 0) {
                            specific = true;
                        }

                        if (word) {
                            if (stroke.type.startsWith(type) && stroke.type.endsWith("words")) {
                                return stroke.annotatedText;
                            } else {
                                return "";
                            }
                        }
                        return stroke.annotatedText;
                    }).flat());
                };

                let sortType = (t, label) => {
                    let annotatedTextNodes = extractText(t);
                    let annotatedTextContent = [...annotatedTextNodes].map(node => typeof node === "string" ? node : node.textContent).join(" ");
                    
                    if (annotatedTextContent.trim() !== "") {
                        type.push(label);
                        annotatedText.push(annotatedTextContent.trim());
                    }
                };

                // let annotatedTextNodes = new Set(sortedStrokes.map(stroke => {
                //     if (word) {
                //         if (stroke.type.endsWith("words")) {
                //             return stroke.annotatedText;
                //         } else {
                //             return "";
                //         }
                //     }
                //     return stroke.annotatedText;
                // }).flat());
                
                // annotatedText = word ? [...annotatedTextNodes].map(node => typeof node === "string" ? node : node.textContent).join(" ") : [...annotatedTextNodes].map(node => typeof node === "string" ? node : node.textContent).join(" ");
                // console.log(annotatedText);

                if (circle) {
                    sortType("circled", "circled");
                } 
                
                if (underline) {
                    sortType("underlined", "underlined");
                } 
                
                if (crossed) {
                    sortType("crossed", "crossed out");
                } 
                
                if (highlighted) {
                    sortType("highlighted", "highlighted");
                }

                if (annotated) {
                    sortType("annotated", "annotated");
                }

                // d3.selectAll("#hightlighed_word").remove();
                let pageTop = (d3.select(".pen-annotation-layer#layer-" + index).node().getBoundingClientRect().top - d3.select(".react-pdf__Page.page-" + index).node().getBoundingClientRect().top) / window.innerHeight;
                // let pageTop = 0;

                for (let stroke of lastCluster.strokes) {
                    if (stroke.id !== "initial") {
                        let bb = stroke.bbox;
                        let textBBox = stroke.textBbox;
                        let lineBBox = stroke.lineBbox;

                        let textX2 = textBBox.x + textBBox.width;
                        let textY2 = textBBox.y + textBBox.height;
                        let lineX2 = lineBBox.x + lineBBox.width;
                        let lineY2 = lineBBox.y + lineBBox.height;

                        textX2 = isNaN(textX2) ? -Infinity : textX2;
                        textY2 = isNaN(textY2) ? -Infinity : textY2;
                        lineX2 = isNaN(lineX2) ? -Infinity : lineX2;
                        lineY2 = isNaN(lineY2) ? -Infinity : lineY2;

                        bbox.x1 = Math.min(bb.x, bbox.x1, textBBox.x, lineBBox.x);
                        bbox.y1 = Math.min(bb.y, bbox.y1, textBBox.y, lineBBox.y);
                        bbox.x2 = Math.max(bb.right, bbox.x2, textX2, lineX2);
                        bbox.y2 = Math.max(bb.bottom, bbox.y2, textY2, lineY2);

                        annotationBBox.x1 = Math.min(bb.x, annotationBBox.x1);
                        annotationBBox.y1 = Math.min(bb.y, annotationBBox.y1);
                        annotationBBox.x2 = Math.max(bb.right, annotationBBox.x2);
                        annotationBBox.y2 = Math.max(bb.bottom, annotationBBox.y2);

                        // d3.select("body")
                        // .append("div")
                        // .attr("id", "hightlighed_word")
                        // .style("position", "absolute")
                        // .style("top", bb.y * window.innerHeight + pageTop * window.innerHeight + window.scrollY + "px")
                        // .style("left", bb.x * window.innerWidth + "px")
                        // .style("width", (bb.right - bb.x) * window.innerWidth + "px")
                        // .style("height", (bb.bottom - bb.y) * window.innerHeight + "px")
                        // .style("background-color", "rgba(255, 0, 0, 0.5)")
                        // .style("pointer-events", "none");

                        // d3.select("body")
                        // .append("div")
                        // .attr("id", "hightlighed_word")
                        // .style("position", "absolute")
                        // .style("top", textBBox.y * window.innerHeight + pageTop * window.innerHeight + window.scrollY + "px")
                        // .style("left", textBBox.x * window.innerWidth + "px")
                        // .style("width", (textX2 - textBBox.x) * window.innerWidth + "px")
                        // .style("height", (textY2 - textBBox.y) * window.innerHeight + "px")
                        // .style("background-color", "rgba(0, 255, 0, 0.5)")
                        // .style("pointer-events", "none");

                        // d3.select("body")
                        //     .append("div")
                        //     .style("position", "absolute")
                        //     .style("top", `${lineBBox.y1 + window.scrollY + pageTop}px`)
                        //     .style("left", `${lineBBox.x1}px`)
                        //     .style("width", `${lineBBox.x2 - lineBBox.x1}px`)
                        //     .style("height", `${lineBBox.y2 - lineBBox.y1}px`)
                        //     .style("border", "2px solid red");

                        // d3.select("body")
                        // .append("div")
                        // .attr("id", "hightlighed_word")
                        // .style("position", "absolute")
                        // .style("top", lineBBox.y * window.innerHeight + pageTop * window.innerHeight + window.scrollY + "px")
                        // .style("left", lineBBox.x * window.innerWidth + "px")
                        // .style("width", (lineX2 - lineBBox.x) * window.innerWidth + "px")
                        // .style("height", (lineY2 - lineBBox.y) * window.innerHeight + "px")
                        // .style("background-color", "rgba(0, 0, 0, 0.5)")
                        // .style("pointer-events", "none");
                    }
                }

                if (annotatedText.length === 0) {
                    // annotatedText = lastCluster.strokes.map(stroke => stroke.marginalText).join(" ");

                    let annotatedTextNodes = new Set(sortedStrokes.map(stroke => {
                        return stroke.marginalText;
                    }).flat());
                    annotatedText = [...annotatedTextNodes].map(node => node.textContent).join(" ").trim();
                    
                    type = "annotated";

                    for (let stroke of lastCluster.strokes) {
                        if (stroke.id !== "initial") {
                            let marginalBBox = stroke.marginalTextBbox;
            
                            let marginalX2 = marginalBBox.x + marginalBBox.width;
                            let marginalY2 = marginalBBox.y + marginalBBox.height;
            
                            marginalX2 = isNaN(marginalX2) ? -Infinity : marginalX2;
                            marginalY2 = isNaN(marginalY2) ? -Infinity : marginalY2;
            
                            bbox.x1 = Math.min(bbox.x1, marginalBBox.x);
                            bbox.y1 = Math.min(bbox.y1, marginalBBox.y);
                            bbox.x2 = Math.max(bbox.x2, marginalX2);
                            bbox.y2 = Math.max(bbox.y2, marginalY2);
                        }
                    }
                }
                // d3.select("body")
                // .append("div")
                // .attr("id", "hightlighed_word")
                // .style("position", "absolute")
                // .style("top", bbox.y1 * window.innerHeight + pageTop * window.innerHeight + window.scrollY + "px")
                // .style("left", bbox.x1 * window.innerWidth + "px")
                // .style("width", (bbox.x2 - bbox.x1) * window.innerWidth + "px")
                // .style("height", (bbox.y2 - bbox.y1) * window.innerHeight + "px")
                // .style("background-color", "rgba(255, 255, 0, 0.5)")
                // .style("pointer-events", "none");

                let contexts = await Promise.all([createC1, createC2]);
                let [c1, c2] = contexts;

                function cropWorker() {
                    self.onmessage = async function (event) {
                        const { dataUrl, bbox, dimensions } = event.data;
                        const { width, height, pageTop } = dimensions;
                    
                        try {
                            const img = await createImageBitmap(await fetch(dataUrl).then(res => res.blob()));
                    
                            const startX = bbox.x1 * width - 10;
                            const startY = (bbox.y1 + pageTop) * height - 10;
                            const cropWidth = (bbox.x2 - bbox.x1) * width + 20;
                            const cropHeight = (bbox.y2 - bbox.y1 - pageTop) * height + 20;
                    
                            // Create an OffscreenCanvas
                            const offscreenCanvas = new OffscreenCanvas(cropWidth, cropHeight);
                            const ctx = offscreenCanvas.getContext("2d");
                    
                            // Draw the cropped image
                            ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                    
                            // Convert the canvas to a Blob and then to a base64 string
                            const blob = await offscreenCanvas.convertToBlob();
                            const reader = new FileReader();
                            reader.onload = () => {
                                self.postMessage({ croppedBase64: reader.result });
                            };
                            reader.readAsDataURL(blob);
                        } catch (error) {
                            self.postMessage({ error: error.message });
                        }
                    };
                }

                function cropCanvas(canvas, bbox) {
                    return new Promise((resolve, reject) => {
                        const url = URL.createObjectURL(new Blob([`(${cropWorker.toString()})()`]));
                        const worker = new Worker(url);
                        const dataUrl = canvas.toDataURL("image/png");
                
                        if (!dataUrl) {
                            reject(new Error("Failed to get canvas data URL"));
                            return;
                        }
                        const height = Number(document.querySelector(".pen-annotation-container")?.style.getPropertyValue("--annotation-height").split("px")[0]) || window.innerHeight;

                        const payload = {
                            dataUrl,
                            bbox,
                            dimensions: {
                                width: window.innerWidth,
                                height,
                                pageTop,
                            },
                        };

                        worker.onmessage = (event) => {
                            resolve(event.data.croppedBase64);
                            worker.terminate();
                            URL.revokeObjectURL(url);
                        };

                        worker.onerror = (err) => {
                            reject(err);
                            worker.terminate();
                            URL.revokeObjectURL(url);
                        };

                        worker.postMessage(payload);
                    });
                }

                let cropAnnotation = domToCanvas(c1)
                .then(canvas => {
                    c1.workers.forEach(worker => worker.terminate());
                    destroyContext(c1);
                    return cropCanvas(canvas, bbox);
                })
                .then(croppedBase64 => {
                    return croppedBase64;
                });

                let pageImage = domToCanvas(c2)
                .then(canvas => {
                    c2.workers.forEach(worker => worker.terminate());
                    destroyContext(c2);
                    return cropCanvas(canvas, annotationBBox);
                })
                .then(croppedBase64 => {
                    return croppedBase64;
                });

                console.log(lastCluster);
                
                let [annotationWithText, annotationWithoutText] = await Promise.all([cropAnnotation, pageImage]);
                let { rawText, result } = await makeInference(annotationWithText, annotationWithoutText, type, annotatedText, specific);
                let typeAnnotatedText = "";

                if (annotatedText instanceof Array) {
                    for (let i = 0; i < annotatedText.length; i++) {
                        typeAnnotatedText += `${type[i]} "${annotatedText[i]}"`;

                        if (i < annotatedText.length - 1 && annotatedText.length > 1) {
                            typeAnnotatedText += " and ";
                        }
                    }
                } else {
                    typeAnnotatedText = `${type} "${annotatedText}"`;
                }
                resolve({ rawText: typeAnnotatedText + "\n" + rawText, result, images: [annotationWithText, annotationWithoutText] });
            });
        });
    }, [index]);
    
    const updateTextTooltips = useCallback(() => {
        clusterRef.current = clusterRef.current.filter(cluster => cluster.strokes.length > 0 && !(cluster.strokes.length === 1 && cluster.strokes[0].id === "initial"));
        
        let width = d3.select(".react-pdf__Page__canvas").node()?.getBoundingClientRect().right;

        d3.select(ref.current)
        .selectAll("g.toolTip")
        .data(clusterRef.current, (d) => {
            return d.strokes[d.strokes.length - 1]?.id;
        })
        .join(
            enter => enter,
            update => {
                update
                .select(".annotationCount")
                .style("opacity", d => ((d.annotating || d.annotating === false) && !d.open) ? 1 : 0)
                .text(d => d.annotationsFound?.filter(annotation => annotation.accepted !== false).length || 0);
                
                let annotationStatus = update
                .select("text.annotateStatus");

                annotationStatus
                .select("tspan.annotationFound")
                .transition()
                .duration(1000)
                .attr("x", d => {
                    return d.x + (window.innerWidth - width - 36) / 2;
                })
                .attr("y", d => (d.y + 16 + 10))
                .text(d => `Found ${d.annotationsFound?.filter(annotation => annotation.accepted !== false).length} annotations`);
            },
            exit => exit
        );
    }, []);

    const updateTooltips = useCallback(() => {
        clusterRef.current = clusterRef.current.filter(cluster => cluster.strokes.length > 0 && !(cluster.strokes.length === 1 && cluster.strokes[0].id === "initial"));
        // console.clear();
        // console.log(clusterRef.current);
        
        let width = d3.select(".react-pdf__Page__canvas").node()?.getBoundingClientRect().right;
        let left = d3.select(".react-pdf__Page__canvas").node()?.getBoundingClientRect().left;

        function processStrokeList(d, type="fill") {
            if (clusterRef.current.length === 0) 
                return [];

            let strokeList = [];

            for (let i = 0; i < d.strokes.length; i++) {
                let stroke = d.strokes[i];
                let strokeID = stroke.id;

                if (strokeID !== "initial") {
                    if (!d.open && type === "border") {
                        let strokeColour = "rgba(0, 0, 0, 0)";
    
                        if (d.annotating || d.purpose === false) {
                            strokeColour = "#F96900";
                        } else if (d.annotating === false) {
                            strokeColour = "#06D6A0";
                        } else if (d.purpose) {
                            strokeColour = "#FFFD82";
                        }
                        strokeList.push({bbox: stroke.bbox, colour: strokeColour});
                    } else {
                        if (!d3.select(`path[id="${strokeID}"]`).empty()) {
                            let strokeColour = d3.select(`path[id="${strokeID}"]`).style("stroke");
                            strokeList.push({bbox: stroke.bbox, colour: strokeColour});
                        } else {
                            strokeList.push({bbox: stroke.bbox, colour: "black"});
                        }
                    }
                }
            }
            if (strokeList.length === 0)
                return [{bbox: {x: 0, y: 0, width: 0, height: 0}, colour: "black"}];

            strokeList.sort((a, b) => a.bbox.y - b.bbox.y);

            let minY = strokeList[0].bbox.y;
            let maxY = strokeList[strokeList.length - 1].bbox.y + strokeList[strokeList.length - 1].bbox.height;
            
            for (let i = 0; i < strokeList.length; i++) {
                strokeList[i]["offset"] = (strokeList[i].bbox.y + strokeList[i].bbox.height / 2 - minY) / (maxY - minY) * 100;
                strokeList[i]["open"] = d.open;
            }
            return strokeList;
        }
        // clusterRef.current.sort((a, b) => a.lastestTimestamp - b.lastestTimestamp);
        
        for (let cluster of clusterRef.current) {
            if (!cluster.strokes[cluster.strokes.length - 1])
                continue;

            let lastStrokeBbox = cluster.strokes[cluster.strokes.length - 1].bbox;
            let height = Number(document.querySelector(".pen-annotation-container")?.style.getPropertyValue("--annotation-height").split("px")[0]) || window.innerHeight;
            let y = (lastStrokeBbox.y + lastStrokeBbox.height / 2) * height - toolTipSize / 2;
            
            cluster["y"] = Math.min(y, ref.current.getBoundingClientRect().height - 200);
            cluster["x"] = handinessRef?.current === "right" ? left - 12 - (window.innerWidth - width - 36) :  width + 12;
        }
        clusterRef.current.sort((a, b) => a.y - b.y);
        
        for (let i = 0; i < clusterRef.current.length; i++) {
            for (let j = 0; j < clusterRef.current.length; j++) {
                if (clusterRef.current[i].y + toolTipSize > clusterRef.current[j].y && clusterRef.current[i].y < clusterRef.current[j].y + toolTipSize && i !== j) {
                    clusterRef.current[j].y = clusterRef.current[i].y + toolTipSize + 2;
                }
            }
        }

        for (let i = 0; i < clusterRef.current.length; i++) {
            if (clusterRef.current[i].y + 200 > ref.current.getBoundingClientRect().height) {
                let offset = clusterRef.current[i].y + 200 - ref.current.getBoundingClientRect().height;
                clusterRef.current[i].y -= offset;
                
                for (let j = clusterRef.current.length - 1; j >= 0; j--) {
                    for (let k = clusterRef.current.length - 1; k >= 0; k--) {
                        if (j !== k && clusterRef.current[j].y + toolTipSize > clusterRef.current[k].y && clusterRef.current[j].y < clusterRef.current[k].y + toolTipSize) {
                            clusterRef.current[k].y = clusterRef.current[j].y - toolTipSize - 2;
                            k--;
                        }
                    }
                }
            }
        }

        for (let cluster of clusterRef.current) {
            if (!cluster.strokes[cluster.strokes.length - 1])
                return;
        }
        d3.selectAll("path.lineDraw")
        .transition()
        .duration(1000)
        .attr("opacity", 0.1);

        let open = false;

        for (let cluster of clusterRef.current) {
            if (cluster.open) {
                open = true;

                for (let stroke of cluster.strokes) {
                    let path = d3.select(`path[id="${stroke.id}"]`);

                    if (!path.empty()) {
                        path
                        .interrupt()
                        .transition()
                        .duration(1000)
                        .attr("opacity", 1);
                        // .attr("filter", `url(#strokeHighlight${stroke.id})`);
                    }
                }
                d3.select("g.toolTip#toolTip" + cluster.strokes[cluster.strokes.length - 1].id)
                .raise();
            }
        }

        if (!open) {
            d3.selectAll("path.lineDraw")
            .transition()
            .duration(1000)
            .attr("opacity", 1);
        }

        d3.select(ref.current)
        .select("defs")
        .selectAll("linearGradient.markerFillGradient")
        .data(clusterRef.current, (d) => {
            return d.strokes[d.strokes.length - 1]?.id;
        })
        .join(
            enter => {
                enter
                .append("linearGradient")
                .attr("class", "markerFillGradient")
                .attr("id", d => "markerFillGradient" + d.strokes[d.strokes.length - 1].id)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "0%")
                .attr("y2", "100%")
                .selectAll("stop")
                .data(processStrokeList)
                .join(
                    enter => enter.append("stop")
                    .attr("offset", (d) => d.offset + "%")
                    .attr("stop-color", (d) => (d.open ? "rgb(255, 255, 255)" : d.colour)),
                    
                    update => update
                    .attr("offset", (d) => d.offset + "%")
                    .attr("stop-color", (d) => (d.open ? "rgb(255, 255, 255)" : d.colour)),

                    exit => exit
                    .transition()
                    .delay(1000)
                    .remove(),
                );
            },
            update => {
                let changedOpen = [];

                update
                .each(function(d) {
                    let nodeTooltip = d3.select(`g.toolTip#toolTip${d.strokes[d.strokes.length - 1].id}`).node();

                    if (nodeTooltip?.classList && (d.open && !nodeTooltip.classList.contains("open") || !d.open && nodeTooltip.classList.contains("open"))) {
                        changedOpen.push(d);
                    }
                });

                update
                .attr("id", d => "markerFillGradient" + d.strokes[d.strokes.length - 1].id)
                .filter((d) => changedOpen.includes(d))
                .selectAll("stop")
                .data(processStrokeList)
                .join(
                    enter => enter.append("stop")
                    .attr("offset", (d) => d.offset + "%")
                    .attr("stop-color", (d) => (d.open ? "rgb(255, 255, 255)" : d.colour)),
                    
                    update => update
                    .transition("open")
                    .duration(1000)
                    .attr("offset", (d) => d.offset + "%")
                    .attr("stop-color", (d) => (d.open ? "rgb(255, 255, 255)" : d.colour)),
                    
                    exit => exit
                    .transition()
                    .delay(1000)
                    .remove(),
                );
            },

            exit => exit
            .transition()
            .delay(1000)
            .remove(),
        );

        // function processConnectorColour(d, i) {
        //     let startColourID = clusters[i].strokes[clusters[i].strokes.length - 1].id;

        //     if (startColourID === "initial" || d3.select(`path[id="${startColourID}"]`).empty()) 
        //         return [];

        //     let startColour = d3.select(`path[id="${startColourID}"]`).style("stroke");

        //     let lastStrokeBbox = clusters[i].strokes[clusters[i].strokes.length - 1].bbox;
        //     let y = Math.min((lastStrokeBbox.y + lastStrokeBbox.height / 2) * window.innerHeight - 12, ref.current.getBoundingClientRect().height - 200);
        //     let bboxMidY = (lastStrokeBbox.y + lastStrokeBbox.height / 2) * window.innerHeight;
            
        //     let yOffset = (bboxMidY - y) / 2;
        //     let minDistance = Infinity;
        //     let endColour = startColour;
        //     let strokeList = processStrokeList(d);

        //     for (let stroke of strokeList) {
        //         let distance = Math.abs(stroke.offset - yOffset);

        //         if (distance < minDistance) {
        //             minDistance = distance;
        //             endColour = stroke.colour;
        //         }
        //     }
        //     return [{offset: 0, colour: startColour}, {offset: 100, colour: endColour}];
        // }

        // d3.select(ref.current)
        // .select("defs")
        // .selectAll("linearGradient.connectorFillGradient")
        // .data(clusters.map(d => d.strokes[d.strokes.length - 1].id), (d) => {
        //     return d;
        // })
        // .join(
        //     enter => {
        //         enter
        //         .append("linearGradient")
        //         .attr("class", "connectorFillGradient")
        //         .attr("id", (d, i) => "connectorFillGradient" + clusters[i].strokes[clusters[i].strokes.length - 1].id)
        //         .attr("x1", "0%")
        //         .attr("y1", "0%")
        //         .attr("x2", "100%")
        //         .attr("y2", "0%")
        //         .selectAll("stop")
        //         .data(processConnectorColour)
        //         .join(
        //             enter => enter.append("stop")
        //             .attr("offset", (d) => d.offset + "%")
        //             .attr("stop-color", (d) => {
        //                 return d.colour;
        //             }),
                    
        //             update => update
        //             .attr("offset", (d) => d.offset + "%")
        //             .attr("stop-color", (d) => d.colour),

        //             exit => exit
        //             .transition()
        //             .delay(500)
        //             .remove(),
        //         );
        //     },

        //     update => {
        //         update
        //         .selectAll("stop")
        //         .data(processConnectorColour)
        //         .join(
        //             enter => enter.append("stop")
        //             .attr("offset", (d) => d.offset + "%")
        //             .attr("stop-color", (d) => d.colour),
                    
        //             update => update
        //             .transition()
        //             .duration(1000)
        //             .attr("offset", (d) => d.offset + "%")
        //             .attr("stop-color", (d) => d.colour),
                    
        //             exit => exit
        //             .transition()
        //             .delay(500)
        //             .remove(),
        //         ); 
        //     },

        //     exit => exit
        //     .transition()
        //     .delay(500)
        //     .remove(),
        // );

        d3.select(ref.current)
        .select("defs")
        .selectAll("linearGradient.markerBorderGradient")
        .data(clusterRef.current, (d) => {
            return d.strokes[d.strokes.length - 1]?.id;
        })
        .join(
            enter => enter
            .append("linearGradient")
            .attr("class", "markerBorderGradient")
            .attr("id", d => "markerBorderGradient" + d.strokes[d.strokes.length - 1].id)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%")
            .selectAll("stop")
            .data(d => processStrokeList(d, "border"))
            .join(
                enter => enter.append("stop")
                .attr("offset", (d) => d.offset + "%")
                .attr("stop-color", (d) => d.colour),
                
                update => update
                .attr("offset", (d) => d.offset + "%")
                .attr("stop-color", (d) => d.colour),

                exit => exit
                .transition()
                .delay(1000)
                .remove(),
            ),

            update => {
                let changedOpen = [];

                update
                .each(function(d) {
                    let nodeTooltip = d3.select(`g.toolTip#toolTip${d.strokes[d.strokes.length - 1].id}`).node();

                    if (nodeTooltip?.classList && (d.open && !nodeTooltip.classList.contains("open") || !d.open)) {
                        changedOpen.push(d);
                    }
                });

                update
                .attr("id", d => "markerBorderGradient" + d.strokes[d.strokes.length - 1].id)
                .filter((d) => changedOpen.includes(d))
                .selectAll("stop")
                .data(d => processStrokeList(d, "border"))
                .join(
                    enter => enter.append("stop")
                    .attr("offset", (d) => d.offset + "%")
                    .attr("stop-color", (d) => d.colour),
                    
                    update => update
                    .attr("offset", (d) => d.offset + "%")
                    .transition()
                    .duration(1000)
                    .attr("stop-color", (d) => d.colour),

                    exit => exit
                    .transition()
                    .delay(1000)
                    .remove(),
                );
            },

            exit => exit
            .transition()
            .delay(1000)
            .remove(),
        );

        d3.select(ref.current)
        .selectAll("g.toolTip")
        .data(clusterRef.current, (d) => {
            return d.strokes[d.strokes.length - 1]?.id;
        })
        .join(
            enter => {
                let padding = 12;
                let topPadding = 40;

                let tooltip = enter
                .append("g")
                .attr("class", "toolTip")
                .classed("found", d => d.annotationsFound)
                .classed("open", d => d.open)
                .classed("annotating", d => d.annotating)
                .classed("selectedPurpose", d => d.annotating !== undefined)
                .classed("done", d => d.annotating === false)
                .classed("havePurpose", d => d.purpose)
                .classed("inferring", d => d.purpose === false)
                .attr("id", d => "toolTip" + d.strokes[d.strokes.length - 1].id)
                .attr("opacity", 0);

                tooltip
                .append("rect")
                .attr("x", d => {
                    if (handinessRef?.current === "right") {
                        return d.open ? d.x : d.x + (window.innerWidth - width - 48 - toolTipSize / 2);
                    } else {
                        return d.x;
                    }
                })
                .attr("y", d => d.y)
                .style("will-change", "width, height")
                .attr("width", d => d.open ? window.innerWidth - width - 36 : toolTipSize)
                .attr("height", d => d.open ? 200 : toolTipSize)
                .attr("rx", toolTipSize / 2)
                .attr("fill", d => `url(#markerFillGradient${d.strokes[d.strokes.length - 1].id})`)
                .attr("fill-opacity", 0.5)
                .attr("stroke", d => `url(#markerBorderGradient${d.strokes[d.strokes.length - 1].id})`)
                .attr("stroke-opacity", d => d.open ? 0.5 : 1)
                .attr("stroke-width", 3)
                .attr("opacity", 1)
                .style("will-change", "width, height")
                .style("cursor", d => d.open ? "default" : "pointer")
                .call(() => 
                    tooltip
                    .transition()
                    .duration(1000)
                    .attr("opacity", 1)
                )
                .on("click", function(_, d) {
                    if (d.open) {
                        return;
                    }
                    d.open = !d.open;

                    if (!d.open) {
                        d3.selectAll("path.lineDraw")
                        .transition()
                        .duration(1000)
                        .attr("opacity", 0.1);
                    
                        for (let stroke of d.strokes) {
                            let path = d3.select(`path[id="${stroke.id}"]`);

                            if (!path.empty()) {
                                path
                                .interrupt()
                                .transition()
                                .duration(1000)
                                .attr("opacity", 1);
                                // .attr("filter", `url(#strokeHighlight${stroke.id})`);
                            }
                        }
                    }

                    for (let cluster of clusterRef.current) {
                        if (cluster !== d) {
                            cluster.open = false;
                        }
                    }

                    let rect = d3.select(this)
                    .on("pointerover", null)
                    .on("pointerout", null)
                    .on("click", null)
                    .node();

                    d3.select(rect.closest("g")).raise();

                    if (d.open && !d.purpose && d.purpose !== false) {
                        const cluster = d;
                        d.purpose = false;
                        const startTimetamp = Date.now();

                        inferPurpose(d)
                        .then((response) => {
                            cluster.purpose = response.result;
                            updateTooltips();
                            
                            if (onInference instanceof Function) {
                                onInference(startTimetamp, cluster, response.rawText, response.images);
                            }
                        });
                    }
                    updateTooltips();

                    if (onClick instanceof Function) {
                        onClick(d);
                    }
                })
                .on("pointerover", function(_, d) {
                    let cluster = d;

                    d3.selectAll("path.lineDraw")
                    .transition()
                    .duration(1000)
                    .attr("opacity", 0.1);

                    if (!cluster) {
                        return;
                    }
                
                    for (let stroke of cluster.strokes) {
                        let path = d3.select(`path[id="${stroke.id}"]`);

                        if (!path.empty()) {
                            path
                            .interrupt()
                            .transition()
                            .duration(1000)
                            .attr("opacity", 1);
                            // .attr("filter", `url(#strokeHighlight${stroke.id})`);

                            let colour = d3.select(`path[id="${stroke.id}"]`).style("stroke");
                            let regex = /rgb\((\d+), (\d+), (\d+)\)/;
                            let match = regex.exec(colour);
                            let r = parseInt(match[1]);
                            let g = parseInt(match[2]);
                            let b = parseInt(match[3]);
                            
                            d3.select("filter#strokeHighlight" + stroke.id)
                            .select("feColorMatrix")
                            .transition()
                            .duration(1000)
                            .attr("values", `0 0 0 0 ${r / 255}
                                             0 0 0 0 ${g / 255}
                                             0 0 0 0 ${b / 255}
                                             0 0 0 5 0`);
                        }
                    }
                })
                .on("pointerout pointerleave", function(_, d) {
                    for (let cluster of clusterRef.current) {
                        if (cluster.open) {
                            d3.selectAll("path.lineDraw")
                            .transition()
                            .duration(1000)
                            .attr("opacity", 0.1);

                            for (let stroke of cluster.strokes) {
                                d3.select(`path[id="${stroke.id}"]`)
                                .interrupt()
                                .transition()
                                .duration(1000)
                                .attr("opacity", 1);
                            }
                            return;
                        }
                    }
                    let cluster = d;

                    d3.selectAll("path.lineDraw")
                    .transition()
                    .duration(1000)
                    .attr("opacity", 1);

                    if (!cluster) {
                        return;
                    }
                
                    for (let stroke of cluster.strokes) {
                        let path = d3.select(`path[id="${stroke.id}"]`);

                        if (!path.empty()) {
                            // path
                            // .attr("filter", `url(#strokeHighlight${stroke.id})`);

                            let colour = d3.select(`path[id="${stroke.id}"]`).style("stroke");
                            let regex = /rgb\((\d+), (\d+), (\d+)\)/;
                            let match = regex.exec(colour);
                            let r = parseInt(match[1]);
                            let g = parseInt(match[2]);
                            let b = parseInt(match[3]);
                            
                            d3.select("filter#strokeHighlight" + stroke.id)
                            .select("feColorMatrix")
                            .transition()
                            .duration(1000)
                            .attr("values", `0 0 0 0 ${r / 255}
                                             0 0 0 0 ${g / 255}
                                             0 0 0 0 ${b / 255}
                                             0 0 0 0 0`);
                        }
                    }
                });

                tooltip
                .append("circle")
                .attr("cx", d => {
                    if (handinessRef?.current === "right") {
                        return !d.open ? d.x + (window.innerWidth - width - 48) : d.x + (window.innerWidth - width - 40 - padding);
                    } else {
                        return !d.open ? d.x + toolTipSize / 2 : window.innerWidth - 40;
                    }
                })
                .attr("cy", d => d.open ? d.y + toolTipSize / 2 + 4 : d.y + toolTipSize / 2)
                .attr("r", 12)
                .attr("fill", "#b8405e")
                .attr("opacity", d => d.open ? 1 : 0)
                .style("pointer-events", d => d.open ? "all" : "none")
                .style("cursor", "pointer")
                .on("click", function(_, d) {
                    d.open = false;
                    updateTooltips();

                    d3.selectAll("path.lineDraw")
                    .transition()
                    .duration(1000)
                    .attr("opacity", 1);

                    if (onNewActiveCluster instanceof Function) {
                        onNewActiveCluster(null);
                    }
                    clearTimeout(openTimeout.current);
                    toolTipRef.current?.close();
                });

                tooltip
                .append("text")
                .attr("x", d => {
                    if (handinessRef?.current === "right") {
                        return !d.open ? d.x + (window.innerWidth - width - 48) : d.x + (window.innerWidth - width - 40 - padding);
                    } else {
                        return !d.open ? d.x + toolTipSize / 2 : window.innerWidth - 40;
                    }
                })
                .attr("y", d => d.open ? d.y + toolTipSize / 2 + 4 : d.y + toolTipSize / 2)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "14px")
                .attr("fill", "white")
                .attr("opacity", d => d.open ? 1 : 0)
                .text("x")
                .style("font-family", "cursive")
                .style("pointer-events", "none");

                let spinner = d3.select(".comment-wrapper")
                .node();

                // let spinnerBBox = spinner.getBBox();
                let spinnerBBox = {width: 80, height: 66.60443115234375};
                
                tooltip
                .append("g")
                .attr("class", "spinner")
                .append(() => spinner.cloneNode(true))
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2 - spinnerBBox.width / 2)
                .attr("y", d => (d.y + 16 + 90) - spinnerBBox.height / 2 - padding)
                .style("opacity", d => d.open && !d.purpose ? 1 : 0)
                .style("display", d => d.open && !d.purpose ? "unset" : "none")
                .selectAll("*")
                .style("pointer-events", "none");

                tooltip
                .select("g.spinner")
                .select("path")
                .attr("fill", (d) => `url(#markerBorderGradient${d.strokes[d.strokes.length - 1].id})`)
                .attr("fill-opacity", 0.5);
                
                for (let i = 0; i < 2; i++) {
                    for (let j = 0; j < 2; j++) {
                        tooltip
                        .append("rect")
                        .attr("id", i * 2 + j)
                        .attr("x", d => {
                            if (!d.open) {
                                if (handinessRef?.current === "right") {
                                    return d.x + (window.innerWidth - width - 48 - toolTipSize / 2);
                                } else {
                                    return d.x;
                                }
                            }
                            let w = window.innerWidth - width - padding - 36;
                            return d.x + padding + (w / 2) * j;
                        })
                        .attr("y", d => {
                            if (!d.open) {
                                return d.y;
                            }
                            let height = 200 - padding - topPadding;
                            return d.y + padding + topPadding + (height / 2) * i;
                        })
                        .attr("width", d => {
                            if (!d.open) {
                                return toolTipSize;
                            }
                            let w = window.innerWidth - width - padding - 36;
                            return w / 2 - padding;
                        })
                        .attr("height", d => {
                            if (!d.open) {
                                return toolTipSize;
                            }
                            let height = 200 - padding - topPadding;
                            return height / 2 - padding;
                        })
                        .attr("fill", "white")
                        .attr("stroke", "black")
                        .attr("rx", 6)
                        .attr("opacity", d => d.open && d.annotating === undefined ? 1 : 0)
                        .style("cursor", "pointer")
                        .style("pointer-events", d => d.open && d.purpose && d.annotating === undefined ? "all" : "none")
                        .on("pointerover", function(_, d) {
                            let cluster = d;

                            if (cluster.purpose) {
                                let content = <div className={googleSans.className} style={{ maxWidth: "300px", userSelect: "none", fontSize: "15px", letterSpacing: "0.2px", lineHeight: "22px", fontWeight: "400", color: "#E8EDED" }}>
                                    {cluster.purpose.purpose[i * 2 + j]?.purpose}
                                </div>;

                                clearTimeout(openTimeout.current);

                                // if (toolTipRef.current?.isOpen) {
                                //     clearTimeout(closeTimeout.current);

                                //     toolTipRef.current?.open({
                                //         anchorSelect : "#toolTip" + cluster.strokes[cluster.strokes.length - 1].id,
                                //         content: content
                                //     });
                                // } else {
                                openTimeout.current = setTimeout(() => {
                                    toolTipRef.current?.open({
                                        anchorSelect : "#toolTip" + cluster.strokes[cluster.strokes.length - 1].id,
                                        content: content
                                    });
                                }, 1000);
                                // }
                            }
                        })
                        .on("pointerout", function() {
                            // clearTimeout(closeTimeout.current);

                            // if (toolTipRef.current?.isOpen) {
                            //     closeTimeout.current = setTimeout(() => {
                            //         toolTipRef.current?.close();
                            //     }, 500);
                            // } else {
                            clearTimeout(openTimeout.current);
                            // }
                        })
                        .on("click", function(_, d) {
                            d.annotating = true;
                            d.searching = d.purpose.purpose[i * 2 + j];
                            d.annotationsFound = [];
                            const cluster = d;
                            const startTimetamp = Date.now();

                            let onDetect = (result) => {
                                cluster.annotationsFound = result;

                                console.log(cluster.annotationsFound);

                                updateTextTooltips(clusterRef.current);

                                if (onClusterChange instanceof Function) {
                                    onClusterChange(cluster);
                                }
                            };

                            let onEnd = (rawText) => {
                                cluster.annotating = false;
                                updateTooltips();

                                if (onEndAnnotate instanceof Function) {
                                    onEndAnnotate(startTimetamp, cluster, rawText);
                                }
                            };

                            updateTooltips();
                            toolTipRef.current?.close();

                            if (setUpAnnotations instanceof Function) {
                                setUpAnnotations(d.purpose.annotationDescription, d.searching.purposeTitle, d.searching.purpose, onDetect, onEnd, penAnnnotationRef);
                            }

                            sendHistory({
                                purpose: cluster.searching.purpose,
                                purposeTitle: cluster.searching.purposeTitle,
                                annotationDescription: cluster.purpose.annotationDescription,
                                action: "update"
                            });
                        });

                        tooltip
                        .append("text")
                        .attr("id", i * 2 + j)
                        .attr("x", d => {
                            let w = window.innerWidth - width - padding - 36;
                            return d.x + padding + (w / 2) * j + (w / 2 - padding) / 2;
                        })
                        .attr("y", d => {
                            let height = 200 - padding - topPadding;
                            return d.y + padding + topPadding + (height / 2) * i + (height / 2 - padding) / 2;
                        })
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("font-size", "14px")
                        .attr("fill", "black")
                        .style("font-family", "cursive")
                        .style("pointer-events", "none")
                        .text(d =>{
                            if (!d.purpose) {
                                return "";
                            }
                            return d.purpose.purpose[i * 2 + j]?.purposeTitle;
                        })
                        .call(wrap)
                        .transition()
                        .duration(1000)
                        .attr("opacity", d => d.open && d.purpose && d.annotating === undefined ? 1 : 0);
                    }
                }

                tooltip
                .append("foreignObject")
                .attr("class", "input-wrapper")
                .attr("x", d => {
                    if (handinessRef?.current === "right") {
                        return d.open ? d.x + padding : d.x + (window.innerWidth - width - 48 - toolTipSize / 2);
                    } else {
                        return d.x + toolTipSize / 2;
                    }
                })
                .attr("y", d => d.y + toolTipSize / 2)
                .attr("width", d => d.open ? window.innerWidth - width - padding * 3 - 52 : toolTipSize)
                .attr("height", topPadding - padding + 2)
                .style("opacity", d => d.open && d.purpose && d.annotating === undefined ? 1 : 0)
                .style("pointer-events", d => d.open && d.purpose && d.annotating === undefined ? "all" : "none")
                .append("xhtml:div")
                .style("width", "100%")
                .style("height", "100%")
                .style("pointer-events", d => d.open && d.purpose && d.annotating === undefined === undefined ? "all" : "none")
                .append("input")
                .attr("type", "text")
                .attr("placeholder", "Why did you annotate this?")
                .style("float", "inline-start")
                .style("border", "1px solid black")
                .style("border-radius", "6px")
                .style("height", "100%")
                .style("font-family", "cursive")
                .style("padding-left", "6px")
                .style("pointer-events", d => d.open && d.purpose && d.annotating === undefined ? "all" : "none")
                .on("keyup", function(e, d) {
                    if (e.key === "Enter" && this.value !== "") {
                        d.annotating = true;
                        d.searching = {
                            annotationDescription: d.purpose?.annotationDescription,
                            purposeTitle: this.value,
                            purpose: ""
                        };
                        d.annotationsFound = [];
                        const cluster = d;
                        const startTimetamp = Date.now();

                        let onDetect = (result) => {
                            cluster.annotationsFound = result;
                            updateTextTooltips(clusterRef.current);

                            if (onClusterChange instanceof Function) {
                                onClusterChange(cluster);
                            }
                        };

                        let onEnd = (rawText) => {
                            cluster.annotating = false;
                            updateTooltips();

                            if (onEndAnnotate instanceof Function) {
                                onEndAnnotate(startTimetamp, cluster, rawText);
                            }
                        };

                        updateTooltips();
                        toolTipRef.current?.close();

                        if (setUpAnnotations instanceof Function) {
                            setUpAnnotations(d.purpose?.annotationDescription, `${this.value}`, "", onDetect, onEnd, penAnnnotationRef);
                        }

                        sendHistory({
                            purpose: "",
                            purposeTitle: this.value,
                            annotationDescription: cluster.purpose?.annotationDescription,
                            action: "update"
                        });
                    }
                });

                let glass = d3.select(".glass-wrapper")
                .node();

                // let glassBBox = glass.getBBox();
                let glassBBox = {width: 60, height: 60};
                
                tooltip
                .append("g")
                .attr("class", "glass")
                .append(() => glass.cloneNode(true))
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2 - glassBBox.width / 2)
                .attr("y", d => (d.y + 16 + 110) - glassBBox.height / 2 - padding)
                .style("opacity", d => d.open && d.annotating ? 1 : 0)
                .style("display", d => d.open && d.annotating ? "unset" : "none")
                .selectAll("*")
                .attr("transform", null)
                .style("pointer-events", "none");

                tooltip
                .select("g.glass")
                .select("animateTransform")
                .attr("dur", "3s");

                let annotateStatus = tooltip
                .append("text")
                .attr("class", "annotateStatus")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "14px")
                .attr("fill", "black")
                .style("font-family", "cursive")
                .style("pointer-events", "none")
                .style("opacity", d => d.open && d.purpose && (d.annotating || d.annotating === false) ? 1 : 0);

                annotateStatus
                .append("tspan")
                .classed("lookingFor1", true)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 10)
                .attr("dy", "0em")
                .text(d => (d.annotating === false) ? `Done annotating for` : `Annotating for`)
                .style("pointer-events", "none");

                annotateStatus
                .append("tspan")
                .classed("lookingFor2", true)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 10)
                .attr("dy", "1.2em")
                .text(d => `"${d.searching?.purposeTitle}"`)
                .style("pointer-events", "none");

                annotateStatus
                .append("tspan")
                .classed("annotationFound", true)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 10)
                .attr("dy", "3em")
                .text(d => `Found ${d.annotationsFound?.filter(annotation => annotation.accepted !== false).length} annotations`)
                .style("pointer-events", "none");

                annotateStatus
                .append("tspan")
                .classed("navagation", true)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 10)
                .attr("dy", "8em")
                .style("font-style", "italic")
                .text(`Use the arrows on the ${handinessRef.current === "right" ? "right" : "left"} to navigate annotations`)
                .style("pointer-events", "none")
                .style("opacity", d => d.open && d.purpose && d.annotating === false ? 1 : 0)
                .call(wrap, window.innerWidth - width - 36);

                tooltip
                .append("text")
                .classed("annotationCount", true)
                .attr("x", d => d.x + toolTipSize / 2)
                .attr("y", d => d.y + toolTipSize / 2 + 1)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "14px")
                .attr("fill", "white")
                .style("font-family", "cursive")
                .style("pointer-events", "none")
                .text(d => d.annotationsFound?.filter(annotation => annotation.accepted !== false).length);

                tooltip
                .append("text")
                .classed("busyText1", true)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 20)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "14px")
                .style("font-family", "cursive")
                .style("pointer-events", "none")
                .text("I am working...")
                .style("opacity", d => d.open && !d.purpose ? 1 : 0)
                .style("display", d => d.open && !d.purpose ? "unset" : "none");

                let busyText2 = tooltip
                .append("text")
                .classed("busyText2", true)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "14px")
                .style("font-family", "cursive")
                .style("pointer-events", "none")
                .style("opacity", d => d.open && !d.purpose ? 1 : 0)
                .style("display", d => d.open && !d.purpose ? "unset" : "none");

                busyText2
                .append("tspan")
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 140)
                .attr("dy", "0em")
                .text("You can continue annotating");

                busyText2
                .append("tspan")
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 140)
                .attr("dy", "1.4em")
                .text("I will turn yellow in the scrollbar when I am done");

                tooltip
                .append("text")
                .classed("busyText3", true)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 160)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "14px")
                .style("font-family", "cursive")
                .style("pointer-events", "none")
                .style("opacity", d => d.open && d.annotating ? 1 : 0)
                .style("display", d => d.open && d.annotating ? "unset" : "none")
                .text("I will turn green in the scrollbar when I am done");
            },

            update => {
                // update
                // .transition()
                // .duration(1)
                // .on("end", () => {
                let padding = 12;
                let topPadding = 40;

                let changedOpen = [];
                let changedOpenPurposeAnnotating = [];

                update
                .each(function(d, i, n) {
                    if (d.open && !n[i].classList.contains("open") || !d.open && n[i].classList.contains("open")) {
                        changedOpen.push(d);
                    }

                    if (
                        ((n[i].classList.contains("open") && n[i].classList.contains("havePurpose") && n[i].classList.contains("noSelectedPurpose")) && !(d.open && d.purpose && d.annotating === undefined)) || 
                        (!(n[i].classList.contains("open") && n[i].classList.contains("havePurpose") && n[i].classList.contains("noSelectedPurpose")) && (d.open && d.purpose && d.annotating === undefined))
                    ) {
                        changedOpenPurposeAnnotating.push(d);
                    }
                });

                update
                .classed("found", d => d.annotationsFound)
                .classed("open", d => d.open)
                .classed("annotating", d => d.annotating)
                .classed("noSelectedPurpose", d => d.annotating === undefined)
                .classed("done", d => d.annotating === false)
                .classed("havePurpose", d => d.purpose)
                .classed("inferring", d => d.purpose === false)
                .transition()
                .duration(1000)
                .attr("opacity", 1);

                update
                .select("text.busyText3")
                .style("display", "unset")
                .transition()
                .duration(d => d.open ? 1000 : 500)
                .delay(d => d.open ? 500 : 0)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => (d.y + 16 + 160))
                .style("opacity", d => d.open && d.annotating ? 1 : 0)
                .on("end", function(d) {
                    if (!(d?.open && d?.annotating)) {
                        d3.select(this).style("display", "none");
                    }
                });

                update
                .select("text.busyText2")
                .style("display", "unset")
                .transition()
                .duration(d => d.open ? 1000 : 500)
                .delay(d => d.open && d.annotating === undefined && !d.purpose ? 500 : 0)
                .style("opacity", d => d.open && !d.purpose ? 1 : 0)
                .on("end", function(d) {
                    if (!(d?.open && !d?.purpose)) {
                        d3.select(this).style("display", "none");
                    }
                });

                update
                .select("text.busyText2")
                .selectAll("tspan")
                .data(d => [d])
                .transition()
                .duration(1000)
                .attr("x", (d) => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", (d) => d.y + 16 + 140);
                // .attr("dy", (d, i) => i === 0 ? "0em" : "1.4em");

                update
                .select("text.busyText1")
                .style("display", "unset")
                .transition()
                .duration(d => d.open ? 1000 : 500)
                .delay(d => d.open && d.annotating === undefined && !d.purpose ? 500 : 0)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 20)
                .style("opacity", d => d.open && !d.purpose ? 1 : 0)
                .on("end", function(d) {
                    if (!(d?.open && !d?.purpose)) {
                        d3.select(this).style("display", "none");
                    }
                });

                update
                .select(".annotationCount")
                .transition()
                .duration(1000)
                .attr("x", d => {
                    if (handinessRef?.current === "right") {
                        return d.x + (window.innerWidth - width - 48);
                    } else {
                        return d.x + toolTipSize / 2;
                    }
                })
                .attr("y", d => d.y + toolTipSize / 2 + 1)
                .style("opacity", d => ((d.annotating || d.annotating === false) && !d.open) ? 1 : 0)
                .text(d => d.annotationsFound?.filter(annotation => annotation.accepted !== false).length);

                let annotationStatus = update
                .select("text.annotateStatus");

                annotationStatus
                .transition()
                .duration(d => d.open ? 1000 : 500)
                .delay(d => d.open ? 500 : 0)
                .style("opacity", d => d.open && d.purpose && (d.annotating || d.annotating === false) ? 1 : 0);

                annotationStatus
                .selectAll("tspan")
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 10);

                annotationStatus
                .select("tspan.lookingFor1")
                .transition()
                .duration(1000)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 10)
                .text(d => (d.annotating === false) ? `Done annotating for` : `Annotating for`);

                annotationStatus
                .select("tspan.lookingFor2")
                .text(d => `"${d.searching?.purposeTitle}"`)
                .transition()
                .duration(1000)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 10);

                annotationStatus
                .select("tspan.annotationFound")
                .transition()
                .duration(1000)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 10)
                .text(d => `Found ${d.annotationsFound?.filter(annotation => annotation.accepted !== false).length} annotations`);

                annotationStatus
                .select("tspan.navagation")
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2)
                .attr("y", d => d.y + 16 + 10)
                .transition()
                .duration(d => d.open ? 1000 : 500)
                .delay(d => d.open ? 500 : 0)
                .style("opacity", d => d.open && d.purpose && d.annotating === false ? 1 : 0)
                .text(`Use the arrows on the ${handinessRef.current === "right" ? "right" : "left"} to navigate annotations`);

                // let glass = d3.select(".glass-wrapper")
                // .node();

                // let glassBBox = glass.getBBox();
                let glassBBox = { width: 60, height: 60 };

                update
                .select("g.glass")
                .select("svg")
                .style("display", "unset")
                .transition()
                .duration(d => d.open ? 1000 : 500)
                .delay(d => d.open ? 500 : 0)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2 - glassBBox.width / 2)
                .attr("y", d => (d.y + 16 + 110) - glassBBox.height / 2 - padding)
                .style("opacity", d => d.open && d.annotating ? 1 : 0)
                .on("end", function(d) {
                    if (!(d?.open && d?.annotating)) {
                        d3.select(this).style("display", "none");
                    }
                });

                update
                .select("foreignObject.input-wrapper")
                .style("pointer-events", d => d.open && d.purpose && d.annotating === undefined ? "all" : "none")
                .transition("update")
                .duration(1000)
                .attr("height", topPadding - padding + 2);

                update
                .filter(d => changedOpen.includes(d))
                .select("foreignObject.input-wrapper")
                .transition("open")
                .duration(1000)
                .attr("x", d => {
                    if (handinessRef?.current === "right") {
                        return d.open ? d.x + padding : d.x + (window.innerWidth - width - 48 - toolTipSize / 2);
                    } else {
                        return d.open ? d.x + padding : d.x;
                    }
                })
                .attr("y", d => d.open ? d.y + padding : d.y)
                .attr("width", d => d.open ? window.innerWidth - width - padding * 3 - 52 : toolTipSize);

                update
                .filter(d => changedOpenPurposeAnnotating.includes(d))
                .select("foreignObject.input-wrapper")
                .transition("openPurposeAnnotating")
                .duration(1000)
                .style("opacity", d => d.open && d.purpose && d.annotating === undefined ? 1 : 0);

                update
                .select("foreignObject.input-wrapper")
                .selectAll("*")
                .data(d => [d])
                .style("pointer-events", (d) => d.open && d.purpose && d.annotating === undefined ? "all" : "none");

                update
                .select("foreignObject.input-wrapper")
                .select("input")
                .style("pointer-events", (d) => d.open && d.purpose && d.annotating === undefined ? "all" : "none")
                .on("keyup", function(e, d) {
                    if (e.key === "Enter" && this.value !== "") {
                        d.annotating = true;
                        d.searching = {
                            annotationDescription: d.purpose?.annotationDescription,
                            purposeTitle: this.value,
                            purpose: ""
                        };
                        d.annotationsFound = [];
                        const cluster = d;
                        const startTimetamp = Date.now();

                        let onDetect = (result) => {
                            cluster.annotationsFound = result;
                            updateTextTooltips(clusterRef.current);
                            
                            // console.log(cluster.annotationsFound);

                            if (onClusterChange instanceof Function) {
                                onClusterChange(cluster);
                            }
                        };

                        let onEnd = (rawText) => {
                            cluster.annotating = false;
                            updateTooltips();

                            if (onEndAnnotate instanceof Function) {
                                onEndAnnotate(startTimetamp, cluster, rawText);
                            }
                        };
                        
                        updateTooltips();
                        toolTipRef.current?.close();

                        if (setUpAnnotations instanceof Function) {
                            setUpAnnotations(d.purpose?.annotationDescription, `But the user has said: "${this.value}".`, "", onDetect, onEnd, penAnnnotationRef);
                        }

                        sendHistory({
                            purpose: "",
                            purposeTitle: this.value,
                            annotationDescription: cluster.purpose?.annotationDescription,
                            action: "update"
                        });
                    }
                });

                // let spinner = d3.select(".comment-wrapper")
                // .node();

                let spinnerBBox = {width: 80, height: 66.60443115234375};
                
                for (let i = 0; i < 2; i++) {
                    for (let j = 0; j < 2; j++) {
                        update
                        .select(`rect[id="${i * 2 + j}"]`)
                        .style("cursor", d => d.open ? "pointer" : "default")
                        .style("pointer-events", "none")
                        .on("pointerover", function(_, d) {
                            let cluster = d;

                            if (cluster?.purpose) {
                                let content = <div className={googleSans.className} style={{ maxWidth: "300px", userSelect: "none", fontSize: "15px", letterSpacing: "0.2px", lineHeight: "22px", fontWeight: "400", color: "#E8EDED" }}>
                                    {cluster.purpose.purpose[i * 2 + j]?.purpose}
                                </div>;
                                
                                clearTimeout(openTimeout.current);
                                
                                // if (toolTipRef.current?.isOpen) {
                                //     clearTimeout(closeTimeout.current);

                                //     toolTipRef.current?.open({
                                //         anchorSelect : "#toolTip" + cluster.strokes[cluster.strokes.length - 1].id,
                                //         content: content
                                //     });
                                // } else {
                                openTimeout.current = setTimeout(() => {
                                    toolTipRef.current?.open({
                                        anchorSelect : "#toolTip" + cluster.strokes[cluster.strokes.length - 1].id,
                                        content: content
                                    });
                                }, 1000);
                                // }
                            }
                        })
                        .on("pointerout", function() {
                            // clearTimeout(closeTimeout.current);

                            // if (toolTipRef.current?.isOpen) {
                            //     closeTimeout.current = setTimeout(() => {
                            //         toolTipRef.current?.close();
                            //     }, 500);
                            // } else {
                            clearTimeout(openTimeout.current);
                            // }
                        })
                        .on("click", function(_, d) {
                            d.annotating = true;
                            d.searching = d.purpose?.purpose[i * 2 + j];
                            d.annotationsFound = [];
                            const cluster = d;
                            const startTimetamp = Date.now();

                            let onDetect = (result) => {
                                cluster.annotationsFound = result;
                                updateTextTooltips(clusterRef.current);

                                // console.log(result);
                                // console.log(cluster.annotationsFound);

                                if (onClusterChange instanceof Function) {
                                    onClusterChange(cluster);
                                }
                            };

                            let onEnd = (rawText) => {
                                cluster.annotating = false;
                                updateTooltips();

                                if (onEndAnnotate instanceof Function) {
                                    onEndAnnotate(startTimetamp, cluster, rawText);
                                }
                            };

                            updateTooltips();
                            toolTipRef.current?.close();

                            if (setUpAnnotations instanceof Function) {
                                setUpAnnotations(d.purpose.annotationDescription, d.searching.purposeTitle, d.searching.purpose, onDetect, onEnd, penAnnnotationRef);
                            }

                            sendHistory({
                                purpose: cluster.searching.purpose,
                                purposeTitle: cluster.searching.purposeTitle,
                                annotationDescription: cluster.purpose.annotationDescription,
                                action: "update"
                            });
                        })
                        .transition("update")
                        .duration(1000)
                        .on("end", function(d) {
                            if (d)
                                d3.select(this)
                                .style("pointer-events", d.open && d.purpose && d.annotating === undefined ? "all" : "none");
                        });

                        update
                        .select(`rect[id="${i * 2 + j}"]`)
                        .filter(d => changedOpen.includes(d))
                        .transition("open")
                        .duration(1000)
                        .attr("x", d => {
                            if (!d.open) {
                                if (handinessRef?.current === "right") {
                                    return d.x + (window.innerWidth - width - 48 - toolTipSize / 2);
                                } else {
                                    return d.x;
                                }
                            }
                            let w = window.innerWidth - width - padding - 36;
                            return d.x + padding + (w / 2) * j;
                        })
                        .attr("y", d => {
                            if (!d.open) {
                                return d.y;
                            }
                            let height = 200 - padding - topPadding;
                            return d.y + padding + topPadding + (height / 2) * i;
                        })
                        .attr("width", d => {
                            if (!d.open) {
                                return toolTipSize;
                            }
                            let w = window.innerWidth - width - padding - 36;
                            return w / 2 - padding;
                        })
                        .attr("height", d => {
                            if (!d.open) {
                                return toolTipSize;
                            }
                            let height = 200 - padding - topPadding;
                            return height / 2 - padding;
                        });

                        update
                        .filter(d => changedOpenPurposeAnnotating.includes(d))
                        .select(`rect[id="${i * 2 + j}"]`)
                        .transition("openPurposeAnnotating")
                        .duration(1000)
                        .attr("opacity", d => d.open && d.purpose && d.annotating === undefined ? 1 : 0);

                        update
                        .select(`text[id="${i * 2 + j}"]`)
                        .text(d =>{
                            if (!d.purpose) {
                                return "";
                            }
                            return d.purpose.purpose[i * 2 + j]?.purposeTitle;
                        })
                        .attr("x", d => {
                            let w = window.innerWidth - width - padding - 36;
                            return d.x + padding + (w / 2) * j + (w / 2 - padding) / 2;
                        })
                        .attr("y", d => {
                            let height = 200 - padding - topPadding;
                            return d.y + padding + topPadding + (height / 2) * i + (height / 2 - padding) / 2;
                        })
                        .call(wrap)
                        .transition()
                        .duration(d => d.open ? 1000 : 500)
                        .delay(d => d.open && d.annotating === undefined ? 500 : 0)
                        .attr("opacity", d => d.open && d.purpose && d.annotating === undefined ? 1 : 0);
                    }
                }

                update
                .select("g.spinner")
                .select("svg")
                .style("display", "unset")
                .transition()
                .duration(d => d.open ? 1000 : 500)
                .delay(d => d.open && d.annotating === undefined && !d.purpose ? 500 : 0)
                .attr("x", d => d.x + (window.innerWidth - width - 36) / 2 - spinnerBBox.width / 2)
                .attr("y", d => (d.y + 16 + 90) - spinnerBBox.height / 2 - padding)
                .style("opacity", d => d.open && !d.purpose ? 1 : 0)
                .on("end", function(d) {
                    if (!(d?.open && !d?.purpose)) {
                        d3.select(this).style("display", "none");
                    }
                });

                update
                .select("circle")
                .style("pointer-events", d => d.open ? "all" : "none")
                .on("click", function(_, d) {
                    d.open = false;
                    updateTooltips();

                    d3.selectAll("path.lineDraw")
                    .transition()
                    .duration(1000)
                    .attr("opacity", 1);

                    if (onNewActiveCluster instanceof Function) {
                        onNewActiveCluster(null);
                    }
                    clearTimeout(openTimeout.current);
                    toolTipRef.current?.close();
                });

                update
                .filter(d => changedOpen.includes(d))
                .select("circle")
                .transition("open")
                .duration(1000)
                .attr("cx", d => {
                    if (handinessRef?.current === "right") {
                        return !d.open ? d.x + (window.innerWidth - width - 48) : d.x + (window.innerWidth - width - 40 - padding);
                    } else {
                        return !d.open ? d.x + padding : window.innerWidth - 40;
                    }
                })
                .attr("cy", d => d.open ? d.y + toolTipSize / 2 + 4 : d.y + toolTipSize / 2)
                .attr("opacity", d => d.open ? 1 : 0);

                update
                .filter(d => changedOpen.includes(d))
                .select("text")
                .transition("open")
                .duration(1000)
                .attr("x", d => {
                    if (handinessRef?.current === "right") {
                        return !d.open ? d.x + (window.innerWidth - width - 48) : d.x + (window.innerWidth - width - 40 - padding);
                    } else {
                        return !d.open ? d.x + padding : window.innerWidth - 40;
                    }
                })
                .attr("y", d => d.open ? d.y + toolTipSize / 2 + 4 : d.y + toolTipSize / 2)
                .attr("opacity", d => d.open ? 1 : 0);

                update
                .select("rect")
                .style("cursor", d => d.open ? "default" : "pointer")
                .call(update => {
                    update
                    .filter(d => changedOpen.includes(d))
                    .transition("open")
                    .duration(1000)
                    .attr("x", d => {
                        if (handinessRef?.current === "right") {
                            return d.open ? d.x : d.x + (window.innerWidth - width - 36 - toolTipSize / 2 - 12);
                        } else {
                            return d.x;
                        }
                    })
                    .attr("y", d => d.y)
                    .attr("width", d => d.open ? window.innerWidth - width - 36 : toolTipSize)
                    .attr("height", d => d.open ? 200 : toolTipSize)
                    .attr("stroke-opacity", d => d.open ? 0.5 : 1)
                    .attr("fill-opacity", 0.5)
                    .attr("opacity", 1);
                    
                    update
                    .transition("update")
                    .duration(1000)
                    // .style("pointer-events", "none")
                    .on("start", () => {
                        toolTipRef.current?.close();
                    })
                    .on("end", function(d) {
                        if (!d || !d.strokes[d.strokes.length - 1])
                            return;

                        if (d.open) {
                            d3.select(this)
                            .on("click", null)
                            .on("pointerover", null)
                            .on("pointerout", null);
                        } else {
                            clearTimeout(openTimeout.current);

                            d3.select(this)
                            .on("pointerover", function() {
                                let cluster = d;

                                d3.selectAll("path.lineDraw")
                                .transition()
                                .duration(1000)
                                .attr("opacity", 0.1);
                                
                                if (cluster?.strokes) {
                                    for (let stroke of cluster.strokes) {
                                        let path = d3.select(`path[id="${stroke.id}"]`);
    
                                        if (!path.empty()) {
                                            path
                                            .interrupt()
                                            .transition()
                                            .duration(1000)
                                            .attr("opacity", 1);
                                            // .attr("filter", `url(#strokeHighlight${stroke.id})`);
    
                                            let colour = d3.select(`path[id="${stroke.id}"]`).style("stroke");
                                            let regex = /rgb\((\d+), (\d+), (\d+)\)/;
                                            let match = regex.exec(colour);
                                            let r = parseInt(match[1]);
                                            let g = parseInt(match[2]);
                                            let b = parseInt(match[3]);
                                            
                                            d3.select("filter#strokeHighlight" + stroke.id)
                                            .select("feColorMatrix")
                                            .transition()
                                            .duration(1000)
                                            .attr("values", `0 0 0 0 ${r / 255}
                                                            0 0 0 0 ${g / 255}
                                                            0 0 0 0 ${b / 255}
                                                            0 0 0 5 0`);
                                        }
                                    }
                                }
                            })
                            .on("pointerout pointerleave", function() {
                                for (let cluster of clusterRef.current) {
                                    if (cluster.open) {
                                        d3.selectAll("path.lineDraw")
                                        .transition()
                                        .duration(1000)
                                        .attr("opacity", 0.1);

                                        for (let stroke of cluster.strokes) {
                                            d3.select(`path[id="${stroke.id}"]`)
                                            .interrupt()
                                            .transition()
                                            .duration(1000)
                                            .attr("opacity", 1);
                                        }
                                        return;
                                    }
                                }
                                let cluster = d;

                                d3.selectAll("path.lineDraw")
                                .transition()
                                .duration(1000)
                                .attr("opacity", 1);
                                
                                if (cluster.strokes) {
                                    for (let stroke of cluster.strokes) {
                                        let path = d3.select(`path[id="${stroke.id}"]`);

                                        if (!path.empty()) {
                                            // path
                                            // .attr("filter", `url(#strokeHighlight${stroke.id})`);

                                            let colour = d3.select(`path[id="${stroke.id}"]`).style("stroke");
                                            let regex = /rgb\((\d+), (\d+), (\d+)\)/;
                                            let match = regex.exec(colour);
                                            let r = parseInt(match[1]);
                                            let g = parseInt(match[2]);
                                            let b = parseInt(match[3]);
                                            
                                            d3.select("filter#strokeHighlight" + stroke.id)
                                            .select("feColorMatrix")
                                            .transition()
                                            .duration(1000)
                                            .attr("values", `0 0 0 0 ${r / 255}
                                                             0 0 0 0 ${g / 255}
                                                             0 0 0 0 ${b / 255}
                                                             0 0 0 0 0`);
                                        }
                                    }
                                }
                            })
                            .on("click", function() {            
                                if (d.open) {
                                    return;
                                }
                                d.open = !d.open;
            
                                if (!d.open) {
                                    let cluster = d;
            
                                    d3.selectAll("path.lineDraw")
                                    .transition()
                                    .duration(1000)
                                    .attr("opacity", 1);
                            
                                    for (let stroke of cluster.strokes) {
                                        let path = d3.select(`path[id="${stroke.id}"]`);
            
                                        if (!path.empty()) {
                                            // path
                                            // .attr("filter", `url(#strokeHighlight${stroke.id})`);
            
                                            let colour = d3.select(`path[id="${stroke.id}"]`).style("stroke");
                                            let regex = /rgb\((\d+), (\d+), (\d+)\)/;
                                            let match = regex.exec(colour);
                                            let r = parseInt(match[1]);
                                            let g = parseInt(match[2]);
                                            let b = parseInt(match[3]);
                                            
                                            d3.select("filter#strokeHighlight" + stroke.id)
                                            .select("feColorMatrix")
                                            .transition()
                                            .duration(1000)
                                            .attr("values", `0 0 0 0 ${r / 255}
                                                             0 0 0 0 ${g / 255}
                                                             0 0 0 0 ${b / 255}
                                                             0 0 0 0 0`);
                                        }
                                    }
                                }
                                
                                for (let cluster of clusterRef.current) {
                                    if (cluster !== d) {
                                        cluster.open = false;
                                    }
                                }
            
                                let rect = d3.select(this)
                                .on("pointerover", null)
                                .on("pointerout", null)
                                .node();
            
                                d3.select(rect.closest("g")).raise();

                                // console.log(d);
            
                                if (d.open && !d.purpose && d.purpose !== false) {
                                    d.purpose = false;
                                    const cluster = d;
                                    const startTimetamp = Date.now();
                                    
                                    inferPurpose(d)
                                    .then((response) => {
                                        cluster.purpose = response.result;
                                        updateTooltips();
                                        
                                        if (onInference instanceof Function) {
                                            onInference(startTimetamp, cluster, response.rawText, response.images);
                                        }
                                    });
                                }
                                updateTooltips();
                                
                                if (onClick instanceof Function) {
                                    onClick(d);
                                }
                            });
                        }
                    });
                });
                // });
            },

            exit => exit
            .call(exit =>
                exit
                .on("click", null)
                .style("cursor", "default")
                .classed("exit", true)
                .transition()
                .duration(1000)
                .attr("opacity", 0)
                .remove()
            ),
        );

        // d3.select(ref.current)
        // .select("defs")
        // .selectAll("filter.strokeHighlight")
        // .data(clusterRef.current.map(cluster => cluster.strokes).flat(), (d) => {
        //     return d.id;
        // })
        // .join(
        //     enter => {
        //         let filter = enter
        //         .append("filter")
        //         .attr("class", "strokeHighlight")
        //         .attr("id", (d, i) => "strokeHighlight" + d.id)
        //         .attr("x", "-500%")
        //         .attr("y", "-500%")
        //         .attr("width", "1000%")
        //         .attr("height", "1000%");

        //         filter
        //         .append("feGaussianBlur")
        //         .attr("in", "SourceGraphic")
        //         .attr("stdDeviation", 3)
        //         .attr("result", "blur");

        //         filter
        //         .append("feColorMatrix")
        //         .attr("in", "blur")
        //         .attr("type", "matrix")
        //         .attr("values", (d, i) => {
        //             if (d.id === "initial")
        //                 return `1 0 0 0 0
        //                         0 1 0 0 0
        //                         0 0 1 0 0
        //                         0 0 0 15 0`;

        //             let colour = d3.select(`path[id="${d.id}"]`).style("stroke");
        //             let regex = /rgb\((\d+), (\d+), (\d+)\)/;
        //             let match = regex.exec(colour);
        //             let r = parseInt(match[1]);
        //             let g = parseInt(match[2]);
        //             let b = parseInt(match[3]);

        //             return `0 0 0 0 ${r / 255}
        //                     0 0 0 0 ${g / 255}
        //                     0 0 0 0 ${b / 255}
        //                     0 0 0 0 0`;
                
        //         })
        //         .attr("result", "blue");


        //         filter
        //         .append("feColorMatrix")
        //         .attr("in", "SourceGraphic")
        //         .attr("type", "matrix")
        //         .attr("values", `1 0 0 0 0
        //                         0 1 0 0 0
        //                         0 0 1 0 0
        //                         1 1 1 10 0`)
        //         .attr("result", "solid");

        //         filter
        //         .append("feComposite")
        //         .attr("in", "SourceGraphic")
        //         .attr("in2", "solid")
        //         .attr("result", "solid2")
        //         .attr("operator", "over");

        //         filter
        //         .append("feComposite")
        //         .attr("in", "blue")
        //         .attr("in2", "solid2")
        //         .attr("result", "border")
        //         .attr("operator", "out");

        //         filter
        //         .append("feGaussianBlur")
        //         .attr("in", "border")
        //         .attr("stdDeviation", 2)
        //         .attr("result", "border");
                

        //         filter
        //         .append("feComposite")
        //         .attr("in", "SourceGraphic")
        //         .attr("in2", "border");
        //     },
        // );


        // let bboxes = {};
            
        // for (let cluster of clusters) {
        //     let bbox = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };

        //     for (let stroke of cluster.strokes) {
        //         if (!d3.select(`[id="${stroke.id}"]`).empty()) {
        //             let bb = stroke.bbox;
        //             bbox.x1 = Math.min(bb.x, bbox.x1);
        //             bbox.y1 = Math.min(bb.y, bbox.y1);
        //             bbox.x2 = Math.max(bb.x + bb.width, bbox.x2);
        //             bbox.y2 = Math.max(bb.y + bb.height, bbox.y2);
        //         }
        //     }
        //     bboxes[cluster.strokes[cluster.strokes.length - 1].id] = bbox;
        // }

        // d3.select(ref.current)
        // .selectAll("rect.bbox")
        // .data(clusters.map(d => d.strokes[d.strokes.length - 1].id), (d) => {
        //     return d;
        // })
        // .join(
        //     enter => {
        //         enter
        //         .append("rect")
        //         .attr("class", "bbox")
        //         .style("pointer-events", "none")
        //         .attr("x", (d) => bboxes[d].x1 * window.innerWidth - 10)
        //         .attr("y", (d) => bboxes[d].y1 * window.innerHeight - 10)
        //         .attr("width", (d) => (bboxes[d].x2 - bboxes[d].x1) * window.innerWidth + 20)
        //         .attr("height", (d) => (bboxes[d].y2 - bboxes[d].y1) * window.innerHeight + 20)
        //         .attr("fill", "none")
        //         .attr("stroke", d => `url(#markerBorderGradient${d})`)
        //         .attr("stroke-width", 2)
        //         .attr("rx", 10)
        //         .attr("opacity", 0)
        //         .call(enter => 
        //             enter
        //             .transition()
        //             .duration(1000)
        //             .attr("opacity", d => {
        //                 let cluster = clusters.find(cluster => cluster.strokes[cluster.strokes.length - 1].id === d);

        //                 if (!cluster)
        //                     return 0;

        //                 return cluster.open || cluster.hover ? 1 : 0;
        //             })
        //         );
        //     },
        //     update => {
        //         update
        //         .call(update => 
        //             update
        //             .transition()
        //             .duration(1000)
        //             .attr("x", (d) => bboxes[d].x1 * window.innerWidth - 10)
        //             .attr("y", (d) => bboxes[d].y1 * window.innerHeight - 10)
        //             .attr("width", (d) => (bboxes[d].x2 - bboxes[d].x1) * window.innerWidth + 20)
        //             .attr("height", (d) => (bboxes[d].y2 - bboxes[d].y1) * window.innerHeight + 20)
        //             .attr("opacity", d => {
        //                 let cluster = clusters.find(cluster => cluster.strokes[cluster.strokes.length - 1].id === d);

        //                 if (!cluster)
        //                     return 0;

        //                 return cluster.open || cluster.hover ? 1 : 0;
        //             })
        //         );
        //     },
        //     exit => exit
        //     .call(exit =>
        //         exit
        //         .transition()
        //         .duration(1000)
        //         .attr("opacity", 0)
        //         .remove()
        //     ),
        // );

        // d3.select(ref.current)
        // .selectAll("line.connector")
        // .data(clusters.map(d => d.strokes[d.strokes.length - 1].id), (d) => {
        //     return d;
        // })
        // .join(
        //     enter => {
        //         enter
        //         .append("line")
        //         .attr("class", "connector")
        //         .style("pointer-events", "none")
        //         .attr("x1", (d) => bboxes[d].x2 * window.innerWidth + 10)
        //         .attr("y1", (d, i) => {
        //             let lastStrokeBbox = clusters[i].strokes[clusters[i].strokes.length - 1].bbox;
        //             return (lastStrokeBbox.y + lastStrokeBbox.height / 2) * window.innerHeight;
        //         })
        //         .attr("x2", (d) => d3.select(".react-pdf__Page__canvas").node().getBoundingClientRect().right + 12)
        //         .attr("y2", (d, i) => {
        //             let lastStrokeBbox = clusters[i].strokes[clusters[i].strokes.length - 1].bbox;
        //             return (lastStrokeBbox.y + lastStrokeBbox.height / 2) * window.innerHeight + 0.5;
        //         })
        //         .attr("stroke", d => `url(#connectorFillGradient${d})`)
        //         .attr("stroke-width", 2)
        //         .attr("opacity", d => clusters.find(cluster => cluster.strokes[cluster.strokes.length - 1].id === d).open ? 1 : 0)
        //         .call(enter => 
        //             enter
        //             .transition()
        //             .duration(1000)
        //             .attr("opacity", d => clusters.find(cluster => cluster.strokes[cluster.strokes.length - 1].id === d).open ? 1 : 0)
        //         );
        //     },
        //     update => {
        //         update
        //         .call(update => 
        //             update
        //             .transition()
        //             .duration(1000)
        //             .attr("x1", (d) => bboxes[d].x2 * window.innerWidth + 10)
        //             .attr("y1", (d, i) => {
        //                 let lastStrokeBbox = clusters[i].strokes[clusters[i].strokes.length - 1].bbox;
        //                 return (lastStrokeBbox.y + lastStrokeBbox.height / 2) * window.innerHeight;
        //             })
        //             .attr("x2", (d) => d3.select(".react-pdf__Page__canvas").node().getBoundingClientRect().right + 12)
        //             .attr("y2", (d, i) => {
        //                 let lastStrokeBbox = clusters[i].strokes[clusters[i].strokes.length - 1].bbox;
        //                 return (lastStrokeBbox.y + lastStrokeBbox.height / 2) * window.innerHeight + 0.5;
        //             })
        //             .attr("opacity", d => clusters.find(cluster => cluster.strokes[cluster.strokes.length - 1].id === d).open ? 1 : 0)
        //         );
        //     },
        //     exit => exit
        //     .call(exit =>
        //         exit
        //         .transition()
        //         .duration(1000)
        //         .attr("opacity", 0)
        //         .remove()
        //     ),
        // );
    }, [onClick, inferPurpose, onInference, onNewActiveCluster, toolTipRef, setUpAnnotations, sendHistory, updateTextTooltips, onClusterChange, onEndAnnotate, penAnnnotationRef, handinessRef]);

    useEffect(() => {
        if (clusters) {
            for (let cluster of clusters) {
                if (cluster["open"] === undefined)
                    cluster["open"] = false;
            }
            clusterRef.current = [...clusters].filter(cluster => (!cluster.disabled || cluster.annotationsFound || cluster.purpose || cluster.purpose === false) && (cluster.strokes.length === 1 && cluster.strokes[0].id !== "initial" || cluster.strokes.length > 1));

            // console.log(clusterRef.current);

            // for (let cluster of clusterRef.current) {
            //     if (cluster.annotationsFound) {
            //         cluster.annotationsFound = [...cluster.annotationsFound].filter(annotation => annotation.accepted !== false);
            //     }
            // }
            updateTooltips();
        } else {
            clusterRef.current = [];
            updateTooltips();
        }
        // console.log(clusterRef.current)

        return () => {
            clusterRef.current = [];
        };
    }, [clusters, updateTooltips]);

    return (
        <svg ref={ref} id="toolTipcanvas" width={"100%"} height={"100%"} style={{ userSelect: "none" }} >
            <defs>
            </defs>
        </svg>
    );
}