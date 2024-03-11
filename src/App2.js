import { useRef, useState } from 'react';
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

    const svgContent = useRef([]);

    function onDocumentLoadSuccess({ numPages }) {
        numPages = 2;
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

        // Split the text into words and put them in spans
        spanPresentation.forEach((span) => {
            let text = span.textContent;
            // Get number of leading spaces
            let leadingSpaces = text.match(/^ */)[0].length;
            let trailingSpaces = text.match(/ *$/)[0].length;
            let words = text.split(" ").filter((word) => word !== "");
            d3.select(span).text("");

            // Add leading spaces
            for (let i = 0; i < leadingSpaces; i++) {
                d3.select(span).append("span").text(" ");
            }

            // Add words
            words.forEach((word, i) => {
                // Split the word into characters and put them in spans
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

    return (
        <>
            <Document file="./leu2022a.pdf" onLoadSuccess={onDocumentLoadSuccess} >
                {pageContent}
                <div className="pen-annotation-container">

                    {Array.from(new Array(numPages), (el, index) =>
                        <PenAnnotation index={index + 1} tool={tool} colour={colour} key={`annotation_${index + 1}`} content={svgContent.current[index + 1]} />
                    )}
                </div>
                {/* <button onClick={() => handleNewPage(pageNumber + 1)} style={{ zIndex: 4 }}>Next</button>
                <button onClick={() => handleNewPage(pageNumber - 1)} style={{ zIndex: 4 }}>Previous</button> */}
            </Document>
            <Toolbar tool={tool} onToolChange={onToolChange} onColourChange={onChange} defaultColour={defaultColour} />
        </>
    );
}