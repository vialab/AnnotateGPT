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

const PathExtras = {
    coordsToPath: coordsToPath,
    pathToCoords: pathToCoords,
    getCachedPathBBox: getCachedPathBBox,
    pathCoordHitTest: pathCoordHitTest,
    closestPoint: closestPoint,
};

Object.freeze(PathExtras);
export default PathExtras;
