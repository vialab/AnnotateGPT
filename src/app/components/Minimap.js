// https://github.com/jeremy-carbonne/react-minimap
import { forwardRef, useState, useEffect, useCallback, useRef, useImperativeHandle } from "react";
import "./css/Minimap.css";

function Child(props) {
    const { width, height, left, top } = props;

    return <div className="minimap-child" style={{ position: "absolute", width, height, left, top }} />;
}

const Minimap = forwardRef((props, ref) => {
    const { selector, scrollContainer, className = "", width = 200, height = 200, keepAspectRatio = false, childComponent = Child, onMountCenterOnX = false, onMountCenterOnY = false, children } = props;
    
    const [miniMapWidth, setMiniMapWidth] = useState(width);
    const [miniMapHeight, setMiniMapHeight] = useState(height);
    const [miniMapChildren, setMiniMapChildren] = useState(null);

    const minimapRef = useRef(null);
    const sourceRef = useRef(document.querySelector(scrollContainer));
    const viewPortRef = useRef(null);
    const downState = useRef(false);

    const x = useRef(0);
    const y = useRef(0);
    const l = useRef(0);
    const t = useRef(0);
    const w = useRef(0);
    const h = useRef(0);

    const init = useCallback(() => {
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

        setMiniMapChildren(Array.from(nodes).map((node, key) => {
            const { width, height, left, top } = node.getBoundingClientRect();

            const wM = width * ratioX;
            const hM = height * ratioY;
            const xM = (left + scrollLeft - sourceRect.left) * ratioX;
            const yM = (top + scrollTop - sourceRect.top) * ratioY;

            return <ChildComponent key={key} width={Math.round(wM)} height={Math.round(hM)} left={Math.round(xM)} top={Math.round(yM)} node={node} />;
        }));
    }, [childComponent, height, keepAspectRatio, selector, width]);

    const synchronize = useCallback(options => {
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

        if (options && !options.skipChildren || !options)
            init();
    }, [init, miniMapHeight, miniMapWidth]);

    const move = useCallback(e => {
        if (!downState.current)
            return;

        if (e.buttons !== 1 && (e.type.match(/mouse/) || e.pointerType === "mouse")) {
            up();
            return;
        }

        let event;

        e.preventDefault();
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

    const up = () => {
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
    }, [childComponent, height, init, keepAspectRatio, onMountCenterOnX, onMountCenterOnY, selector, synchronize, width]);

    useImperativeHandle(ref, () => ({
        synchronize,
        up,
        down,
        move,
        element: minimapRef.current,
    }), [down, move, synchronize]);

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
});
Minimap.displayName = "Minimap";

export default Minimap;
