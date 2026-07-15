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

// Builds a random, contiguous, top-left-corner-anchored subset of `pieceCount`
// placements from a full solution — the starting "island" for `play`.
// A full tiling's piece-adjacency graph is always connected (the union of all
// pieces covers the whole connected rectangle), so any pieceCount in [0,12]
// is always reachable by random walk from the corner piece.
function buildChallenge(solutionPlacements, pieceCount, pieceLookup) {
    if (pieceCount <= 0) return [];

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
    const island = new Set([corner.id]);
    const frontier = new Set(adjacency.get(corner.id));

    while (island.size < Math.min(pieceCount, 12) && frontier.size > 0) {
        const options = Array.from(frontier);
        const next = options[Math.floor(Math.random() * options.length)];
        frontier.delete(next);
        island.add(next);
        for (const neighbor of adjacency.get(next)) {
            if (!island.has(neighbor)) frontier.add(neighbor);
        }
    }

    return Array.from(island).map((id) => byId.get(id));
}

module.exports = {
    buildChallenge,
    occupiedCells,
};
