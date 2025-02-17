import * as d3 from "d3";
import MathExtras from "./MathExtras.js";
import PathExtras from "./PathExtras.js";
import polygonClipping from "polygon-clipping";
import * as flubber from "flubber";
import { getStroke } from "perfect-freehand";

// Default settings
const defStrokeParam = {
    // Line function for drawing (must convert coordinates to a valid path string)
    lineFunc: PathExtras.getSvgPathFromStroke,
    // Minimum distance between points that is allowed (longer will be interpolated)
    minDist: 2,
    // Max time between events (done to somewhat keep a stable sample rate)
    maxTimeDelta: 500,
};

const defEraserParam = {
    eraserMode: "object", // Can use "object" or "pixel"
    eraserSize: 20, // NOTE: Small eraser sizes will cause skipping isses - will need to be fixed
};

const defStrokeStyles = {
    stroke: "black",
    "stroke-width": "1px",
    "stroke-linejoin": "round",
    "stroke-linecap": "round",
    "stroke-miterlimit": 8,
};

const defEraserStyles = {
    "pointer-events": "none",
    fill: "rgba(0,0,0, 0.5)",
};

export default class SvgPenSketch {
    constructor(
        element = null, strokeStyles = {}, strokeParam = {}, eraserParam = {}, eraserStyles = {}, transform = { k: 1, x: 0, y: 0 }
    ) {
        // If the element is a valid
        if (element != null && typeof element === "object" && element.nodeType) {
            // Private variables
            // The root SVG element
            this._element = d3.select(element);
            // Variable for if the pointer event is a pen
            this._isPen = false;
            // Resize the canvas viewbox on window resize
            // TODO: Need to implement a proper fix to allow paths to scale
            // window.onresize = _ => {
            //     this.resizeCanvas();
            // };
            // Prep the canvas for drawing
            this._element.on("pointerdown", e => {
                this._handlePointer(e);
            });
            // Stop touch scrolling
            this._element.on("touchstart",
                e => {
                    if (this._isPen) 
                        e.preventDefault();
                },
                { passive: false });
            // Stop the context menu from appearing
            this._element.on("contextmenu", e => { 
                e.preventDefault();
                e.stopPropagation();
            });
            // Public variables
            // Handles scaling of parent components
            this.parentScale = 1;
            // Forces the use of the eraser - even if the pen isn't tilted over
            this.forceEraser = false;
            // Stroke parameters
            this.strokeParam = { ...defStrokeParam, ...strokeParam };
            // Styles for the stroke
            this.strokeStyles = { ...defStrokeStyles, ...strokeStyles };
            // Eraser paraneters
            this.eraserParam = { ...defEraserParam, ...eraserParam };
            // Styles for the Eraser
            this.eraserStyles = { ...defEraserStyles, ...eraserStyles };

            this.transform = transform;
            // Pen Callbacks
            this.penStartCallback = _ => {};
            this.penDownCallback = _ => {};
            this.penUpCallback = _ => {};
            // Eraser Callbacks
            this.eraseStartCallback = _ => {};
            this.eraserDownCallback = _ => {};
            this.eraserUpCallback = _ => {};
        } else {
            throw new Error("svg-pen-sketch needs a svg element in the constructor to work");
        }
    }

    // Public functions
    getElement() {
        return this._element.node();
    }
    toggleForcedEraser() {
        this.forceEraser = !this.forceEraser;
    }

    // Not being used at the moment
    resizeCanvas() {
        let bbox = this._element.node().getBoundingClientRect();
        this._element.attr("viewBox", "0 0 " + bbox.width + " " + bbox.height);
    }

