import { useEffect, useState } from "react";
import { ReactComponent as PenIcon } from "./svg/pen.svg";
import { ReactComponent as HighlighterIcon } from "./svg/download.svg";
import Palette from "./Palette";
import * as d3 from "d3";

import "./css/Toolbar.css";

export default function Toolbar({ tool, onToolChange, defaultColour, onColourChange }) {
    let [ colour, setColour ] = useState(defaultColour);

    useEffect(() => {
        d3.selectAll("#pen, #highlighter, #palette")
        .selectAll("g")
        .on("pointermove", function () {
            d3.select(d3.select(this).node().closest("svg")).classed("hover", true);
        })
        .on("pointerleave", function () {
            d3.select(d3.select(this).node().closest("svg")).classed("hover", false);
        });

        return () => {
            d3.selectAll("#pen, #highlighter, #palette")
            .selectAll("g")
            .on("pointermove", null)
            .on("pointerleave", null);
        };
    }, []);

    useEffect(() => {
        let tools = d3.selectAll("#pen, #highlighter");
        
        tools
        .on("click", function () {            
            tools.classed("active", false);
            d3.select(this).classed("active", true);

            if (onToolChange instanceof Function)
                onToolChange(d3.select(this).attr("id"));
        });

        return () => {
            d3.selectAll("#pen, #highlighter")
            .on("click", null);
        };
    }, [onToolChange]);

    function onPaletteChange(color, event) {
        setColour(color.hex);

        if (onColourChange instanceof Function) 
            onColourChange(color, event);
    }

    return (
        <div className="toolbar">
            <div className="svg-container">
                <PenIcon id="pen" className={tool === "pen" ? "active" : null} />
            </div>

            <div className="svg-container">
                <HighlighterIcon id="highlighter" className={tool === "highlighter" ? "active" : null} />
            </div>

            <div className="palette-container">
                <Palette colour={colour} onChange={onPaletteChange} />
            </div>
        </div>
    );
}