import React, { useEffect, useRef, useState } from 'react';
import SvgPenSketch from './SvgPenSketch';
import * as d3 from 'd3';
import { ShapeInfo, Intersection } from "kld-intersections";
import PenCluster from './PenCluster';

import Tooltip from './Tooltip.js';
import { Cluster } from './PenCluster';
import "./OpenAIUtils";

import './css/PenAnnotation.css';

function isHorizontalLine(coordinates) {
    if (coordinates.length < 2 || d3.line()(coordinates).length < 100) {
        return false;
    }

    let y = coordinates[0][1];

    for (let i = 1; i < coordinates.length; i++) {
        if (coordinates[i][1] < y - 20 || coordinates[i][1] > y + 20) {
            return false;
        }
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

export default function PenAnnotation({ content, index, tool, colour, onPenDown, onChange }) {
    const svgRef = useRef();
    const svgPenSketch = useRef();
    const penCluster = useRef(new PenCluster());
    const lastCluster = useRef(null);
    const [clustersState, setClusters] = useState([]);
    const [lockCluster, setLockCluster] = useState([]);

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

        if (d3.select(".screenshot-container").empty()) {
            let container = document.createElement("div");

            d3.select(container)
            .attr("class", "screenshot-container")
            .style("position", "absolute")
            .style("top", "0")
            .style("left", "0")
            .style("width", "100%")
            .style("display", "flex")
            .style("justify-content", "center")
            .style("z-index", "-1000");

            document.body.appendChild(container);
        }
    }, []);

    let startTime = useRef(null);
    let timeout = useRef(null);

    useEffect(() => {
        svgPenSketch.current.penStartCallback = (path) => {
            d3.select(path).classed(tool, true).attr("opacity", 1);
            startTime.current = Date.now();
            
            clearTimeout(timeout.current);
            
            if (onPenDown instanceof Function) {
                onPenDown();
            }
        };
    }, [onPenDown, tool]);

    useEffect(() => {
        svgPenSketch.current.penDownCallback = () => {
            d3.select(".toolbar").classed("disabled", true);
        };

        svgPenSketch.current.eraserUpCallback = () => {
            d3.select(".toolbar").classed("disabled", false);
        };

        svgPenSketch.current.eraserDownCallback = (affectedPaths, currPointerEvent, elements, eraserCoords) => {
            d3.select(".toolbar").classed("disabled", true);
            let newClusters = [...clustersState];
            let newLockCluster = [...lockCluster];

            for (let path of affectedPaths) {
                d3.select(path).remove();
                
                let findStroke = newClusters.findIndex(cluster => cluster.strokes.find(stroke => stroke.id === path.id));
                let findLockStroke = lockCluster.findIndex(cluster => cluster.strokes.find(stroke => stroke.id === path.id));
                
                if (findStroke !== -1) {
                    newClusters[findStroke].strokes = [...newClusters[findStroke].strokes.filter(stroke => stroke.id !== path.id)];
                    clearTimeout(timeout.current);

                    timeout.current = setTimeout(() => {
                        setClusters(newClusters);
                    }, 1000);
                }

                if (findLockStroke !== -1) {
                    newLockCluster[findLockStroke].strokes = [...newLockCluster[findLockStroke].strokes.filter(stroke => stroke.id !== path.id)];
                    clearTimeout(timeout.current);

                    timeout.current = setTimeout(() => {
                        setLockCluster(newLockCluster);
                    }, 1000);
                }
                penCluster.current.remove(path.id);
            }

            // if (affectedPaths.length !== 0) {
            // console.log(newClusters.filter(cluster => cluster.strokes.length > 0 && !(cluster.strokes.length === 1 && cluster.strokes[0].id === "initial")));
                
            // }
        };

        let clusterStrokes = async (clusters, stopIteration) => {
            console.log(clusters, stopIteration);
            let newClusterArray = clusters[stopIteration[stopIteration.length - 1]].sort((a, b) => a.lastestTimestamp - b.lastestTimestamp);
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
            let newClusters = [...clustersState];
            lastCluster.current = newClusterArray[newClusterArray.length - 1];

            for (let c of newClusterArray) {
                c = new Cluster(c.strokes);
                let findStroke = newClusters.findIndex(cluster => cluster.strokes.find(stroke => stroke.id === c.strokes[0].id));


                if (findStroke === -1)
                    newClusters.push(c);
                else
                    newClusters[findStroke] = c;
            }
            
            setClusters(newClusters);
            // onChange(c, index);
        };

        svgPenSketch.current.penUpCallback = (path, e, coords) => {
            d3.select(".toolbar").classed("disabled", false);

            if (coords.length < 2) {
                return;
            }
            let scrollCoords = coords.map(coord => [coord[0], coord[1] - window.scrollY]);

            let processWords = (wordsOfInterest) => {
                let words = new Set([...wordsOfInterest.map(w => w.element)]);
                let text = "";

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
                            text += "\n";
                            prevYCoord = closestWordRect.top;
                        }
                        text += word.textContent + " ";

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
                let pageTop = d3.select(".pen-annotation-layer#layer-" + index).node().getBoundingClientRect().top;
                let pathBbox = path.getBoundingClientRect();
                pathBbox.y -= pageTop;
                let [clusters, stopIteration] = penCluster.current.add(path.id, pathBbox, startTime.current, text);
                
                // clusterStrokes(clusters, stopIteration);
                

                clearTimeout(timeout.current);

                timeout.current = setTimeout(() => {
                    clusterStrokes(clusters, stopIteration);
                }, 1000);
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
                        let y = tool === "highlighter" ? rect.top + rect.height / 2 : rect.bottom;

                        return {
                            x1: rect.left,
                            y1: y,
                            x2: rect.right,
                            y2: y,
                            element: word,
                        };
                    });

                    if (tool === "pen") {
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
                                wordsOfInterest.push({ ...rectLines.find(line => line.x1 === e.data.x1 && line.y1 === e.data.y1 && line.x2 === e.data.x2 && line.y2 === e.data.y2), coord: e.data.coord });
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
                        .then(char => processWords(char));
                    } else {
                        processWords(words);
                    }
                });
            } else {
                // Distance of the first coord and the last coord
                let wordsOfInterest = [];
                let distance = (coords[0][0] - coords[coords.length - 1][0]) ** 2 + (coords[0][1] - coords[coords.length - 1][1]) ** 2;
                let checkLoop = checkEnclosed(coords);

                if (!(distance >= 10000 && !checkLoop)) {
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
                    }
                }

                processWords(wordsOfInterest);
            }

        };
    }, [index, tool, onChange, clustersState, lockCluster]);

    useEffect(() => {
        d3.select(svgRef.current).html(content);
    }, [content]);

    useEffect(() => {
        svgPenSketch.current.strokeStyles = {
            ...svgPenSketch.current.strokeStyles,
            stroke: colour,
        };
    }, [colour]);

    useEffect(() => {
        if (tool === "pen") {
            svgPenSketch.current.strokeStyles = {
                ...svgPenSketch.current.strokeStyles,
                "stroke-opacity": 1,
                "stroke-width": "2",
            };
        } else {
            svgPenSketch.current.strokeStyles = {
                ...svgPenSketch.current.strokeStyles,
                "stroke-opacity": 0.2,
                "stroke-width": "25",
            };
        }
    }, [tool]);

    function onClick(cluster) {
        if (!lockCluster.find(c => c.strokes.find(stroke => {
            if (!stroke.id || !cluster.strokes[0]) {
                return false;
            }

            return stroke.id === cluster.strokes[0].id;
        }))) {
            let newCluster = new Cluster(cluster.strokes);
            newCluster.lastestTimestamp = cluster.lastestTimestamp;
            newCluster.open = cluster.open;
            newCluster.x = cluster.x;
            newCluster.y = cluster.y;
            setLockCluster([...lockCluster, newCluster]);

            penCluster.current.removeCluster(cluster);

            let newClusters = [...clustersState];
            let findCluster = newClusters.findIndex(c => c.strokes.find(stroke => stroke.id === cluster.strokes[0].id));

            if (findCluster !== -1) {
                newClusters.splice(findCluster, 1);
            }
            setClusters(newClusters);
        }
    }

    return (
        <div className={"pen-annotation-layer"} id={"layer-" + index}>
            <svg ref={svgRef} width={"100%"} height={"100%"} style={{ position: "absolute" }} />
            
            <Tooltip index={index} onClick={onClick} clusters={[...clustersState, ...lockCluster]} />
        </div>
    );
};
