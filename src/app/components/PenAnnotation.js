import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import SvgPenSketch from './js/SvgPenSketch';
import * as d3 from 'd3';
import { ShapeInfo, Intersection } from "kld-intersections";
import PenCluster, { calculateMinDistance } from './PenCluster';

import Tooltip from './Tooltip.js';
import { Cluster } from './PenCluster';
import "./js/OpenAIUtils";

import './css/PenAnnotation.css';

function isHorizontalLine(coordinates) {
    if (coordinates.length < 2) {
        return false;
    }

    // function getDisplacement(point1, point2) {
    //     var dx = point2[0] - point1[0];
    //     var dy = point2[1] - point1[1];
    //     return dx * dx + dy * dy;
    // }

    // let totalDistance = coordinates.reduce((acc, curr, i) => {
    //     if (i === 0) {
    //         return acc;
    //     }
    //     return acc + getDisplacement(coordinates[i - 1], curr);
    // }, 0);
    // let totalDisplacement = getDisplacement(coordinates[0], coordinates[coordinates.length - 1]);
    
    // if (totalDistance >= totalDisplacement * 1.5) {
    //     return false;
    // }
    // let y = coordinates[0][1];

    // for (let i = 1; i < coordinates.length; i++) {
    //     if (coordinates[i][1] < y - 20 || coordinates[i][1] > y + 20) {
    //         return false;
    //     }
    // }

    let current = coordinates[0];
    let averageX = 0;
    let averageY = 0;

    for (let i = 1; i < coordinates.length; i++) {
        let next = coordinates[i];

        averageX += Math.abs(next[0] - current[0]);
        averageY += Math.abs(next[1] - current[1]);

        current = next;
    }
    averageX /= coordinates.length - 1;
    averageY /= coordinates.length - 1;

    // console.log(averageX / averageY);

    return averageX / averageY > 5;
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

        if (len_sq !== 0) //in case of 0 length line
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

        if (dist < minDistance && dist < 20) {
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
            return -2 < lambda && lambda < 3 && -2 < gamma && gamma < 3;
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

        while (dist(x1, y1, x2, y2) < 400) {
            samplePoint1++;
            i1++;

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

            while (dist(x3, y3, x4, y4) < 400) {
                samplePoint2++;
                i2--;

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
    let pathLength = path.getTotalLength();
    let precision = 100;
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
    }

    return minDistance;
}

const PenAnnotation = forwardRef(({ content, index, tool, colour, toolTipRef, setUpAnnotations, onNewActiveCluster, onClusterChange, onEraseCallback, penStartCallback, penEndCallback, eraseStartCallback, eraseEndCallback }, ref) => {
    const svgRef = useRef();
    const svgPenSketch = useRef();
    const penCluster = useRef(new PenCluster());
    // const lastCluster = useRef(null);
    const paragraphs = useRef([]);
    const [clustersState, setClusters] = useState([]);
    const [lockCluster, setLockCluster] = useState([]);
    const clustersRef = useRef(clustersState);
    const lockClusterRef = useRef(lockCluster);
    const hoveredCluster = useRef(null);
    const hoverTimeout = useRef(null);
    const activeCluster = useRef(null);

    const handleHover = useCallback(e => {
        if (e.buttons === 0 && e.button === -1) {
            if (activeCluster.current && d3.select(`g.toolTip[id="toolTip${activeCluster.current?.strokes[activeCluster.current.strokes.length - 1]?.id}"]`).empty()) {
                activeCluster.current = null;
            }

            let coords = d3.pointer(e);
            let [x, y] = coords;
            let closestCluster = null;

            loop1: for (let cluster of [...clustersRef.current].concat([...lockClusterRef.current])) {
                for (let stroke of cluster.strokes) {
                    if (stroke.id !== "initial" && stroke.id) {
                        let path = d3.select(`path[id="${stroke.id}"]`).node();

                        if (path) {
                            const pointObj = svgPenSketch.current._element.node().createSVGPoint();
                            pointObj.x = x;
                            pointObj.y = y;
                            
                            if (path.isPointInFill(pointObj) || getDistanceFromPointToPath({x, y}, path) < 500) {
                                closestCluster = cluster;
                                break loop1;
                            }
                        }
                    }
                }
            }

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
                        // let id = closestCluster.strokes[closestCluster.strokes.length - 1].id;
                        // let findClosestCluster = lockClusterRef.current.find(cluster => cluster.strokes.find(stroke => stroke.id === id));
                        // let ifOpen = findClosestCluster?.open ? true : false;
                        // console.log(ifOpen, id);
                        // if (findClosestCluster?.open) {
                        //     return;
                        // }

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
                            if (closestCluster.open) {
                                onNewActiveCluster(closestCluster);
                            } else {
                                onNewActiveCluster(null);
                            }
                        }
                        activeCluster.current = closestCluster;
                        setClusters([...clustersRef.current]);
                        setLockCluster([...lockClusterRef.current]);
                    }, 1000);
                }
                hoveredCluster.current = lastStroke.id;
            } else {
                clearTimeout(hoverTimeout.current);
                hoveredCluster.current = null;
            }
        }
    }, [onNewActiveCluster]);

    useEffect(() => {
        svgPenSketch.current = new SvgPenSketch(
            svgRef.current,
            {
                fill: "none",
                stroke: "red",
                "stroke-opacity": 0.3,
                "stroke-width": "25",
            },
            {},
            { eraserMode: "object", eraserSize: "25" }
        );

        if (d3.select(".screenshot-container1").empty()) {
            let container = document.createElement("div");

            d3.select(container)
            .attr("class", "screenshot-container1")
            .style("position", "absolute")
            .style("top", "0")
            .style("left", "0")
            .style("width", "100%")
            .style("display", "flex")
            .style("justify-content", "center")
            .style("z-index", "-1000");

            document.body.appendChild(container);
        }

        if (d3.select(".screenshot-container2").empty()) {
            let container = document.createElement("div");

            d3.select(container)
            .attr("class", "screenshot-container2")
            .style("position", "absolute")
            .style("top", "0")
            .style("left", "0")
            .style("width", "100%")
            .style("height", "var(--annotation-height)")
            .style("display", "flex")
            .style("justify-content", "center")
            .style("z-index", "-1000");

            document.body.appendChild(container);
        }
    }, []);
    
    useEffect(() => {
        svgPenSketch.current._element
        .on("pointermove.hover", (e) => {
            handleHover(e);
        })
        .on("pointerleave.hover", () => {
            clearTimeout(hoverTimeout.current);
        });

        return () => {
            svgPenSketch.current._element
            .on("pointermove.hover", null)
            .on("pointerleave.hover", null);
        };
    }, [handleHover]);

    useEffect(() => {
        let toolbar = d3.select(".toolbar");
        let toolTip = d3.selectAll("#toolTipcanvas");
        let navagation = d3.select(".navigateContainer");

        svgPenSketch.current.eraseStartCallback = () => {
            toolbar.classed("disabled", true);
            toolTip.classed("disabled", true);
            navagation.classed("disabled", true);
            clearTimeout(hoverTimeout.current);
            hoveredCluster.current = null;
            activeCluster.current = null;

            // for (let cluster of [...clustersRef.current].concat([...lockClusterRef.current])) {
            //     cluster.disabled = true;
            //     cluster.open = false;
            // }
            // setClusters([...clustersRef.current]);
            // setLockCluster([...lockClusterRef.current]);
            // activeCluster.current = null;
            
            // if (onNewActiveCluster instanceof Function)
            //     onNewActiveCluster(null);

            if (eraseStartCallback instanceof Function) {
                eraseStartCallback();
            }
        };
    }, [onNewActiveCluster, eraseStartCallback]);

    useEffect(() => {
        svgPenSketch.current.eraserDownCallback = (affectedPaths, currPointerEvent, elements, eraserCoords) => {
            let newClusters = [...clustersRef.current];
            let newLockCluster = [...lockClusterRef.current];

            for (let path of affectedPaths) {
                d3.select(path).remove();
                
                let findStroke = newClusters.findIndex(cluster => cluster.strokes.find(stroke => stroke.id === path.id));
                let findLockStroke = newLockCluster.findIndex(cluster => cluster.strokes.find(stroke => stroke.id === path.id));
                
                if (findStroke !== -1) {
                    newClusters[findStroke].strokes = [...newClusters[findStroke].strokes.filter(stroke => stroke.id !== path.id)];
                    clearTimeout(timeout.current);

                    if (onEraseCallback instanceof Function) {
                        onEraseCallback(newClusters[findStroke]);
                    }
                    // timeout.current = setTimeout(() => {
                    setClusters(newClusters.filter(cluster => cluster.strokes.length > 0 && !(cluster.strokes.length === 1 && cluster.strokes[0].id === "initial")));
                    // }, 1000);
                }

                if (findLockStroke !== -1) {
                    newLockCluster[findLockStroke].strokes = [...newLockCluster[findLockStroke].strokes.filter(stroke => stroke.id !== path.id)];
                    clearTimeout(timeout.current);

                    if (onEraseCallback instanceof Function) {
                        onEraseCallback(newLockCluster[findLockStroke]);
                    }
                    // timeout.current = setTimeout(() => {
                    setLockCluster(newLockCluster.filter(cluster => cluster.strokes.length > 0 && !(cluster.strokes.length === 1 && cluster.strokes[0].id === "initial")));
                    // }, 1000);
                }
                penCluster.current.remove(path.id);
            }

            // if (affectedPaths.length !== 0) {
            // console.log(newClusters.filter(cluster => cluster.strokes.length > 0 && !(cluster.strokes.length === 1 && cluster.strokes[0].id === "initial")));
                
            // }
        };
    }, [onEraseCallback]);

    
    useEffect(() => {
        let toolbar = d3.select(".toolbar");
        let toolTip = d3.selectAll("#toolTipcanvas");
        let navagation = d3.select(".navigateContainer");
        
        svgPenSketch.current.eraserUpCallback = () => {
            toolbar.classed("disabled", false);
            toolTip.classed("disabled", false);
            navagation.classed("disabled", false);

            if (eraseEndCallback instanceof Function) {
                eraseEndCallback();
            }
        };
    }, [eraseEndCallback]);

    useEffect(() => {
        let toolbar = d3.select(".toolbar");
        let toolTip = d3.selectAll("#toolTipcanvas");
        let navagation = d3.select(".navigateContainer");
        
        svgPenSketch.current.penStartCallback = (path) => {
            // for (let cluster of [...clustersRef.current].concat([...lockClusterRef.current])) {
            //     cluster.disabled = true;
            //     cluster.open = false;
            // }
            // activeCluster.current = null;

            // if (onNewActiveCluster instanceof Function)
            //     onNewActiveCluster(null);
            
            // setClusters([...clustersRef.current]);
            // setLockCluster([...lockClusterRef.current]);
            hoveredCluster.current = null;
            activeCluster.current = null;
            clearTimeout(hoverTimeout.current);

            if (tool.current === "pen") {
                d3.select(path)
                .style("stroke-opacity", 1)
                .style("stroke-width", 2);
            } else {
                d3.select(path)
                .style("stroke-opacity", 0.2)
                .style("stroke-width", 25);
            }
            d3.select(path).style("stroke", colour.current);
            d3.select(path).classed(tool.current, true).attr("opacity", 1);
            toolbar.classed("disabled", true);
            toolTip.classed("disabled", true);
            navagation.classed("disabled", true);
            
            startTime.current = Date.now();
            
            clearTimeout(timeout.current);

            if (penStartCallback instanceof Function) {
                penStartCallback();
            }
        };
    }, [tool, colour, onNewActiveCluster, penStartCallback]);

    let startTime = useRef(null);
    let timeout = useRef(null);    

    useEffect(() => {
        let toolbar = d3.select(".toolbar");
        let toolTip = d3.selectAll("#toolTipcanvas");
        let navagation = d3.select(".navigateContainer");

        let clusterStrokes = async (clusters, stopIteration) => {
            console.log(clusters, stopIteration);
            let newClusterArray = clusters[stopIteration[stopIteration.length - 1]];
            // let noText = true;

            // loop1: for (let i = stopIteration[stopIteration.length - 1]; i < clusters.length; i++) {
            //     for (let stroke of clusters[i][clusters[i].length - 1].strokes) {
            //         lastCluster = clusters[i][clusters[i].length - 1];

            //         if (stroke.annotatedText !== "") {
            //             console.log(clusters[i]);
            //             break loop1;
            //         }
            //     }
            // }
            let newClusters = [...clustersRef.current];
            // lastCluster.current = newClusterArray[newClusterArray.length - 1];

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
            setClusters(newClusters.sort((a, b) => a.lastestTimestamp - b.lastestTimestamp));
            // onChange(c, index);
        };

        svgPenSketch.current.penUpCallback = (path, e, coords) => {        
            toolbar.classed("disabled", false);
            toolTip.classed("disabled", false);
            navagation.classed("disabled", false);

            if (coords.length < 2) {
                return;
            }
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
                        // console.log(lines);

                        // let newLines = [];

                        // for (let line of lines) {
                        //     let xDistances = line.map((word, i) => {
                        //         if (i === 0) {
                        //             return null;
                        //         }
                        //         return line[i].getBoundingClientRect().left - line[i - 1].getBoundingClientRect().right;
                        //     }
                        //     );
                        //     let xDistance = d3.mean(xDistances);
                        //     let newLine = [];

                        //     for (let word of line) {
                        //         let closestWordRect = word.getBoundingClientRect();

                        //         if (newLine.length === 0) {
                        //             newLine.push(word);
                        //         } else {
                        //             let prevWordRect = newLine[newLine.length - 1].getBoundingClientRect();

                        //             if (closestWordRect.left - prevWordRect.right - xDistance / 2 <= xDistance) {
                        //                 newLine.push(word);
                        //             } else {
                        //                 newLines.push(newLine);
                        //                 newLine = [word];
                        //             }
                        //         }
                        //     }
                        //     newLines.push(newLine);
                        // }
                        // console.log(newLines);
                
                        let yDistances = lines.map((line, i) => {
                            if (i === 0) {
                                return null;
                            }
                            return lines[i][0].getBoundingClientRect().top - lines[i - 1][0].getBoundingClientRect().bottom;
                        });
                        let yDistance = d3.mean(yDistances);
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
                let pageTop = d3.select(".pen-annotation-layer#layer-" + index).node().getBoundingClientRect().top;

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
                            // text.push("\n");
                            prevYCoord = closestWordRect.top;
                        }
                        text.push(word);

                        // if (type !== "underlined_character") {
                        //     text.push(" ");
                        // }
                        textBBox.x1 = Math.min(textBBox.x1, closestWordRect.left);
                        textBBox.y1 = Math.min(textBBox.y1, closestWordRect.top - pageTop);
                        textBBox.x2 = Math.max(textBBox.x2, closestWordRect.right);
                        textBBox.y2 = Math.max(textBBox.y2, closestWordRect.bottom - pageTop);

                        // d3.select("body")
                        // .append("div")
                        // .style("position", "absolute")
                        // .attr("class", "highlighted-word")
                        // .style("top", `${closestWordRect.top + window.scrollY}px`)
                        // .style("left", `${closestWordRect.left}px`)
                        // .style("width", `${closestWordRect.width}px`)
                        // .style("height", `${closestWordRect.height}px`)
                        // .style("border", (d3.select(word).attr("class") === "word" ? "2px solid red" : "1px solid green"));
                    }
                }
                let pathBbox = path.getBoundingClientRect();
                pathBbox.y -= pageTop;

                if (text.length === 0) {
                    type = "annotated";

                    for (let paragraph of paragraphs.current) {
                        for (let line of paragraph) {
                            let y1 = d3.min(line.map(word => word.getBoundingClientRect().top - pageTop));
                            let y2 = d3.max(line.map(word => word.getBoundingClientRect().bottom - pageTop));

                            if ((pathBbox.y < y2 || pathBbox.y + pathBbox.height < y2) && (pathBbox.y > y1 || pathBbox.y + pathBbox.height > y1)) {
                                // marginalText += paragraph.map(line => line.map(word => word).join(" ")).join(" ") + " ";
                                
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

                    if (marginalTextBBox.x1 === Infinity) {
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
                        // console.log(closestParagraph);
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
                    // d3.select("body")
                    // .append("div")
                    // .style("position", "absolute")
                    // .style("top", `${lineBBox.y1 + window.scrollY + pageTop}px`)
                    // .style("left", `${lineBBox.x1}px`)
                    // .style("width", `${lineBBox.x2 - lineBBox.x1}px`)
                    // .style("height", `${lineBBox.y2 - lineBBox.y1}px`)
                    // .style("border", "2px solid red");
                }

                if (tool.current === "highlighter") {
                    type = type.replace("underlined", "highlighted");
                }
                let [clusters, stopIteration] = penCluster.current.add(
                    path.id,
                    pathBbox,
                    type,
                    startTime.current,
                    text,
                    marginalText,
                    {x: textBBox.x1, y: textBBox.y1, width: textBBox.x2 - textBBox.x1, height: textBBox.y2 - textBBox.y1},
                    {x: marginalTextBBox.x1, y: marginalTextBBox.y1, width: marginalTextBBox.x2 - marginalTextBBox.x1, height: marginalTextBBox.y2 - marginalTextBBox.y1},
                    {x: lineBBox.x1, y: lineBBox.y1, width: lineBBox.x2 - lineBBox.x1, height: lineBBox.y2 - lineBBox.y1}
                );
                clearTimeout(timeout.current);
                clusterStrokes(clusters, stopIteration);

                // timeout.current = setTimeout(() => {
                // }, 1000);

                if (penEndCallback instanceof Function) {
                    penEndCallback();
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
                        let y = tool.current === "highlighter" ? rect.top + rect.height / 2 : rect.bottom + 5;

                        return {
                            x1: rect.left,
                            y1: y,
                            x2: rect.right,
                            y2: y,
                            element: word,
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
                            // eslint-disable-next-line no-new-func
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
                                    wordsOfInterest.push({ ...line, coord: e.data.coord });
                                } else {
                                    console.log(e.data, line);
                                }
                            }
                            length++;

                            if (length === scrollCoords.length && wordsOfInterest.length > 0) {
                                let majorityY = d3.median(wordsOfInterest.map(w => w.element.getBoundingClientRect().bottom));
                                let wordsOfInterestFiltered = wordsOfInterest.filter(w => w.element.getBoundingClientRect().bottom > majorityY - 5 && w.element.getBoundingClientRect().bottom < majorityY + 5);

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
                                resolve(wordsOfInterest);
                                worker.terminate();
                            }
                        };
                    });
                };

                let words = d3.select(".react-pdf__Page.page-" + index).select(".textLayer").selectAll("span.word").nodes().filter(word => {
                    return word.textContent.trim() !== "";
                });

                checkLineWords(words)
                .then(words => {
                    if (words.length === 0) {
                        let characters = d3.select(".react-pdf__Page.page-" + index)
                        .select(".textLayer")
                        .selectAll("span.character")
                        .nodes().filter(word => {
                            return word.textContent.trim() !== "";
                        });

                        checkLineWords(characters)
                        .then(char => {
                            let parentNode = new Set(char.map(c => c.element.parentNode));                            

                            processWords([...parentNode].map(p => { return { element: p }; }), "underlined_character");
                        });
                    } else {
                        processWords(words, "underlined_words");
                    }
                });
            } else {
                // Distance of the first coord and the last coord
                let wordsOfInterest = [];
                let distance = (coords[0][0] - coords[coords.length - 1][0]) ** 2 + (coords[0][1] - coords[coords.length - 1][1]) ** 2;
                let type = "circled_words";

                if (distance < 10000 || checkEnclosed(coords)) {
                    let shape = ShapeInfo.path(d3.select(path).attr("d"));
                    let words = d3.select(".react-pdf__Page.page-" + index).select(".textLayer").selectAll("span.word").nodes();
                    let pathBoundingBox = path.getBoundingClientRect();
                    let svgBoundingBox = svgRef.current.getBoundingClientRect();

                    let checkContainWords = (words) => {
                        for (let word of words) {
                            let rect = word.getBoundingClientRect();
                            let svgPoint = svgRef.current.createSVGPoint();
                            svgPoint.x = rect.left;
                            svgPoint.y = rect.top - svgBoundingBox.top;
                            svgPoint = svgPoint.matrixTransform(svgRef.current.getScreenCTM());

                            let svgPoint2 = svgRef.current.createSVGPoint();
                            svgPoint2.x = rect.right;
                            svgPoint2.y = rect.bottom - svgBoundingBox.top;
                            svgPoint2 = svgPoint2.matrixTransform(svgRef.current.getScreenCTM());

                            // d3.select(svgRef.current)
                            // .append("rect")
                            // .attr("x", svgPoint.x)
                            // .attr("y", svgPoint.y - svgBoundingBox.top)
                            // .attr("width", svgPoint2.x - svgPoint.x)
                            // .attr("height", svgPoint2.y - svgPoint.y)
                            // .attr("fill", "none")
                            // .attr("stroke", "black");

                            let rectShape = ShapeInfo.rectangle(svgPoint.x, svgPoint.y - svgBoundingBox.top, svgPoint2.x - svgPoint.x, svgPoint2.y - svgPoint.y);
                            let intersection = Intersection.intersect(rectShape, shape);

                            if (intersection.status === "Intersection") {
                                let center = [svgPoint.x + (svgPoint2.x - svgPoint.x) / 2, svgPoint.y - svgBoundingBox.top + (svgPoint2.y - svgPoint.y) / 2];
                                let rightCenter = [svgPoint2.x - (svgPoint2.x - svgPoint.x) / 4, svgPoint.y - svgBoundingBox.top + (svgPoint2.y - svgPoint.y) / 2 + (svgPoint2.y - svgPoint.y) / 4];
                                let leftCenter = [svgPoint.x + (svgPoint2.x - svgPoint.x) / 4, svgPoint.y - svgBoundingBox.top + (svgPoint2.y - svgPoint.y) / 4];

                                // d3.select(svgRef.current)
                                // .append("circle")
                                // .attr("cx", center[0])
                                // .attr("cy", center[1])
                                // .attr("r", 5)
                                // .attr("fill", "black");

                                // d3.select(svgRef.current)
                                // .append("circle")
                                // .attr("cx", rightCenter[0])
                                // .attr("cy", rightCenter[1])
                                // .attr("r", 5)
                                // .attr("fill", "black");

                                // d3.select(svgRef.current)
                                // .append("circle")
                                // .attr("cx", leftCenter[0])
                                // .attr("cy", leftCenter[1])
                                // .attr("r", 5)
                                // .attr("fill", "black");

                                if (d3.polygonContains(coords, center) && d3.polygonContains(coords, rightCenter) && d3.polygonContains(coords, leftCenter)) {
                                    wordsOfInterest.push({ element: word });
                                }
                            } else {
                                let rectBoundingBox = word.getBoundingClientRect();

                                if (rectBoundingBox.left > pathBoundingBox.x && rectBoundingBox.right < pathBoundingBox.x + pathBoundingBox.width && rectBoundingBox.top > pathBoundingBox.y && rectBoundingBox.bottom < pathBoundingBox.y + pathBoundingBox.height) {
                                    wordsOfInterest.push({ element: word });
                                }
                            }
                        }
                    };
                    checkContainWords(words);

                    if (wordsOfInterest.length === 0) {
                        let characters = d3.select(".react-pdf__Page.page-" + index).select(".textLayer").selectAll("span.character").nodes();
                        checkContainWords(characters);
                        type = "circled_character";
                    }
                }
                processWords(wordsOfInterest, type);
            }
        };
    }, [index, tool, colour, onNewActiveCluster, penEndCallback]);

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
        if (!lockClusterRef.current.find(c => c.strokes.find(stroke => {
            if (!stroke.id || !cluster.strokes[0]) {
                return false;
            }
            return stroke.id === cluster.strokes[0].id;
        }))) {
            for (let c of [...clustersRef.current].concat([...lockClusterRef.current])) {
                c.open = false;
            }
            let newCluster = new Cluster(cluster.strokes);
            newCluster.lastestTimestamp = cluster.lastestTimestamp;
            newCluster.open = true;
            newCluster.x = cluster.x;
            newCluster.y = cluster.y;
            newCluster.purpose = cluster.purpose;
            setLockCluster([...lockClusterRef.current, newCluster]);

            penCluster.current.removeCluster(cluster);

            let newClusters = [...clustersRef.current];
            let findCluster = newClusters.findIndex(c => c.strokes.find(stroke => stroke.id === cluster.strokes[0].id));

            if (findCluster !== -1) {
                newClusters.splice(findCluster, 1);
            }
            setClusters(newClusters);
            clustersRef.current = newClusters;
            activeCluster.current = newCluster;

            if (onNewActiveCluster instanceof Function)
                onNewActiveCluster(newCluster);
        } else {
            for (let c of [...clustersRef.current].concat([...lockClusterRef.current])) {
                c.open = false;
            }
            cluster.open = true;
            activeCluster.current = cluster;

            if (onNewActiveCluster instanceof Function)
                onNewActiveCluster(cluster);
        }
    }

    function onInference(cluster) {
        let findCluster = lockClusterRef.current.findIndex(c => c.strokes.find(stroke => stroke.id === cluster.strokes[0].id));

        if (findCluster !== -1) {
            let newLockCluster = [...lockClusterRef.current];
            newLockCluster[findCluster].purpose = cluster.purpose;
            // newLockCluster[findCluster].open = cluster.open;
            setLockCluster(newLockCluster);
        }
    }

    useImperativeHandle(ref, () => ({
        updateClusters: (clusters) => {
            setClusters(clusters);
        },
        updateLockCluster: (clusters) => {
            setLockCluster(clusters);
        },
        clusters: clustersRef,
        lockClusters: lockClusterRef,
    }), []);

    return (
        <div className={"pen-annotation-layer"} id={"layer-" + index}>
            <svg ref={svgRef} width={"100%"} height={"100%"} style={{ position: "absolute" }} />
            
            <Tooltip penAnnnotationRef={ref} index={index} onClick={onClick} onNewActiveCluster={onNewActiveCluster} onClusterChange={onClusterChange} onInference={onInference} setUpAnnotations={setUpAnnotations} clusters={[...clustersState, ...lockCluster]} toolTipRef={toolTipRef} />
        </div>
    );
});

export default PenAnnotation;