    // Gets the path elements in a specified range
    // Uses their bounding boxes, so we can't tell if we're actually hitting the stroke with this
    // Just to determine if a stroke is close
    getPathsinRange(x, y, range = 1) {
        // The eraser bounds
        let p = this._element.node().createSVGPoint();
        let pointObj = this._element.node().createSVGPoint();
        let paths = [];
        let elements = [];

        // let includes = el => {
        //     return paths.includes(el);
        // };
        // d3.selectAll(".canvasElement").style("pointer-events", "visible");

        // Get the paths in the eraser's range        
        let lineDraw = this._element.selectAll("path.lineDraw").nodes();
        let linePaths = [];
        let strokeWidth = this.strokeStyles["stroke-width"] ? parseFloat(this.strokeStyles["stroke-width"]) : 1;
        
        let isPointInCircle = (px, py) => {
            let cx = this.transform.x / this.transform.k + x;
            let cy = this.transform.y / this.transform.k + y;

            const dx = px - cx;
            const dy = py - cy;
            return dx * dx + dy * dy <= range * range;
        };

        for (let i = 0; i < lineDraw.length; i++) {
            let path = lineDraw[i];
            let bbox = path.getBBox();

            let x1 = bbox.x - range - strokeWidth / 2;
            let x2 = bbox.x + bbox.width + range + strokeWidth / 2;
            let y1 = bbox.y - range - strokeWidth / 2;
            let y2 = bbox.y + bbox.height + range + strokeWidth / 2;

            if (isPointInCircle(x1 + range, y1 + range) && isPointInCircle(x1 + range, y2 - range) && isPointInCircle(x2 - range, y1 + range) && isPointInCircle(x2 - range, y2 - range)) {
                paths.push(path);
                elements.push(path);
            } else if (x > x1 && x < x2 && y > y1 && y < y2) {
                linePaths.push(path);
            }
        }

        for (let path of linePaths) {
            loop: for (let r = range; r >= 1; r -= 5) {
                for (let t = 0; t < 360; t += 20) {
                    p.x = this.transform.x / this.transform.k + x + r * Math.cos((Math.PI / 180) * t);
                    p.y = this.transform.y / this.transform.k + y + r * Math.sin((Math.PI / 180) * t);
                    let pt = p;

                    pointObj.x = pt.x;
                    pointObj.y = pt.y;

                    let isOnTopOfPath = path.isPointInStroke(pointObj) || path.isPointInFill(pointObj);

                    if (isOnTopOfPath) {
                        paths.push(path);
                        elements.push(path);
                        break loop;
                    }
                }
            }
        }
        // d3.selectAll(".canvasElement").style("pointer-events", "none");
        return [paths, elements];
    }

    // Remove a stroke if it's within range and the mouse is over it
    removePaths(x, y, eraserSize = 1) {
        // Prep variables
        // let removedPathIDs = [];

        // Get paths in the eraser's range
        let paths = this.getPathsinRange(x, y, eraserSize);

        // for (let path of paths) {
        //     removedPathIDs.push(d3.select(path).attr("id"));
        //     d3.select(path).remove();
        // }

        return paths;
    }

    // Edit (erase) a portion of a stroke
    erasePaths(x, y, eraserSize = 1) {
        let p = this._element.node().createSVGPoint();
        let eraserCoords = [];

        let [paths, ] = this.getPathsinRange(x, y, eraserSize);

        for (let t = 0; t < 360; t += 10) {
            p.x = this.transform.x / this.transform.k + x + eraserSize * Math.cos((Math.PI / 180) * t);
            p.y = this.transform.y / this.transform.k + y + eraserSize * Math.sin((Math.PI / 180) * t);
            let pt = p.matrixTransform(this._element.node().getScreenCTM());
            eraserCoords.push([pt.x * this.transform.k, pt.y * this.transform.k]);
        }

        for (let path of paths) {
            let pathD3 = d3.select(path);
            let coords = PathExtras.pathToCoords(pathD3.attr("d"));
            let diff = polygonClipping.difference([coords], [eraserCoords]);
            pathD3.remove();

            for (let i = 0; i < diff.length; i++) {
                for (let j = 0; j < diff[i].length; j++) {
                    let area = Math.abs(d3.polygonArea(diff[i][j]));

                    if (area > 20 && (Math.abs(d3.polygonArea(coords)) > area || diff.length === 1)) 
                        this._element.append("path").attr("d", flubber.toPathString(diff[i][j])).attr("class", pathD3.attr("class")).attr("transform", pathD3.attr("transform")).attr("style", pathD3.attr("style"));
            
                }
            }
        }
    }

    changeTransform(transform) {
        this.transform = transform;

        for (let path of this._element.node().querySelectorAll(".lineDraw")) {
            d3.select(path).attr("transform", transform);
        }
    }

    // Private functions
    _createEraserHandle(x, y) {
        // Prep the eraser hover element
        this._eraserHandle = this._element.append("circle");
        this._eraserHandle
        .attr("class", "eraserHandle")
        .attr("r", this.eraserParam.eraserSize / 2)
        .attr("cx", x)
        .attr("cy", y)
        .attr("transform", `translate(${this.transform.x} ${this.transform.y}) scale(${this.transform.k})`);

        // Hide the mouse cursor
        this._element.style("cursor", "none");

        // Apply all user-desired styles
        for (let styleName in this.eraserStyles) {
            this._eraserHandle.style(styleName, this.eraserStyles[styleName]);
        }
    }

    _moveEraserHandle(x, y) {
        if (this._eraserHandle) {
            this._eraserHandle.attr("cx", x);
            this._eraserHandle.attr("cy", y);
        }
    }

    _removeEraserHandle() {
        if (this._eraserHandle) {
            this._eraserHandle.remove();
            this._eraserHandle = null;
            this._element.style("cursor", null);
        }
    }

