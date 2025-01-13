// "use client";

import { useEffect, useState } from "react";
import { CirclePicker } from "react-color";
import * as d3 from "d3";

import PaletteSVG from "./svg/palette.svg";

import styles from "./css/Palette.module.css";

export default function Palette({ colour, onChange }) {
    let [ active, setActive ] = useState(false);

    useEffect(() => {
        d3.select(".react-pdf__Document")
        .on("pointerdown", (e) => {
            if (e.srcElement.closest(styles["circle-picker"])) 
                return;
            e.stopPropagation();
            setActive(false);
        });

        return () => {
            d3.select(".react-pdf__Document").on("pointerdown", null);
        };
    }, []);

    useEffect(() => {
        d3.select("#" + styles.palette)
        .on("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            setActive(!active);
        });

        return () => {
            d3.select("#" + styles.palette).on("click", null);
        };
    }, [active]);

    useEffect(() => {
        d3.select("#" + styles.palette)
        .selectAll("path[class^='colour']")
        .style("fill", colour);
    }, [colour]);

    return (
        <>
            <PaletteSVG id={styles.palette} />
            { active && <CirclePicker onChange={onChange} color={colour} className={styles["circle-picker"]} colors={
                ["#f44336", "#e91e63", "#9c27b0", "#3f51b5", "#03a9f4", "#009688", "#4caf50", "#cddc39", "#ffc107", "#ff9800", "#795548", "#000000"]
            }/> }
        </>
    );
}