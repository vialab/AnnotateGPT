import { ReactComponent as PaletteSVG } from "./svg/palette.svg";
import { CirclePicker } from 'react-color';
import { useEffect, useState, useRef } from "react";
import * as d3 from "d3";

import "./css/Palette.css";

export default function Palette({ colour, onChange }) {
    let svgRef = useRef();
    let [ active, setActive ] = useState(false);

    useEffect(() => {
        d3.select("body")
        .on("pointerdown", (e) => {
            if (e.srcElement.closest(".circle-picker")) 
                return;
            e.stopPropagation();
            setActive(false);
        });

        return () => {
            d3.select("body").on("pointerdown", null);
        };
    }, []);

    useEffect(() => {
        const currentSvgRef = svgRef.current;

        d3.select(currentSvgRef)
        .on("click", (e) => {
            e.stopPropagation();
            setActive(!active);
        });

        return () => {
            d3.select(currentSvgRef).on("click", null);
        };
    }, [active]);

    useEffect(() => {
        d3.select(svgRef.current)
        .selectAll("path[class^='colour']")
        .style("fill", colour);
    }, [colour]);

    return (
        <>
            <PaletteSVG id="palette" ref={svgRef} />
            { active && <CirclePicker onChange={onChange} color={colour} colors={
                ["#f44336", "#e91e63", "#9c27b0", "#673ab7", "#3f51b5", "#2196f3", "#03a9f4", "#00bcd4", "#009688", "#4caf50", "#8bc34a", "#cddc39", "#ffeb3b", "#ffc107", "#ff9800", "#ff5722", "#795548", "#000000"]
            }/> }
        </>
    );
}