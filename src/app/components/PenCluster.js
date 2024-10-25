export function checkBoundingBoxes(box1, box2) {
    // if (isEmpty() || w <= 0 || h <= 0) {
    //     return false;
    // }
    // double x0 = getX();
    // double y0 = getY();
    // return (x + w > x0 &&
    //         y + h > y0 &&
    //         x < x0 + getWidth() &&
    //         y < y0 + getHeight());

    return (box2.x + box2.width > box1.x && box2.y + box2.height > box1.y && box2.x < box1.x + box1.width && box2.y < box1.y + box1.height);

    // let left1 = box1.x;
    // let right1 = box1.x + box1.width;
    // let top1 = box1.y;
    // let bottom1 = box1.y + box1.height;

    // let left2 = box2.x;
    // let right2 = box2.x + box2.width;
    // let top2 = box2.y;
    // let bottom2 = box2.y + box2.height;

    // let intersect = !(box1.x > right2 || right1 < left2 || top1 > bottom2 || bottom1 < top2);

    // return intersect;
}


export function calculateMinDistance(box1, box2) {
    let dx2 = 0, dy2 = 0;
    let box1ContainsBox2 = box1.x < box2.x && box1.x + box1.width > box2.x + box2.width && box1.y < box2.y && box1.y + box1.height > box2.y + box2.height;
    let box2ContainsBox1 = box2.x < box1.x && box2.x + box2.width > box1.x + box1.width && box2.y < box1.y && box2.y + box2.height > box1.y + box1.height;
    // console.log(box1, box2, checkBoundingBoxes(box1, box2), box1ContainsBox2, box2ContainsBox1);
    // console.log((!checkBoundingBoxes(box1, box2) && !box1ContainsBox2) || box2ContainsBox1);

    if (box1ContainsBox2 || box2ContainsBox1) {
        // dx2 = Math.min(Math.pow(box1.x - (box2.x + box2.width), 2), Math.pow((box1.x + box1.width - box2.x), 2));
        // dy2 = Math.min(Math.pow(box1.y - (box2.y + box2.height), 2), Math.pow((box1.y + box1.height - box2.y), 2));
        dx2 = Math.min(Math.pow(box2.x - (box1.x + box1.width), 2), Math.pow(box1.x - (box2.x + box2.width), 2));
        dy2 = Math.min(Math.pow(box2.y - (box1.y + box1.height), 2), Math.pow(box1.y - (box2.y + box2.height), 2));
        return dx2 + dy2;
    } else {
        const a = box1;
        const b = box2;
        const deltas = [a.x - b.x - b.width, a.y - b.y - b.height, b.x - a.x - a.width, b.y - a.y - a.height];

        const sum = deltas.reduce((total, d) => {
            return d > 0 ? total + d ** 2 : total;
        }, 0);

        return sum;
    }
}

export class Cluster {
    constructor(strokes) {
        this.strokes = [...strokes];
        this.lastestTimestamp = Math.max(...strokes.map(point => point.endTime));
    }

    distanceTo(cluster) {
        let minDistance = Infinity;

        for (let point1 of this.strokes) {
            for (let point2 of cluster.strokes) {
                let spatial = calculateMinDistance(point1.bbox, point2.bbox);

                
                let dt = point2.startTime > point1.startTime ? point2.startTime - point1.endTime : point1.startTime - point2.endTime;
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
        this.lastestTimestamp = Math.max(this.lastestTimestamp, cluster.endTime);
    }
}

class Stroke {
    constructor(id, bbox, type, time, text = [], marginalText = [], textBbox = {}, marginalTextBbox = {}, lineBbox = {}, page = 0, endTime = 0) {
        this.startTime = time;
        this.type = type;
        this.endTime = id === "initial" ? 0 : Date.now();
        this.endTime = endTime === 0 ? this.endTime : endTime;
        this.id = id;
        this.bbox = Stroke.normalizeBoundingBox(bbox);
        this.annotatedText = text;
        this.marginalText = marginalText;
        this.textBbox = Stroke.normalizeBoundingBox(textBbox);
        this.marginalTextBbox = Stroke.normalizeBoundingBox(marginalTextBbox);
        this.lineBbox = Stroke.normalizeBoundingBox(lineBbox);
        this.page = page;
    }

    static normalizeBoundingBox(bbox) {
        let height = Number(document.querySelector(".pen-annotation-container")?.style.getPropertyValue("--annotation-height").split("px")[0]) || window.innerHeight;

        return {
            x: bbox.x / window.innerWidth,
            y: bbox.y / height,
            width: bbox.width / window.innerWidth,
            height: bbox.height / height,
            top: bbox.y / height,
            right: (bbox.x + bbox.width) / window.innerWidth,
            bottom: (bbox.y + bbox.height) / height,
            left: bbox.x / window.innerWidth
        };
    }
}

export default class PenCluster {
    constructor() {
        let height = Number(document.querySelector(".pen-annotation-container")?.style.getPropertyValue("--annotation-height").split("px")[0]) || window.innerHeight;

        this.strokes = [new Stroke("initial", {x: window.innerWidth / 2, y: height / 2, width: 1, height: 1}, "intital", 0)];
        this.stopIteration = [];
        this.history = [];
    }

    add(id, bbox, type, time, text = [], marginalText = [], textBbox = {}, marginalTextBbox = {}, lineBbox = {}, page = 0, endTime = 0) {
        // console.clear();
        this.strokes.push(new Stroke(id, bbox, type, time, text, marginalText, textBbox, marginalTextBbox, lineBbox, page, endTime));
        return this.update();
    }

    update() {
        let clusters = this.strokes.map(point => new Cluster([point]));
        let d = [0];
        let history = [[...clusters]];
        let stopIteration = [];

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
        }
        let maxRatio = -Infinity;

        if (history.length < 3) {
            stopIteration.push(history.length - 1);
            this.history = history;
            this.stopIteration = stopIteration;
            return [history, stopIteration];
        } else {
            for (let i = 1; i < d.length - 1; i++) {
                let ratio = (d[i + 1] - d[i]) * (d[i + 1] - d[i]) / (d[i] - d[i - 1]);
                
                if (ratio > maxRatio) {
                    maxRatio = ratio;
                    stopIteration.push(i);
                }
            }
        }
        // console.log(history);
        // console.log(history[stopIteration[stopIteration.length - 1]]);
        this.history = history;
        this.stopIteration = stopIteration;
        return [history, stopIteration];
    }

    remove(id) {
        this.strokes = this.strokes.filter(stroke => stroke.id !== id);
        this.history.map(clusters => clusters = clusters.filter(cluster => cluster.strokes = cluster.strokes.filter(stroke => stroke.id !== id)));
    }

    removeCluster(cluster) {
        for (let stroke of cluster.strokes) {
            if (stroke.id !== "initial")
                this.remove(stroke.id);
        }
        this.update();
        this.history = this.history.filter(clusters => clusters.length > 0);
        
        console.log(this.history);
    }
}