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

export default function Tooltip({ mode, clusters, index, onClick, onInference, onNewActiveCluster, onClusterChange, toolTipRef, setUpAnnotations, penAnnnotationRef, onEndAnnotate }) {
    let ref = useRef(null);
    let openTimeout = useRef(null);
    let closeTimeout = useRef(null);
    let clusterRef = useRef(clusters);
    const toolTipSize = 25;

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
                // console.error("Error:", error);

                toast.error("updatePurpose: " + error.toString().replace("Error: ", ""), {
                    toastId: "updatePurpose"
                });
            });
        }
    }, [mode]);

    const inferPurpose = useCallback(async (lastCluster) => {
        if (typeof mode === "string" && mode.toLowerCase().includes("practice")) {
            return new Promise(
                resolve => {
                    setTimeout(() => {
                        console.log("Resolving promise...");
        
                        resolve({
                            rawText: "Bla bla bla...",
                            result: JSON.parse(`{
                                "annotationDescription": "Test",
                                "pastAnnotationHistory": "Test",
                                "purpose": [
                                    {
                                        "persona": "Persona 1",
                                        "purpose": "Purpose 1",
                                        "purposeTitle": "Purpose 1"
                                    },
                                    {
                                        "persona": "Persona 2",
                                        "purpose": "Purpose 2",
                                        "purposeTitle": "Purpose 2"
                                    },
                                    {
                                        "persona": "Persona 3",
                                        "purpose": "Purpose 3",
                                        "purposeTitle": "Purpose 3"
                                    },
                                    {
                                        "persona": "Persona 4",
                                        "purpose": "Purpose 4",
                                        "purposeTitle": "Purpose 4"
                                    }
                                ]
                            }`),
                            images: ["test image 1", "test image 2"]
                        });
                            
                    }, 1000);
                } 
            );
        }
        let bbox = {x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity};
        let annotationPage1 = d3.select("#layer-" + index).node().cloneNode(true);
        let annotationPage2 = d3.select("#layer-" + index).node().cloneNode(true);
        let page = d3.select(".react-pdf__Page.page-" + index).node().cloneNode();
        let canvasPage = d3.select(".react-pdf__Page.page-" + index).select("canvas").node().cloneNode();
        let container1 = d3.select(".screenshot-container1").html("").node();
        let container2 = d3.select(".screenshot-container2").html("").node();

        d3.select(annotationPage1)
        .select("#toolTipcanvas")
        .remove();

        d3.select(annotationPage1)
        .selectAll("path")
        .attr("filter", null);

        d3.select(annotationPage2)
        .select("#toolTipcanvas")
        .remove();

        d3.select(annotationPage2)
        .selectAll("path")
        .attr("filter", null);
        
        container1.appendChild(page);
        container1.appendChild(annotationPage1);
        container2.appendChild(annotationPage2);
        d3.select(page).append(() => canvasPage);

        let context = d3.select(container1).select("canvas").node().getContext("2d");

        d3.select(annotationPage1)
        .style("position", "absolute")
        .style("top", index === 1 ? "0" : "-10px")
        .selectAll("path")
        .style("stroke", "red")
        .attr("class", null)
        .attr("opacity", null);

        d3.select(annotationPage2)
        .style("position", "absolute")
        .style("top", index === 1 ? "0" : "-10px")
        .selectAll("path")
        .style("stroke", "red")
        .attr("class", null)
        .attr("opacity", null);

        context.drawImage(d3.select(".react-pdf__Page.page-" + index).select("canvas").node(), 0, 0);

        let ids = lastCluster.strokes.map(stroke => stroke.id);

        const createC1 = createContext(container1, {
            workerUrl: "./Worker.js",
            workerNumber: 1,
            filter: (node) => {
                if (node.tagName === "path") {
                    let id = node.id;
                    d3.select(node).attr("id", null);

                    return ids.includes(id);
                }
                return true;
            }
        });

        const createC2 = createContext(container2, {
            workerUrl: "./Worker.js",
            workerNumber: 1,
            filter: (node) => {
                if (node.tagName === "path") {
                    let id = node.id;
                    d3.select(node).attr("id", null);

                    return ids.includes(id);
                }
                return true;
            }
        });
        
        let circle = lastCluster.strokes.find(stroke => stroke.type.startsWith("circled"));
        let underline = lastCluster.strokes.find(stroke => stroke.type.startsWith("underlined"));
        let highlighted = lastCluster.strokes.find(stroke => stroke.type.startsWith("highlighted"));
        let crossed = lastCluster.strokes.find(stroke => stroke.type.startsWith("crossed"));
        let word = lastCluster.strokes.find(stroke => stroke.type.endsWith("words"));
        
        let sortedStrokes = [...lastCluster.strokes].sort((a, b) => {
            if (a.bbox.y === b.bbox.y) {
                return a.bbox.x - b.bbox.x;
            }
            return a.bbox.y - b.bbox.y;
        });
        // let annotatedText = sortedStrokes.map(stroke => stroke.annotatedText).join("");
        let annotatedText = "";

        let annotatedTextNodes = new Set(sortedStrokes.map(stroke => {
            if (word) {
                if (stroke.type.endsWith("words")) {
                    return stroke.annotatedText;
                } else {
                    return "";
                }
            }
            return stroke.annotatedText;
        }).flat());
        
        annotatedText = word ? [...annotatedTextNodes].map(node => node.textContent).join(" ") : [...annotatedTextNodes].map(node => node.textContent).join(" ");

        let type = "annotated (not circled, underlined, highlighted or crossed out)";

        if (circle) {
            type = "circled";
        } else if (underline) {
            type = "underlined";
        } else if (crossed) {
            type = "crossed out";
        } else if (highlighted) {
            type = "highlighted";
        } else {
            type = "annotated (not circled, underlined, highlighted or crossed out)";
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

        if (annotatedText.trim() === "") {
            // annotatedText = lastCluster.strokes.map(stroke => stroke.marginalText).join(" ");

            let annotatedTextNodes = new Set(sortedStrokes.map(stroke => {
                return stroke.marginalText;
            }).flat());
            annotatedText = [...annotatedTextNodes].map(node => node.textContent).join(" ").trim();
            
            type = "annotated (not circled, underlined or highlighted)";

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

        let cropAnnotation = domToCanvas(c1).then(canvas => {
            return new Promise((resolve, reject) => {
                let dataUrl = canvas.toDataURL('image/png');
                // console.log(dataUrl);

                if (dataUrl) {
                    let img = new Image();
                    img.src = dataUrl;

                    let startX = bbox.x1 * window.innerWidth - 10;
                    let startY = (bbox.y1 + pageTop) * window.innerHeight - 10;
                    let cropWidth = (bbox.x2 - bbox.x1) * window.innerWidth + 20;
                    let cropHeight = (bbox.y2 - bbox.y1 - pageTop) * window.innerHeight + 20;

                    img.onload = function () {
                        let canvas = document.createElement('canvas');
                        canvas.width = cropWidth;
                        canvas.height = cropHeight;

                        let ctx = canvas.getContext('2d');
                        ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

                        let croppedBase64 = canvas.toDataURL('image/png');
                        resolve(croppedBase64);
                    };
                }
                destroyContext(c1);
            });
        });

        let pageImage = domToCanvas(c2).then(canvas => {
            return new Promise((resolve, reject) => {
                let dataUrl = canvas.toDataURL('image/png');
                // console.log(dataUrl);

                if (dataUrl) {
                    let img = new Image();
                    img.src = dataUrl;

                    let startX = bbox.x1 * window.innerWidth - 10;
                    let startY = (bbox.y1 + pageTop) * window.innerHeight - 10;
                    let cropWidth = (bbox.x2 - bbox.x1) * window.innerWidth + 20;
                    let cropHeight = (bbox.y2 - bbox.y1 - pageTop) * window.innerHeight + 20;

                    img.onload = function () {
                        let canvas = document.createElement('canvas');
                        canvas.width = cropWidth;
                        canvas.height = cropHeight;

                        let ctx = canvas.getContext('2d');
                        ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

                        let croppedBase64 = canvas.toDataURL('image/png');
                        resolve(croppedBase64);
                    };
                }
                destroyContext(c2);
            });
        });

        console.log(lastCluster);
        
        let [annotationWithText, annotationWithoutText] = await Promise.all([cropAnnotation, pageImage]);
        let { rawText, result } = await makeInference(annotationWithText, annotationWithoutText, type, annotatedText.trim());
        return { rawText, result, images: [annotationWithText, annotationWithoutText] };
    }, [index, mode]);
    
    const updateTextTooltips = useCallback(() => {
        clusterRef.current = clusterRef.current.filter(cluster => cluster.strokes.length > 0 && !(cluster.strokes.length === 1 && cluster.strokes[0].id === "initial"));
        
        let width = d3.select(".react-pdf__Page__canvas").node()?.getBoundingClientRect().right;

        d3.select(ref.current)
        .selectAll("g.toolTip")
        .data(clusterRef.current.map(d => d.strokes[d.strokes.length - 1].id), (d) => {
            return d;
        })
        .join(
            enter => enter,
            update => {
                update
                .select(".annotationCount")
                .style("opacity", (d, i) => ((clusterRef.current[i].annotating || clusterRef.current[i].annotating === false) && !clusterRef.current[i].open) ? 1 : 0)
                .text((d, i) => clusterRef.current[i].annotationsFound?.length || 0);
                
                let annotationStatus = update
                .select("text.annotateStatus");

                annotationStatus
                .select("tspan.annotationFound")
                .transition()
                .duration(1000)
                .attr("x", (d, i) => {
                    return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2;
                })
                .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 10))
                .text((d, i) => `Found ${clusterRef.current[i].annotationsFound?.length} annotations`);
            },
            exit => exit
        );
    }, []);

    const updateTooltips = useCallback(() => {
        clusterRef.current = clusterRef.current.filter(cluster => cluster.strokes.length > 0 && !(cluster.strokes.length === 1 && cluster.strokes[0].id === "initial"));
        // console.clear();
        // console.log(clusterRef.current);
        
        let width = d3.select(".react-pdf__Page__canvas").node()?.getBoundingClientRect().right;

        function processStrokeList(d) {
            if (clusterRef.current.length === 0) 
                return [];

            let idx = clusterRef.current.findIndex(cluster => {
                if (!cluster.strokes[cluster.strokes.length - 1]) 
                    return false;
                return cluster.strokes[cluster.strokes.length - 1].id === d;
            });

            if (idx === -1)
                return [];

            let strokeList = [];

            for (let i = 0; i < clusterRef.current[idx].strokes.length; i++) {
                let stroke = clusterRef.current[idx].strokes[i];
                let strokeID = stroke.id;
    
                if (strokeID !== "initial" && !d3.select(`path[id="${strokeID}"]`).empty()) {
                    let strokeColour = d3.select(`path[id="${strokeID}"]`).style("stroke");
                    strokeList.push({bbox: stroke.bbox, colour: strokeColour});
                }
            }
            if (strokeList.length === 0)
                return [];

            strokeList.sort((a, b) => a.bbox.y - b.bbox.y);

            let minY = strokeList[0].bbox.y;
            let maxY = strokeList[strokeList.length - 1].bbox.y + strokeList[strokeList.length - 1].bbox.height;
            
            for (let i = 0; i < strokeList.length; i++) {
                strokeList[i]["offset"] = (strokeList[i].bbox.y + strokeList[i].bbox.height / 2 - minY) / (maxY - minY) * 100;
                strokeList[i]["open"] = clusterRef.current[idx].open;
            }
            return strokeList;
        }
        clusterRef.current.sort((a, b) => a.lastestTimestamp - b.lastestTimestamp);
        
        for (let cluster of clusterRef.current) {
            if (!cluster.strokes[cluster.strokes.length - 1])
                continue;

            let lastStrokeBbox = cluster.strokes[cluster.strokes.length - 1].bbox;
            let y = (lastStrokeBbox.y + lastStrokeBbox.height / 2) * window.innerHeight - toolTipSize / 2;
            
            cluster["y"] = Math.min(y, ref.current.getBoundingClientRect().height - 200);
            cluster["x"] = width + 12;
        }
        
        for (let i = 0; i < clusterRef.current.length; i++) {
            for (let j = i + 1; j < clusterRef.current.length; j++) {
                if (clusterRef.current[i].y + toolTipSize > clusterRef.current[j].y && clusterRef.current[i].y < clusterRef.current[j].y + toolTipSize) {
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
        .data(clusterRef.current.map(d => d.strokes[d.strokes.length - 1].id), (d) => {
            return d;
        })
        .join(
            enter => {
                enter
                .append("linearGradient")
                .attr("class", "markerFillGradient")
                .attr("id", (d, i) => "markerFillGradient" + clusterRef.current[i].strokes[clusterRef.current[i].strokes.length - 1].id)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "0%")
                .attr("y2", "100%")
                .selectAll("stop")
                // .each(function(d, i) {
                //     index.set(this, i);
                // })
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
                update
                .attr("id", (d, i) => "markerFillGradient" + clusterRef.current[i].strokes[clusterRef.current[i].strokes.length - 1].id)
                .transition()
                .duration(1)
                .on("end", () => {
                    update
                    .selectAll("stop")
                    .data(processStrokeList)
                    .join(
                        enter => enter.append("stop")
                        .attr("offset", (d) => d.offset + "%")
                        .attr("stop-color", (d) => (d.open ? "rgb(255, 255, 255)" : d.colour)),
                        
                        update => update
                        .transition()
                        .duration(1000)
                        .attr("offset", (d) => d.offset + "%")
                        .attr("stop-color", (d) => (d.open ? "rgb(255, 255, 255)" : d.colour)),
                        
                        exit => exit
                        .transition()
                        .delay(1000)
                        .remove(),
                    );
                });
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
        .data(clusterRef.current.map(d => d.strokes[d.strokes.length - 1].id), (d) => {
            return d;
        })
        .join(
            enter => enter
            .append("linearGradient")
            .attr("class", "markerBorderGradient")
            .attr("id", (d, i) => "markerBorderGradient" + clusterRef.current[i].strokes[clusterRef.current[i].strokes.length - 1].id)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%")
            .selectAll("stop")
            .data(processStrokeList)
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
                update
                .transition()
                .delay(1000)
                .attr("id", (d, i) => "markerBorderGradient" + clusterRef.current[i].strokes[clusterRef.current[i].strokes.length - 1].id)
                .on("end", () =>
                    update
                    .selectAll("stop")
                    .data(processStrokeList)
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
                    )
                );
            },

            exit => exit
            .transition()
            .delay(1000)
            .remove(),
        );

        const index = d3.local();

        d3.select(ref.current)
        .selectAll("g.toolTip")
        .data(clusterRef.current.map(d => d.strokes[d.strokes.length - 1].id), (d) => {
            return d;
        })
        .join(
            enter => {
                let tooltip = enter
                .append("g")
                .attr("class", "toolTip")
                .classed("found", (d, i) => clusterRef.current[i].annotationsFound)
                .attr("id", (d, i) => "toolTip" + clusterRef.current[i].strokes[clusterRef.current[i].strokes.length - 1].id)
                .attr("opacity", 0);

                tooltip
                .append("rect")
                .attr("x", (d, i) => {
                    return clusterRef.current[i].x;
                })
                .attr("y", (d, i) => {
                    return clusterRef.current[i].y;
                })
                .attr("width", (d, i) => clusterRef.current[i].open ? window.innerWidth - width - 36 : toolTipSize)
                .attr("height", (d, i) => clusterRef.current[i].open ? 200 : toolTipSize)
                .attr("rx", toolTipSize / 2)
                .attr("fill", (d, i) => `url(#markerFillGradient${clusterRef.current[i].strokes[clusterRef.current[i].strokes.length - 1].id})`)
                .attr("fill-opacity", 0.5)
                .attr("stroke", (d, i) => `url(#markerBorderGradient${clusterRef.current[i].strokes[clusterRef.current[i].strokes.length - 1].id})`)
                .attr("stroke-opacity", (d, i) => clusterRef.current[i].open ? 0.5 : 0)
                .attr("stroke-width", 2)
                .attr("opacity", 1)
                .style("will-change", "width, height")
                .style("cursor", (d, i) => clusterRef.current[i].open ? "default" : "pointer")
                .call(() => 
                    tooltip
                    .transition()
                    .duration(1000)
                    .attr("opacity", 1)
                )
                .each(function(d, i) {
                    index.set(this, i);
                })
                .on("click", function() {
                    let i = index.get(this);
                    
                    if (clusterRef.current[i].open) {
                        return;
                    }
                    clusterRef.current[i].open = !clusterRef.current[i].open;

                    if (!clusterRef.current[i].open) {
                        d3.selectAll("path.lineDraw")
                        .transition()
                        .duration(1000)
                        .attr("opacity", 0.1);
                    
                        for (let stroke of clusterRef.current[i].strokes) {
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
                    } else {
                        for (let idx = 0; idx < clusterRef.current.length; idx++) {
                            if (idx !== i) {
                                clusterRef.current[idx].open = false;
                            }
                        }
                    }
                    updateTooltips(clusterRef.current);

                    let rect = d3.select(this)
                    .on("pointerover", null)
                    .on("pointerout", null)
                    .on("click", null)
                    .node();

                    d3.select(rect.closest("g")).raise();

                    if (clusterRef.current[i].open && !clusterRef.current[i].purpose && clusterRef.current[i].purpose !== false) {
                        clusterRef.current[i].purpose = false;
                        const cluster = clusterRef.current[i];
                        const startTimetamp = Date.now();

                        inferPurpose(clusterRef.current[i])
                        .then((response) => {
                            cluster.purpose = response.result;
                            // updateTooltips(clusters);
                            
                            if (onInference instanceof Function) {
                                onInference(startTimetamp, cluster, response.rawText, response.images);
                            }
                        });
                    }

                    if (onClick instanceof Function) {
                        onClick(clusterRef.current[i]);
                    }
                })
                .on("pointerover", function(d) {
                    let cluster = clusterRef.current[index.get(this)];

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
                .on("pointerout", function(d) {
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
                    let cluster = clusterRef.current[index.get(this)];

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
                .attr("cx", (d, i) => !clusterRef.current[i].open ? clusterRef.current[i].x + toolTipSize / 2 : window.innerWidth - 40)
                .attr("cy", (d, i) => clusterRef.current[i].y + 16)
                .attr("r", 12)
                .attr("fill", "#b8405e")
                .attr("opacity", (d, i) => clusterRef.current[i].open ? 1 : 0)
                .style("pointer-events", (d, i) => clusterRef.current[i].open ? "all" : "none")
                .style("cursor", "pointer")
                .each(function(d, i) {
                    index.set(this, i);
                })
                .on("click", function() {
                    let i = index.get(this);
                    clusterRef.current[i].open = false;
                    updateTooltips(clusterRef.current);

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
                .attr("x", (d, i) => !clusterRef.current[i].open ? clusterRef.current[i].x + toolTipSize / 2 : window.innerWidth - 40)
                .attr("y", (d, i) => clusterRef.current[i].y + 16)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "14px")
                .attr("fill", "white")
                .attr("opacity", (d, i) => clusterRef.current[i].open ? 1 : 0)
                .text("x")
                .style("font-family", "cursive")
                .style("pointer-events", "none");

                let spinner = d3.select(".comment-wrapper")
                .node();

                let spinnerBBox = spinner.getBBox();

                let padding = 12;
                let topPadding = 40;
                
                tooltip
                .append("g")
                .attr("class", "spinner")
                .append(() => spinner.cloneNode(true))
                .attr("x", (d, i) => {
                    return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2 - spinnerBBox.width / 2;
                })
                .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 90) - spinnerBBox.height / 2 - padding)
                .style("opacity", (d, i) => clusterRef.current[i].open && !clusterRef.current[i].purpose ? 1 : 0)
                .selectAll("*")
                .style("pointer-events", "none");

                tooltip
                .select("g.spinner")
                .each(function(d, i) {
                    index.set(this, i);
                })
                .selectAll("path")
                .attr("fill", function() {
                    let i = index.get(this);
                    return `url(#markerBorderGradient${clusterRef.current[i].strokes[clusterRef.current[i].strokes.length - 1].id})`;
                })
                .attr("fill-opacity", 0.5);
                
                for (let i = 0; i < 2; i++) {
                    for (let j = 0; j < 2; j++) {
                        tooltip
                        .append("rect")
                        .attr("id", i * 2 + j)
                        .attr("x", (d, k) => {
                            if (!clusterRef.current[k].open) {
                                return clusterRef.current[k].x;
                            }
                            let w = window.innerWidth - width - padding - 36;
                            return clusterRef.current[k].x + padding + (w / 2) * j;
                        })
                        .attr("y", (d, k) => {
                            if (!clusterRef.current[k].open) {
                                return clusterRef.current[k].y;
                            }
                            let height = 200 - padding - topPadding;
                            return clusterRef.current[k].y + padding + topPadding + (height / 2) * i;
                        })
                        .attr("width", (d, k) => {
                            if (!clusterRef.current[k].open) {
                                return toolTipSize;
                            }
                            let w = window.innerWidth - width - padding - 36;
                            return w / 2 - padding;
                        })
                        .attr("height", (d, k) => {
                            if (!clusterRef.current[k].open) {
                                return toolTipSize;
                            }
                            let height = 200 - padding - topPadding;
                            return height / 2 - padding;
                        })
                        .attr("fill", "white")
                        .attr("stroke", "black")
                        .attr("rx", 6)
                        .attr("opacity", (d, k) => clusterRef.current[k].open && clusterRef.current[k].annotating === undefined ? 1 : 0)
                        .style("cursor", "pointer")
                        .style("pointer-events", (d, k) => clusterRef.current[k].open && clusterRef.current[k].purpose && clusterRef.current[k].annotating === undefined ? "all" : "none")
                        .each(function(d, k) {
                            index.set(this, k);
                        })
                        .on("pointerover", function() {
                            let k = index.get(this);
                            let cluster = clusterRef.current[k];

                            if (cluster.purpose) {
                                let content = <div className={googleSans.className} style={{ maxWidth: "300px", userSelect: "none", fontSize: "15px", letterSpacing: "0.2px", lineHeight: "22px", fontWeight: "400", color: "#E8EDED" }}>
                                    {cluster.purpose.purpose[i * 2 + j]?.purpose}
                                </div>;

                                clearTimeout(openTimeout.current);

                                if (toolTipRef.current?.isOpen) {
                                    clearTimeout(closeTimeout.current);

                                    toolTipRef.current?.open({
                                        anchorSelect : "#toolTip" + cluster.strokes[cluster.strokes.length - 1].id,
                                        content: content
                                    });
                                } else {
                                    openTimeout.current = setTimeout(() => {
                                        toolTipRef.current?.open({
                                            anchorSelect : "#toolTip" + cluster.strokes[cluster.strokes.length - 1].id,
                                            content: content
                                        });
                                    }, 1000);
                                }
                            }
                        })
                        .on("pointerout", function() {
                            clearTimeout(closeTimeout.current);

                            if (toolTipRef.current?.isOpen) {
                                closeTimeout.current = setTimeout(() => {
                                    toolTipRef.current?.close();
                                }, 500);
                            } else {
                                clearTimeout(openTimeout.current);
                            }
                        })
                        .on("click", function() {
                            let k = index.get(this);
                            clusterRef.current[k].annotating = true;
                            clusterRef.current[k].searching = clusterRef.current[k].purpose.purpose[i * 2 + j];
                            clusterRef.current[k].annotationsFound = [];
                            const cluster = clusterRef.current[k];
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
                                updateTooltips(clusterRef.current);

                                if (onEndAnnotate instanceof Function) {
                                    onEndAnnotate(startTimetamp, cluster, rawText);
                                }
                            };

                            if (setUpAnnotations instanceof Function) {
                                setUpAnnotations(clusterRef.current[k].purpose.annotationDescription, clusterRef.current[k].searching.purposeTitle, clusterRef.current[k].searching.purpose, onDetect, onEnd, penAnnnotationRef);
                            }

                            sendHistory({
                                purpose: cluster.searching.purpose,
                                purposeTitle: cluster.searching.purposeTitle,
                                annotationDescription: cluster.purpose.annotationDescription,
                                action: "update"
                            });

                            updateTooltips(clusterRef.current);
                            toolTipRef.current?.close();
                        });

                        tooltip
                        .append("text")
                        .attr("id", i * 2 + j)
                        .attr("x", (d, k) => {
                            let w = window.innerWidth - width - padding - 36;
                            return clusterRef.current[k].x + padding + (w / 2) * j + (w / 2 - padding) / 2;
                        })
                        .attr("y", (d, k) => {
                            let height = 200 - padding - topPadding;
                            return clusterRef.current[k].y + padding + topPadding + (height / 2) * i + (height / 2 - padding) / 2;
                        })
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("font-size", "14px")
                        .attr("fill", "black")
                        .style("font-family", "cursive")
                        .style("pointer-events", "none")
                        .text((d, k) =>{
                            if (!clusterRef.current[k].purpose) {
                                return "";
                            }
                            return clusterRef.current[k].purpose.purpose[i * 2 + j]?.purposeTitle;
                        })
                        .call(wrap)
                        .transition()
                        .duration(1000)
                        .attr("opacity", (d, k) => clusterRef.current[k].open && clusterRef.current[k].purpose && clusterRef.current[k].annotating === undefined ? 1 : 0);
                    }
                }

                tooltip
                .append("foreignObject")
                .attr("class", "input-wrapper")
                .attr("x", (d, i) => clusterRef.current[i].x + toolTipSize / 2)
                .attr("y", (d, i) => clusterRef.current[i].y + toolTipSize / 2)
                .attr("width", (d, i) => clusterRef.current[i].open ? window.innerWidth - width - padding * 3 - 52 : toolTipSize)
                .attr("height", topPadding - padding + 2)
                .style("opacity", (d, i) => clusterRef.current[i].open && clusterRef.current[i].purpose && clusterRef.current[i].annotating === undefined ? 1 : 0)
                .style("pointer-events", (d, i) => clusterRef.current[i].open && clusterRef.current[i].purpose && clusterRef.current[i].annotating === undefined ? "all" : "none")
                .append("xhtml:div")
                .style("width", "100%")
                .style("height", "100%")
                .style("pointer-events", (d, i) => clusterRef.current[i].open && clusterRef.current[i].purpose && clusterRef.current[i].annotating === undefined === undefined ? "all" : "none")
                .append("input")
                .attr("type", "text")
                .attr("placeholder", "Why did you annotate this?")
                .style("float", "inline-start")
                .style("border", "1px solid black")
                .style("border-radius", "6px")
                .style("height", "100%")
                .style("font-family", "cursive")
                .style("padding-left", "6px")
                .style("pointer-events", (d, i) => clusterRef.current[i].open && clusterRef.current[i].purpose && clusterRef.current[i].annotating === undefined ? "all" : "none")
                .each(function(d, i) {
                    index.set(this, i);
                })
                .on("keyup", function(e) {
                    if (e.key === "Enter" && this.value !== "") {
                        let i = index.get(this);
                        clusterRef.current[i].annotating = true;
                        clusterRef.current[i].searching = {
                            annotationDescription: clusterRef.current[i].purpose?.annotationDescription,
                            purposeTitle: this.value,
                            purpose: ""
                        };
                        clusterRef.current[i].annotationsFound = [];
                        const cluster = clusterRef.current[i];
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
                            updateTooltips(clusterRef.current);

                            if (onEndAnnotate instanceof Function) {
                                onEndAnnotate(startTimetamp, cluster, rawText);
                            }
                        };

                        if (setUpAnnotations instanceof Function) {
                            setUpAnnotations(clusterRef.current[i].purpose?.annotationDescription, `But the user has said: "${this.value}"`, "", onDetect, onEnd, penAnnnotationRef);
                        }

                        sendHistory({
                            purpose: "",
                            purposeTitle: this.value,
                            annotationDescription: cluster.purpose?.annotationDescription,
                            action: "update"
                        });

                        updateTooltips(clusterRef.current);
                    }
                });

                let glass = d3.select(".glass-wrapper")
                .node();

                let glassBBox = glass.getBBox();
                
                tooltip
                .append("g")
                .attr("class", "glass")
                .append(() => glass.cloneNode(true))
                .attr("x", (d, i) => {
                    return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2 - glassBBox.width / 2;
                })
                .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 140) - glassBBox.height / 2 - padding)
                .style("opacity", (d, i) => clusterRef.current[i].open && clusterRef.current[i].annotating ? 1 : 0)
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
                .style("opacity", (d, i) => clusterRef.current[i].open && clusterRef.current[i].purpose && (clusterRef.current[i].annotating || clusterRef.current[i].annotating === false) ? 1 : 0);

                annotateStatus
                .append("tspan")
                .classed("lookingFor1", true)
                .attr("x", (d, i) => {
                    return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2;
                })
                .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 10))
                .attr("dy", "0em")
                .text((d, i) => (clusterRef.current[i].annotating === false) ? `Done annotating for` : `Annotating for`)
                .style("pointer-events", "none");

                annotateStatus
                .append("tspan")
                .classed("lookingFor2", true)
                .attr("x", (d, i) => {
                    return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2;
                })
                .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 10))
                .attr("dy", "1.2em")
                .text((d, i) => `"${clusterRef.current[i].searching?.purposeTitle}"`)
                .style("pointer-events", "none");

                annotateStatus
                .append("tspan")
                .classed("annotationFound", true)
                .attr("x", (d, i) => {
                    return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2;
                })
                .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 10))
                .attr("dy", "3em")
                .text((d, i) => `Found ${clusterRef.current[i].annotationsFound?.length} annotations`)
                .style("pointer-events", "none");

                annotateStatus
                .append("tspan")
                .classed("navagation", true)
                .attr("x", (d, i) => {
                    return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2;
                })
                .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 10))
                .attr("dy", "8em")
                .style("font-style", "italic")
                .text("Use the arrows on the left to navigate annotations")
                .style("pointer-events", "none")
                .style("opacity", (d, i) => clusterRef.current[i].open && clusterRef.current[i].purpose && clusterRef.current[i].annotating === false ? 1 : 0)
                .call(wrap, window.innerWidth - width - 36);

                tooltip
                .append("text")
                .classed("annotationCount", true)
                .attr("x", (d, i) => {
                    return clusterRef.current[i].x + toolTipSize / 2;
                })
                .attr("y", (d, i) => clusterRef.current[i].y + toolTipSize / 2 + 1)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "14px")
                .attr("fill", "white")
                .style("font-family", "cursive")
                .style("pointer-events", "none")
                .text((d, i) => clusterRef.current[i].annotationsFound?.length);
            },

            update => {
                update
                .transition()
                .duration(1)
                .on("end", () => {
                    let padding = 12;
                    let topPadding = 40;

                    update
                    .select(".annotationCount")
                    .transition()
                    .duration(1000)
                    .attr("x", (d, i) => {
                        return clusterRef.current[i].x + toolTipSize / 2;
                    })
                    .attr("y", (d, i) => clusterRef.current[i].y + toolTipSize / 2 + 1)
                    .style("opacity", (d, i) => ((clusterRef.current[i].annotating || clusterRef.current[i].annotating === false) && !clusterRef.current[i].open) ? 1 : 0)
                    .text((d, i) => clusterRef.current[i].annotationsFound?.length);

                    let annotationStatus = update
                    .select("text.annotateStatus");

                    annotationStatus
                    .transition()
                    .duration((d, i) => clusterRef.current[i].open ? 1000 : 500)
                    .delay((d, i) => clusterRef.current[i].open ? 500 : 0)
                    .style("opacity", (d, i) => clusterRef.current[i].open && clusterRef.current[i].purpose && (clusterRef.current[i].annotating || clusterRef.current[i].annotating === false) ? 1 : 0)
                    .each(function(d, i) {
                        index.set(this, i);
                    });

                    annotationStatus
                    .selectAll("tspan")
                    .attr("x", function() {
                        let i = index.get(this);
                        return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2;
                    })
                    .attr("y", function() {
                        let i = index.get(this);
                        return (clusterRef.current[i].y + 16 + 10);
                    });

                    annotationStatus
                    .select("tspan.lookingFor1")
                    .transition()
                    .duration(1000)
                    .attr("x", (d, i) => {
                        return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2;
                    })
                    .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 10))
                    .text((d, i) => (clusterRef.current[i].annotating === false) ? `Done annotating for` : `Annotating for`);

                    annotationStatus
                    .select("tspan.lookingFor2")
                    .text((d, i) => `"${clusterRef.current[i].searching?.purposeTitle}"`)
                    .transition()
                    .duration(1000)
                    .attr("x", (d, i) => {
                        return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2;
                    })
                    .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 10));

                    annotationStatus
                    .select("tspan.annotationFound")
                    .transition()
                    .duration(1000)
                    .attr("x", (d, i) => {
                        return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2;
                    })
                    .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 10))
                    .text((d, i) => `Found ${clusterRef.current[i].annotationsFound?.length} annotations`);

                    annotationStatus
                    .select("tspan.navagation")
                    .attr("x", (d, i) => {
                        return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2;
                    })
                    .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 10))
                    .transition()
                    .duration((d, k) => clusterRef.current[k].open ? 1000 : 500)
                    .delay((d, k) => clusterRef.current[k].open ? 500 : 0)
                    .style("opacity", (d, i) => clusterRef.current[i].open && clusterRef.current[i].purpose && clusterRef.current[i].annotating === false ? 1 : 0);

                    let glass = d3.select(".glass-wrapper")
                    .node();

                    let glassBBox = glass.getBBox();

                    update
                    .select("g.glass")
                    .select("svg")
                    .transition()
                    .duration((d, k) => clusterRef.current[k].open ? 1000 : 500)
                    .delay((d, k) => clusterRef.current[k].open ? 500 : 0)
                    .attr("x", (d, i) => {
                        return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2 - glassBBox.width / 2;
                    })
                    .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 140) - glassBBox.height / 2 - padding)
                    .style("opacity", (d, i) => clusterRef.current[i].open && clusterRef.current[i].annotating ? 1 : 0);

                    update
                    .select("foreignObject.input-wrapper")
                    .style("pointer-events", (d, i) => clusterRef.current[i].open && clusterRef.current[i].purpose && clusterRef.current[i].annotating === undefined ? "all" : "none")
                    .transition()
                    .duration(1000)
                    .attr("x", (d, i) => clusterRef.current[i].open ? clusterRef.current[i].x + padding : clusterRef.current[i].x)
                    .attr("y", (d, i) => clusterRef.current[i].open ? clusterRef.current[i].y + padding : clusterRef.current[i].y)
                    .attr("width", (d, i) => clusterRef.current[i].open ? window.innerWidth - width - padding * 3 - 52 : toolTipSize)
                    .attr("height", topPadding - padding + 2)
                    .style("opacity", (d, i) => clusterRef.current[i].open && clusterRef.current[i].purpose && clusterRef.current[i].annotating === undefined ? 1 : 0)
                    .each(function(d, i) {
                        index.set(this, i);
                    })
                    .selectAll("*")
                    .style("pointer-events", function() {
                        let i = index.get(this);

                        return clusterRef.current[i].open && clusterRef.current[i].purpose && clusterRef.current[i].annotating === undefined ? "all" : "none";
                    });

                    update
                    .select("foreignObject.input-wrapper")
                    .select("input")
                    .on("keyup", function(e) {
                        if (e.key === "Enter" && this.value !== "") {
                            let i = index.get(this);
                            clusterRef.current[i].annotating = true;
                            clusterRef.current[i].searching = {
                                annotationDescription: clusterRef.current[i].purpose?.annotationDescription,
                                purposeTitle: this.value,
                                purpose: ""
                            };
                            clusterRef.current[i].annotationsFound = [];
                            const cluster = clusterRef.current[i];
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
                                updateTooltips(clusterRef.current);

                                if (onEndAnnotate instanceof Function) {
                                    onEndAnnotate(startTimetamp, cluster, rawText);
                                }
                            };

                            if (setUpAnnotations instanceof Function) {
                                setUpAnnotations(clusterRef.current[i].purpose?.annotationDescription, `But the user has said: "${this.value}"`, "", onDetect, onEnd, penAnnnotationRef);
                            }

                            sendHistory({
                                purpose: "",
                                purposeTitle: this.value,
                                annotationDescription: cluster.purpose?.annotationDescription,
                                action: "update"
                            });

                            updateTooltips(clusterRef.current);
                        }
                    });

                    let spinner = d3.select(".comment-wrapper")
                    .node();

                    let spinnerBBox = spinner.getBBox();
                    
                    for (let i = 0; i < 2; i++) {
                        for (let j = 0; j < 2; j++) {
                            update
                            .select(`rect[id="${i * 2 + j}"]`)
                            .style("cursor", (d, k) => clusterRef.current[k].open ? "pointer" : "default")
                            .style("pointer-events", "none")
                            .each(function(d, k) {
                                index.set(this, k);
                            })
                            .on("pointerover", function() {
                                let k = index.get(this);
                                let cluster = clusterRef.current[k];

                                if (cluster?.purpose) {
                                    let content = <div className={googleSans.className} style={{ maxWidth: "300px", userSelect: "none", fontSize: "15px", letterSpacing: "0.2px", lineHeight: "22px", fontWeight: "400", color: "#E8EDED" }}>
                                        {cluster.purpose.purpose[i * 2 + j]?.purpose}
                                    </div>;
                                    
                                    clearTimeout(openTimeout.current);
                                    
                                    if (toolTipRef.current?.isOpen) {
                                        clearTimeout(closeTimeout.current);

                                        toolTipRef.current?.open({
                                            anchorSelect : "#toolTip" + cluster.strokes[cluster.strokes.length - 1].id,
                                            content: content
                                        });
                                    } else {
                                        openTimeout.current = setTimeout(() => {
                                            toolTipRef.current?.open({
                                                anchorSelect : "#toolTip" + cluster.strokes[cluster.strokes.length - 1].id,
                                                content: content
                                            });
                                        }, 1000);
                                    }
                                }
                            })
                            .on("pointerout", function() {
                                clearTimeout(closeTimeout.current);

                                if (toolTipRef.current?.isOpen) {
                                    closeTimeout.current = setTimeout(() => {
                                        toolTipRef.current?.close();
                                    }, 500);
                                } else {
                                    clearTimeout(openTimeout.current);
                                }
                            })
                            .on("click", function() {
                                let k = index.get(this);
                                clusterRef.current[k].annotating = true;
                                clusterRef.current[k].searching = clusterRef.current[k].purpose?.purpose[i * 2 + j];
                                clusterRef.current[k].annotationsFound = [];
                                const cluster = clusterRef.current[k];
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
                                    updateTooltips(clusterRef.current);

                                    if (onEndAnnotate instanceof Function) {
                                        onEndAnnotate(startTimetamp, cluster, rawText);
                                    }
                                };

                                if (setUpAnnotations instanceof Function) {
                                    setUpAnnotations(clusterRef.current[k].purpose.annotationDescription, clusterRef.current[k].searching.purposeTitle, clusterRef.current[k].searching.purpose, onDetect, onEnd, penAnnnotationRef);
                                }

                                sendHistory({
                                    purpose: cluster.searching.purpose,
                                    purposeTitle: cluster.searching.purposeTitle,
                                    annotationDescription: cluster.purpose.annotationDescription,
                                    action: "update"
                                });

                                updateTooltips(clusterRef.current);
                                toolTipRef.current?.close();
                            })
                            .transition()
                            .duration(1000)
                            .attr("x", (d, k) => {
                                if (!clusterRef.current[k].open) {
                                    return clusterRef.current[k].x;
                                }
                                let w = window.innerWidth - width - padding - 36;
                                return clusterRef.current[k].x + padding + (w / 2) * j;
                            })
                            .attr("y", (d, k) => {
                                if (!clusterRef.current[k].open) {
                                    return clusterRef.current[k].y;
                                }
                                let height = 200 - padding - topPadding;
                                return clusterRef.current[k].y + padding + topPadding + (height / 2) * i;
                            })
                            .attr("width", (d, k) => {
                                if (!clusterRef.current[k].open) {
                                    return toolTipSize;
                                }
                                let w = window.innerWidth - width - padding - 36;
                                return w / 2 - padding;
                            })
                            .attr("height", (d, k) => {
                                if (!clusterRef.current[k].open) {
                                    return toolTipSize;
                                }
                                let height = 200 - padding - topPadding;
                                return height / 2 - padding;
                            })
                            .attr("opacity", (d, k) => clusterRef.current[k].open && clusterRef.current[k].purpose && clusterRef.current[k].annotating === undefined ? 1 : 0)
                            .each(function(d, k) {
                                index.set(this, k);
                            })
                            .on("end", function() {
                                let k = index.get(this);

                                if (clusterRef.current[k])
                                    d3.select(this)
                                    .style("pointer-events", clusterRef.current[k].open && clusterRef.current[k].purpose && clusterRef.current[k].annotating === undefined ? "all" : "none");
                            });

                            update
                            .select(`text[id="${i * 2 + j}"]`)
                            .text((d, k) =>{
                                if (!clusterRef.current[k].purpose) {
                                    return "";
                                }
                                return clusterRef.current[k].purpose.purpose[i * 2 + j]?.purposeTitle;
                            })
                            .attr("x", (d, k) => {
                                let w = window.innerWidth - width - padding - 36;
                                return clusterRef.current[k].x + padding + (w / 2) * j + (w / 2 - padding) / 2;
                            })
                            .attr("y", (d, k) => {
                                let height = 200 - padding - topPadding;
                                return clusterRef.current[k].y + padding + topPadding + (height / 2) * i + (height / 2 - padding) / 2;
                            })
                            .call(wrap)
                            .transition()
                            .duration((d, k) => clusterRef.current[k].open ? 1000 : 500)
                            .delay((d, k) => clusterRef.current[k].open && clusterRef.current[k].annotating === undefined ? 500 : 0)
                            .attr("opacity", (d, k) => clusterRef.current[k].open && clusterRef.current[k].purpose && clusterRef.current[k].annotating === undefined ? 1 : 0);
                        }
                    }

                    update
                    .select("g.spinner")
                    .select("svg")
                    .transition()
                    .duration((d, k) => clusterRef.current[k].open ? 1000 : 500)
                    .delay((d, k) => clusterRef.current[k].open && clusterRef.current[k].annotating === undefined && !clusterRef.current[k].purpose ? 500 : 0)
                    .attr("x", (d, i) => {
                        return clusterRef.current[i].x + (window.innerWidth - width - 36) / 2 - spinnerBBox.width / 2;
                    })
                    .attr("y", (d, i) => (clusterRef.current[i].y + 16 + 90) - spinnerBBox.height / 2 - padding)
                    .style("opacity", (d, i) => clusterRef.current[i].open && !clusterRef.current[i].purpose ? 1 : 0);

                    update
                    .select("circle")
                    .style("pointer-events", (d, i) => clusterRef.current[i].open ? "all" : "none")
                    .each(function(d, i) {
                        index.set(this, i);
                    })
                    .on("click", function(e) {
                        let i = index.get(this);
                        clusterRef.current[i].open = false;
                        updateTooltips(clusterRef.current);

                        d3.selectAll("path.lineDraw")
                        .transition()
                        .duration(1000)
                        .attr("opacity", 1);

                        if (onNewActiveCluster instanceof Function) {
                            onNewActiveCluster(null);
                        }
                        clearTimeout(openTimeout.current);
                        toolTipRef.current?.close();
                    })
                    .transition()
                    .duration((d, i) => 1000)
                    .attr("cx", (d, i) => !clusterRef.current[i].open ? clusterRef.current[i].x + padding : window.innerWidth - 40)
                    .attr("cy", (d, i) => clusterRef.current[i].y + 16)
                    .attr("opacity", (d, i) => clusterRef.current[i].open ? 1 : 0);

                    update
                    .select("text")
                    .each(function(d, i) {
                        index.set(this, i);
                    })
                    .transition()
                    .duration((d, i) => 1000)
                    .attr("x", (d, i) => !clusterRef.current[i].open ? clusterRef.current[i].x + padding : window.innerWidth - 40)
                    .attr("y", (d, i) => clusterRef.current[i].y + 16)
                    .attr("opacity", (d, i) => clusterRef.current[i].open ? 1 : 0);

                    update
                    .select("rect")
                    .each(function(d, i) {
                        index.set(this, i);
                    })
                    .style("cursor", (d, i) => clusterRef.current[i].open ? "default" : "pointer")
                    .call(update => 
                        update
                        .transition()
                        .duration(1000)
                        .attr("x", (d, i) => clusterRef.current[i].x)
                        .attr("y", (d, i) => clusterRef.current[i].y)
                        .attr("width", (d, i) => clusterRef.current[i].open ? window.innerWidth - width - 36 : toolTipSize)
                        .attr("height", (d, i) => clusterRef.current[i].open ? 200 : toolTipSize)
                        .attr("fill-opacity", 0.5)
                        .attr("stroke-opacity", (d, i) => clusterRef.current[i].open ? 0.5 : 0)
                        .attr("opacity", 1)
                        // .style("pointer-events", "none")
                        .on("end", function(d, i) {
                            if (!clusterRef.current[i] || !clusterRef.current[i].strokes[clusterRef.current[i].strokes.length - 1])
                                return;

                            if (clusterRef.current[i].open) {
                                d3.select(this)
                                .on("click", null)
                                .on("pointerover", null)
                                .on("pointerout", null);
                            } else {
                                clearTimeout(openTimeout.current);
                                toolTipRef.current?.close();

                                d3.select(this)
                                .on("pointerover", function(d) {
                                    let cluster = clusterRef.current[index.get(this)];

                                    d3.selectAll("path.lineDraw")
                                    .transition()
                                    .duration(1000)
                                    .attr("opacity", 0.1);
                                    
                                    if (cluster.strokes) {
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
                                .on("pointerout", function(d) {
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
                                    let cluster = clusterRef.current[index.get(this)];

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
                                    let i = index.get(this);
                
                                    if (clusterRef.current[i].open) {
                                        return;
                                    }
                                    clusterRef.current[i].open = !clusterRef.current[i].open;
                
                                    if (!clusterRef.current[i].open) {
                                        let cluster = clusterRef.current[i];
                
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
                                    } else {
                                        for (let idx = 0; idx < clusterRef.current.length; idx++) {
                                            if (idx !== i) {
                                                clusterRef.current[idx].open = false;
                                            }
                                        }
                                    }
                                    updateTooltips(clusterRef.current);
                
                                    let rect = d3.select(this)
                                    .on("pointerover", null)
                                    .on("pointerout", null)
                                    .node();
                
                                    d3.select(rect.closest("g")).raise();
                
                                    if (clusterRef.current[i].open && !clusterRef.current[i].purpose && clusterRef.current[i].purpose !== false) {
                                        clusterRef.current[i].purpose = false;
                                        const cluster = clusterRef.current[i];
                                        const startTimetamp = Date.now();
                                        
                                        inferPurpose(clusterRef.current[i])
                                        .then((response) => {
                                            cluster.purpose = response.result;
                                            // updateTooltips(clusters);
                                            
                                            if (onInference instanceof Function) {
                                                onInference(startTimetamp, cluster, response.rawText, response.images);
                                            }
                                        });
                                    }
                                    if (onClick instanceof Function) {
                                        onClick(clusterRef.current[i]);
                                    }
                                });
                            }

                            d3.select(this)
                            .style("pointer-events", "all")
                            .attr("fill", (d) => `url(#markerFillGradient${clusterRef.current[i].strokes[clusterRef.current[i].strokes.length - 1].id})`)
                            .attr("stroke", (d) => `url(#markerBorderGradient${clusterRef.current[i].strokes[clusterRef.current[i].strokes.length - 1].id})`)
                            .attr("rx", toolTipSize / 2)
                            .transition()
                            .duration(1000)
                            .attr("opacity", 1);
                        })
                    );

                    update
                    .classed("found", (d, i) => clusterRef.current[i].annotationsFound)
                    .transition()
                    .duration(1000)
                    .attr("opacity", 1);
                });
            },

            exit => exit
            .call(exit =>
                exit
                .on("click", null)
                .style("cursor", "default")
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
    }, [onClick, inferPurpose, onInference, onNewActiveCluster, toolTipRef, setUpAnnotations, sendHistory, updateTextTooltips, onClusterChange, onEndAnnotate, penAnnnotationRef]);

    useEffect(() => {
        if (clusters) {
            for (let cluster of clusters) {
                if (cluster["open"] === undefined)
                    cluster["open"] = false;
            }
            clusterRef.current = clusters.filter(cluster => !cluster.disabled || cluster.annotationsFound);

            for (let cluster of clusterRef.current) {
                if (cluster.annotationsFound) {
                    cluster.annotationsFound = cluster.annotationsFound.filter(annotation => annotation.accepted !== false);
                }
            }
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