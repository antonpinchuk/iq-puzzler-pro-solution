const path = require("path");
const { parseArgs } = require("node:util");

const Board = require("../lib/board.js");
const Pieces = require("../lib/pieces.js");
const Solver = require("../lib/solver.js");
const Challenge = require("../lib/challenge.js");
const SolutionsStore = require("../lib/solutions-store.js");
const Display = require("../render/console-display.js");
const Animator = require("../render/animator.js");
const Format = require("../render/format.js");

const SOLUTIONS_PATH = path.join(__dirname, "..", "solutions.json");

function parseCliArgs() {
    const { values } = parseArgs({
        options: {
            speed: { type: "string", default: "200" },
            pieces: { type: "string", default: "9" },
            verbose: { type: "boolean", default: false },
        },
    });

    const speed = Math.max(0, parseInt(values.speed, 10) || 0);
    const pieces = Math.min(12, Math.max(0, parseInt(values.pieces, 10)));
    return { speed, pieces, verbose: values.verbose };
}

function waitForSpace() {
    const stdin = process.stdin;
    if (typeof stdin.setRawMode !== "function") {
        console.error("This tool needs an interactive terminal (stdin is not a TTY).");
        process.exit(1);
    }

    return new Promise((resolve) => {
        const wasRaw = stdin.isRaw;
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding("utf8");

        function onData(key) {
            if (key === "" || key === "q") {
                cleanup();
                process.exit(0);
            }
            if (key === " ") {
                cleanup();
                resolve();
            }
        }

        function cleanup() {
            stdin.removeListener("data", onData);
            stdin.setRawMode(wasRaw);
            stdin.pause();
        }

        stdin.on("data", onData);
    });
}

const pieceLookup = (id) => Pieces.find((p) => p.id === id);

function buildFieldFromPlacements(placements) {
    const field = Board.createField(Board.BOARD_WIDTH, Board.BOARD_HEIGHT);
    for (const p of placements) {
        const piece = pieceLookup(p.id);
        Board.place(field, piece.shapes[p.orientationIndex], p.x, p.y, p.id);
    }
    return field;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function mergeStatsInto(target, source) {
    target.nodesVisited += source.nodesVisited;
    target.placementsTried += source.placementsTried;
    target.rejectedByCollision += source.rejectedByCollision;
    target.rejectedByFloodFill += source.rejectedByFloodFill;
    target.backtracks += source.backtracks;
    target.maxDepth = Math.max(target.maxDepth, source.maxDepth);
    target.solutionsFound += source.solutionsFound;
    target.elapsedMs += source.elapsedMs;
}

// Solves an empty board by trying each possible top-left-corner seed piece in
// random order until one leads to a solution. Every corner candidate is known
// (from the exhaustive `solutions` search) to be part of at least one full
// tiling, so this is guaranteed to terminate — unlike solving directly from
// an empty board with a single random pass, which has no such guarantee.
async function solveFromEmptyBoard({ pieces, order, drawInitial, onStep }) {
    const cornerCandidates = shuffle(Solver.computeCornerCandidates(pieces, Board.BOARD_WIDTH, Board.BOARD_HEIGHT));

    const totalStats = {
        nodesVisited: 0, placementsTried: 0, rejectedByCollision: 0,
        rejectedByFloodFill: 0, backtracks: 0, maxDepth: 0, solutionsFound: 0, elapsedMs: 0,
    };

    for (const seed of cornerCandidates) {
        const field = Board.createField(Board.BOARD_WIDTH, Board.BOARD_HEIGHT);
        const seedPiece = pieceLookup(seed.id);
        const seedShape = seedPiece.shapes[seed.orientationIndex];
        Board.place(field, seedShape, seed.x, seed.y, seed.id);

        drawInitial(field, `Trying seed piece=${seed.id} orient=${seed.orientationIndex}...`);

        const remainingPieces = pieces.filter((p) => p.id !== seed.id);
        const result = await Solver.solve({ field, pieces: remainingPieces, order, stopAfterFirst: true, onStep });
        mergeStatsInto(totalStats, result.stats);

        if (result.solutions.length > 0) {
            return { field, stats: totalStats };
        }
    }

    throw new Error("No seed piece led to a solution — this should be unreachable given a complete solutions.json.");
}

async function main() {
    const { speed, pieces: pieceCount, verbose } = parseCliArgs();

    if (!SolutionsStore.exists(SOLUTIONS_PATH)) {
        console.error(`No solutions.json found at ${SOLUTIONS_PATH}.`);
        console.error("Run `npm run solutions` first, then copy build/solutions.json to the repo root.");
        process.exit(1);
    }

    const store = SolutionsStore.read(SOLUTIONS_PATH);
    const solution = store.solutions[Math.floor(Math.random() * store.solutions.length)];

    const challenge = Challenge.buildChallenge(solution, pieceCount, pieceLookup);
    const challengeIds = new Set(challenge.map((p) => p.id));
    const remainingPieces = Pieces.filter((p) => !challengeIds.has(p.id));

    const initialField = buildFieldFromPlacements(challenge);

    Display.clearScreen();
    Display.drawField(initialField);
    console.log(`\nChallenge: ${challenge.length} piece(s) placed, ${remainingPieces.length} remaining.`);
    console.log("Press SPACE to start solving (q or Ctrl+C to quit)...");

    await waitForSpace();

    const startedAt = Date.now();

    Display.clearScreen();
    const { onStep, drawInitial } = Animator.makeStepHandler({
        speed,
        startedAt,
        boardHeight: Board.BOARD_HEIGHT,
        verbose,
    });

    let stats;

    if (challenge.length === 0) {
        // No pre-placed island to anchor the search — retry across every
        // possible top-left-corner seed piece until one completes (see
        // solveFromEmptyBoard for why this always terminates).
        const outcome = await solveFromEmptyBoard({ pieces: remainingPieces, order: "random", drawInitial, onStep });
        stats = outcome.stats;
    } else {
        const solveField = Board.cloneField(initialField);
        drawInitial(solveField);
        const result = await Solver.solve({
            field: solveField,
            pieces: remainingPieces,
            order: "random",
            stopAfterFirst: true,
            onStep,
        });
        stats = result.stats;
    }

    Display.moveCursor(Board.BOARD_HEIGHT + 3, 1);
    Display.showCursor();
    console.log("Solved!\n");
    console.log(Format.formatSolveStats(stats));

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
