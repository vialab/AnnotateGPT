import { useEffect, useRef } from "react";
import * as d3 from "d3";
import "./css/NavigateCluster.css";

export default function NavigateCluster({ cluster, annotations }) {
    let annotationsRef = useRef(annotations);
    let index = useRef(0);
    let isScroll = useRef(false);
    let resetIndex = useRef(true);

    function scrollTween(offset) {
        return function () {
            var i = d3.interpolateNumber(document.documentElement.scrollTop, offset);
            return function (t) {
                window.scrollTo(0, i(t));
            };
        };
    }

    function scrollTo(y) {
        d3.select("html")
        .transition()
        .duration(1000)
        .tween("scroll", scrollTween(y))
        .on("start", () => {
            isScroll.current = true;
        })
        .on("end", () => {
            isScroll.current = false;
        });
    }

    let onPrev = () => {
        if (resetIndex.current) {
            resetIndex.current = false;

            let distances = annotationsRef.current.map(annotation => {
                let y = d3.mean(annotation.spans.map(span => {
                    if (span.classList?.contains("toolTip")) {
                        span = d3.select("g.toolTip#" + span.id).node();
                    }
                    return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
                }));
                return Math.floor(window.innerHeight / 2 - Math.round(y));
            }).map(d => d <= 0 ? Infinity : d);

            let i = distances.indexOf(Math.min(...distances));
            let prevAnnotation = annotationsRef.current[i];

            if (prevAnnotation && distances[i] !== Infinity) {
                let y = d3.mean(prevAnnotation.spans.map(span => {
                    if (span.classList?.contains("toolTip")) {
                        span = d3.select("g.toolTip#" + span.id).node();
                    }
                    return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
                }));
                scrollTo(y + window.scrollY - window.innerHeight / 2);
                index.current = i;
            }
        } else {
            if (index.current > 0) {
                index.current--;
            }
            let annotation = annotationsRef.current[index.current]?.spans;
    
            if (annotation) {
                let yCoord = d3.mean(annotation.map(span => {
                    if (span.classList?.contains("toolTip")) {
                        span = d3.select("g.toolTip#" + span.id).node();
                    }
                    return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
                }));        
                scrollTo(yCoord - window.innerHeight / 2 + window.scrollY);
            }
        }
        d3.select("#topButton")
        .classed("disabled", index.current === 0);

        d3.select("#bottomButton")
        .classed("disabled", index.current === annotationsRef.current.length - 1);
    };
    
    let onNext = () => {
        if (resetIndex.current) {
            resetIndex.current = false;

            let distances = annotationsRef.current.map(annotation => {
                let y = d3.mean(annotation.spans.map(span => {
                    if (span.classList?.contains("toolTip")) {
                        span = d3.select("g.toolTip#" + span.id).node();
                    }
                    return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
                }));
                return Math.floor(Math.round(y) - window.innerHeight / 2);
            }).map(d => d <= 0 ? Infinity : d);

            let i = distances.indexOf(Math.min(...distances));
            let nextAnnotation = annotationsRef.current[i];

            if (nextAnnotation && distances[i] !== Infinity) {
                let y = d3.mean(nextAnnotation.spans.map(span => {
                    if (span.classList.contains("toolTip")) {
                        span = d3.select("g.toolTip#" + span.id).node();
                    }
                    return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
                }));
                scrollTo(y - window.innerHeight / 2 + window.scrollY);
                index.current = i;
            }
        } else {
            if (index.current < annotationsRef.current.length - 1) {
                index.current++;
            }
            let annotation = annotationsRef.current[index.current]?.spans;
    
            if (annotation) {
                let yCoord = d3.mean(annotation.map(span => {
                    if (span.classList?.contains("toolTip")) {
                        span = d3.select("g.toolTip#" + span.id).node();
                    }
                    return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
                }));        
                scrollTo(yCoord - window.innerHeight / 2 + window.scrollY);
            }
        }

        d3.select("#bottomButton")
        .classed("disabled", index.current === annotationsRef.current.length - 1);

        d3.select("#topButton")
        .classed("disabled", index.current === 0);
    };

    let findIndex = () => {
        let distances = annotationsRef.current.map(annotation => {
            let y = d3.mean(annotation.spans.map(span => {
                if (span.classList?.contains("toolTip")) {
                    span = d3.select("g.toolTip#" + span.id).node();
                }
                return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
            }));
            return Math.floor(Math.abs(Math.round(y) - window.innerHeight / 2));
        });
        index.current = distances.indexOf(Math.min(...distances));
        resetIndex.current = true;

        // if (index.current === 0) {
        //     let y = d3.mean(annotationsRef.current[index.current].spans.map(span => {
        //         if (span.classList?.contains("toolTip")) {
        //             span = d3.select("g.toolTip#" + span.id).node();
        //         }
        //         return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
        //     }));
        //     let distance = Math.floor(window.innerHeight / 2 - Math.round(y));
        //     console.log(distance);

        //     if (distance > 0) {
        //         index.current = 1;
        //     }
        // } else if (index.current === annotationsRef.current.length - 1 && annotationsRef.current.length > 0) {
        //     let y = d3.mean(annotationsRef.current[index.current].spans.map(span => {
        //         if (span.classList?.contains("toolTip")) {
        //             span = d3.select("g.toolTip#" + span.id).node();
        //         }
        //         return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
        //     }));
        //     let distance = Math.floor(Math.round(y) - window.innerHeight / 2);

        //     if (distance > 0) {
        //         index.current = annotationsRef.current.length - 2;
        //     }
        // }

        if (window.scrollY === 0) {
            index.current = 0;
        } else if (window.scrollY + window.innerHeight >= document.body.scrollHeight) {
            index.current = annotationsRef.current.length - 1;
        }
        // console.log(index.current);

        d3.select("#topButton")
        .classed("disabled", index.current === 0);

        d3.select("#bottomButton")
        .classed("disabled", index.current === annotationsRef.current.length - 1);
    };

    useEffect(() => {
        d3.select(window)
        .on("scroll", () => {
            if (!isScroll.current) {
                resetIndex.current = true;
                findIndex();
            }
        });

        return () => {
            d3.select(window).on("scroll", null);
        };
    }, []);

    useEffect(() => {
        let tAnnotations = [...annotations];

        if (cluster && tAnnotations.length > 0) {
            let tooltip = d3.select("g.toolTip#toolTip" + cluster.strokes[cluster.strokes.length - 1].id).node();
            tAnnotations.push({ spans: [tooltip] });
        }

        let sortAnnotations = tAnnotations.sort((a, b) => {
            // console.log(a.spans, b.spans);
            let aY = d3.mean(a.spans.filter(span => span instanceof Element).map(span => span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2 + window.scrollY));
            let bY = d3.mean(b.spans.filter(span => span instanceof Element).map(span => span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2 + window.scrollY));
            return aY - bY;
        });
        annotationsRef.current = sortAnnotations;
        // console.log(annotationsRef.current);

        for (let i = 0; i < annotationsRef.current.length; i++) {
            // console.log(annotationsRef.current[i].spans);
            annotationsRef.current[i].spans = annotationsRef.current[i].spans.filter(span => span instanceof Element);
        }
        findIndex();

        return () => {
            annotationsRef.current = [];
        };
    }, [annotations, cluster]);

    return (
        <div className="navigateContainer">
            <div className="navigationContainer" id="topButton" style={{ opacity: annotations?.length === 0 ? 0 : 1 }}>
                <svg className="button-55" style={{ pointerEvents: annotations?.length === 0 ? "none" : "all" }} onClick={onPrev} height="40px" width="40px" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="10 10 600 600">
                    <g id="SVGRepo_iconCarrier"> 
                        <path d="M 209.3749 389.8736 c 3.4272 2.4696 10.836 -0.6048 18.7488 -7.812 c 14.1624 -12.9528 28.5264 -25.9056 42.0336 -39.6144 c 20.8656 -21.1176 41.1768 -42.7896 61.6896 -64.2096 c 33.768 40.0176 73.332 75.6 109.7712 113.6016 c 1.7136 1.8144 5.7456 3.3264 7.5096 3.3264 c 3.4776 0 2.6712 -3.7296 0.4536 -8.2152 c -7.4088 -14.7672 -19.2528 -29.7864 -32.4576 -43.8984 c -25.704 -27.3672 -51.0048 -55.0368 -77.868 -81.4968 l -0.1008 -0.1008 l 0 0 c -3.7296 -3.6792 -9.7272 -3.6288 -13.4064 0.1008 c -6.3504 6.4512 -12.7008 13.0032 -18.9 19.656 c -4.2336 3.9816 -8.4672 7.9128 -12.6504 11.8944 c -26.5608 25.4016 -52.7184 51.2064 -77.112 78.5232 C 210.0805 379.4409 205.5949 387.2024 209.3749 389.8736 z"></path>
                    </g>
                </svg>
            </div>

            <div className="navigationContainer" id="bottomButton" style={{ opacity: annotations?.length === 0 ? 0 : 1 }}>
                <svg className="button-55" style={{ pointerEvents: annotations?.length === 0 ? "none" : "all" }} onClick={onNext} height="40px" width="40px" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="10 10 600 600">
                    <g id="SVGRepo_iconCarrier"> 
                        <path d="M 209.3749 389.8736 c 3.4272 2.4696 10.836 -0.6048 18.7488 -7.812 c 14.1624 -12.9528 28.5264 -25.9056 42.0336 -39.6144 c 20.8656 -21.1176 41.1768 -42.7896 61.6896 -64.2096 c 33.768 40.0176 73.332 75.6 109.7712 113.6016 c 1.7136 1.8144 5.7456 3.3264 7.5096 3.3264 c 3.4776 0 2.6712 -3.7296 0.4536 -8.2152 c -7.4088 -14.7672 -19.2528 -29.7864 -32.4576 -43.8984 c -25.704 -27.3672 -51.0048 -55.0368 -77.868 -81.4968 l -0.1008 -0.1008 l 0 0 c -3.7296 -3.6792 -9.7272 -3.6288 -13.4064 0.1008 c -6.3504 6.4512 -12.7008 13.0032 -18.9 19.656 c -4.2336 3.9816 -8.4672 7.9128 -12.6504 11.8944 c -26.5608 25.4016 -52.7184 51.2064 -77.112 78.5232 C 210.0805 379.4409 205.5949 387.2024 209.3749 389.8736 z"></path>
                    </g>
                </svg>
            </div>
        </div>
    );
}