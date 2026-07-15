const board = require("./board");

// Regions at or below this size get an expensive-ish exact shape-fit check;
// above it we rely on the cheap subset-sum check alone (kept polynomial per call).
const SMALL_REGION_THRESHOLD = 8;

// Necessary-but-not-fully-sufficient viability check: cheap enough to run on
// every tentative placement, not a second full solver. False negatives (rare)
// are caught a few levels deeper by ordinary backtracking.
function isViable(field, remainingPieces) {
    const regions = board.findAllEmptyRegions(field);

    const totalEmptyCells = regions.reduce((sum, r) => sum + r.length, 0);
    const totalRemainingCells = remainingPieces.reduce((sum, p) => sum + p.cellCount, 0);
    if (totalEmptyCells !== totalRemainingCells) {
        return false;
    }

    const cellCounts = remainingPieces.map((p) => p.cellCount);
    for (const region of regions) {
        if (region.length === 0) continue;
        if (!subsetSumReachable(region.length, cellCounts)) {
            return false;
        }
        if (region.length <= SMALL_REGION_THRESHOLD && !anyPieceFitsInRegion(region, remainingPieces)) {
            return false;
        }
    }

    return true;
}

// Can some subset of remainingPieces' cell counts sum exactly to `target`?
function subsetSumReachable(target, cellCounts) {
    const reachable = new Set([0]);
    for (const count of cellCounts) {
        for (const sum of Array.from(reachable)) {
            const next = sum + count;
            if (next === target) return true;
            if (next < target) reachable.add(next);
        }
    }
    return reachable.has(target);
}

// Can at least one remaining piece (any orientation) be placed fully inside
// this connected region, ignoring the rest of the board?
function anyPieceFitsInRegion(region, remainingPieces) {
    const cellSet = new Set(region.map(({ x, y }) => `${x},${y}`));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { x, y } of region) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    const regionWidth = maxX - minX + 1;
    const regionHeight = maxY - minY + 1;

    for (const piece of remainingPieces) {
        for (const shape of piece.shapes) {
            const shapeHeight = shape.length;
            const shapeWidth = shape[0].length;
            if (shapeWidth > regionWidth || shapeHeight > regionHeight) continue;

            for (let oy = minY; oy <= maxY - shapeHeight + 1; oy++) {
                for (let ox = minX; ox <= maxX - shapeWidth + 1; ox++) {
                    if (shapeFitsAt(shape, ox, oy, cellSet)) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function shapeFitsAt(shape, ox, oy, cellSet) {
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] && !cellSet.has(`${ox + j},${oy + i}`)) {
                return false;
            }
        }
    }
    return true;
}

module.exports = {
    isViable,
    subsetSumReachable,
    anyPieceFitsInRegion,
};
