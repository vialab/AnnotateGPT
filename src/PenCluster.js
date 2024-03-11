function checkBoundingBoxes(box1, box2) {
    // Calculate the sides of the boxes
    let left1 = box1.x;
    let right1 = box1.x + box1.width;
    let top1 = box1.y;
    let bottom1 = box1.y + box1.height;

    let left2 = box2.x;
    let right2 = box2.x + box2.width;
    let top2 = box2.y;
    let bottom2 = box2.y + box2.height;

    // Check for intersection
    let intersect = !(left1 > right2 || right1 < left2 || top1 > bottom2 || bottom1 < top2);

    // Check for containment
    let box1ContainsBox2 = left1 <= left2 && right1 >= right2 && top1 <= top2 && bottom1 >= bottom2;
    let box2ContainsBox1 = left2 <= left1 && right2 >= right1 && top2 <= top1 && bottom2 >= bottom1;

    return intersect || box1ContainsBox2 || box2ContainsBox1;
}


function calculateMinDistance(box1, box2) {
    let dx2 = 0, dy2 = 0;

    if (checkBoundingBoxes(box1, box2)) {
        dx2 = Math.min(Math.pow(box1.x - (box2.x + box2.width), 2), Math.pow((box1.x + box1.width - box2.x), 2));
        dy2 = Math.min(Math.pow(box1.y - (box2.y + box2.height), 2), Math.pow((box1.y + box1.height - box2.y), 2));
    } else {
        let x_diff_1, x_diff_2, x_diff_3, x_diff_4;
        x_diff_1 = Math.abs(box1.x - box2.x);
        x_diff_2 = Math.abs(box1.x - (box2.x + box2.width));
        x_diff_3 = Math.abs((box1.x + box1.width) - box2.x);
        x_diff_4 = Math.abs((box1.x + box1.width) - (box2.x + box2.width));
        
        let y_diff_1, y_diff_2, y_diff_3, y_diff_4;
        y_diff_1 = Math.abs(box1.y - box2.y);
        y_diff_2 = Math.abs(box1.y - (box2.y + box2.height));
        y_diff_3 = Math.abs((box1.y + box1.height) - box2.y);
        y_diff_4 = Math.abs((box1.y + box1.height) - (box2.y + box2.height));
        
        dx2 = Math.pow(Math.min(x_diff_1, x_diff_2, x_diff_3, x_diff_4), 2);
        dy2 = Math.pow(Math.min(y_diff_1, y_diff_2, y_diff_3, y_diff_4), 2);
    }
    return dx2 + dy2;
}

class Cluster {
    constructor(strokes) {
        this.strokes = [...strokes];
        this.lastestTimestamp = Math.max(...strokes.map(point => point.timestamp));
    }

    distanceTo(cluster) {
        let minDistance = Infinity;

        for (let point1 of this.strokes) {
            for (let point2 of cluster.strokes) {
                let spatial = calculateMinDistance(point1.bbox, point2.bbox);
                let dt = point2.timestamp - point1.timestamp;
                let temporal = (dt / 1000 > 60) ? 1 : (dt / 1000 / 60);

                let distance = Math.sqrt(spatial + temporal * temporal);

                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
        }
        return minDistance;
    }

    merge(cluster) {
        this.strokes = this.strokes.concat(...cluster.strokes);
        this.lastestTimestamp = Math.max(this.lastestTimestamp, cluster.lastestTimestamp);
    }
}

class Stroke {
    constructor(id, bbox) {
        this.timestamp = Date.now();
        this.id = id;
        this.bbox = Stroke.normalizeBoundingBox(bbox);
    }

    static normalizeBoundingBox(bb) {
        bb.x = bb.x / window.innerWidth;
        bb.y = bb.y / window.innerHeight;
        bb.width = bb.width / window.innerWidth;
        bb.height = bb.height / window.innerHeight;
        return bb;
    }
}


export default class PenCluster {
    constructor() {
        this.strokes = [];
    }

    add(id, bbox) {
        // console.clear();
        this.strokes.push(new Stroke(id, bbox));
        let clusters = this.strokes.map(point => new Cluster([point]));
        let d = [0];
        let history = [[...clusters]];
        let stopIteration = 0;
        console.log(clusters);

        while (clusters.length > 1) {
            let minDistance = Infinity;
            let pair = [];

            for (let i = 0; i < clusters.length; i++) {
                for (let j = i + 1; j < clusters.length; j++) {
                    let distance = clusters[i].distanceTo(clusters[j]);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        pair = [i, j];
                    }
                }
            }
            d.push(minDistance);

            let newCluster = new Cluster(clusters[pair[0]].strokes.concat(clusters[pair[1]].strokes));

            // clusters[pair[0]].merge(clusters[pair[1]]);
            clusters[pair[0]] = newCluster;
            clusters.splice(pair[1], 1);
            history.push([...clusters]);
            // console.log(d2, d1, d0);
        }
        let maxRatio = -Infinity;

        if (history.length < 3) {
            return history[history.length - 1];
        } else {
            for (let i = 1; i < d.length - 1; i++) {
                let ratio = (d[i + 1] - d[i]) * (d[i + 1] - d[i]) / (d[i] - d[i - 1]);
                
                if (ratio > maxRatio) {
                    maxRatio = ratio;
                    stopIteration = i;
                }
            }
        }

        console.log(history);
        console.log(history[stopIteration]);
        return history[stopIteration];
    }
}