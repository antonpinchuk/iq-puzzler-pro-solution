const { parentPort, workerData } = require("worker_threads");

const Board = require("../lib/board.js");
const Pieces = require("../lib/pieces.js");
const Solver = require("../lib/solver.js");

const { rootCandidates, pieceIds } = workerData;
const AllPieces = pieceIds ? Pieces.filter((p) => pieceIds.includes(p.id)) : Pieces;

const stats = {
    nodesVisited: 0,
    placementsTried: 0,
    rejectedByCollision: 0,
    rejectedByFloodFill: 0,
    backtracks: 0,
    maxDepth: 0,
    solutionsFound: 0,
};

const PROGRESS_INTERVAL_MS = 1000;
let lastProgressAt = Date.now();

// Live counters updated on every solver event (cheap, sync), so progress can be
// reported mid-search rather than only after each (potentially very large)
// root candidate's whole subtree finishes.
function makeOnStep(rootPlacement) {
    return async function onStep(event) {
        switch (event.type) {
            case "place":
                stats.nodesVisited++;
                break;
            case "attempt":
                stats.placementsTried++;
                break;
            case "reject-collision":
                stats.rejectedByCollision++;
                break;
            case "reject-pruned":
                stats.rejectedByFloodFill++;
                break;
            case "backtrack":
                stats.backtracks++;
                break;
            case "solution":
                stats.solutionsFound++;
                parentPort.postMessage({ type: "solution", placements: [rootPlacement, ...event.placements] });
                break;
        }
        if (event.depth + 1 > stats.maxDepth) stats.maxDepth = event.depth + 1;

        const now = Date.now();
        if (now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
            parentPort.postMessage({ type: "progress", stats: { ...stats } });
            lastProgressAt = now;
        }
    };
}

async function run() {
    for (const rootCandidate of rootCandidates) {
        const piece = AllPieces.find((p) => p.id === rootCandidate.id);
        const shape = piece.shapes[rootCandidate.orientationIndex];
        const field = Board.createField(Board.BOARD_WIDTH, Board.BOARD_HEIGHT);

        if (!Board.canPlace(field, shape, rootCandidate.x, rootCandidate.y)) continue;
        Board.place(field, shape, rootCandidate.x, rootCandidate.y, rootCandidate.id);

        const remainingPieces = AllPieces.filter((p) => p.id !== rootCandidate.id);
        const rootPlacement = {
            id: rootCandidate.id,
            x: rootCandidate.x,
            y: rootCandidate.y,
            orientationIndex: rootCandidate.orientationIndex,
        };
        stats.nodesVisited++; // the seeded root placement itself

        await Solver.solve({
            field,
            pieces: remainingPieces,
            order: "deterministic",
            stopAfterFirst: false,
            onStep: makeOnStep(rootPlacement),
        });
    }

    parentPort.postMessage({ type: "done", stats });
}

run();