    // Handles the different pointers
    // Also allows for pens to be used on modern browsers
    _handlePointer(e) {
        // If the pointer is a pen - prevent the touch event and run pointer handling code
        if (e.pointerType === "touch") {
            this._isPen = false;
        } else {
            this._isPen = true;

            let pointerButton = e.button;
            if (this.forceEraser) 
                pointerButton = 5;

            // Determine if the pen tip or eraser is being used
            // ID 0 *should be* the pen tip, with anything else firing the eraser
            switch (pointerButton) {
            // Pen
                case 0:
                // Create the path/coordinate arrays and set event handlers
                    let penCoords = [];
                    let strokePath = this._createPath();

                    // Create the drawing event handlers
                    this._element.on("pointermove", e => this._handleDownEvent(e, _ => this._onDraw(strokePath, penCoords, e)));
                    this._element.on("pointerup", e => this._handleUpEvent(e, _ => this._stopDraw(strokePath, penCoords)));
                    this._element.on("pointerleave", e => this._handleUpEvent(e, _ => this._stopDraw(strokePath, penCoords)));
                    if (this.penStartCallback !== undefined) {
                        this.penStartCallback(strokePath.node(), e);
                    }
                    break;

                // Eraser
                default:
                case 5:
                // Create the location arrays
                    let [x, y] = this._getMousePos(e);
                    let eraserCoords = [[x, y]];

                    // Create the eraser handle
                    this._createEraserHandle(x, y);

                    // Call the eraser event once for the initial on-click
                    this._handleDownEvent(e, _ => this._onErase(eraserCoords));

                    // Create the erase event handlers
                    this._element.on("pointermove", e => {
                        this._handleDownEvent(e, _ => this._onErase(eraserCoords));
                    });
                    this._element.on("pointerup", e => this._handleUpEvent(e, _ => this._stopErase(eraserCoords)));
                    this._element.on("pointerleave", e => this._handleUpEvent(e, _ => this._stopErase(eraserCoords)));
                    if (this.eraseStartCallback !== undefined) {
                        this.eraseStartCallback(e);
                    }
                    break;
            }
        }
    }

    // Creates a new pointer event that can be modified
    _createEvent(e) {
        let newEvent = {};
        let features = ["screenX", "screenY", "clientX", "clientY", "offsetX", "offsetY", "pageX", "pageY", "pointerType", "pressure", "movementX", "movementY", "tiltX", "tiltY", "twistX", "twistY", "timeStamp"];

        for (let feat of features) {
            newEvent[feat] = e[feat];
        }
        return newEvent;
    }

    // Handles the creation of this._currPointerEvent and this._prevPointerEvent
    // Also interpolates between events if needed to keep a particular sample rate
    _handleDownEvent(e, callback) {
        if (this._prevPointerEvent) {
            let timeDelta = e.timeStamp - this._prevPointerEvent.timeStamp;

            if (timeDelta > this.strokeParam.maxTimeDelta * 2) {
                // Calculate how many interpolated samples we need
                let numSteps = Math.floor(timeDelta / this.strokeParam.maxTimeDelta) + 1;
                let step = timeDelta / numSteps / timeDelta;

                // For each step
                for (let i = step; i < 1; i += step) {
                    // Make a new event based on the current event
                    let newEvent = this._createEvent(e);
                    for (let feat in newEvent) {
                        // For every feature (that is a number)
                        if (!isNaN(parseFloat(newEvent[feat]))) {
                            // Linearly interpolate it
                            newEvent[feat] = MathExtras.lerp(this._prevPointerEvent[feat], newEvent[feat], i);
                        }
                    }
                    // Set it and call the callback
                    this._currPointerEvent = newEvent;
                    callback();
                }
            }
        }

        // Call the proper callback with the "real" event
        this._currPointerEvent = this._createEvent(e);
        callback();
        this._prevPointerEvent = this._currPointerEvent;
    }

    // Handles the removal of this._currPointerEvent and this._prevPointerEvent
    _handleUpEvent(e, callback) {
        // Run the up callback
        this._currPointerEvent = this._createEvent(e);
        callback();

        // Cleanup the previous pointer events
        this._prevPointerEvent = null;
        this._currPointerEvent = null;
    }

    // Creates a new path on the screen
    _createPath() {
        let strokePath = this._element.append("path");

        // Generate a random ID for the stroke
        let strokeID = Math.random().toString(32).slice(2, 11);
        strokePath.attr("id", strokeID).style("will-change", "d");
        strokePath.classed("lineDraw", true);

        // Apply all user-desired styles
        for (let styleName in this.strokeStyles) {
            strokePath.style(styleName, this.strokeStyles[styleName]);
        }
        // strokePath.attr("transform", `translate(${this.transform.x}, ${this.transform.y}) scale(${this.transform.k})`);

        return strokePath;
    }

