import { ReactComponent as PaletteSVG } from "./palette.svg";
import { CirclePicker } from 'react-color';
import "./Palette.css";
import { useEffect, useState } from "react";

export default function Palette() {
    let [ active, setActive ] = useState(false);

    // useEffect(() => {


    return (
        <>
            <PaletteSVG />
            <CirclePicker />
        </>
    );
}