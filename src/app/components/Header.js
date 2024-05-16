"use client";
import { useEffect, cloneElement } from "react";
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
    useEffect(() => {
        d3.select("#root")
        .on("scroll.header", () => {
            
            let scroll = d3.select("#root").node().scrollTop;
            
            d3.select("#header")
            .style("--header-inner-height", Math.max(50, 80 - scroll) + "px");
        });

        return () => {
            d3.select("#root").on("scroll.header", null);
        };
    }, []);
    
    return (
        <header id={"header"}>
            <div id={"headerInner"}>
                <svg 
                    viewBox="10 0 500 200"
                    className={"svg"}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <g className="graphic">
                        <AnnotateBlobIcon />
                        <AnnotatePenIcon viewBox="0 -50 600 1200" />
                        <text x={150} y={90} fontSize={100} className={mistrully.className} style={{ pointerEvents: "none" }}>Annotate</text>
                        <text x={300} y={170} fontSize={60} className={googleSans.className} style={{ pointerEvents: "none" }}>GPT</text>
                    </g>
                </svg>
                { 
                    children instanceof Array ?
                    
                        children.map((child, index) => {
                            return cloneElement(child, { className: "headerlinks " + googleSans.className, key: index });
                        }) : 
                        cloneElement(children, { className: "headerlinks " + googleSans.className })
                }
            </div>
        </header>
    );
}