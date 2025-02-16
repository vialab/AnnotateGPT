// https://github.com/jeremy-carbonne/react-minimap
import { useState, useEffect, useCallback, useRef, useImperativeHandle } from "react";
import "./css/Minimap.css";

function Child(props) {
    const { width, height, left, top } = props;

    return <div className="minimap-child" style={{ position: "absolute", width, height, left, top }} />;
}

function Minimap({ ref, ...props }) {
    const { selector, scrollContainer, className = "", width = 200, height = 200, keepAspectRatio = false, childComponent = Child, onMountCenterOnX = false, onMountCenterOnY = false, children } = props;
    
    const [miniMapWidth, setMiniMapWidth] = useState(width);
    const [miniMapHeight, setMiniMapHeight] = useState(height);
    const [miniMapChildren, setMiniMapChildren] = useState(null);

    const minimapRef = useRef(null);
    const sourceRef = useRef(null);
    const viewPortRef = useRef(null);
    const downState = useRef(false);

    const x = useRef(0);
    const y = useRef(0);
    const l = useRef(0);
    const t = useRef(0);
    const w = useRef(0);
    const h = useRef(0);

    const init = useCallback(() => {
        sourceRef.current = document.querySelector(scrollContainer);

        if (!sourceRef.current) {
            return;
        }
        const ChildComponent = childComponent;
        const { scrollWidth, scrollHeight, scrollTop, scrollLeft } = sourceRef.current;
        const sourceRect = sourceRef.current.getBoundingClientRect();

        let miniMapWidth = width;
        let miniMapHeight = height;

        let ratioX = width / scrollWidth;
        let ratioY = height / scrollHeight;

        if (keepAspectRatio) {
            if (ratioX < ratioY) {
                ratioY = ratioX;
                miniMapHeight = Math.round(scrollHeight / (scrollWidth / width));
            } else {
                ratioX = ratioY;
                miniMapWidth = Math.round(scrollWidth / (scrollHeight / height));
            }
        }

        const nodes = sourceRef.current.querySelectorAll(selector);
        setMiniMapWidth(miniMapWidth);
        setMiniMapHeight(miniMapHeight);

        const highlightKeys = new Set();

        setMiniMapChildren(
            Array.from(nodes)
            .filter(node => {
                const { width, height } = node.getBoundingClientRect();
                return width > 0 && height > 0;
            })
            .sort((a, b) => {
                const aRect = a.getBoundingClientRect();
                const bRect = b.getBoundingClientRect();

                // Sort by height size
                return bRect.height - aRect.height;
            })
            .map((node, key) => {
                const { width, height, left, top } = node.getBoundingClientRect();

                const wM = width * ratioX;
                const hM = height * ratioY;
                const xM = (left + scrollLeft - sourceRect.left) * ratioX;
                const yM = (top + scrollTop - sourceRect.top) * ratioY;

                const component = ChildComponent({ key, width: Math.round(wM), height: Math.round(hM), left: Math.round(xM), top: Math.round(yM), node });
                
                if (highlightKeys.has(component?.key)) {
                    return null;
                }
                highlightKeys.add(component?.key);
                return component;
            })
            .sort((a, b) => {
                if (a?.key < b?.key) {
                    return -1;
                }
                if (a?.key > b?.key) {
                    return 1;
                }
                return 0;
            })
        );
    }, [childComponent, height, keepAspectRatio, selector, width, scrollContainer]);

    const synchronize = useCallback(options => {
        if (!sourceRef.current) {
            return;
        }
        const { width, height } = { width: miniMapWidth, height: miniMapHeight };

        const rect = sourceRef.current.getBoundingClientRect();
        const dims = [rect.width, rect.height];
        const scroll = [sourceRef.current.scrollLeft, sourceRef.current.scrollTop];
        const scaleX = width / sourceRef.current.scrollWidth;
        const scaleY = height / sourceRef.current.scrollHeight;

        const lW = dims[0] * scaleX;
        const lH = dims[1] * scaleY;
        const lX = scroll[0] * scaleX;
        const lY = scroll[1] * scaleY;

        w.current = Math.round(lW) > width ? width : Math.round(lW);
        h.current = Math.round(lH) > height ? height : Math.round(lH);
        l.current = Math.round(lX);
        t.current = Math.round(lY);

        viewPortRef.current.style.width = `${w.current}px`;
        viewPortRef.current.style.height = `${h.current}px`;
        viewPortRef.current.style.left = `${l.current}px`;
        viewPortRef.current.style.top = `${t.current}px`;

        if (options !== undefined) {
            if (options.centerOnX) {
                sourceRef.current.scrollLeft = sourceRef.current.scrollWidth / 2 - dims[0] / 2;
            }

            if (options.centerOnY) {
                sourceRef.current.scrollTop = sourceRef.current.scrollHeight / 2 - dims[1] / 2;
            }
        }

        if (options && !options.skipChildren && options.type !== "scroll" || !options)
            init();
    }, [init, miniMapHeight, miniMapWidth]);

    const move = useCallback(e => {
        if (!downState.current)
            return;

        if (e.buttons !== 1 && (e.type.match(/mouse/) || e.pointerType === "mouse")) {
            up(e);
            return;
        }
        let event;

        if (e.type.match(/touch/)) {
            if (e.touches.length > 1) {
                return;
            }
            event = e.touches[0];
        } else {
            event = e;
        }
        let dx = event.clientX - x.current;
        let dy = event.clientY - y.current;
        const { width, height } = { width: miniMapWidth, height: miniMapHeight };

        if (l.current + dx < 0) {
            dx = -l.current;
        }
        if (t.current + dy < 0) {
            dy = -t.current;
        }
        if (l.current + w.current + dx > width) {
            dx = width - l.current - w.current;
        }
        if (t.current + h.current + dy > height) {
            dy = height - t.current - h.current;
        }
        x.current += dx;
        y.current += dy;

        l.current += dx;
        t.current += dy;

        viewPortRef.current.style.left = `${l.current}px`;
        viewPortRef.current.style.top = `${t.current}px`;

        const coefX = width / sourceRef.current.scrollWidth;
        const coefY = height / sourceRef.current.scrollHeight;
        sourceRef.current.scrollLeft = Math.round(l.current / coefX);
        sourceRef.current.scrollTop = Math.round(t.current / coefY);
    }, [miniMapWidth, miniMapHeight]);


    const down = useCallback(e => {
        const pos = minimapRef.current.getBoundingClientRect();

        x.current = Math.round(pos.left + l.current + w .current/ 2);
        y.current = Math.round(pos.top + t.current + h.current / 2);

        downState.current = true;
        move(e);
    }, [move]);

    const up = (e) => {
        e.preventDefault();
        downState.current = false;
    };

    const limitResize = useRef(false);
    const executeAgain = useRef(false);

    useEffect(() => {
        const resize = () => {
            if (!limitResize.current) {
                synchronize();
            } else {
                executeAgain.current = true;
            }
            limitResize.current = true;

            setTimeout(() => {
                limitResize.current = false;

                if (executeAgain.current) {
                    resize();
                    executeAgain.current = false;
                }
            }, 100);
        };
        synchronize({
            centerOnX: onMountCenterOnX,
            centerOnY: onMountCenterOnY,
        });
        window.addEventListener("resize", resize);
        init();
        
        return () => {
            window.removeEventListener("resize", resize);
        };
    }, [init, onMountCenterOnX, onMountCenterOnY, synchronize]);

    useEffect(() => {
        let element = document.querySelector(scrollContainer);

        sourceRef.current = element;

        element.addEventListener("scroll", synchronize);
        element.addEventListener("pointermove", move);
        // element.addEventListener("pointerleave", up);
        element.addEventListener("pointerup", up);

        return () => {
            element.removeEventListener("scroll", synchronize);
            element.removeEventListener("pointermove", move);
            // element.removeEventListener("pointerleave", up);
            element.removeEventListener("pointerup", up);
        };
    }, [synchronize, scrollContainer, move]);

    useImperativeHandle(ref, () => ({
        synchronize,
        up,
        down,
        move,
        element: minimapRef.current,
    }), [down, move, synchronize]);

    return (
        <div className={`minimap-container ${className}`}>
            <div className="minimap" style={{ width: `${miniMapWidth}px`, height: `${miniMapHeight}px` }} ref={minimapRef} onMouseDown={down} onTouchStart={down} onTouchMove={move} onMouseMove={move} onTouchEnd={up} onMouseUp={up}>
                <div
                    className="minimap-viewport"
                    ref={viewPortRef}
                />
                {miniMapChildren}
            </div>

            {children}
        </div>
    );
}

export default Minimap;