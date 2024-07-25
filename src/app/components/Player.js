import { useEffect, useRef } from "react";
import videojs from "video.js";
import * as d3 from "d3";

import "video.js/dist/video-js.css";
import "./css/Player.css";

import { googleSans } from "../page";

const Component = videojs.getComponent('Component');

class Gradient extends Component {
    constructor(player, options = {}) {
        super(player, options);

        if (options.text) {
            this.updateTextContent(options.text);
        }
    }

    createEl() {
        return videojs.dom.createEl('div', {
            className: 'vjs-gradient'
        });
    }
}

videojs.registerComponent('Gradient', Gradient);

export default function Player({ src, track }) {
    const videoRef = useRef(null);
    const playerRef = useRef(null);

    useEffect(() => {
        if (!playerRef.current) {
            const videoElement = document.createElement("video");

            videoRef.current.appendChild(videoElement);

            playerRef.current = videojs(videoElement, {
                controls: true,
                html5: {
                    nativeTextTracks: false,
                },
                fill: true,
                disablePictureInPicture: true,
                userActions: {
                    doubleClick: false
                },
                sources: [{
                    src: src,
                    type: "video/mp4"
                }],
                tracks: [{ 
                    src: track,
                    kind: "subtitles",
                    srclang: "en",
                    label: "English",
                    default: true
                }],
            });

            playerRef.current.addClass("vjs-theme-fantasy");
            playerRef.current.addClass("video-js");
        } else {
            const player = playerRef.current;

            player.src({ src: src, type: "video/mp4" });
            player.addRemoteTextTrack({ src: track, kind: "subtitles", srclang: "en", label: "English", default: true }, false);
        }
        let timeout = null;
    
        d3.select(".video-js.vjs-theme-fantasy")
        .on("click", () => {
            if (playerRef.current?.paused()) 
                return;

            if (d3.select(".vjs-control-bar").style("opacity") === "0") {
                d3.select(".vjs-control-bar").style("opacity", "1");
                d3.select(".video-js.vjs-theme-fantasy").style("cursor", "auto");
            }
            clearTimeout(timeout);
            
            timeout = setTimeout(() => {
                if (playerRef.current?.paused())
                    return;

                d3.select(".vjs-control-bar").transition().style("opacity", "0");
                d3.select(".video-js.vjs-theme-fantasy").style("cursor", "none");
            }, 2000);
        })
        .on("pointerenter", () => {
            d3.select(".vjs-control-bar").transition().style("opacity", "1");
            d3.select(".video-js.vjs-theme-fantasy").style("cursor", "auto");
        })
        .on("pointerleave", () => {
            d3.select(".vjs-control-bar").transition().style("opacity", "0");
        })
        .on("pointermove", () => {
            d3.select(".video-js.vjs-theme-fantasy").on("click")();
        });

        playerRef.current?.getChild("ControlBar").addChild("Gradient", {}, 0);

        return () => {
            const player = playerRef.current;
            
            if (player && !player.isDisposed()) {
                player.dispose();
                playerRef.current = null;
            }
        };
    }, [src, track, videoRef]);

    return (
        <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: googleSans.style.fontFamily }} ref={videoRef}>
        </div>
    );
}