    // Gets the mouse position on the canvas
    _getMousePos(event) {
        let pt = this.getElement().createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;

        let transformedPt = pt.matrixTransform(this.getElement().getScreenCTM().inverse());
        // transformedPt = [(transformedPt.x - this.transform.x) / this.transform.k, (transformedPt.y - this.transform.y) / this.transform.k]
        return [transformedPt.x, transformedPt.y];
    }

    // Handle the drawing
    _onDraw(strokePath, penCoords, e) {
        if (this._currPointerEvent.pointerType !== "touch") {
            let [x, y] = this._getMousePos(this._currPointerEvent);

            // Add the points to the path
            penCoords.push([x, y, e.pressure]);

            let mapPenCoords = penCoords.map(coord => {
                return { x: coord[0], y: coord[1], pressure: coord[2] };
            });

            const stroke = getStroke(mapPenCoords, {
                size: this.strokeStyles["toolRef"]?.current === "pen" ? 2 : 25,
                thinning: 0.25,
                smoothing: 1,
                streamline: 0.5,
                simulatePressure: false,
            });

            strokePath.attr("d", this.strokeParam.lineFunc(stroke));

            // Call the callback
            if (this.penDownCallback !== undefined) {
                this.penDownCallback(strokePath.node(), this._currPointerEvent, penCoords);
            }
        }
    }

    // Interpolate coordinates in the paths in order to keep a min distance
    _interpolateStroke(strokePath, penCoords) {
        const w = new Worker(URL.createObjectURL(new Blob([`(${MathExtras.interpolate.toString()})()`])));

        // Fill in the path if there are missing nodes
        w.postMessage({ penCoords: penCoords, minDist: this.strokeParam.minDist });

        w.addEventListener("message", (event) => {
            let mapPenCoords = event.data.map(coord => {
                return { x: coord[0], y: coord[1], pressure: coord[2] };
            });

            const stroke = getStroke(mapPenCoords, {
                size: this.strokeStyles["toolRef"]?.current === "pen" ? 2 : 25,
                thinning: 0.25,
                smoothing: 1,
                streamline: 0.5,
                simulatePressure: false
            });

            // Update the stroke
            strokePath.attr("d", this.strokeParam.lineFunc(stroke));
            w.terminate();
        });
    }

    // Stop the drawing
    _stopDraw(strokePath, penCoords) {
        // Remove the event handlers
        this._element.on("pointermove", null);
        this._element.on("pointerup", null);
        this._element.on("pointerleave", null);

        // Interpolate the path if needed
        // this._interpolateStroke(strokePath, penCoords);

        // Call the callback
        if (this.penUpCallback !== undefined) {
            this.penUpCallback(strokePath.node(), this._currPointerEvent, penCoords);
        }
    }

    // Handle the erasing
    _onErase(eraserCoords) {
        if (this._currPointerEvent.pointerType !== "touch") {
            let [mouseX, mouseY] = this._getMousePos(this._currPointerEvent);
            let [x, y] = [this._eraserHandle.attr("cx"), this._eraserHandle.attr("cy")];
            // console.log(x, y);
            // Add the points
            eraserCoords.push([x, y]);

            [x, y] = [(x - this.transform.x) / this.transform.k, (y - this.transform.y) / this.transform.k];
            let affectedPaths = null,
                elements = null;
            // Move the eraser cursor
            this._moveEraserHandle(mouseX, mouseY);

            switch (this.eraserParam.eraserMode) {
                case "object":
                // Remove any paths in the way
                    [affectedPaths, elements] = this.removePaths(x, y, this.eraserParam.eraserSize / 2);
                    break;
                case "pixel":
                    affectedPaths = this.erasePaths(x, y, this.eraserParam.eraserSize / 2);
                    break;
                default:
                    console.error("ERROR: INVALID ERASER MODE");
                    break;
            }

            if (this.eraserDownCallback !== undefined) {
                this.eraserDownCallback(affectedPaths, this._currPointerEvent, elements, eraserCoords);
            }
        }
    }

    // Stop the erasing
    _stopErase(eraserCoords) {
        // Remove the eraser icon and add the cursor
        this._removeEraserHandle();

        // Remove the event handlers
        this._element.on("pointermove", null);
        this._element.on("pointerup", null);
        this._element.on("pointerleave", null);

        // Call the callback
        if (this.eraserUpCallback !== undefined) {
            this.eraserUpCallback(this._currPointerEvent, eraserCoords);
        }
    }
}
