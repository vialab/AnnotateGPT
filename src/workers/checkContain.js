import { ShapeInfo, Intersection } from "kld-intersections";
import { polygonContains } from "d3-polygon";
import * as d3 from "d3";

function intersect(p1, p2, boundary, orientation) {
    let t;
    if (orientation === "vertical") {
        t = (boundary - p1[0]) / (p2[0] - p1[0]);
        return [boundary, p1[1] + t * (p2[1] - p1[1])];
    } else {
        t = (boundary - p1[1]) / (p2[1] - p1[1]);
        return [p1[0] + t * (p2[0] - p1[0]), boundary];
    }
}

// Sutherland-Hodgman clipping function.
function clipPolygonToRect(polygon, rect) {
    // rect is defined by two points: [ [x0, y0], [x1, y1] ]
    let [x0, y0] = rect[0],
        [x1, y1] = rect[1];

    // Define the four clipping boundaries.
    const clipEdges = [
        {
            // Left edge: x must be >= x0.
            inside: p => p[0] >= x0,
            intersect: (p1, p2) => intersect(p1, p2, x0, "vertical"),
        },
        {
            // Top edge: y must be >= y0.
            inside: p => p[1] >= y0,
            intersect: (p1, p2) => intersect(p1, p2, y0, "horizontal"),
        },
        {
            // Right edge: x must be <= x1.
            inside: p => p[0] <= x1,
            intersect: (p1, p2) => intersect(p1, p2, x1, "vertical"),
        },
        {
            // Bottom edge: y must be <= y1.
            inside: p => p[1] <= y1,
            intersect: (p1, p2) => intersect(p1, p2, y1, "horizontal"),
        },
    ];

    let outputList = polygon;
    clipEdges.forEach(edge => {
        const inputList = outputList;
        outputList = [];
        for (let i = 0; i < inputList.length; i++) {
            const current = inputList[i];
            const previous = inputList[(i - 1 + inputList.length) % inputList.length];

            const currentInside = edge.inside(current);
            const previousInside = edge.inside(previous);

            if (currentInside) {
                if (!previousInside) {
                    // Coming from outside -> add intersection point.
                    outputList.push(edge.intersect(previous, current));
                }
                // Add current point.
                outputList.push(current);
            } else if (previousInside) {
                // Leaving the clipping region -> add intersection.
                outputList.push(edge.intersect(previous, current));
            }
            // If both are outside, add nothing.
        }
    });
    return outputList;
}

addEventListener("message", (e) => {
    let rect = e.data.rect;
    let pathBoundingBox = e.data.pathBoundingBox;
    let svgBoundingBox = e.data.svgBoundingBox;
    let coords = e.data.coords;
    // let checkCenter = e.data.checkCenter;
    let svgPoint = e.data.svgPoint;
    let svgPoint2 = e.data.svgPoint2;
    let pageTop = e.data.pageTop;
    let contain = false;

    if (rect.left > pathBoundingBox.x + pathBoundingBox.width || rect.right < pathBoundingBox.x || rect.top > pathBoundingBox.y + pathBoundingBox.height || rect.bottom < pathBoundingBox.y) {
        postMessage({ contain: false, i: e.data.i, containCenter: false });
    } else if (rect.left > pathBoundingBox.x && rect.right < pathBoundingBox.x + pathBoundingBox.width && rect.top > pathBoundingBox.y && rect.bottom < pathBoundingBox.y + pathBoundingBox.height) {
        // wordsOfInterest.push({ element: word });
        let clipped = clipPolygonToRect(coords, [[rect.left, rect.top - pageTop], [rect.right, rect.bottom - pageTop]]);
        const overlappedArea = Math.abs(d3.polygonArea(clipped)) / ((rect.right - rect.left) * (rect.bottom - rect.top));

        if (overlappedArea > 0.5) {
            contain = true;
        }
        postMessage({ contain: contain, i: e.data.i, containCenter: true });
    } else {
        let shape = ShapeInfo.path(e.data.d);
        let rectShape = ShapeInfo.rectangle(svgPoint.x, svgPoint.y - svgBoundingBox.top, svgPoint2.x - svgPoint.x, svgPoint2.y - svgPoint.y);
        let intersection = Intersection.intersect(rectShape, shape);

        if (intersection.status === "Intersection") {
            let center = [svgPoint.x + (svgPoint2.x - svgPoint.x) / 2, svgPoint.y - svgBoundingBox.top + (svgPoint2.y - svgPoint.y) / 2];
            let rightCenter = [svgPoint2.x - (svgPoint2.x - svgPoint.x) / 4, svgPoint.y - svgBoundingBox.top + (svgPoint2.y - svgPoint.y) / 2 + (svgPoint2.y - svgPoint.y) / 4];
            let leftCenter = [svgPoint.x + (svgPoint2.x - svgPoint.x) / 4, svgPoint.y - svgBoundingBox.top + (svgPoint2.y - svgPoint.y) / 4];
            let containCenter = false, containBox = false;

            let clipped = clipPolygonToRect(coords, [[rect.left, rect.top - pageTop], [rect.right, rect.bottom - pageTop]]);
            const overlappedArea = Math.abs(d3.polygonArea(clipped)) / ((rect.right - rect.left) * (rect.bottom - rect.top));
    
            if (overlappedArea > 0.5) {
                contain = true;
            }

            function overlapArea(rect1, rect2) {
                const [x1A, y1A, x2A, y2A] = rect1;
                const [x1B, y1B, x2B, y2B] = rect2;
                const overlapWidth = Math.max(0, Math.min(x2A, x2B) - Math.max(x1A, x1B));
                const overlapHeight = Math.max(0, Math.min(y2A, y2B) - Math.max(y1A, y1B));
                return overlapWidth * overlapHeight;
            }
            let rect1 = [svgPoint.x, svgPoint.y, svgPoint2.x, svgPoint2.y];
            let rect2 = [pathBoundingBox.x, pathBoundingBox.y, pathBoundingBox.x + pathBoundingBox.width, pathBoundingBox.y + pathBoundingBox.height];
            let area = overlapArea(rect1, rect2);
            let ratio = area / ((svgPoint2.x - svgPoint.x) * (svgPoint2.y - svgPoint.y));
            
            if (ratio > 0.5) {
                containBox = true;
            }
            
            if (polygonContains(coords, center) && (polygonContains(coords, rightCenter) || polygonContains(coords, leftCenter))) {
                containCenter = true;
            }
            postMessage({ contain: contain, i: e.data.i, containCenter: containCenter, containBox: containBox });
            return;
        }
        postMessage({ contain: false, i: e.data.i, containCenter: false });
    }
});