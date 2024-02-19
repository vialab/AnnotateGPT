import { useEffect } from "react";
import { ReactComponent as PenIcon } from "./pen.svg";
import { ReactComponent as HighlighterIcon } from "./download.svg";
import Palette from "./Palette";
import * as d3 from "d3";

import "./Toolbar.css";

export default function Toolbar() {
    useEffect(() => {
        d3.selectAll("#pen, #highlighter")
        .selectAll("*")
        .on("mousemove", function () {
            d3.select(d3.select(this).node().closest("svg")).classed("active", true);
        })
        .on("mouseleave", function () {
            d3.select(d3.select(this).node().closest("svg")).classed("active", false);
        });


        return () => {
            d3.selectAll("#pen, #highlighter")
            .selectAll("*")
            .on("mousemove", null);
        };
    }, []);

    return (
        <div className="toolbar">
            <div className="svg-container">
                <PenIcon id="pen" />
            </div>

            <div className="svg-container">
                <HighlighterIcon id="highlighter" />
            </div>

            <div className="palette-container">
                <Palette id="" />
            </div>
        </div>
    );
}