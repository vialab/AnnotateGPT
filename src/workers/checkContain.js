import { ShapeInfo, Intersection } from "kld-intersections";
import { polygonContains } from "d3-polygon";

addEventListener("message", (e) => {
    let rect = e.data.rect;
    let pathBoundingBox = e.data.pathBoundingBox;
    let svgBoundingBox = e.data.svgBoundingBox;
    let coords = e.data.coords;
    let checkCenter = e.data.checkCenter;
    let svgPoint = e.data.svgPoint;
    let svgPoint2 = e.data.svgPoint2;
    let shape = ShapeInfo.path(e.data.d);

    if (rect.left > pathBoundingBox.x + pathBoundingBox.width || rect.right < pathBoundingBox.x || rect.top > pathBoundingBox.y + pathBoundingBox.height || rect.bottom < pathBoundingBox.y) {
        postMessage({ contain: false, i: e.data.i });
    } else if (rect.left > pathBoundingBox.x && rect.right < pathBoundingBox.x + pathBoundingBox.width && rect.top > pathBoundingBox.y && rect.bottom < pathBoundingBox.y + pathBoundingBox.height) {
        // wordsOfInterest.push({ element: word });
        postMessage({ contain: true, i: e.data.i });
    } else {
        let rectShape = ShapeInfo.rectangle(svgPoint.x, svgPoint.y - svgBoundingBox.top, svgPoint2.x - svgPoint.x, svgPoint2.y - svgPoint.y);
        let intersection = Intersection.intersect(rectShape, shape);


        if (intersection.status === "Intersection") {
            let center = [svgPoint.x + (svgPoint2.x - svgPoint.x) / 2, svgPoint.y - svgBoundingBox.top + (svgPoint2.y - svgPoint.y) / 2];
            let rightCenter = [svgPoint2.x - (svgPoint2.x - svgPoint.x) / 4, svgPoint.y - svgBoundingBox.top + (svgPoint2.y - svgPoint.y) / 2 + (svgPoint2.y - svgPoint.y) / 4];
            let leftCenter = [svgPoint.x + (svgPoint2.x - svgPoint.x) / 4, svgPoint.y - svgBoundingBox.top + (svgPoint2.y - svgPoint.y) / 4];                

            if (!checkCenter) {
                function overlapArea(rect1, rect2) {
                    // Extract rectangle coordinates
                    const [x1A, y1A, x2A, y2A] = rect1;
                    const [x1B, y1B, x2B, y2B] = rect2;
                
                    // Calculate overlap width and height
                    const overlapWidth = Math.max(0, Math.min(x2A, x2B) - Math.max(x1A, x1B));
                    const overlapHeight = Math.max(0, Math.min(y2A, y2B) - Math.max(y1A, y1B));
                
                    // Calculate overlap area
                    return overlapWidth * overlapHeight;
                }
                let rect1 = [svgPoint.x, svgPoint.y, svgPoint2.x, svgPoint2.y];
                let rect2 = [pathBoundingBox.x, pathBoundingBox.y, pathBoundingBox.x + pathBoundingBox.width, pathBoundingBox.y + pathBoundingBox.height];
                let area = overlapArea(rect1, rect2);
                let ratio = area / ((svgPoint2.x - svgPoint.x) * (svgPoint2.y - svgPoint.y));
                
                if (ratio > 0.5) {
                    postMessage({ contain: true, i: e.data.i });
                }
            } else if (polygonContains(coords, center) && (polygonContains(coords, rightCenter) || polygonContains(coords, leftCenter))) {
                postMessage({ contain: true, i: e.data.i });
            }
        }
    }
    postMessage({ contain: false, i: e.data.i });
});