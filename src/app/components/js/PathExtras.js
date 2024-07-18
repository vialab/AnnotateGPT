import polygonClipping from "polygon-clipping";

function coordsToPath(points) {
    let pathStr = "";

    for (let point of points) {
        if (pathStr === "") {
            pathStr += "M";
        } else {
            pathStr += "L";
        }
        pathStr += `${point[0]} ${point[1]} `;
    }

    return pathStr.trim();
}

function pathToCoords(pathStr) {
    let commands = pathStr.split(/(?=[LMC])/);
    let points = commands.map(function (point) {
        if (point !== " ") {
            // If the string doesn't have a space at the end, add it
            // Usefule for the last coords
            if (point[point.length - 1] !== " ") {
                point += " ";
            }

            // Trim the path string and convert it
            let coords = point.slice(1, -1).split(" ");

            // Convert the coords to a float
            coords[0] = parseFloat(coords[0]);
            coords[1] = parseFloat(coords[1]);
            return coords;
        }
        return undefined;
    });
    return points;
}

function getCachedPathBBox(path) {
    if (!path._boundingClientRect) {
        path._boundingClientRect = path.getBBox();
    }
    return path._boundingClientRect;
}

function pathCoordHitTest(pathCoords, x, y, range = 1) {
    // The bounds
    // let xLowerBounds = x - range,
    //     xUpperBounds = x + range,
    //     yLowerBounds = y - range,
    //     yUpperBounds = y + range;
    // The indicies of the path coord array that the eraser is over
    let hitIndicies = [];

    for (let i = 0; i < pathCoords.length; i++) {
        let xCoord = pathCoords[i][0],
            yCoord = pathCoords[i][1];

        // If the particular point on the line is within the erasing area
        // Eraser area = eraser point +- eraserSize in the X and Y directions
        // if (
        //     xLowerBounds <= xCoord &&
        //     xCoord <= xUpperBounds &&
        //     yLowerBounds <= yCoord &&
        //     yCoord <= yUpperBounds
        // ) {
        //     // If we need to erase this point just create a seperation between the last two points
        //     // The seperation is done by creating two new paths
        //     hitIndicies.push(i);
        // }
        if (Math.sqrt(Math.pow(xCoord - x, 2) + Math.pow(yCoord - y, 2)) <= range) {
            // If we need to erase this point just create a seperation between the last two points
            // The seperation is done by creating two new paths
            hitIndicies.push(i);
        }
    }

    return hitIndicies;
}

function closestPoint(pathNode, point, range = 1) {
    var pathLength = pathNode.getTotalLength(),
        precision = 25,
        best,
        bestLength,
        bestDistance = Infinity;

    // linear scan for coarse approximation
    for (var scan, scanLength = 0, scanDistance; scanLength <= pathLength; scanLength += precision) {
        if ((scanDistance = distance2((scan = pathNode.getPointAtLength(scanLength)))) < bestDistance) {
            best = scan;
            bestLength = scanLength;
            bestDistance = scanDistance;
        }
    }

    // binary search for precise estimate
    precision /= 2;
    while (precision > range) {
        var before, after, beforeLength, afterLength, beforeDistance, afterDistance;
        if ((beforeLength = bestLength - precision) >= 0 && (beforeDistance = distance2((before = pathNode.getPointAtLength(beforeLength)))) < bestDistance) {
            best = before;
            bestLength = beforeLength;
            bestDistance = beforeDistance;
        } else if ((afterLength = bestLength + precision) <= pathLength && (afterDistance = distance2((after = pathNode.getPointAtLength(afterLength)))) < bestDistance) {
            best = after;
            bestLength = afterLength;
            bestDistance = afterDistance;
        } else {
            precision /= 2;
        }

        if (bestDistance <= range) {
            break;
        }
    }

    best = [best.x, best.y];
    best.distance = Math.sqrt(bestDistance);
    return best;

    function distance2(p) {
        var dx = p.x - point[0],
            dy = p.y - point[1];
        return dx * dx + dy * dy;
    }
}

function getSvgPathFromStroke(points, closed = true) {
    const len = points.length;
    const average = (a, b) => (a + b) / 2;

    if (len < 4) {
        return ``;
    }

    let a = points[0];
    let b = points[1];
    const c = points[2];

    let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} t`;
    let prevPoint = [average(b[0], c[0]), average(b[1], c[1])];

    for (let i = 2, max = len - 1; i < max; i++) {
        a = points[i];
        b = points[i + 1];

        let x = average(a[0], b[0]);
        let y = average(a[1], b[1]);

        let dx = x - prevPoint[0];
        let dy = y - prevPoint[1];

        result += `${dx.toFixed(2)},${dy.toFixed(2)} `;
        prevPoint = [x, y];
    }

    if (closed) {
        result += 'Z';
    }

    return result;
}

function getFlatSvgPathFromStroke(stroke) {
    try {
        const faces = polygonClipping.union([stroke]);

        const d = [];
    
        faces.forEach((face) =>
            face.forEach((points) => {
                d.push(getSvgPathFromStroke(points));
            })
        );
    
        return d.join(' ');
    } catch (e) {
        return getSvgPathFromStroke(stroke);
    }
}

const PathExtras = {
    coordsToPath: coordsToPath,
    pathToCoords: pathToCoords,
    getCachedPathBBox: getCachedPathBBox,
    pathCoordHitTest: pathCoordHitTest,
    closestPoint: closestPoint,
    getSvgPathFromStroke: getSvgPathFromStroke,
    getFlatSvgPathFromStroke: getFlatSvgPathFromStroke,
};

Object.freeze(PathExtras);
export default PathExtras;
