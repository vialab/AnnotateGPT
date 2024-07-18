"use client";
import { cloneElement, useState, useCallback } from "react";
import * as d3 from "d3";
import localFont from "next/font/local";

import { googleSans } from "../page";

import AnnotatePenIcon from "./svg/logoPen.svg";
import AnnotateBlobIcon from "./svg/logoBlob.svg";
import "./css/Header.css";

export const mistrully = localFont({
    src: "./css/Mistrully.otf",
    display: 'swap',
});

export default function Header({ children }) {
    const [gradientCenter, setGradientCenter] = useState({ cx: "50%", cy: "50%" });
    const [radius, setRadius] = useState(0);

    let onPointerEnter = useCallback(() => {
        d3.interrupt("gradientCenter");
        d3.interrupt("textTranslate");
        
        d3.transition()
        .duration(500)
        .tween("gradientCenter", () => {
            return (t) => {
                setRadius(radius * (1 - t) + 35 * t);
            };
        });
    }, [radius]);

    let onPointerMove = useCallback((e) => {
        let [x, y] = d3.pointer(e);
        let headerRect = d3.select("#header").node().getBoundingClientRect();
        let blobRect = d3.select("#__id119_s5xkaoep3i").node().getBoundingClientRect();

        x += headerRect.x - blobRect.x;
        y += headerRect.y - blobRect.y;
        
        const width = blobRect.width;
        const height = blobRect.height;
        const cxPercentage = Math.min((x / width) * 100, 100);
        const cyPercentage = Math.min((y / height) * 100, 100);

        let offX = x - (width * 0.5);
        let offY = y - (height * 0.5);

        const translateX = (Math.min(offX, width * 2) * -3) / 100;
        const translateY = (Math.min(offY, height * 2) * -3) / 100;
        const translatePenX = (Math.min(offX, width * 2) * -1) / 100;
        const translatePenY = (Math.min(offY, height * 2) * -1) / 100;

        d3.select(".graphic")
        .style("--x", translateX + "px")
        .style("--y", translateY + "px");

        d3.select("#penIcon")
        .style("--penX", translatePenX + "px")
        .style("--penY", translatePenY + "px");

        setGradientCenter({
            cx: `${isNaN(cxPercentage) ? 50 : cxPercentage}%`,
            cy: `${isNaN(cyPercentage) ? 50 : cyPercentage}%`,
        });
    }, []);

    let onPointerLeave = useCallback(() => {
        d3.interrupt("gradientCenter");
        d3.interrupt("textTranslate");

        d3.transition()
        .duration(500)
        .tween("gradientCenter", () => {
            return (t) => {
                setRadius(radius * (1 - t));
            };
        });

        d3.select("#headerLogo")
        .selectAll("text")
        .transition("textTranslate")
        .duration(500)
        .attr("transform", "translate(0, 0)");
    }, [radius]);

    return (
        <header id={"header"} onPointerLeave={onPointerLeave} onPointerEnter={onPointerEnter} onPointerMove={onPointerMove}>
            <div id={"headerInner"}>
                <div id={"headerLogo"} >
                    <svg
                        viewBox="0 0 165 54"
                        className={"svg"}
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            <radialGradient
                                id="emeraldGradient"
                                gradientUnits="userSpaceOnUse"
                                r={radius + "%"}
                                cx={gradientCenter.cx}
                                cy={gradientCenter.cy}
                            >
                                { <stop stopColor="#fae472" /> }
                                <stop offset={1} stopColor="#FAE47200" />
                            </radialGradient>

                            <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                                <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0
                                                                               0 1 0 0 0
                                                                               0 0 1 0 0
                                                                               0 0 0 1.5 0" result="blur" />
                            </filter>
                        </defs>

                        <AnnotateBlobIcon />

                        <g filter="url(#blur)">
                            <AnnotateBlobIcon stroke="url(#emeraldGradient)" fill={"none"} strokeWidth={8} />
                        </g>

                        <g id="penIcon">
                            <AnnotatePenIcon viewBox="1200 -40 800 3500" />
                        </g>

                        <g className="graphic">
                            <text x={30} y={30} fontSize={35} className={mistrully.className} style={{ pointerEvents: "none" }}>Annotate</text>
                            <text x={100} y={50} fontSize={15} className={googleSans.className} style={{ pointerEvents: "none" }}>GPT</text>
                        </g>
                    </svg>
                </div>
                { children instanceof Array ?
                    children.map((child, index) => {
                        return cloneElement(child, { className: "headerlinks " + googleSans.className, key: index });
                    }) :
                    cloneElement(children, { className: "headerlinks " + googleSans.className })
                }
            </div>
        </header>
    );
}