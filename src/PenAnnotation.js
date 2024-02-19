import React, { useEffect, useRef } from 'react';
import SvgPenSketch from './SvgPenSketch';
import * as d3 from 'd3';
import { ShapeInfo, Intersection } from "kld-intersections";

import './PenAnnotation.css';

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

export default function PenAnnotation({ content }) {
    const svgRef = useRef();

    useEffect(() => {
        let svgPenSketch = new SvgPenSketch(
            svgRef.current,
            {
                fill: "none",
                "fill-opacity": 1,
                stroke: "red",
                "stroke-opacity": 0.3,
                "stroke-width": "25",
            },
            {},
            { eraserMode: "object", eraserSize: "25" }
        );

        svgPenSketch.eraserUpCallback = (affectedPaths, currPointerEvent, elements, eraserCoords) => {
            d3.select(".toolbar").classed("disabled", false);
        };

        svgPenSketch.eraserDownCallback = (affectedPaths, currPointerEvent, elements, eraserCoords) => {
            d3.select(".toolbar").classed("disabled", true);

            for (let path of affectedPaths) {
                d3.select(path).remove();
            }
        };

        svgPenSketch.penDownCallback = (path, e, coords) => {
            d3.select(".toolbar").classed("disabled", true);
        };

        svgPenSketch.penUpCallback = (path, e, coords) => {
            d3.select(".toolbar").classed("disabled", false);
            // Check words underlined
            if (coords.length < 2) {
                return;
            }
            let scrollCoords = coords.map(coord => [coord[0], coord[1] - window.scrollY]);
            let wordsOfInterest = new Set();

            if (isHorizontalLine(scrollCoords)) {
                let page = svgRef.current.closest(".react-pdf__Page");
                let words = d3.select(page).selectAll(".textLayer span.word").nodes();

                if (words.length === 0) {
                    return;
                }
                let bottomLines = words.filter(word => {
                    return word.textContent.trim() !== "";
                }).map(word => {
                    let rect = word.getBoundingClientRect();

                    return {
                        x1: rect.left,
                        y1: rect.bottom,
                        x2: rect.right,
                        y2: rect.bottom,
                        element: word,
                    };
                });
                let svgPoint = svgRef.current.createSVGPoint();
                let allLines = bottomLines.map(line => {
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
                        postMessage(closestLine);
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
                // Wait for worker to finish
                let length = 0;

                worker.onmessage = (e) => {
                    if (e.data !== undefined) {
                        // console.log(wordsOfInterest);
                        wordsOfInterest.add(bottomLines.find(line => line.x1 === e.data.x1 && line.y1 === e.data.y1 && line.x2 === e.data.x2 && line.y2 === e.data.y2));
                    }
                    length++;

                    if (length === scrollCoords.length) {
                        let majorityY = d3.median([...wordsOfInterest].map(w => w.element.getBoundingClientRect().bottom));
                        let wordsOfInterestFiltered = [...wordsOfInterest].filter(w => w.element.getBoundingClientRect().bottom > majorityY - 5 && w.element.getBoundingClientRect().bottom < majorityY + 5);

                        let leftMostX = d3.min([...wordsOfInterest].map(w => w.element.getBoundingClientRect().left));
                        let rightMostX = d3.max([...wordsOfInterest].map(w => w.element.getBoundingClientRect().right));

                        
                        for (let word of words) {
                            let rect = word.getBoundingClientRect();

                            if (rect.left > leftMostX && rect.right < rightMostX && rect.bottom > majorityY - 5 && rect.bottom < majorityY + 5) {
                                wordsOfInterestFiltered.push({element: word});
                            }
                        }

                        for (let word of wordsOfInterestFiltered) {
                            let closestWordRect = word.element.getBoundingClientRect();

                            d3.select("html")
                            .append("div")
                            .style("position", "absolute")
                            .style("top", `${closestWordRect.top + window.scrollY}px`)
                            .style("left", `${closestWordRect.left}px`)
                            .style("width", `${closestWordRect.width}px`)
                            .style("height", `${closestWordRect.height}px`)
                            .style("border", "1px solid red");
                        }

                    }
                };
            } else {
                // Distance of the first coord and the last coord
                let distance = Math.sqrt((coords[0][0] - coords[coords.length - 1][0]) ** 2 + (coords[0][1] - coords[coords.length - 1][1]) ** 2);
                if (distance > 50) {
                    return;
                }
                let shape = ShapeInfo.path(d3.select(path).attr("d"));

                let page = svgRef.current.closest(".react-pdf__Page");
                let words = d3.select(page).selectAll(".textLayer span.word").nodes();
                let pathBoundingBox = path.getBoundingClientRect();
                let svgBoundingBox = svgRef.current.getBoundingClientRect();

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
                        let rightCenter = [svgPoint2.x - (svgPoint2.x - svgPoint.x) / 4 , svgPoint.y - svgBoundingBox.top + (svgPoint2.y - svgPoint.y) / 2 + (svgPoint2.y - svgPoint.y) / 4];
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
                        
                        if (d3.polygonContains(coords, center) && d3.polygonContains(coords, rightCenter) && d3.polygonContains(coords, leftCenter)){
                            wordsOfInterest.add(word);
                        }
                    } else {
                        let rectBoundingBox = word.getBoundingClientRect();

                        if (rectBoundingBox.left > pathBoundingBox.x && rectBoundingBox.right < pathBoundingBox.x + pathBoundingBox.width && rectBoundingBox.top > pathBoundingBox.y && rectBoundingBox.bottom < pathBoundingBox.y + pathBoundingBox.height) {
                            wordsOfInterest.add(word);
                        }
                    }
                }

                for (let word of wordsOfInterest) {
                    let closestWordRect = word.getBoundingClientRect();

                    d3.select("html")
                    .append("div")
                    .style("position", "absolute")
                    .style("top", `${closestWordRect.top + window.scrollY}px`)
                    .style("left", `${closestWordRect.left}px`)
                    .style("width", `${closestWordRect.width}px`)
                    .style("height", `${closestWordRect.height}px`)
                    .style("border", "1px solid red");
                }
            }
        };
    }, []);

    useEffect(() => {
        d3.select(svgRef.current).html(content);
    }, [content]);

    return (
        <div className="pen-annotation-layer">
            <svg ref={svgRef} width={"100%"} height={"100%"} />
        </div>
    );
};
