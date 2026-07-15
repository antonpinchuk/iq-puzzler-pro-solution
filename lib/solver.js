const board = require("./board");
const pruning = require("./pruning");

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Pieces/orientations positioned so some `1` cell of the shape lands exactly on `cell`.
function enumerateCandidates(cell, availablePieces) {
    const candidates = [];
    for (const piece of availablePieces) {
        for (let orientationIndex = 0; orientationIndex < piece.shapes.length; orientationIndex++) {
            const shape = piece.shapes[orientationIndex];
            for (let dy = 0; dy < shape.length; dy++) {
                for (let dx = 0; dx < shape[dy].length; dx++) {
                    if (!shape[dy][dx]) continue;
                    const x = cell.x - dx;
                    const y = cell.y - dy;
                    candidates.push({ id: piece.id, shape, orientationIndex, x, y });
                }
            }
        }
    }
    return candidates;
}

// Valid (pieceId, orientationIndex, x, y) placements covering the board's
// top-left corner cell (0,0) on an otherwise empty board of the given size —
// the set of possible first/seed moves. Shared by `solutions` (root-candidate
// partitioning) and `play` (seed-retry when starting from an empty board).
function computeCornerCandidates(pieces, boardWidth, boardHeight) {
    const field = board.createField(boardWidth, boardHeight);
    return enumerateCandidates({ x: 0, y: 0 }, pieces)
        .filter((c) => board.canPlace(field, c.shape, c.x, c.y))
        .map((c) => ({ id: c.id, x: c.x, y: c.y, orientationIndex: c.orientationIndex }));
}

function createStats() {
    return {
        nodesVisited: 0,
        placementsTried: 0,
        rejectedByCollision: 0,
        rejectedByFloodFill: 0,
        backtracks: 0,
        maxDepth: 0,
        solutionsFound: 0,
        elapsedMs: 0,
    };
}

async function noop() {}

// See lib/solver.md-equivalent design in the plan: shared recursive backtracking
// engine used by both `solutions` (enumerate all, deterministic order) and
// `play` (stop after first, randomized order), differing only via options.
async function solve(options) {
    const {
        field,
        pieces,
        order = "deterministic",
        stopAfterFirst = false,
        onStep = noop,
    } = options;

    const stats = createStats();
    const solutions = [];
    const placementStack = [];
    const startedAt = Date.now();

    // `field` is passed by reference, not cloned, on every event — cheap event
    // types (attempt/reject/place/backtrack) let callers that don't render
    // (e.g. the `solutions` worker, which only cares about counts) skip the
    // O(cells) copy entirely. Callers that do render (e.g. `play`'s animator)
    // clone it themselves only for the events they actually draw.
    async function recurse(availablePieces, depth) {
        const cell = board.findNextEmptyCell(field);
        if (cell === null) {
            stats.solutionsFound++;
            const placements = placementStack.slice();
            solutions.push(placements);
            await onStep({ type: "solution", field, placements, depth });
            return true;
        }

        let candidates = enumerateCandidates(cell, availablePieces);
        if (order === "random") shuffle(candidates);

        for (const candidate of candidates) {
            stats.placementsTried++;
            await onStep({
                type: "attempt",
                field,
                pieceId: candidate.id,
                x: candidate.x,
                y: candidate.y,
                orientationIndex: candidate.orientationIndex,
                depth,
            });

            if (!board.canPlace(field, candidate.shape, candidate.x, candidate.y)) {
                stats.rejectedByCollision++;
                await onStep({
                    type: "reject-collision",
                    field,
                    pieceId: candidate.id,
                    x: candidate.x,
                    y: candidate.y,
                    orientationIndex: candidate.orientationIndex,
                    depth,
                });
                continue;
            }

            board.place(field, candidate.shape, candidate.x, candidate.y, candidate.id);
            const remainingPieces = availablePieces.filter((p) => p.id !== candidate.id);

            if (!pruning.isViable(field, remainingPieces)) {
                stats.rejectedByFloodFill++;
                await onStep({
                    type: "reject-pruned",
                    field,
                    pieceId: candidate.id,
                    x: candidate.x,
                    y: candidate.y,
                    orientationIndex: candidate.orientationIndex,
                    depth,
                });
                board.remove(field, candidate.shape, candidate.x, candidate.y);
                continue;
            }

            placementStack.push({ id: candidate.id, x: candidate.x, y: candidate.y, orientationIndex: candidate.orientationIndex });
            stats.nodesVisited++;
            if (depth + 1 > stats.maxDepth) stats.maxDepth = depth + 1;
            await onStep({
                type: "place",
                field,
                pieceId: candidate.id,
                x: candidate.x,
                y: candidate.y,
                orientationIndex: candidate.orientationIndex,
                depth,
            });

            const found = await recurse(remainingPieces, depth + 1);
            if (found && stopAfterFirst) {
                return true;
            }

            placementStack.pop();
            board.remove(field, candidate.shape, candidate.x, candidate.y);
            stats.backtracks++;
            await onStep({
                type: "backtrack",
                field,
                pieceId: candidate.id,
                x: candidate.x,
                y: candidate.y,
                orientationIndex: candidate.orientationIndex,
                depth,
            });
        }

        return false;
    }

    await recurse(pieces, 0);
    stats.elapsedMs = Date.now() - startedAt;

    return { solutions, stats };
}

module.exports = {
    solve,
    enumerateCandidates,
    computeCornerCandidates,
};
