import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import SvgPenSketch from "./js/SvgPenSketch";
import * as d3 from "d3";
import PenCluster, { calculateMinDistance, Cluster, Stroke } from "./js/PenCluster";
import Tooltip from "./Tooltip.js";
import "./js/OpenAIUtils";

import "./css/PenAnnotation.css";

import toolbarStyles from "./css/Toolbar.module.css";
import { googleSans } from "../page";

function isHorizontalLine(coords, maxYVariance = 7, maxDirectionChanges = 3) {
    if (coords.length < 2) {
        return false;
    }

    let y = coords[0][1];

    for (let i = 1; i < coords.length; i++) {
        if (coords[i][1] < y - 20 || coords[i][1] > y + 20) {
            return false;
        }
    }
    const yVals = coords.map(pt => pt[1]);
    const meanY = yVals.reduce((a, b) => a + b) / yVals.length;
    const yVariance = yVals.reduce((sum, y) => sum + (y - meanY) ** 2, 0) / yVals.length;

    if (yVariance > maxYVariance) {
        return false;
    }
    return true;
}

function findClosestLine(lines, point) {
    function distance(x1, y1, x2, y2, x, y) {
        let A = x - x1;
        let B = y - y1;
        let C = x2 - x1;
        let D = y2 - y1;

        let dot = A * C + B * D;
        let len_sq = C * C + D * D;
        let param = -1;

        if (len_sq !== 0)
            param = dot / len_sq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        let dx = x - xx;
        let dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    let closestLine;
    let minDistance = Infinity;

    for (let line of lines) {
        let dist = distance(line.x1, line.y1, line.x2, line.y2, point.x, point.y);

        if (dist < minDistance && dist < 10) {
            minDistance = dist;
            closestLine = line;
        }
    }
    return closestLine;
}


function checkEnclosed(coords) {
    function intersects(a, b, c, d, p, q, r, s) {
        let det, gamma, lambda;
        det = (c - a) * (s - q) - (r - p) * (d - b);

        if (det === 0) {
            return false;
        } else {
            lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
            gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
            return -1 <= lambda && lambda <= 2 && -1 <= gamma && gamma <= 2;
        }
    }

    function dist(x1, y1, x2, y2) {
        var a = x1 - x2;
        var b = y1 - y2;

        return a * a + b * b;
    }

    loop1: for (let i1 = 0; i1 < coords.length / 3; i1++) {
        let samplePoint1 = 1;

        let x1 = coords[i1][0];
        let y1 = coords[i1][1];
        let x2 = coords[i1 + samplePoint1][0];
        let y2 = coords[i1 + samplePoint1][1];

        while (dist(x1, y1, x2, y2) < 900) {
            samplePoint1++;

            if (i1 + samplePoint1 >= coords.length / 3)
                break loop1;
            x2 = coords[i1 + samplePoint1][0];
            y2 = coords[i1 + samplePoint1][1];
        }

        loop2: for (let i2 = coords.length - 1; i2 >= (coords.length / 3) * 2; i2--) {
            let samplePoint2 = 1;

            let x3 = coords[i2][0];
            let y3 = coords[i2][1];
            let x4 = coords[i2 - samplePoint2][0];
            let y4 = coords[i2 - samplePoint2][1];

            while (dist(x3, y3, x4, y4) < 900) {
                samplePoint2++;

                if (i2 - samplePoint2 <= (coords.length / 3) * 2)
                    break loop2;
                x4 = coords[i2 - samplePoint2][0];
                y4 = coords[i2 - samplePoint2][1];
            }

            if (intersects(x1, y1, x2, y2, x3, y3, x4, y4)) {
                return true;
            }
        }
    }
    return false;
}

function getDistanceFromPointToPath(point, path) {
    return new Promise((resolve, reject) => {
        let pathLength = path.getTotalLength();
        let precision = 50;
        let minDistance = Infinity;

        for (let i = 0; i <= precision; i++) {
            let distanceAlongPath = i / precision * pathLength;
            let pathPoint = path.getPointAtLength(distanceAlongPath);
            let dx = pathPoint.x - point.x;
            let dy = pathPoint.y - point.y;
            let distance = dx * dx + dy * dy;

            if (distance < minDistance) {
                minDistance = distance;
            }

            if (minDistance < 625) {
                resolve(minDistance);
                break;
            }
        }

        resolve(minDistance);
    });
}

function nearPath(point, path) {
    let bbox = path.getBBox();
    let offset = 25;

    if (point.x < bbox.x + bbox.width + offset && point.x > bbox.x - offset && point.y < bbox.y + bbox.height + offset && point.y > bbox.y - offset) {
        return true;
    }
    return false;
}


function PenAnnotation({ mode, content, index, tool, colour, toolTipRef, handiness, disabled, setUpAnnotations, onNewActiveCluster, onClusterChange, onEraseCallback, penStartCallback, penEndCallback, eraseStartCallback, eraseEndCallback, onInferenceCallback, onEndAnnotateCallback, ref }) {
    const svgRef = useRef();
    const svgPenSketch = useRef();
    const penCluster = useRef(new PenCluster());
    const paragraphs = useRef([]);
    const [clustersState, setClusters] = useState([]);
    const [lockCluster, setLockCluster] = useState([]);
    const clustersRef = useRef(clustersState);
    const lockClusterRef = useRef(lockCluster);
    const modeRef = useRef(mode ?? "llm");
    const hoveredCluster = useRef(null);
    const hoverTimeout = useRef(null);
    const activeCluster = useRef(null);
    const disabledRef = useRef(disabled);

    const handleHover = useCallback(async e => {
        let hasTouchScreen = navigator.maxTouchPoints > 0;
        
        if ((e.buttons === 0 && e.button === -1 && !hasTouchScreen) || hasTouchScreen) {
            if (activeCluster.current && d3.select(`g.toolTip[id="toolTip${activeCluster.current?.strokes[activeCluster.current.strokes.length - 1]?.id}"]`).empty()) {
                activeCluster.current = null;
            }
            let coords = d3.pointer(e);
            let [x, y] = coords;
            let closestCluster = null;

            loop1: for (let cluster of [...clustersRef.current].concat([...lockClusterRef.current])) {
                if (!(cluster.purpose || cluster.purpose === false)) {
                    for (let stroke of cluster.strokes) {
                        if (stroke.id !== "initial" && stroke.id) {
                            let path = d3.select(`path[id="${stroke.id}Outline"]`).node();

                            if (path) {
                                const pointObj = svgPenSketch.current._element.node().createSVGPoint();
                                pointObj.x = x;
                                pointObj.y = y;
                                
                                if (path.isPointInFill(pointObj) || path.isPointInStroke(pointObj)) {
                                    closestCluster = cluster;
                                    break loop1;
                                }
                            }
                        }
                    }
                }
            }

            let processClosestCluster = (closestCluster) => {
                if (closestCluster) {
                    let lastStroke = closestCluster.strokes[closestCluster.strokes.length - 1];
                    let closestBBox = {x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity};

                    for (let stroke of closestCluster.strokes) {
                        if (stroke.id !== "initial") {
                            let strokeBBox = stroke.bbox;
            
                            closestBBox.x1 = Math.min(closestBBox.x1, strokeBBox.left);
                            closestBBox.y1 = Math.min(closestBBox.y1, strokeBBox.top);
                            closestBBox.x2 = Math.max(closestBBox.x2, strokeBBox.right);
                            closestBBox.y2 = Math.max(closestBBox.y2, strokeBBox.bottom);
                        }
                    }

                    if (hoveredCluster.current !== lastStroke.id && activeCluster.current?.strokes[activeCluster.current.strokes.length - 1].id !== lastStroke.id) {
                        clearTimeout(hoverTimeout.current);

                        hoverTimeout.current = setTimeout(() => {
                            let closeClusters = [];

                            if (!hasTouchScreen) {
                                for (let cluster of [...clustersRef.current].concat([...lockClusterRef.current])) {
                                    let clusterBBox = {x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity};

                                    for (let stroke of cluster.strokes) {
                                        if (stroke.id !== "initial") {
                                            let strokeBBox = stroke.bbox;
                            
                                            clusterBBox.x1 = Math.min(clusterBBox.x1, strokeBBox.left);
                                            clusterBBox.y1 = Math.min(clusterBBox.y1, strokeBBox.top);
                                            clusterBBox.x2 = Math.max(clusterBBox.x2, strokeBBox.right);
                                            clusterBBox.y2 = Math.max(clusterBBox.y2, strokeBBox.bottom);
                                        }
                                    }
                                    let box1 = {x: closestBBox.x1 * window.innerWidth, y: closestBBox.y1 * window.innerHeight, width: closestBBox.x2 * window.innerWidth - closestBBox.x1 * window.innerWidth, height: closestBBox.y2 * window.innerHeight - closestBBox.y1 * window.innerHeight};
                                    let box2 = {x: clusterBBox.x1 * window.innerWidth, y: clusterBBox.y1 * window.innerHeight, width: clusterBBox.x2 * window.innerWidth - clusterBBox.x1 * window.innerWidth, height: clusterBBox.y2 * window.innerHeight - clusterBBox.y1 * window.innerHeight};

                                    let box1ContainsBox2 = box1.x < box2.x && box1.x + box1.width > box2.x + box2.width && box1.y < box2.y && box1.y + box1.height > box2.y + box2.height;
                                    let box2ContainsBox1 = box2.x < box1.x && box2.x + box2.width > box1.x + box1.width && box2.y < box1.y && box2.y + box2.height > box1.y + box1.height;
                
                                    if (box1ContainsBox2 || box2ContainsBox1) {
                                        closeClusters.push(cluster);
                                    } else {
                                        let distance = calculateMinDistance(box1, box2);
                                        
                                        if (distance < 2500) {
                                            closeClusters.push(cluster);
                                        }
                                    }
                                }
                            }

                            for (let cluster of [...clustersRef.current].concat([...lockClusterRef.current])) {
                                cluster.disabled = true;
                            }

                            for (let cluster of closeClusters) {
                                cluster.disabled = false;
                                cluster.open = false;
                            }
                            closestCluster.disabled = false;
                            closestCluster.open = false;

                            if (onNewActiveCluster instanceof Function) {
                                onNewActiveCluster(closestCluster);
                            }
                            activeCluster.current = closestCluster;
                            setClusters([...clustersRef.current]);

                            if (!hasTouchScreen)
                                setLockCluster([...lockClusterRef.current]);
                        }, hasTouchScreen ? 0 : 1000);
                    }
                    hoveredCluster.current = lastStroke.id;
                } else {
                    clearTimeout(hoverTimeout.current);
                    hoveredCluster.current = null;
                }
            };
            processClosestCluster(closestCluster);
        }
    }, [onNewActiveCluster]);

    useEffect(() => {
        svgPenSketch.current = new SvgPenSketch(
            svgRef.current,
            {
                fill: "none",
                stroke: "red",
                "stroke-opacity": 0,
                "stroke-width": 1,
            },
            {},
            { eraserMode: "object", eraserSize: "25" }
        );
    }, []);
    
    useEffect(() => {
        let hasTouchScreen = navigator.maxTouchPoints > 0;

        svgPenSketch.current._element
        .on(hasTouchScreen ? "pointerdown.hover" : "pointermove.hover", (e) => {
            if (hasTouchScreen && e.pointerType !== "touch") {
                return;
            }

            if (typeof modeRef.current === "string" && modeRef.current.toLowerCase().includes("llm") && !disabledRef.current?.current) {
                handleHover(e);
            }
        });

        return () => {
            svgPenSketch.current._element
            .on("pointerdown.hover", null)
            .on("pointermove.hover", null)
            .on("pointerleave.hover", null);
        };
    }, [handleHover]);

    useEffect(() => {
        let toolbar = d3.select("." + toolbarStyles.toolbar);
        let toolTip = d3.selectAll("#toolTipcanvas");
        let navagation = d3.select(".navigateContainer");

        svgPenSketch.current.eraseStartCallback = () => {
            if (disabledRef.current?.current) {
                for (let cluster of [...clustersRef.current].concat([...lockClusterRef.current])) {
                    cluster.disabled = true;
                    cluster.open = false;
                    setClusters([...clustersRef.current]);
                    setLockCluster([...lockClusterRef.current]);
                }
                return;
            }
            toolbar.classed(toolbarStyles.disabled, true);
            toolTip.classed("disabled", true);
            navagation.classed("disabled", true);
            clearTimeout(hoverTimeout.current);
            hoveredCluster.current = null;
            activeCluster.current = null;

            window.getSelection().removeAllRanges();

            if (eraseStartCallback instanceof Function) {
                eraseStartCallback();
            }
        };
    }, [eraseStartCallback]);

    useEffect(() => {
        svgPenSketch.current.eraserDownCallback = (affectedPaths, currPointerEvent, elements, eraserCoords) => {
            if (disabledRef.current?.current) {
                return;
            }
            let newClusters = [...clustersRef.current];
            let newLockCluster = [...lockClusterRef.current];

            for (let path of affectedPaths) {
                d3.select(path).remove();
                d3.select(`path[id="${path.id}Outline"]`).remove();
                
                let findStroke = newClusters.findIndex(cluster => cluster.strokes.find(stroke => stroke.id === path.id));
                let findLockStroke = newLockCluster.findIndex(cluster => cluster.strokes.find(stroke => stroke.id === path.id));
                
                if (findStroke !== -1) {
                    newClusters[findStroke].strokes = [...newClusters[findStroke].strokes.filter(stroke => stroke.id !== path.id)];

                    if (onEraseCallback instanceof Function) {
                        onEraseCallback(newClusters[findStroke], path.id, index);
                    }
                    newClusters = newClusters.filter(cluster => cluster.strokes.length > 0 && !(cluster.strokes.length === 1 && cluster.strokes[0].id === "initial"));
                    clustersRef.current = newClusters;
                    setClusters(newClusters);
                }

                if (findLockStroke !== -1) {
                    newLockCluster[findLockStroke].strokes = [...newLockCluster[findLockStroke].strokes.filter(stroke => stroke.id !== path.id)];

                    if (onEraseCallback instanceof Function) {
                        onEraseCallback(newLockCluster[findLockStroke], path.id, index);
                    }
                    lockClusterRef.current = newLockCluster;
                    setLockCluster(newLockCluster);
                }
                penCluster.current.remove(path.id);
            }
        };
    }, [onEraseCallback, index]);

    
    useEffect(() => {
        let toolbar = d3.select("." + toolbarStyles.toolbar);
        let toolTip = d3.selectAll("#toolTipcanvas");
        let navagation = d3.select(".navigateContainer");
        
        svgPenSketch.current.eraserUpCallback = () => {
            if (disabledRef.current?.current) {
                return;
            }
            toolbar.classed(toolbarStyles.disabled, false);
            toolTip.classed("disabled", false);
            navagation.classed("disabled", false);

            if (eraseEndCallback instanceof Function) {
                eraseEndCallback();
            }
        };
    }, [eraseEndCallback]);

    useEffect(() => {
        let toolbar = d3.select("." + toolbarStyles.toolbar);
        let toolTip = d3.selectAll("#toolTipcanvas");
        let navagation = d3.select(".navigateContainer");

        svgPenSketch.current.strokeStyles = {
            ...svgPenSketch.current.strokeStyles,
            toolRef: tool,
        };
        
        svgPenSketch.current.penStartCallback = (path) => {
            if (disabledRef.current?.current) {
                for (let cluster of [...clustersRef.current].concat([...lockClusterRef.current])) {
                    cluster.disabled = true;
                    cluster.open = false;
                    setClusters([...clustersRef.current]);
                    setLockCluster([...lockClusterRef.current]);
                }
                return;
            }
            hoveredCluster.current = null;
            activeCluster.current = null;
            clearTimeout(hoverTimeout.current);

            d3.select(path)
            .style("stroke", colour.current)
            .style("fill", colour.current)
            .style("fill-opacity", tool.current === "pen" ? 1 : 0.2)
            .classed(tool.current, true)
            .attr("opacity", 1);

            toolbar.classed(toolbarStyles.disabled, true);
            toolTip.classed("disabled", true);
            navagation.classed("disabled", true);
            
            startTime.current = Date.now();
            window.getSelection().removeAllRanges();

            if (penStartCallback instanceof Function) {
                penStartCallback();
            }
        };
    }, [tool, colour, penStartCallback]);

    let startTime = useRef(null);

    let clusterStrokes = async (clusters, stopIteration) => {
        let newClusterArray = clusters[stopIteration[stopIteration.length - 1]];
        let newClusters = [...clustersRef.current];

        for (let c of newClusterArray) {
            if (c.strokes.length === 0) {
                continue;
            }
            c = new Cluster(c.strokes);
            c.disabled = true;

            for (let stroke of c.strokes) {
                let findStroke = newClusters.findIndex(cluster => cluster.strokes.find(s => s.id === stroke.id));

                if (findStroke !== -1) {
                    newClusters.splice(findStroke, 1);
                }
            }
            newClusters.push(c);
        }
        newClusters = newClusters.filter(cluster => cluster.strokes.length > 0 && !(cluster.strokes.length === 1 && cluster.strokes[0].id === "initial")).sort((a, b) => a.lastestTimestamp - b.lastestTimestamp);
        clustersRef.current = newClusters;
        setClusters(newClusters);
    };

    useEffect(() => {
        let toolbar = d3.select("." + toolbarStyles.toolbar);
        let toolTip = d3.selectAll("#toolTipcanvas");
        let navagation = d3.select(".navigateContainer");

        svgPenSketch.current.penUpCallback = (path, e, coords) => {
            if (disabledRef.current?.current) {
                return;
            }
            toolbar.classed(toolbarStyles.disabled, false);
            toolTip.classed("disabled", false);
            navagation.classed("disabled", false);

            if (coords.length < 2) {
                d3.select(path).remove();
                return;
            }
            let outLinePath = svgPenSketch.current._element.append("path");

            outLinePath
            .attr("d", d3.select(path).attr("d"))
            .attr("class", "lineDrawOutline")
            .attr("style", svgPenSketch.current.strokeStyles["style"])
            .style("fill", "none")
            .style("stroke", "none")
            .style("opacity", "0")
            .style("stroke-width", 30)
            .attr("id", d3.select(path).attr("id") + "Outline");

            let pageTop = d3.select(".pen-annotation-layer#layer-" + index).node().getBoundingClientRect().top;
            let pathBbox = path.getBoundingClientRect();
            pathBbox.y -= pageTop;

            let newStroke = new Stroke(path.id,
                pathBbox,
                "processing",
                startTime.current
            );
            newStroke.page = index;
            newStroke.bbox = newStroke.normalizeBoundingBox(pathBbox);

            if (eraseEndCallback instanceof Function) {
                eraseEndCallback();
            }
            let endTime = Date.now();
            let [clusters, stopIteration] = penCluster.current.addNewStroke(newStroke);
            clusterStrokes(clusters, stopIteration);

            let scrollCoords = coords.map(coord => [coord[0], coord[1] - window.scrollY]);
            
            let processWords = (wordsOfInterest, type) => {
                if (paragraphs.current.length === 0) {
                    let words = d3.select(".react-pdf__Page.page-" + index).select(".textLayer").selectAll("span.word").nodes().filter(word => {
                        return word.textContent.trim() !== "";
                    });

                    if (words.length !== 0) {
                        let lines = [];
                        let line = [];
                        let prevYCoord = words[0].getBoundingClientRect().top;
                
                        for (let word of words) {
                            let closestWordRect = word.getBoundingClientRect();
                            
                            if (closestWordRect.top > prevYCoord + closestWordRect.height / 2 || closestWordRect.top < prevYCoord - closestWordRect.height / 2) {
                                lines.push(line);
                                line = [];
                                prevYCoord = closestWordRect.top;
                            }
                            line.push(word);
                        }
                        lines.push(line);
                
                        let yDistances = lines.map((line, i) => {
                            if (i === 0) {
                                return null;
                            }
                            return lines[i][0].getBoundingClientRect().top - lines[i - 1][0].getBoundingClientRect().bottom;
                        });
                        let yDistance = d3.mode(yDistances);
                        let paragraph = [];
                
                        for (let line of lines) {
                            let y = d3.median(line.map(word => word.getBoundingClientRect().top));
                            let meanHeight = d3.mean(line.map(word => word.getBoundingClientRect().height));
                
                            if (paragraph.length === 0) {
                                paragraph.push(line);
                            } else {
                                let prevY = d3.median(paragraph[paragraph.length - 1].map(word => word.getBoundingClientRect().bottom));
                
                                if (Math.abs(y - prevY) - meanHeight / 2 < yDistance) {
                                    paragraph.push(line);
                                } else {
                                    paragraphs.current.push(paragraph);
                                    paragraph = [line];
                                }
                            }
                        }
                        paragraphs.current.push(paragraph);
                    }
                }
                let words = new Set([...wordsOfInterest.map(w => w.element)]);
                let text = [];
                let marginalText = [];
                let textBBox = {x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity};
                let marginalTextBBox = {x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity};

                words = [...words].sort((a, b) => {
                    if (a.getBoundingClientRect().top === b.getBoundingClientRect().top) {
                        return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
                    }
                    return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
                });

                if (wordsOfInterest.length !== 0) {
                    let prevYCoord = words[0].getBoundingClientRect().top;

                    for (let word of words) {
                        let closestWordRect = word.getBoundingClientRect();

                        if (closestWordRect.top > prevYCoord + 5) {
                            prevYCoord = closestWordRect.top;
                        }
                        text.push(word);

                        textBBox.x1 = Math.min(textBBox.x1, closestWordRect.left);
                        textBBox.y1 = Math.min(textBBox.y1, closestWordRect.top - pageTop);
                        textBBox.x2 = Math.max(textBBox.x2, closestWordRect.right);
                        textBBox.y2 = Math.max(textBBox.y2, closestWordRect.bottom - pageTop);

                    }
                }
                let pathBbox = path.getBoundingClientRect();
                pathBbox.y -= pageTop;

                if (text.length === 0 ) {
                    type = "annotated";

                    for (let paragraph of paragraphs.current) {
                        for (let line of paragraph) {
                            let y1 = d3.min(line.map(word => word.getBoundingClientRect().top - pageTop));
                            let y2 = d3.max(line.map(word => word.getBoundingClientRect().bottom - pageTop));

                            if ((pathBbox.y < y2 || pathBbox.y + pathBbox.height < y2) && (pathBbox.y > y1 || pathBbox.y + pathBbox.height > y1)) {
                                for (let word of line) {
                                    marginalText.push(word);
                                }
                                marginalTextBBox.x1 = Math.min(marginalTextBBox.x1, d3.min(line.map(word => word.getBoundingClientRect().left)));
                                marginalTextBBox.y1 = Math.min(marginalTextBBox.y1, y1);
                                marginalTextBBox.x2 = Math.max(marginalTextBBox.x2, d3.max(line.map(word => word.getBoundingClientRect().right)));
                                marginalTextBBox.y2 = Math.max(marginalTextBBox.y2, y2);
                            }
                        }
                    }

                    if (marginalTextBBox.x1 === Infinity && paragraphs.current.length > 0) {
                        let distances = paragraphs.current.map(paragraph => {
                            let y1 = d3.min(paragraph.map(line => d3.min(line.map(word => word.getBoundingClientRect().top - pageTop))));
                            let y2 = d3.max(paragraph.map(line => d3.max(line.map(word => word.getBoundingClientRect().bottom - pageTop))));
                            let x1 = d3.min(paragraph.map(line => d3.min(line.map(word => word.getBoundingClientRect().left))));
                            let x2 = d3.max(paragraph.map(line => d3.max(line.map(word => word.getBoundingClientRect().right))));

                            return calculateMinDistance(pathBbox, {x: x1, y: y1, width: x2 - x1, height: y2 - y1});

                        });
                        let closestParagraph = paragraphs.current[distances.indexOf(d3.min(distances))];
                        let y1 = d3.min(closestParagraph.map(line => d3.min(line.map(word => word.getBoundingClientRect().top - pageTop))));
                        let y2 = d3.max(closestParagraph.map(line => d3.max(line.map(word => word.getBoundingClientRect().bottom - pageTop))));

                        for (let line of closestParagraph) {
                            for (let word of line) {
                                marginalText.push(word);
                            }
                        }
                        marginalTextBBox.x1 = Math.min(marginalTextBBox.x1, d3.min(closestParagraph.map(line => d3.min(line.map(word => word.getBoundingClientRect().left)))));
                        marginalTextBBox.y1 = Math.min(marginalTextBBox.y1, y1);
                        marginalTextBBox.x2 = Math.max(marginalTextBBox.x2, d3.max(closestParagraph.map(line => d3.max(line.map(word => word.getBoundingClientRect().right)))));
                        marginalTextBBox.y2 = Math.max(marginalTextBBox.y2, y2);
                    }
                }
                let lineBBox = {x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity};

                if (type === "underlined_character") {
                    for (let paragraph of paragraphs.current) {
                        for (let line of paragraph) {
                            for (let word of line) {
                                let rect = word.getBoundingClientRect();

                                if (rect.top - pageTop === textBBox.y1 && rect.bottom - pageTop === textBBox.y2) {
                                    lineBBox.x1 = Math.min(lineBBox.x1, rect.left);
                                    lineBBox.y1 = Math.min(lineBBox.y1, rect.top - pageTop);
                                    lineBBox.x2 = Math.max(lineBBox.x2, rect.right);
                                    lineBBox.y2 = Math.max(lineBBox.y2, rect.bottom - pageTop);
                                }
                            }
                        }
                    }
                }

                if (tool.current === "highlighter") {
                    type = type.replace("underlined", "highlighted");
                    type = type.replace("crossed", "highlighted");
                }
                newStroke.type = type;
                newStroke.endTime = newStroke.endTime === 0 ? endTime : newStroke.endTime;
                newStroke.annotatedText = text;
                newStroke.marginalText = marginalText;
                newStroke.page = index;
                newStroke.textBbox = newStroke.normalizeBoundingBox({x: textBBox.x1, y: textBBox.y1, width: textBBox.x2 - textBBox.x1, height: textBBox.y2 - textBBox.y1});
                newStroke.marginalTextBbox = newStroke.normalizeBoundingBox({x: marginalTextBBox.x1, y: marginalTextBBox.y1, width: marginalTextBBox.x2 - marginalTextBBox.x1, height: marginalTextBBox.y2 - marginalTextBBox.y1});
                newStroke.lineBbox = newStroke.normalizeBoundingBox({x: lineBBox.x1, y: lineBBox.y1, width: lineBBox.x2 - lineBBox.x1, height: lineBBox.y2 - lineBBox.y1});

                if (penEndCallback instanceof Function) {
                    penEndCallback({ path, stroke: newStroke, page: index });
                }
                return words;
            };

            if (isHorizontalLine(scrollCoords)) {
                let checkLineWords = (words) => {
                    if (words.length === 0) {
                        return;
                    }
                    let wordsOfInterest = [];
                    let rectLines = words.map(word => {
                        let rect = word.getBoundingClientRect();
                        let y = tool.current === "highlighter" ? rect.top + rect.height / 2 : rect.bottom;
                        let type = tool.current === "highlighter" ? "highlighted" : "underlined";

                        return {
                            x1: rect.left,
                            y1: y,
                            x2: rect.right,
                            y2: y,
                            element: word,
                            type: type,
                        };
                    });

                    if (tool.current === "pen") {
                        words.forEach(word => {
                            let rect = word.getBoundingClientRect();

                            rectLines.push({
                                x1: rect.left,
                                y1: rect.top + rect.height / 2,
                                x2: rect.right,
                                y2: rect.top + rect.height / 2,
                                element: word,
                                type: "crossed",
                            });
                        });
                    }
                    let svgPoint = svgRef.current.createSVGPoint();

                    let allLines = rectLines.map(line => {
                        return {
                            x1: line.x1,
                            y1: line.y1,
                            x2: line.x2,
                            y2: line.y2,
                        };
                    });

                    let workerCode = function () {
                        onmessage = (e) => {
                            let lines = e.data.lines;
                            let coords = e.data.coords;
                            let findClosestLine = new Function(`return ${e.data.findClosestLine}`)();

                            let closestLine = findClosestLine(lines, { x: coords[0], y: coords[1] });
                            postMessage({ ...closestLine, coord: coords });
                        };
                    };

                    let worker = new Worker(URL.createObjectURL(new Blob([`(${workerCode})()`], { type: "application/javascript" })));

                    for (let coord of scrollCoords) {
                        svgPoint.x = coord[0];
                        svgPoint.y = coord[1];
                        svgPoint = svgPoint.matrixTransform(svgRef.current.getScreenCTM());
                        coord = [svgPoint.x, svgPoint.y + window.scrollY];

                        worker.postMessage({ lines: allLines, coords: [coord[0], coord[1]], findClosestLine: findClosestLine.toString() });
                    }
                    let length = 0;

                    return new Promise((resolve, reject) => {
                        worker.onmessage = (e) => {
                            if (e.data !== undefined && e.data.x1 !== undefined) {
                                let line = rectLines.find(line => line.x1 === e.data.x1 && line.y1 === e.data.y1 && line.x2 === e.data.x2 && line.y2 === e.data.y2);

                                if (line !== undefined) {
                                    wordsOfInterest.push({ ...line, coord: e.data.coord, type: line.type });
                                }
                            }
                            length++;

                            let majorityType;

                            if (length === scrollCoords.length && wordsOfInterest.length > 0) {
                                let majorityY = d3.mode(wordsOfInterest.map(w => w.element.getBoundingClientRect().bottom));
                                let wordsOfInterestFiltered = wordsOfInterest.filter(w => w.element.getBoundingClientRect().bottom >= majorityY - 5 && w.element.getBoundingClientRect().bottom <= majorityY + 5);
                                majorityType = d3.mode(wordsOfInterestFiltered.map(w => w.type));

                                wordsOfInterestFiltered.sort((a, b) => a.x1 - b.x1);
                                let prevElement = wordsOfInterestFiltered[0].element;
                                let leftMost = wordsOfInterestFiltered[0].coord[0];
                                let rightMost = wordsOfInterestFiltered[0].coord[0];
                                wordsOfInterest = [];

                                for (let i = 0; i < wordsOfInterestFiltered.length; i++) {
                                    let element = wordsOfInterestFiltered[i].element;

                                    if (element === prevElement && i !== wordsOfInterestFiltered.length - 1) {
                                        if (wordsOfInterestFiltered[i].coord[0] < leftMost) {
                                            leftMost = wordsOfInterestFiltered[i].coord[0];
                                        }
                                        if (wordsOfInterestFiltered[i].coord[0] > rightMost) {
                                            rightMost = wordsOfInterestFiltered[i].coord[0];
                                        }
                                    } else {
                                        if (i === wordsOfInterestFiltered.length - 1) {
                                            if (wordsOfInterestFiltered[i].coord[0] < leftMost) {
                                                leftMost = wordsOfInterestFiltered[i].coord[0];
                                            }
                                            if (wordsOfInterestFiltered[i].coord[0] > rightMost) {
                                                rightMost = wordsOfInterestFiltered[i].coord[0];
                                            }
                                        }

                                        if (rightMost - leftMost > (prevElement.getBoundingClientRect().width) / 2) {
                                            wordsOfInterest.push({ element: prevElement });
                                        }
                                        prevElement = element;
                                        leftMost = wordsOfInterestFiltered[i].coord[0];
                                        rightMost = wordsOfInterestFiltered[i].coord[0];
                                    }
                                }
                                let leftMostX = d3.min(wordsOfInterest.map(w => w.element.getBoundingClientRect().left));
                                let rightMostX = d3.max(wordsOfInterest.map(w => w.element.getBoundingClientRect().right));

                                for (let word of words) {
                                    let rect = word.getBoundingClientRect();

                                    if (rect.left > leftMostX && rect.right < rightMostX && rect.bottom > majorityY - 5 && rect.bottom < majorityY + 5) {
                                        wordsOfInterest.push({ element: word });
                                    }
                                }
                            }

                            if (length === scrollCoords.length) {
                                resolve([wordsOfInterest, majorityType]);
                                worker.terminate();
                            }
                        };
                    });
                };

                let words = d3.select(".react-pdf__Page.page-" + index).select(".textLayer").selectAll("span.word").nodes().filter(word => {
                    return word.textContent.trim() !== "";
                });

                checkLineWords(words)
                .then(results => {
                    let [words, type] = results;
                    
                    if (words.length === 0) {
                        let characters = d3.select(".react-pdf__Page.page-" + index)
                        .select(".textLayer")
                        .selectAll("span.character")
                        .nodes().filter(word => {
                            return word.textContent.trim() !== "";
                        });

                        checkLineWords(characters)
                        .then(results => {
                            let [char, type] = results;

                            processWords(char, type + "_character");
                        });
                    } else {
                        processWords(words, type + "_words");
                    }
                });
            } else {
                let wordsOfInterest = [], annotatedWordsOfInterest = [], boxWordsOfInterest = [];
                let distance = (coords[0][0] - coords[coords.length - 1][0]) ** 2 + (coords[0][1] - coords[coords.length - 1][1]) ** 2;
                let type = "annotated";

                let words = d3.select(".react-pdf__Page.page-" + index).select(".textLayer").selectAll("span.word").nodes();
                let pathBoundingBox = path.getBoundingClientRect();
                let svgBoundingBox = svgRef.current.getBoundingClientRect();

                let checkContainWords = (words) => {
                    let worker = new Worker(new URL("../../workers/checkContain.js", import.meta.url));
                    let done = 0;

                    for (let i = 0; i < words.length; i++) {
                        let rect = words[i].getBoundingClientRect();
                        
                        let svgPoint = svgRef.current.createSVGPoint();
                        svgPoint.x = rect.left;
                        svgPoint.y = rect.top - svgBoundingBox.top;
                        svgPoint = svgPoint.matrixTransform(svgRef.current.getScreenCTM());

                        let svgPoint2 = svgRef.current.createSVGPoint();
                        svgPoint2.x = rect.right;
                        svgPoint2.y = rect.bottom - svgBoundingBox.top;
                        svgPoint2 = svgPoint2.matrixTransform(svgRef.current.getScreenCTM());

                        worker.postMessage({ 
                            rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, 
                            pathBoundingBox: pathBoundingBox,
                            svgBoundingBox: svgBoundingBox,
                            coords: coords,
                            i: i,
                            svgPoint: { x: svgPoint.x, y: svgPoint.y },
                            svgPoint2: { x: svgPoint2.x, y: svgPoint2.y },
                            d: d3.select(path).attr("d"),
                            pageTop: d3.select(".pen-annotation-layer#layer-" + index).node().getBoundingClientRect().top
                        });
                    }

                    return new Promise((resolve, reject) => {
                        worker.onmessage = (e) => {
                            done++;

                            if (e.data.containCenter) {
                                wordsOfInterest.push({ element: words[e.data.i] });
                            }

                            if (e.data.contain) {
                                annotatedWordsOfInterest.push({ element: words[e.data.i] });
                            }

                            if (e.data.containBox) {
                                boxWordsOfInterest.push({ element: words[e.data.i] });
                            }

                            if (done === words.length) {
                                resolve(wordsOfInterest);
                                worker.terminate();
                            }
                        };
                    });
                };

                if (distance < 400 || checkEnclosed(coords)) {
                    type = "circled_words";

                    checkContainWords(words)
                    .then(() => {
                        if (wordsOfInterest.length === 0) {
                            type = "circled_character";
                            let characters = d3.select(".react-pdf__Page.page-" + index).select(".textLayer").selectAll("span.character").nodes();

                            checkContainWords(characters)
                            .then(() => {
                                if (wordsOfInterest.length === 0) {
                                    type = "annotated_words";
                                    processWords((annotatedWordsOfInterest.length !== 0 && tool.current !== "highlighter") ? annotatedWordsOfInterest : boxWordsOfInterest, type);
                                } else {
                                    processWords(wordsOfInterest, type);
                                }
                            });
                        } else {
                            processWords(wordsOfInterest, type);
                        }
                    });
                } else {
                    type = "annotated_words";

                    checkContainWords(words)
                    .then(() => {
                        if (wordsOfInterest.length === 0) {
                            if (annotatedWordsOfInterest.length === 0 && boxWordsOfInterest.length === 0) {
                                let characters = d3.select(".react-pdf__Page.page-" + index).select(".textLayer").selectAll("span.character").nodes();

                                checkContainWords(characters)
                                .then(() => {
                                    if (wordsOfInterest.length === 0) {
                                        type = "annotated_words";
                                        processWords((annotatedWordsOfInterest.length !== 0 && tool.current !== "highlighter") ? annotatedWordsOfInterest : boxWordsOfInterest, type);
                                    } else {
                                        processWords(wordsOfInterest, type);
                                    }
                                });
                            } else {
                                processWords((annotatedWordsOfInterest.length !== 0 && tool.current !== "highlighter") ? annotatedWordsOfInterest : boxWordsOfInterest, type);
                            }
                        } else {
                            processWords(wordsOfInterest, type);
                        }
                    });
                }
            }
        };
    }, [index, tool, penEndCallback, eraseEndCallback]);

    useEffect(() => {
        d3.select(svgRef.current).html(content);
    }, [content]);

    useEffect(() => {
        lockClusterRef.current = lockCluster;

        return () => {
            lockClusterRef.current = [];
        };
    }, [lockCluster]);

    useEffect(() => {
        clustersRef.current = clustersState;

        return () => {
            clustersRef.current = [];
        };
    }, [clustersState]);

    function onClick(cluster) {
        let firstStroke = cluster.strokes[0].id === "initial" ? cluster.strokes[1] : cluster.strokes[0];

        if (!lockClusterRef.current.find(c => c.strokes.find(stroke => {
            if (!stroke.id || !firstStroke.id || stroke.id === "initial") {
                return false;
            }
            return stroke.id === firstStroke.id;
        }))) {
            for (let c of [...clustersRef.current].concat([...lockClusterRef.current])) {
                if (c !== cluster) {
                    c.open = false;
                }
            }

            setLockCluster([...lockClusterRef.current, cluster]);
            lockClusterRef.current = [...lockClusterRef.current, cluster];

            penCluster.current.removeCluster(cluster);

            let newClusters = [...clustersRef.current];
            let findCluster = newClusters.findIndex(c => c.strokes.find(stroke => stroke.id === cluster.strokes[0].id));

            if (findCluster !== -1) {
                newClusters.splice(findCluster, 1);
            }
            setClusters(newClusters);
            clustersRef.current = newClusters;
            activeCluster.current = cluster;

            if (onNewActiveCluster instanceof Function)
                onNewActiveCluster(cluster, false);
        } else {
            for (let c of [...clustersRef.current].concat([...lockClusterRef.current])) {
                if (c !== cluster) {
                    c.open = false;
                }
            }
            cluster.open = true;
            activeCluster.current = cluster;

            if (onNewActiveCluster instanceof Function)
                onNewActiveCluster(cluster, false);
        }
    }

    function onInference(startTimetamp, cluster, rawText, images) {
        let firstStroke = cluster.strokes[0].id === "initial" ? cluster.strokes[1] : cluster.strokes[0];

        let findCluster = lockClusterRef.current.findIndex(c => c.strokes.find(stroke => {
            if (!stroke.id || !firstStroke?.id || stroke.id === "initial") {
                return false;
            }
            return stroke.id === firstStroke.id;
        }));

        if (findCluster !== -1) {
            let newLockCluster = [...lockClusterRef.current];
            newLockCluster[findCluster].purpose = cluster.purpose;
            setLockCluster(newLockCluster);

            if (onInferenceCallback instanceof Function) {
                onInferenceCallback(startTimetamp, newLockCluster[findCluster], rawText, images);
            }
        }
    }

    function onEndAnnotate(startTimetamp, cluster, rawText) {
        if (onEndAnnotateCallback instanceof Function) {
            onEndAnnotateCallback(startTimetamp, cluster, rawText);
        }
    }

    function setMode(mode) {
        modeRef.current = mode;
    }

    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    useImperativeHandle(ref, () => ({
        updateClusters: (clusters) => {
            setClusters(clusters);
        },
        updateLockCluster: (clusters) => {
            setLockCluster(clusters);
        },
        clusters: clustersRef,
        lockClusters: lockClusterRef,
        svgRef: svgRef.current,
        penCluster: penCluster.current,
        setMode: setMode,
        clusterStrokes: clusterStrokes,
    }), []);

    return (
        <div className={"pen-annotation-layer"} id={"layer-" + index}>
            <svg ref={svgRef} width={"100%"} height={"100%"} style={{ position: "absolute" }} />

            <span className={"pageNumber " + googleSans.className}>{index}</span>
            
            <Tooltip 
                penAnnnotationRef={ref}
                index={index}
                mode={mode}
                handinessRef={handiness}
                disabledRef={disabled}
                onClick={onClick}
                onNewActiveCluster={onNewActiveCluster}
                onClusterChange={onClusterChange}
                onInference={onInference}
                onEndAnnotate={onEndAnnotate}
                setUpAnnotations={setUpAnnotations}
                clusters={[...clustersState, ...lockCluster]}
                toolTipRef={toolTipRef}
            />
        </div>
    );
};

export default PenAnnotation;