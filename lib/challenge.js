const Board = require("./board");

function occupiedCells(placement, pieceLookup) {
    const piece = pieceLookup(placement.id);
    const shape = piece.shapes[placement.orientationIndex];
    const cells = [];
    for (let i = 0; i < shape.length; i++)
        for (let j = 0; j < shape[i].length; j++)
            if (shape[i][j])
                cells.push({ x: placement.x + j, y: placement.y + i });
    return cells;
}

function areAdjacent(cellsA, cellsB) {
    const setB = new Set(cellsB.map(({ x, y }) => `${x},${y}`));
    for (const { x, y } of cellsA) {
        if (setB.has(`${x + 1},${y}`)) return true;
        if (setB.has(`${x - 1},${y}`)) return true;
        if (setB.has(`${x},${y + 1}`)) return true;
        if (setB.has(`${x},${y - 1}`)) return true;
    }
    return false;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Builds a random, contiguous, top-left-corner-anchored subset of `pieceCount`
// placements from a full solution — the starting "island" for `play`.
//
// Growing the island purely by piece-adjacency (any two pieces touching)
// isn't enough on its own: it's possible for the *empty* cells left behind to
// split into two or more disconnected pockets even though the placed pieces
// themselves form one connected blob (e.g. a piece that wraps around and
// seals off a pocket elsewhere on the board). Since the point of the island
// is "one contiguous sea of empty water for the solver to fill", each
// candidate addition is validated against the actual empty-region count on a
// real field, not just the piece-adjacency graph.
function buildChallenge(solutionPlacements, pieceCount, pieceLookup) {
    if (pieceCount <= 0) return [];

    const targetCount = Math.min(pieceCount, 12);

    const cellsByPlacement = new Map();
    for (const p of solutionPlacements) {
        cellsByPlacement.set(p.id, occupiedCells(p, pieceLookup));
    }

    const adjacency = new Map();
    for (const p of solutionPlacements) adjacency.set(p.id, new Set());
    for (let i = 0; i < solutionPlacements.length; i++) {
        for (let j = i + 1; j < solutionPlacements.length; j++) {
            const a = solutionPlacements[i];
            const b = solutionPlacements[j];
            if (areAdjacent(cellsByPlacement.get(a.id), cellsByPlacement.get(b.id))) {
                adjacency.get(a.id).add(b.id);
                adjacency.get(b.id).add(a.id);
            }
        }
    }

    const corner = solutionPlacements.find((p) =>
        cellsByPlacement.get(p.id).some((c) => c.x === 0 && c.y === 0)
    );

    const byId = new Map(solutionPlacements.map((p) => [p.id, p]));

    function placeAllOn(field, ids) {
        for (const id of ids) {
            const placement = byId.get(id);
            const piece = pieceLookup(placement.id);
            Board.place(field, piece.shapes[placement.orientationIndex], placement.x, placement.y, placement.id);
        }
    }

    function keepsEmptySpaceContiguous(candidateIds) {
        const field = Board.createField(Board.BOARD_WIDTH, Board.BOARD_HEIGHT);
        placeAllOn(field, candidateIds);
        const regions = Board.findAllEmptyRegions(field);
        return regions.length <= 1;
    }

    // Randomized DFS with backtracking: grow the island by adding a random
    // frontier candidate; if it would split the remaining empty space, try a
    // different candidate; if none of the current frontier works, backtrack
    // to the previous island state and try a different earlier choice. This
    // always terminates since the full solution itself (island = all 12
    // pieces, empty space = none) is a valid end state reachable by
    // construction (it's the source data, already fully connected).
    function grow(island, frontier) {
        if (island.length >= targetCount) return island;

        const candidates = shuffle(Array.from(frontier));
        for (const candidateId of candidates) {
            const nextIsland = island.concat(candidateId);
            if (!keepsEmptySpaceContiguous(nextIsland)) continue;

            const nextFrontier = new Set(frontier);
            nextFrontier.delete(candidateId);
            for (const neighbor of adjacency.get(candidateId)) {
                if (!nextIsland.includes(neighbor)) nextFrontier.add(neighbor);
            }

            const result = grow(nextIsland, nextFrontier);
            if (result) return result;
        }

        return null;
    }

    const initialFrontier = new Set(adjacency.get(corner.id));
    const island = grow([corner.id], initialFrontier);

    if (!island) {
        throw new Error(`Could not build a contiguous ${targetCount}-piece island from this solution.`);
    }

    return island.map((id) => byId.get(id));
}

module.exports = {
    buildChallenge,
    occupiedCells,
};
