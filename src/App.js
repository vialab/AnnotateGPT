import { useState } from 'react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import {
    PdfLoader,
    PdfHighlighter,
    Tip,
    Highlight,
    Popup,
    AreaHighlight,
} from "react-pdf-highlighter";

const HighlightPopup = ({ comment }) => comment.text ? (
    <div className="Highlight__popup">
        {comment.emoji} {comment.text}
    </div>
) : null;

const getNextId = () => String(Math.random()).slice(2);
const parseIdFromHash = () => document.location.hash.slice("#highlight-".length);

export default function App() {
    const [highlights, setHighlights] = useState([]);
    // const [containerWidth, setContainerWidth] = useState();
    // const maxWidth = 600;

    let scrollViewerTo = (highlight) => {};

    function addHighlight(highlight) {
        console.log("Saving highlight", highlight);

        setHighlights([...highlights, { ...highlight, id: getNextId() }]);
    }

    function getHighlightById(id) {
        return highlights.find((highlight) => highlight.id === id);
    }

    let scrollToHighlightFromHash = () => {
        const highlight = getHighlightById(parseIdFromHash());

        if (highlight) {
            scrollViewerTo(highlight);
        }
    };

    let updateHighlight = (highlightId, position, content) => {
        console.log("Updating highlight", highlightId, position, content);

        highlights.map((h) => {
            const {
                id,
                position: originalPosition,
                content: originalContent,
                ...rest
            } = h;
            return id === highlightId
                ? {
                    id,
                    position: { ...originalPosition, ...position },
                    content: { ...originalContent, ...content },
                    ...rest,
                }
                : h;
        });
    };

    return (
        <>
            <div className="App" style={{ display: "flex", height: "100vh", justifyContent: "center", alignItems: "center" }}>
                <div
                    style={{
                        height: "100vh",
                        width: "75vw",
                        position: "relative",
                    }}
                >
                    <PdfLoader url={"./leu2022a.pdf"}>
                        {(pdfDocument) => (
                            <PdfHighlighter
                                pdfDocument={pdfDocument}
                                enableAreaSelection={(event) => event.altKey}
                                onScrollChange={() => document.location.hash = ""}
                                // pdfScaleValue="page-width"
                                scrollRef={(scrollTo) => {
                                    scrollViewerTo = scrollTo;

                                    scrollToHighlightFromHash();
                                }}
                                onSelectionFinished={(
                                    position,
                                    content,
                                    hideTipAndSelection,
                                    transformSelection
                                ) => (
                                    <Tip
                                        onOpen={transformSelection}
                                        onConfirm={(comment) => {
                                            addHighlight({ content, position, comment });

                                            hideTipAndSelection();
                                        }}
                                    />
                                )}
                                highlightTransform={(
                                    highlight,
                                    index,
                                    setTip,
                                    hideTip,
                                    viewportToScaled,
                                    screenshot,
                                    isScrolledTo
                                ) => {
                                    const isTextHighlight = !Boolean(
                                        highlight.content && highlight.content.image
                                    );

                                    const component = isTextHighlight ? (
                                        <Highlight
                                            isScrolledTo={isScrolledTo}
                                            position={highlight.position}
                                            comment={highlight.comment}
                                        />
                                    ) : (
                                        <AreaHighlight
                                            isScrolledTo={isScrolledTo}
                                            highlight={highlight}
                                            onChange={(boundingRect) => {
                                                updateHighlight(
                                                    highlight.id,
                                                    { boundingRect: viewportToScaled(boundingRect) },
                                                    { image: screenshot(boundingRect) }
                                                );
                                            }}
                                        />
                                    );

                                    return (
                                        <Popup
                                            popupContent={<HighlightPopup {...highlight} />}
                                            onMouseOver={(popupContent) =>
                                                setTip(highlight, (highlight) => popupContent)
                                            }
                                            onMouseOut={hideTip}
                                            key={index}
                                            children={component}
                                        />
                                    );
                                }}
                                highlights={highlights}
                            />
                        )}
                    </PdfLoader>
                </div>
            </div>
        </>
    );
}