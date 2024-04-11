import { useEffect, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import PenAnnotation from './PenAnnotation.js';
import Toolbar from './Toolbar.js';
import * as d3 from 'd3';

import './css/App.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url,
).toString();

export default function App() {
    const defaultColour = "#000000";

    const [numPages, setNumPages] = useState();
    const [colour, setColour] = useState(defaultColour);
    const [pageContent, setPageContent] = useState([]);
    const [tool, setTool] = useState("pen");
    const [lastCluster, setLastCluster] = useState(null);
    const [open, setOpen] = useState(false);

    const svgContent = useRef([]);
    const toolTipRef = useRef(null);

    function onDocumentLoadSuccess({ numPages }) {
        numPages = 3;
        setNumPages(numPages);
        svgContent.current = Array(numPages).fill(null);

        let pageContent = Array.from(new Array(numPages), (el, index) =>
            <div className="page-container" key={`pageContainer_${index + 1}`} style={{ position: "relative" }}>
                <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    height={window.innerHeight * 1.5}
                    onRenderTextLayerSuccess={() => onLoad(index + 1)}
                    className={`page-${index + 1}`}
                >
                </Page>
                { index !== numPages - 1 ? <hr style={{ width: "100%" }} /> : null }
            </div>
        );
        setPageContent(pageContent);
    }

    function onLoad(index) {
        let spanPresentation = d3.select(".react-pdf__Page.page-" + index)
        .select(".textLayer")
        .selectAll("span[role='presentation']")
        .nodes();

        spanPresentation.forEach((span) => {
            let text = span.textContent;
            let leadingSpaces = text.match(/^ */)[0].length;
            let trailingSpaces = text.match(/ *$/)[0].length;
            let words = text.split(" ").filter((word) => word !== "");
            d3.select(span).text("");

            for (let i = 0; i < leadingSpaces; i++) {
                d3.select(span).append("span").text(" ");
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
                    d3.select(span).append("span").text(" ").style("position", "relative");
                }
            });

            if (words.length !== 0) {
                for (let i = 0; i < trailingSpaces; i++) {
                    d3.select(span).append("span").text(" ");
                }
            }
        });
    }

    function onChange(colour, event) {
        setColour(colour.hex);
    }

    function onToolChange(tool) {
        setTool(tool);
    }

    function onClusterChange(cluster, index) {
        let bbox = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };

        for (let stroke of cluster.strokes) {
            if (!d3.select(`[id="${stroke.id}"]`).empty()) {
                let bb = stroke.bbox;
                bbox.x1 = Math.min(bb.x, bbox.x1);
                bbox.y1 = Math.min(bb.y, bbox.y1);
                bbox.x2 = Math.max(bb.x + bb.width, bbox.x2);
                bbox.y2 = Math.max(bb.y + bb.height, bbox.y2);
            }
        }

        if (bbox.x1 === Infinity) {
            d3.selectAll(".bboxAnnotation, .bboxAnnotationLine").remove();
            setLastCluster(null);
            return;
        }

        if (d3.select("div#layer-" + index).select(".bboxAnnotation").empty()) {
            d3.select("div#layer-" + index)
            .select("svg")
            .append("rect")
            .attr("class", "bboxAnnotation");

            d3.select("div#layer-" + index)
            .select("svg")
            .append("line")
            .attr("class", "bboxAnnotationLine");
        }

        d3.select("div#layer-" + index)
        .select(".bboxAnnotation")
        .attr("x", bbox.x1 * window.innerWidth - 10)
        .attr("y", bbox.y1 * window.innerHeight - 10)
        .attr("rx", 10)
        .attr("width", (bbox.x2 - bbox.x1) * window.innerWidth + 20)
        .attr("height", (bbox.y2 - bbox.y1) * window.innerHeight + 20)
        .attr("fill", "none")
        .attr("opacity", 0)
        .attr("stroke", "url(#bboxGradient)");

        let strokeList = [];

        for (let i = 0; i < cluster.strokes.length; i++) {
            let stroke = cluster.strokes[i];
            let strokeID = stroke.id;

            if (strokeID !== "initial") {
                let strokeColour = d3.select(`path[id="${strokeID}"]`).style("stroke");
                strokeList.push({bbox: stroke.bbox, colour: strokeColour});
            }
        }
        strokeList.sort((a, b) => a.bbox.y - b.bbox.y);
        
        let right = d3.select(".react-pdf__Page__canvas").node().getBoundingClientRect().right;
        let lastStroke = cluster.strokes[cluster.strokes.length - 1];
        let lastStrokeBbox = lastStroke.bbox;
        let lastStrokeColour = d3.select(`path[id="${lastStroke.id}"]`).style("stroke");

        let lineGradient = d3.select("svg#toolTipcanvas")
        .select("defs")
        .select("linearGradient#annotationLineGradient");

        lineGradient.selectAll("stop").remove();

        lineGradient.append("stop")
        .attr("offset", "0%")
        .style("stop-color", lastStrokeColour);
        
        lineGradient.append("stop")
        .attr("offset", "100%")
        .style("stop-color", strokeList[0].colour);

        d3.select("div#layer-" + index)
        .select(".bboxAnnotationLine")
        .attr("x1", right + 12)
        .attr("y1", (lastStrokeBbox.y + lastStrokeBbox.height / 2) * window.innerHeight)
        .attr("x2", bbox.x2 * window.innerWidth + 10)
        .attr("y2", (lastStrokeBbox.y + lastStrokeBbox.height / 2) * window.innerHeight + 0.5)
        .attr("stroke", "url(#annotationLineGradient)")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", 2)
        .attr("opacity", 0);

        let minY = strokeList[0].bbox.y;
        let maxY = strokeList[strokeList.length - 1].bbox.y + strokeList[strokeList.length - 1].bbox.height;

        let gradient = d3.select("svg#toolTipcanvas")
        .select("defs")
        .select("linearGradient#bboxGradient");

        gradient.selectAll("stop").remove();
        
        for (let i = 0; i < strokeList.length; i++) {
            gradient.append("stop")
            .attr("offset", `${(strokeList[i].bbox.y + strokeList[i].bbox.height / 2 - minY) / (maxY - minY) * 100}%`)
            .style("stop-color", strokeList[i].colour);
        }

        setTimeout(() => {
            setLastCluster(cluster);
        }, 1500);
    }

    function onPenDown() {
        if (open)
            setOpen(false);

        d3.select(toolTipRef.current)
        .style("cursor", "pointer");
    }

    // useEffect(() => {
    //     const currentRef = toolTipRef.current;

    //     d3.select(toolTipRef.current)
    //     .style("cursor", "pointer")
    //     .on("click", function () {
    //         setOpen(true);
    //         d3.select(toolTipRef.current).style("cursor", "default");
    //     });

    //     return () => {
    //         d3.select(currentRef).on("click", null);
    //     };
    // }, []);

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

                    {Array.from(new Array(numPages), (el, index) =>
                        <PenAnnotation onPenDown={onPenDown} onChange={onClusterChange} index={index + 1} tool={tool} colour={colour} key={`annotation_${index + 1}`} content={svgContent.current[index + 1]} />
                    )}
                </div>
                {/* <button onClick={() => handleNewPage(pageNumber + 1)} style={{ zIndex: 4 }}>Next</button>
                <button onClick={() => handleNewPage(pageNumber - 1)} style={{ zIndex: 4 }}>Previous</button> */}
            </Document>
            <Toolbar tool={tool} onToolChange={onToolChange} onColourChange={onChange} defaultColour={defaultColour} />
        </>
    );
}