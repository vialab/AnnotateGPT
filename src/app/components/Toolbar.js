import { useEffect, useState } from "react";
import * as d3 from "d3";

import PenIcon from "./svg/pen.svg";
import HighlighterIcon from "./svg/highlighter.svg";
import Palette from "./Palette";

import toolbarStyles from "./css/Toolbar.module.css";
import paletteStyles from "./css/Palette.module.css";

export default function Toolbar({ tool, onToolChange, defaultColour, onColourChange, handiness }) {
    let [ colour, setColour ] = useState(defaultColour);

    useEffect(() => {
        d3.selectAll(`#${toolbarStyles.pen}, #${toolbarStyles.highlighter}`)
        .selectAll("g")
        .on("pointermove", function () {
            d3.select(d3.select(this).node().closest("svg")).classed(toolbarStyles.hover, true);
        })
        .on("pointerleave", function () {
            d3.select(d3.select(this).node().closest("svg")).classed(toolbarStyles.hover, false);
        });

        d3.selectAll(`#${paletteStyles.palette}`)
        .selectAll("g")
        .on("pointermove", function () {
            d3.select(d3.select(this).node().closest("svg")).classed(paletteStyles.hover, true);
        })
        .on("pointerleave", function () {
            d3.select(d3.select(this).node().closest("svg")).classed(paletteStyles.hover, false);
        });

        return () => {
            d3.selectAll(`#${toolbarStyles.pen}, #${toolbarStyles.highlighter}, #${paletteStyles.palette}`)
            .selectAll("g")
            .on("pointermove", null)
            .on("pointerleave", null);
        };
    }, []);

    useEffect(() => {
        let tools = d3.selectAll(`#${toolbarStyles.pen}, #${toolbarStyles.highlighter}`);
        
        tools
        .on("click", function () {
            tools.classed(toolbarStyles.active, false);
            d3.select(this).classed(toolbarStyles.active, true);

            if (onToolChange instanceof Function)
                onToolChange(d3.select(this).attr("id") === toolbarStyles.pen ? "pen" : "highlighter");
        });

        return () => {
            d3.selectAll(`#${toolbarStyles.pen}, #${toolbarStyles.highlighter}`)
            .on("click", null);
        };
    }, [onToolChange]);

    function onPaletteChange(color, event) {
        setColour(color.hex);

        if (onColourChange instanceof Function) 
            onColourChange(color, event);
    }

    return (
        <div className={toolbarStyles.toolbar + " toolbar-container " + (handiness === "left" ? toolbarStyles.left : toolbarStyles.right)}>
            <div className={toolbarStyles["svg-container"]}>
                {/* <Image src={PenIcon} id="pen" className={tool === "pen" ? "active" : null} /> */}
                <PenIcon id={toolbarStyles.pen} className={tool === "pen" ? toolbarStyles.active : null} />
            </div>

            <div className={toolbarStyles["svg-container"]}>
                {/* <Image src={HighlighterIcon} id="highlighter" className={tool === "highlighter" ? "active" : null} /> */}
                <HighlighterIcon id={toolbarStyles.highlighter} className={tool === "highlighter" ? toolbarStyles.active : null} />
            </div>

            <div className={toolbarStyles["palette-container"]}>
                <Palette colour={colour} onChange={onPaletteChange} />
            </div>
        </div>
    );
}