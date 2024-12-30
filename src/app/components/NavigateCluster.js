import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import "./css/NavigateCluster.css";

export default function NavigateCluster({ handiness, cluster, annotations, currentAnnotation, onPrevCallback, onNextCallback, removed, filter }) {
    let annotationsRef = useRef(annotations);
    let index = useRef(0);
    let isScroll = useRef(false);
    let removedRef = useRef(removed);
    let filterRef = useRef(filter);
    // let resetIndex = useRef(true);

    function scrollTween(offset) {
        return function () {
            var i = d3.interpolateNumber(this.scrollTop, offset);

            return function (t) {
                d3.select("#root").node().scroll(0, i(t));
            };
        };
    }

    function scrollTo(y) {
        d3.select("#root")
        .transition()
        .duration(1000)
        .tween("scroll", scrollTween(y))
        .on("start", () => {
            // d3.select("#root").node().scroll(0, y);
            isScroll.current = true;
        })
        .on("end", () => {
            isScroll.current = false;
        });
    }

    const checkDisable = useCallback((animate = true) => {
        let filteredAnnotations = filterRef.current ? annotationsRef.current.filter(annotation => !annotation.spans[0].classList?.contains("toolTip")) : annotationsRef.current;
        let indexFilter = filterRef.current ? filteredAnnotations.indexOf(annotationsRef.current[index.current]) : index.current;
        
        let firstIndex = 0;
        let lastIndex = filteredAnnotations.length - 1;

        if (indexFilter === -1) {
            return;
        }

        for (let i = 0; i < filteredAnnotations.length; i++) {
            if (filteredAnnotations[i]?.accepted === false) {
                firstIndex = i;
            } else {
                break;
            }
        }

        for (let i = lastIndex; i >= 0; i--) {
            if (filteredAnnotations[i]?.accepted === false) {
                lastIndex = i;
            } else {
                break;
            }
        }
        // console.log(indexFilter, firstIndex, lastIndex);
        let topDisabled = indexFilter === 0 || (filteredAnnotations[firstIndex]?.accepted === false && indexFilter === firstIndex + 1) || indexFilter === firstIndex;
        let bottomDisabled = indexFilter === filteredAnnotations.length - 1 || (filteredAnnotations[lastIndex]?.accepted === false && indexFilter === lastIndex - 1) || indexFilter === lastIndex;
        // console.log(topDisabled, bottomDisabled);

        if (animate) {
            d3.select("#bottomButton")
            .transition()
            .duration(1000)
            .on("end", () => {
                d3.select("#bottomButton").classed("disabled", bottomDisabled);
            });

            d3.select("#topButton")
            .transition()
            .duration(1000)
            .on("end", () => {
                d3.select("#topButton").classed("disabled", topDisabled);
            });
        } else {
            d3.select("#topButton").classed("disabled", topDisabled);
            d3.select("#bottomButton").classed("disabled", bottomDisabled);
        }
    }, []);

    let onPrev = () => {
        // if (resetIndex.current) {
        //     resetIndex.current = false;

        //     let distances = annotationsRef.current.map(annotation => {
        //         let y = d3.mean(annotation.spans.map(span => {
        //             if (span.classList?.contains("toolTip")) {
        //                 span = d3.select("g.toolTip#" + span.id).node();
                    
        //                 if (!span) {
        //                     return null;
        //                 }
        //             }
        //             return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
        //         }));
        //         return Math.floor(window.innerHeight / 2 - Math.round(y));
        //     }).map(d => d <= 0 ? Infinity : d);

        //     let i = distances.indexOf(Math.min(...distances));
        //     let prevAnnotation = annotationsRef.current[i];

        //     if (prevAnnotation && distances[i] !== Infinity) {
        //         let y = d3.mean(prevAnnotation.spans.map(span => {
        //             if (span.classList?.contains("toolTip")) {
        //                 span = d3.select("g.toolTip#" + span.id).node();
                    
        //                 if (!span) {
        //                     return null;
        //                 }
        //             }
        //             return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
        //         }));
        //         scrollTo(y + d3.select("#root").node().scrollTop - window.innerHeight / 2);
        //         index.current = i;
        //     }
        // } else {
        if (index.current > 0) {
            index.current--;
        }
        let annotation = annotationsRef.current[index.current]?.spans;

        if (annotationsRef.current[index.current]?.accepted === false && index.current > 0) {
            onPrev();
            return;
        }

        if (annotation[0].classList?.contains("toolTip") && index.current > 0) {
            onPrev();
            return;
        }

        if (annotation) {
            let yCoord = d3.mean(annotation.map(span => {
                if (span.classList?.contains("toolTip")) {
                    span = d3.select("g.toolTip#" + span.id).node();
                
                    if (!span) {
                        return null;
                    }
                }
                return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
            }));        
            scrollTo(yCoord - window.innerHeight / 2 + d3.select("#root").node().scrollTop);
        }
        // }

        // annotationsRef.current = annotationsRef.current.filter(annotation => annotation.accepted !== false || annotation.spans[0].classList.contains("toolTip"));
        filterRef.current = true;
        checkDisable();

        if (onPrevCallback instanceof Function) {
            onPrevCallback(annotationsRef.current[index.current]);
        }
    };
    
    let onNext = () => {
        // if (resetIndex.current) {
        //     resetIndex.current = false;

        //     let distances = annotationsRef.current.map(annotation => {
        //         let y = d3.mean(annotation.spans.map(span => {
        //             if (span.classList?.contains("toolTip")) {
        //                 span = d3.select("g.toolTip#" + span.id).node();
                    
        //                 if (!span) {
        //                     return null;
        //                 }
        //             }
        //             return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
        //         }));
        //         return Math.floor(Math.round(y) - window.innerHeight / 2);
        //     }).map(d => d <= 0 ? Infinity : d);

        //     let i = distances.indexOf(Math.min(...distances));
        //     let nextAnnotation = annotationsRef.current[i];

        //     if (nextAnnotation && distances[i] !== Infinity) {
        //         let y = d3.mean(nextAnnotation.spans.map(span => {
        //             if (span.classList.contains("toolTip")) {
        //                 span = d3.select("g.toolTip#" + span.id).node();
                    
        //                 if (!span) {
        //                     return null;
        //                 }
        //             }
        //             return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
        //         }));
        //         scrollTo(y - window.innerHeight / 2 + d3.select("#root").node().scrollTop);
        //         index.current = i;
        //     }
        // } else {
        if (index.current < annotationsRef.current.length - 1) {
            index.current++;
        }

        if (annotationsRef.current[index.current]?.accepted === false && index.current < annotationsRef.current.length - 1) {
            onNext();
            return;
        }

        let annotation = annotationsRef.current[index.current]?.spans;

        if (annotation[0].classList?.contains("toolTip") && index.current < annotationsRef.current.length - 1) {
            onNext();
            return;
        }

        if (annotation) {
            let yCoord = d3.mean(annotation.map(span => {
                if (span.classList?.contains("toolTip")) {
                    span = d3.select("g.toolTip#" + span.id).node();
                }
                return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
            }));
            scrollTo(yCoord - window.innerHeight / 2 + d3.select("#root").node().scrollTop);
        }
        // }

        // let topDisabled = removedRef.current ? index.current - 1 === 0 : index.current === 0;
        
        // console.log(annotationsRef.current);
        // console.log(currentAnnotation);
        // console.log(index.current, removedRef.current);
        // console.log(index.current === annotationsRef.current.length - 1);

        // annotationsRef.current = annotationsRef.current.filter(annotation => annotation.accepted !== false || annotation.spans[0].classList.contains("toolTip"));

        filterRef.current = true;
        checkDisable();

        if (onNextCallback instanceof Function) {
            // onNextCallback(annotationsRef.current[removedRef.current ? index.current - 1 : index.current]);
            onNextCallback(annotationsRef.current[index.current]);
        }
        removedRef.current = false;
    };

    // let findIndex = () => {
    //     // console.log(annotationsRef.current);
    //     let distances = annotationsRef.current.map(annotation => {
    //         let y = d3.mean(annotation.spans.map(span => {
    //             if (span.classList?.contains("toolTip")) {
    //                 span = d3.select("g.toolTip#" + span.id).node();

    //                 if (!span) {
    //                     return null;
    //                 }
    //             }
    //             return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
    //         }));
    //         return Math.floor(Math.abs(Math.round(y) - window.innerHeight / 2));
    //     });
    //     index.current = distances.indexOf(Math.min(...distances));
    //     resetIndex.current = true;

    //     if (annotationsRef.current.length === 1) {
    //         if (index.current === 0) {
    //             let y1 = d3.mean(annotationsRef.current[index.current].spans.map(span => {
    //                 if (span.classList?.contains("toolTip")) {
    //                     span = d3.select("g.toolTip#" + span.id).node();

    //                     if (!span) {
    //                         return null;
    //                     }
    //                 }
    //                 return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
    //             }));
    //             let distance1 = Math.floor(window.innerHeight / 2 - Math.round(y1));
    //             // console.log(distance);

    //             let y2 = d3.mean(annotationsRef.current[index.current].spans.map(span => {
    //                 if (span.classList?.contains("toolTip")) {
    //                     span = d3.select("g.toolTip#" + span.id).node();
                    
    //                     if (!span) {
    //                         return null;
    //                     }
    //                 }
    //                 return span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2;
    //             }));
    //             let distance2 = Math.floor(Math.round(y2) - window.innerHeight / 2);

    //             if (distance1 < distance2) {
    //                 index.current = -1;
    //             } else {
    //                 index.current = 1;
    //             }
    //         }
    //     }

    //     // if (d3.select("#root").node().scrollTop === 0) {
    //     //     index.current = 0;
    //     // } else if (d3.select("#root").node().scrollTop + window.innerHeight >= d3.select("#root").node().scrollHeight) {
    //     //     index.current = annotationsRef.current.length - 1;
    //     // }
    //     // console.log(index.current);

    //     d3.select("#topButton")
    //     .classed("disabled", index.current <= 0);

    //     d3.select("#bottomButton")
    //     .classed("disabled", index.current >= annotationsRef.current.length - 1);

    //     annotationsRef.current = annotationsRef.current.filter(annotation => annotation.accepted !== false || annotation.spans[0].classList.contains("toolTip"));
    // };

    // useEffect(() => {
    //     d3.select("#root")
    //     .on("scroll.findIndex", () => {
    //         if (!isScroll.current) {
    //             resetIndex.current = true;
    //             findIndex();
    //         }
    //     });

    //     return () => {
    //         d3.select("#root").on("scroll.findIndex", null);
    //     };
    // }, []);

    useEffect(() => {
        removedRef.current = removed;
    }, [removed]);
    
    useEffect(() => {
        filterRef.current = filter;
    }, [filter]);

    useEffect(() => {
        let tAnnotations = [...annotations];
        let toolTipSpans;

        if (cluster && tAnnotations.length > 0) {
            let tooltip = d3.select("g.toolTip#toolTip" + cluster.strokes[cluster.strokes.length - 1]?.id).node();

            if (tooltip) {
                toolTipSpans = { spans: [tooltip] };
                tAnnotations.push(toolTipSpans);
            }
        }

        let sortAnnotations = tAnnotations.sort((a, b) => {
            if (a.spans instanceof Array && b.spans instanceof Array) {
                let aY = d3.mean(a.spans.filter(span => span instanceof Element).map(span => span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2 + d3.select("#root").node().scrollTop));
                let bY = d3.mean(b.spans.filter(span => span instanceof Element).map(span => span.getBoundingClientRect().top + span.getBoundingClientRect().height / 2 + d3.select("#root").node().scrollTop));
                return aY - bY;
            } else {
                return 0;
            }
        });
        annotationsRef.current = sortAnnotations;

        for (let i = 0; i < annotationsRef.current.length; i++) {
            // console.log(annotationsRef.current[i].spans);
            if (annotationsRef.current[i].spans instanceof Array) {
                annotationsRef.current[i].spans = annotationsRef.current[i].spans.filter(span => span instanceof Element);
            }
        }
        // findIndex();
        
        if (currentAnnotation) {
            let annotation = annotationsRef.current.find(annotation => annotation === currentAnnotation);
            let i = annotationsRef.current.indexOf(annotation);

            if (i !== -1) {
                index.current = i;
            } else if (toolTipSpans) {
                index.current = annotationsRef.current.indexOf(toolTipSpans);
            }
        }
        checkDisable(false);

        // console.log(index.current, annotationsRef.current.length, firstIndex, lastIndex, topDisabled, bottomDisabled);

        // console.log(annotationsRef.current);
        // console.log(currentAnnotation);
        // console.log(index.current, removedRef.current);
        // console.log(index.current === annotationsRef.current.length - 1);
    }, [annotations, cluster, currentAnnotation, checkDisable]);

    return (
        <div className={"navigateContainer " + (handiness === "right" ? "right" : "left")}>
            <div className="navigationContainer disabled" id="topButton" style={{ opacity: annotations?.length === 0 ? 0 : 1, pointerEvents: annotations?.length === 0 ? "none" : "all" }}>
                <svg className="button-55" style={{ pointerEvents: annotations?.length === 0 ? "none" : "all" }} onClick={onPrev} height="40px" width="40px" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="10 10 600 600">
                    <g id="SVGRepo_iconCarrier"> 
                        <path d="M 209.3749 389.8736 c 3.4272 2.4696 10.836 -0.6048 18.7488 -7.812 c 14.1624 -12.9528 28.5264 -25.9056 42.0336 -39.6144 c 20.8656 -21.1176 41.1768 -42.7896 61.6896 -64.2096 c 33.768 40.0176 73.332 75.6 109.7712 113.6016 c 1.7136 1.8144 5.7456 3.3264 7.5096 3.3264 c 3.4776 0 2.6712 -3.7296 0.4536 -8.2152 c -7.4088 -14.7672 -19.2528 -29.7864 -32.4576 -43.8984 c -25.704 -27.3672 -51.0048 -55.0368 -77.868 -81.4968 l -0.1008 -0.1008 l 0 0 c -3.7296 -3.6792 -9.7272 -3.6288 -13.4064 0.1008 c -6.3504 6.4512 -12.7008 13.0032 -18.9 19.656 c -4.2336 3.9816 -8.4672 7.9128 -12.6504 11.8944 c -26.5608 25.4016 -52.7184 51.2064 -77.112 78.5232 C 210.0805 379.4409 205.5949 387.2024 209.3749 389.8736 z"></path>
                    </g>
                </svg>
            </div>

            <div className="navigationContainer disabled" id="bottomButton" style={{ opacity: annotations?.length === 0 ? 0 : 1, pointerEvents: annotations?.length === 0 ? "none" : "all" }}>
                <svg className="button-55" style={{ pointerEvents: annotations?.length === 0 ? "none" : "all" }} onClick={onNext} height="40px" width="40px" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="10 10 600 600">
                    <g id="SVGRepo_iconCarrier"> 
                        <path d="M 209.3749 389.8736 c 3.4272 2.4696 10.836 -0.6048 18.7488 -7.812 c 14.1624 -12.9528 28.5264 -25.9056 42.0336 -39.6144 c 20.8656 -21.1176 41.1768 -42.7896 61.6896 -64.2096 c 33.768 40.0176 73.332 75.6 109.7712 113.6016 c 1.7136 1.8144 5.7456 3.3264 7.5096 3.3264 c 3.4776 0 2.6712 -3.7296 0.4536 -8.2152 c -7.4088 -14.7672 -19.2528 -29.7864 -32.4576 -43.8984 c -25.704 -27.3672 -51.0048 -55.0368 -77.868 -81.4968 l -0.1008 -0.1008 l 0 0 c -3.7296 -3.6792 -9.7272 -3.6288 -13.4064 0.1008 c -6.3504 6.4512 -12.7008 13.0032 -18.9 19.656 c -4.2336 3.9816 -8.4672 7.9128 -12.6504 11.8944 c -26.5608 25.4016 -52.7184 51.2064 -77.112 78.5232 C 210.0805 379.4409 205.5949 387.2024 209.3749 389.8736 z"></path>
                    </g>
                </svg>
            </div>
        </div>
    );
}