import { useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import PenAnnotation from './PenAnnotation.js';
import Toolbar from './Toolbar.js';
import * as d3 from 'd3';

import './App.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url,
).toString();

export default function App() {
    const [numPages, setNumPages] = useState();
    // const [pageNumber, setPageNumber] = useState(1);
    const svgContent = useRef([]);
    // const [containerWidth, setContainerWidth] = useState();
    // const maxWidth = 600;

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
        svgContent.current = Array(numPages).fill(null);
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
                d3.select(span)
                .append("span")
                .text(word)
                .style("position", "relative")
                .style("left", "0px")
                .style("top", "0px")
                .attr("class", "word");

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

    // function handleNewPage(pNum) {
    //     if (pNum > numPages) {
    //         setPageNumber(numPages);
    //     } else if (pNum < 1) {
    //         setPageNumber(1);
    //     } else {
    //         setPageNumber(pNum);
    //     }
    //     svgContent.current[pageNumber] = d3.select(".pen-annotation-layer svg").node().innerHTML;
    // }

    return (
        <>
            <Document file="./leu2022a.pdf" onLoadSuccess={onDocumentLoadSuccess} >
                {Array.from(new Array(numPages), (el, index) =>
                    <div key={`pageContainer_${index + 1}`}>
                        <Page
                            key={`page_${index + 1}`}
                            pageNumber={index + 1}
                            height={window.innerHeight * 1.5}
                            onRenderTextLayerSuccess={() => onLoad(index + 1)}
                            className={`page-${index + 1}`}
                        >
                            <PenAnnotation key={`annotation_${index + 1}`} content={svgContent.current[index + 1]} />
                        </Page>
                        <hr style={{ width: "100%" }} />
                    </div>
                )}
                {/* <button onClick={() => handleNewPage(pageNumber + 1)} style={{ zIndex: 4 }}>Next</button>
                <button onClick={() => handleNewPage(pageNumber - 1)} style={{ zIndex: 4 }}>Previous</button> */}
            </Document>
            <Toolbar />
        </>
    );
}