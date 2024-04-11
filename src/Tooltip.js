import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

// use vite
import { createContext, destroyContext, domToCanvas } from 'modern-screenshot';

export default function Tooltip({ clusters, onClick, index }) {
    let ref = useRef(null);

    const inferPurpose = useCallback(async (lastCluster, bbox) => {
        let annotationPage = d3.select("#layer-" + index).node().cloneNode(true);
        let page = d3.select(".react-pdf__Page.page-" + index).node().cloneNode();
        let canvasPage = d3.select(".react-pdf__Page.page-" + index).select("canvas").node().cloneNode();
        let container = d3.select(".screenshot-container").html("").node();

        d3.select(annotationPage)
        .select("#toolTipcanvas")
        .remove();

        d3.select(annotationPage)
        .selectAll("path")
        .attr("filter", null);
        
        container.appendChild(page);
        container.appendChild(annotationPage);
        d3.select(page).append(() => canvasPage);

        let context = d3.select(container).select("canvas").node().getContext("2d");

        d3.select(annotationPage)
        .style("position", "absolute")
        .style("top", index === 1 ? "0" : "-10px")
        .style("left", "6px");

        context.drawImage(d3.select(".react-pdf__Page.page-" + index).select("canvas").node(), 0, 0);

        let ids = lastCluster.strokes.map(stroke => stroke.id);

        const createC1 = createContext(container, {
            workerUrl: "./Worker.js",
            workerNumber: 1,
            filter: (node) => {
                if (node.tagName === "path")
                    return ids.includes(node.id);
                return true;
            }
        });

        const createC2 = createContext(container, {
            workerUrl: "./Worker.js",
            workerNumber: 1,
        });

        let contexts = await Promise.all([createC1, createC2]);
        let [c1, c2] = contexts;

        domToCanvas(c1).then(canvas => {
            // d3.selectAll(".screenshot-container").remove();
            let dataUrl = canvas.toDataURL('image/png');
            // console.log(dataUrl);

            if (dataUrl) {
                let img = new Image();
                img.src = dataUrl;

                let startX = bbox.x1 * window.innerWidth - 50;
                let startY = bbox.y1 * window.innerHeight - 50;
                let cropWidth = (bbox.x2 - bbox.x1) * window.innerWidth + 100;
                let cropHeight = (bbox.y2 - bbox.y1) * window.innerHeight + 100;

                img.onload = function () {
                    let canvas = document.createElement('canvas');
                    canvas.width = cropWidth * window.devicePixelRatio;
                    canvas.height = cropHeight * window.devicePixelRatio;

                    let ctx = canvas.getContext('2d');
                    ctx.drawImage(img, startX * window.devicePixelRatio, startY * window.devicePixelRatio, cropWidth * window.devicePixelRatio, cropHeight * window.devicePixelRatio, 0, 0, cropWidth * window.devicePixelRatio, cropHeight * window.devicePixelRatio);

                    // let croppedBase64 = canvas.toDataURL('image/png');
                    // console.log(croppedBase64);
                };
            }
            destroyContext(c1);
        });

        domToCanvas(c2).then(dataUrl => {
            // console.log(dataUrl.toDataURL('image/png'));
            destroyContext(c2);
        });
    }, [index]);

    const updateTooltips = useCallback((clusters) => {
        clusters = clusters.filter(cluster => cluster.strokes.length > 0 && !(cluster.strokes.length === 1 && cluster.strokes[0].id === "initial"));
        // console.clear();
        console.log(clusters);

        function processStrokeList(d) {
            if (clusters.length === 0) 
                return [];

            let idx = clusters.findIndex(cluster => {
                if (!cluster.strokes[cluster.strokes.length - 1]) 
                    return false;
                return cluster.strokes[cluster.strokes.length - 1].id === d;
            });

            if (idx === -1)
                return [];

            let strokeList = [];

            for (let i = 0; i < clusters[idx].strokes.length; i++) {
                let stroke = clusters[idx].strokes[i];
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
                strokeList[i]["open"] = clusters[idx].open;
            }
            return strokeList;
        }
        clusters.sort((a, b) => a.lastestTimestamp - b.lastestTimestamp);
        
        for (let cluster of clusters) {
            if (!cluster.strokes[cluster.strokes.length - 1])
                continue;

            let lastStrokeBbox = cluster.strokes[cluster.strokes.length - 1].bbox;
            let y = (lastStrokeBbox.y + lastStrokeBbox.height / 2) * window.innerHeight - 12;
            
            cluster["y"] = Math.min(y, ref.current.getBoundingClientRect().height - 200);
            cluster["x"] = d3.select(".react-pdf__Page__canvas").node().getBoundingClientRect().right + 12;
        }
        
        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                if (clusters[i].y + 24 > clusters[j].y && clusters[i].y < clusters[j].y + 24) {
                    clusters[j].y = clusters[i].y + 26;
                }
            }
        }

        for (let i = 0; i < clusters.length; i++) {
            if (clusters[i].y + 200 > ref.current.getBoundingClientRect().height) {
                let offset = clusters[i].y + 200 - ref.current.getBoundingClientRect().height;
                clusters[i].y -= offset;
                
                for (let j = clusters.length - 1; j >= 0; j--) {
                    for (let k = clusters.length - 1; k >= 0; k--) {
                        if (j !== k && clusters[j].y + 24 > clusters[k].y && clusters[j].y < clusters[k].y + 24) {
                            clusters[k].y = clusters[j].y - 26;
                            k--;
                        }
                    }
                }
            }
        }

        for (let cluster of clusters) {
            if (!cluster.strokes[cluster.strokes.length - 1])
                return;
        }

        d3.select(ref.current)
        .select("defs")
        .selectAll("linearGradient.markerFillGradient")
        .data(clusters.map(d => d.strokes[d.strokes.length - 1].id), (d) => {
            return d;
        })
        .join(
            enter => {
                enter
                .append("linearGradient")
                .attr("class", "markerFillGradient")
                .attr("id", (d, i) => "markerFillGradient" + clusters[i].strokes[clusters[i].strokes.length - 1].id)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "0%")
                .attr("y2", "100%")
                .selectAll("stop")
                .each(function(d, i) {
                    index.set(this, i);
                })
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
                    .delay(500)
                    .remove(),
                );
            },

            update => {                
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
                    .delay(500)
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
        //     let bboxMidY =  (lastStrokeBbox.y + lastStrokeBbox.height / 2) * window.innerHeight;
            
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
        .data(clusters.map(d => d.strokes[d.strokes.length - 1].id), (d) => {
            return d;
        })
        .join(
            enter => enter
            .append("linearGradient")
            .attr("class", "markerBorderGradient")
            .attr("id", (d, i) => "markerBorderGradient" + clusters[i].strokes[clusters[i].strokes.length - 1].id)
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

                exit => exit.remove(),
            ),

            update => {
                update
                .transition()
                .delay(1000)
                .attr("id", (d, i) => "markerBorderGradient" + clusters[i].strokes[clusters[i].strokes.length - 1].id)
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

                        exit => exit.remove(),
                    )
                );
            },

            exit => exit
            .transition()
            .duration(1000)
            .remove(),
        );

        const index = d3.local();

        d3.select(ref.current)
        .selectAll("g.toolTip")
        .data(clusters.map(d => d.strokes[d.strokes.length - 1].id), (d) => {
            return d;
        })
        .join(
            enter => {
                let tooltip = enter
                .append("g")
                .attr("class", "toolTip")
                .attr("opacity", 0);

                tooltip
                .append("rect")
                .attr("x", (d, i) => {
                    return clusters[i].x;
                })
                .attr("y", (d, i) => {
                    return clusters[i].y;
                })
                .attr("width", (d, i) => clusters[i].open ? window.innerWidth - d3.select(".react-pdf__Page__canvas").node().getBoundingClientRect().right - 36 : 24)
                .attr("height", (d, i) => clusters[i].open ? 200 : 24)
                .attr("rx", 12)
                .attr("fill", (d, i) => `url(#markerFillGradient${clusters[i].strokes[clusters[i].strokes.length - 1].id})`)
                .attr("fill-opacity", 0.5)
                .attr("stroke", (d, i) => `url(#markerBorderGradient${clusters[i].strokes[clusters[i].strokes.length - 1].id})`)
                .attr("stroke-opacity", 0)
                .attr("stroke-width", 2)
                .attr("opacity", 1)
                .style("will-change", "width, height")
                .style("cursor", (d, i) => clusters[i].open ? "default" : "pointer")
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
                    
                    if (clusters[i].open) {
                        return;
                    }
                    clusters[i].open = !clusters[i].open;

                    if (!clusters[i].open) {
                        d3.selectAll("path.lineDraw")
                        .transition()
                        .duration(1000)
                        .attr("opacity", 0.1);
                    
                        for (let stroke of clusters[i].strokes) {
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
                        for (let idx = 0; idx < clusters.length; idx++) {
                            if (idx !== i) {
                                clusters[idx].open = false;
                            }
                        }
                    }
                    updateTooltips(clusters);

                    let rect = d3.select(this)
                    .on("pointerover", null)
                    .on("pointerout", null)
                    .node();

                    d3.select(rect.closest("g")).raise();

                    if (clusters[i].open) {
                        let bbox = {x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity};

                        for (let stroke of clusters[i].strokes) {
                            if (stroke.id !== "initial") {
                                let bb = stroke.bbox;
                                bbox.x1 = Math.min(bb.x, bbox.x1);
                                bbox.y1 = Math.min(bb.y, bbox.y1);
                                bbox.x2 = Math.max(bb.x + bb.width, bbox.x2);
                                bbox.y2 = Math.max(bb.y + bb.height, bbox.y2);
                            }
                        }
                        inferPurpose(clusters[i], bbox);
                    }

                    if (onClick instanceof Function) {
                        onClick(clusters[i]);
                    }
                })
                .on("pointerover", function(d) {
                    let cluster = clusters[index.get(this)];

                    d3.selectAll("path.lineDraw")
                    .transition()
                    .duration(1000)
                    .attr("opacity", 0.1);
                
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
                    for (let cluster of clusters) {
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
                    let cluster = clusters[index.get(this)];

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
                });

                // Cancel button with X symbol
                tooltip
                .append("circle")
                .attr("cx", (d, i) => !clusters[i].open ? clusters[i].x + 12 : window.innerWidth - 40)
                .attr("cy", (d, i) => clusters[i].y + 16)
                .attr("r", 12)
                .attr("fill", "#b8405e")
                .attr("opacity", (d, i) => clusters[i].open ? 1 : 0)
                .style("pointer-events", (d, i) => clusters[i].open ? "all" : "none")
                .style("cursor", "pointer")
                .each(function(d, i) {
                    index.set(this, i);
                })
                .on("click", function() {
                    let i = index.get(this);
                    clusters[i].open = false;
                    updateTooltips(clusters);

                    d3.selectAll("path.lineDraw")
                    .transition()
                    .duration(1000)
                    .attr("opacity", 1);
                });

                tooltip
                .append("text")
                .attr("x", (d, i) => !clusters[i].open ? clusters[i].x + 12 : window.innerWidth - 40)
                .attr("y", (d, i) => clusters[i].y + 16)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "16px")
                .attr("fill", "white")
                .attr("opacity", (d, i) => clusters[i].open ? 1 : 0)
                .text("x")
                .style("font-family", "cursive")
                .style("pointer-events", "none");
            },

            update => {
                update
                .select("circle")
                .style("pointer-events", (d, i) => clusters[i].open ? "all" : "none")
                .each(function(d, i) {
                    index.set(this, i);
                })
                .on("click", function() {
                    let i = index.get(this);
                    clusters[i].open = false;
                    updateTooltips(clusters);

                    d3.selectAll("path.lineDraw")
                    .transition()
                    .duration(1000)
                    .attr("opacity", 1);
                })
                .transition()
                .duration((d, i) => 1000)
                .attr("cx", (d, i) => !clusters[i].open ? clusters[i].x + 12 : window.innerWidth - 40)
                .attr("cy", (d, i) => clusters[i].y + 16)
                .attr("opacity", (d, i) => clusters[i].open ? 1 : 0);

                update
                .select("text")
                .each(function(d, i) {
                    index.set(this, i);
                })
                .transition()
                .duration((d, i) => 1000)
                .attr("x", (d, i) => !clusters[i].open ? clusters[i].x + 12 : window.innerWidth - 40)
                .attr("y", (d, i) => clusters[i].y + 16)
                .attr("opacity", (d, i) => clusters[i].open ? 1 : 0);

                update
                .select("rect")
                .each(function(d, i) {
                    index.set(this, i);
                })
                .style("cursor", (d, i) => clusters[i].open ? "default" : "pointer")
                .on("click", function() {
                    let i = index.get(this);

                    if (clusters[i].open) {
                        return;
                    }
                    clusters[i].open = !clusters[i].open;

                    if (!clusters[i].open) {
                        let cluster = clusters[i];

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
                        for (let idx = 0; idx < clusters.length; idx++) {
                            if (idx !== i) {
                                clusters[idx].open = false;
                            }
                        }
                    }
                    updateTooltips(clusters);

                    let rect = d3.select(this)
                    .on("pointerover", null)
                    .on("pointerout", null)
                    .node();

                    d3.select(rect.closest("g")).raise();

                    if (onClick instanceof Function) {
                        onClick(clusters[i]);
                    }
                })
                .call(update => 
                    update
                    .transition()
                    .duration(1000)
                    .attr("x", (d, i) => clusters[i].x)
                    .attr("y", (d, i) => clusters[i].y)
                    .attr("width", (d, i) => clusters[i].open ? window.innerWidth - d3.select(".react-pdf__Page__canvas").node().getBoundingClientRect().right - 36 : 24)
                    .attr("height", (d, i) => clusters[i].open ? 200 : 24)
                    .attr("fill-opacity", 0.5)
                    .attr("stroke-opacity", (d, i) => clusters[i].open ? 0.5 : 0)
                    .attr("opacity", 1)
                    .on("end", function(d, i) {
                        if (!clusters[i].strokes[clusters[i].strokes.length - 1])
                            return;

                        if (clusters[i].open) {
                            d3.select(this)
                            .on("pointerover", null)
                            .on("pointerout", null);
                        } else {
                            d3.select(this)
                            .on("pointerover", function(d) {
                                let cluster = clusters[index.get(this)];

                                d3.selectAll("path.lineDraw")
                                .transition()
                                .duration(1000)
                                .attr("opacity", 0.1);
                
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
                                for (let cluster of clusters) {
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
                                let cluster = clusters[index.get(this)];

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
                            });
                        }

                        d3.select(this)
                        .attr("fill", (d) => `url(#markerFillGradient${clusters[i].strokes[clusters[i].strokes.length - 1].id})`)
                        .attr("stroke", (d) => `url(#markerBorderGradient${clusters[i].strokes[clusters[i].strokes.length - 1].id})`)
                        .attr("rx", 12)
                        .transition()
                        .duration(1000)
                        .attr("opacity", 1);
                    })
                );
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

        d3.select(ref.current)
        .select("defs")
        .selectAll("filter.strokeHighlight")
        .data(clusters.map(cluster => cluster.strokes).flat(), (d) => {
            return d.id;
        })
        .join(
            enter => {
                let filter = enter
                .append("filter")
                .attr("class", "strokeHighlight")
                .attr("id", (d, i) => "strokeHighlight" + d.id)
                .attr("x", "-500%")
                .attr("y", "-500%")
                .attr("width", "1000%")
                .attr("height", "1000%");

                filter
                .append("feGaussianBlur")
                .attr("in", "SourceGraphic")
                .attr("stdDeviation", 3)
                .attr("result", "blur");

                filter
                .append("feColorMatrix")
                .attr("in", "blur")
                .attr("type", "matrix")
                .attr("values", (d, i) => {
                    if (d.id === "initial")
                        return `1 0 0 0 0
                                0 1 0 0 0
                                0 0 1 0 0
                                0 0 0 15 0`;

                    let colour = d3.select(`path[id="${d.id}"]`).style("stroke");
                    let regex = /rgb\((\d+), (\d+), (\d+)\)/;
                    let match = regex.exec(colour);
                    let r = parseInt(match[1]);
                    let g = parseInt(match[2]);
                    let b = parseInt(match[3]);

                    return `0 0 0 0 ${r / 255}
                            0 0 0 0 ${g / 255}
                            0 0 0 0 ${b / 255}
                            0 0 0 0 0`;
                
                })
                .attr("result", "blue");


                filter
                .append("feColorMatrix")
                .attr("in", "SourceGraphic")
                .attr("type", "matrix")
                .attr("values", `1 0 0 0 0
                                0 1 0 0 0
                                0 0 1 0 0
                                1 1 1 10 0`)
                .attr("result", "solid");

                filter
                .append("feComposite")
                .attr("in", "SourceGraphic")
                .attr("in2", "solid")
                .attr("result", "solid2")
                .attr("operator", "over");

                filter
                .append("feComposite")
                .attr("in", "blue")
                .attr("in2", "solid2")
                .attr("result", "border")
                .attr("operator", "out");

                filter
                .append("feGaussianBlur")
                .attr("in", "border")
                .attr("stdDeviation", 2)
                .attr("result", "border");
                

                filter
                .append("feComposite")
                .attr("in", "SourceGraphic")
                .attr("in2", "border");
            },
        );


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
    }, [onClick, inferPurpose]);

    useEffect(() => {
        if (clusters) {
            for (let cluster of clusters) {
                if (cluster["open"] === undefined)
                    cluster["open"] = false;
            }
            updateTooltips(clusters);
        } else {
            updateTooltips([]);
        }
    }, [clusters, updateTooltips]);

    return (
        <svg ref={ref} id="toolTipcanvas" width={"100%"} height={"100%"}>
            <defs>
            </defs>
        </svg>
    );
}