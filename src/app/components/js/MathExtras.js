function getDist(x1, y1, x2, y2) {
    // Return the distance of point 2 (x2,y2) from point 1 (x1, y1)
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function lerp(val1, val2, amnt) {
    amnt = amnt < 0 ? 0 : amnt;
    amnt = amnt > 1 ? 1 : amnt;
    return (1 - amnt) * val1 + amnt * val2;
}

function interpolate() {
    function getDist(x1, y1, x2, y2) {
        // Return the distance of point 2 (x2,y2) from point 1 (x1, y1)
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
    
    function lerp(val1, val2, amnt) {
        amnt = amnt < 0 ? 0 : amnt;
        amnt = amnt > 1 ? 1 : amnt;
        return (1 - amnt) * val1 + amnt * val2;
    }

    this.addEventListener("message", e => {
        let penCoords = e.data.penCoords;
        let minDist = e.data.minDist;
        let newPath = [];

        for (let i = 0; i <= penCoords.length - 2; i++) {
            // Get the current and next coordinates
            let currCoords = penCoords[i];
            let nextCoords = penCoords[i + 1];
            newPath.push(currCoords);

            // If the distance to the next coord is too large, interpolate between
            let dist = getDist(currCoords[0], currCoords[1], nextCoords[0], nextCoords[1]);
            if (dist > minDist * 2) {
                // Calculate how many interpolated samples we need
                let step = Math.floor((dist / minDist) * 2) + 1;
                // Loop through the interpolated samples needed - adding new coordinates
                for (let j = dist / step / dist; j < 1; j += dist / step / dist) {
                    newPath.push([lerp(currCoords[0], nextCoords[0], j), lerp(currCoords[1], nextCoords[1], j), lerp(currCoords[2], nextCoords[2], j)]);
                }
            }

            // Add the final path
            if (i === penCoords.length - 2) {
                newPath.push(nextCoords);
            }
        }
        postMessage(newPath);
    });
}

const MathExtras = {
    getDist: getDist,
    lerp: lerp,
    interpolate: interpolate,
};

Object.freeze(MathExtras);
export default MathExtras;
