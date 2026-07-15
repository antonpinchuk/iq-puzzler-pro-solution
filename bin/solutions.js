const path = require("path");
const { Worker } = require("worker_threads");

const Board = require("../lib/board.js");
const Pieces = require("../lib/pieces.js");
const Solver = require("../lib/solver.js");
const Symmetry = require("../lib/symmetry.js");
const SolutionsStore = require("../lib/solutions-store.js");
const Display = require("../render/console-display.js");
const ProgressLine = require("../render/progress-line.js");
const Format = require("../render/format.js");

const WORKER_COUNT = 4;
const OUTPUT_PATH = path.join(__dirname, "..", "build", "solutions.json");

const pieceLookup = (id) => Pieces.find((p) => p.id === id);

function computeRootCandidates() {
    const all = Solver.computeCornerCandidates(Pieces, Board.BOARD_WIDTH, Board.BOARD_HEIGHT);

    const seen = new Set();
    const reduced = [];
    for (const placement of all) {
        const key = Symmetry.canonicalKey([placement]);
        if (seen.has(key)) continue;

        const variants = Symmetry.generateVariants([placement], Board.BOARD_WIDTH, Board.BOARD_HEIGHT, pieceLookup);
        for (const variant of variants) seen.add(Symmetry.canonicalKey(variant));

        reduced.push(placement);
    }
    return reduced;
}

function partitionRoundRobin(items, n) {
    const chunks = Array.from({ length: n }, () => []);
    items.forEach((item, i) => chunks[i % n].push(item));
    return chunks;
}

function formatDuration(ms) {
    return Format.formatDuration(ms);
}

async function main() {
    const startedAt = Date.now();
    const rootCandidates = computeRootCandidates();

    console.log(`Board ${Board.BOARD_WIDTH}x${Board.BOARD_HEIGHT}, ${Pieces.length} pieces.`);
    console.log(`Root candidates after mirror-dedup: ${rootCandidates.length} (searching with ${WORKER_COUNT} worker threads)\n`);

    const chunks = partitionRoundRobin(rootCandidates, WORKER_COUNT);

    const progress = ProgressLine.createProgressLine();
    const workerStats = chunks.map(() => ({
        nodesVisited: 0, placementsTried: 0, rejectedByCollision: 0,
        rejectedByFloodFill: 0, backtracks: 0, maxDepth: 0, solutionsFound: 0,
    }));
    const doneFlags = chunks.map(() => false);

    const solutionsByKey = new Map();
    let preMirrorSolutionCount = 0;
    let lastDumpAt = Date.now();
    let dirtySinceLastDump = false;
    const DUMP_INTERVAL_MS = 30000;

    function dumpIncremental(force) {
        if (!dirtySinceLastDump) return;
        const now = Date.now();
        if (!force && now - lastDumpAt < DUMP_INTERVAL_MS) return;
        SolutionsStore.write(OUTPUT_PATH, Array.from(solutionsByKey.values()));
        lastDumpAt = now;
        dirtySinceLastDump = false;
    }

    function aggregatedStats() {
        return workerStats.reduce((acc, s) => {
            acc.nodesVisited += s.nodesVisited;
            acc.placementsTried += s.placementsTried;
            acc.rejectedByCollision += s.rejectedByCollision;
            acc.rejectedByFloodFill += s.rejectedByFloodFill;
            acc.backtracks += s.backtracks;
            acc.maxDepth = Math.max(acc.maxDepth, s.maxDepth);
            acc.solutionsFound += s.solutionsFound;
            return acc;
        }, { nodesVisited: 0, placementsTried: 0, rejectedByCollision: 0, rejectedByFloodFill: 0, backtracks: 0, maxDepth: 0, solutionsFound: 0 });
    }

    function renderProgress() {
        const agg = aggregatedStats();
        const elapsedMs = Date.now() - startedAt;
        const nodesPerSec = elapsedMs > 0 ? Math.round((agg.nodesVisited / elapsedMs) * 1000) : 0;
        progress.update(
            `nodes=${agg.nodesVisited} solutions=${preMirrorSolutionCount} elapsed=${formatDuration(elapsedMs)} speed=${nodesPerSec} nodes/s`
        );
    }

    function handleSolution(placements) {
        preMirrorSolutionCount++;
        const variants = Symmetry.generateVariants(placements, Board.BOARD_WIDTH, Board.BOARD_HEIGHT, pieceLookup);

        const newVariants = [];
        for (const variant of variants) {
            const key = Symmetry.canonicalKey(variant);
            if (!solutionsByKey.has(key)) {
                solutionsByKey.set(key, variant);
                newVariants.push(variant);
            }
        }

        if (newVariants.length > 0) {
            dirtySinceLastDump = true;
            progress.clear();
            for (const variant of newVariants) {
                const field = Board.createField(Board.BOARD_WIDTH, Board.BOARD_HEIGHT);
                for (const p of variant) {
                    const piece = pieceLookup(p.id);
                    Board.place(field, piece.shapes[p.orientationIndex], p.x, p.y, p.id);
                }
                Display.drawField(field);
                process.stdout.write("\n");
            }
        }
        dumpIncremental(false);
        renderProgress();
    }

    const workers = [];

    function reportInterrupted() {
        progress.newlineAfter();
        dirtySinceLastDump = true;
        dumpIncremental(true);
        const agg = aggregatedStats();
        console.log("\nInterrupted. Partial results saved so far:");
        console.log(`Total nodes visited:         ${agg.nodesVisited}`);
        console.log(`Solutions found (pre-mirror): ${preMirrorSolutionCount}`);
        console.log(`Solutions saved (post-mirror): ${solutionsByKey.size}`);
        console.log(`Written to:                   ${OUTPUT_PATH}`);
        for (const worker of workers) worker.terminate();
        process.exit(0);
    }
    process.on("SIGINT", reportInterrupted);
    process.on("SIGTERM", reportInterrupted);

    await new Promise((resolve, reject) => {
        chunks.forEach((chunk, index) => {
            const worker = new Worker(path.join(__dirname, "solutions-worker.js"), {
                workerData: { rootCandidates: chunk },
            });
            workers.push(worker);

            worker.on("message", (msg) => {
                if (msg.type === "solution") {
                    handleSolution(msg.placements);
                } else if (msg.type === "progress") {
                    workerStats[index] = msg.stats;
                    renderProgress();
                } else if (msg.type === "done") {
                    workerStats[index] = msg.stats;
                    doneFlags[index] = true;
                    renderProgress();
                    if (doneFlags.every(Boolean)) resolve();
                }
            });

            worker.on("error", reject);
        });
    });

    progress.newlineAfter();

    dirtySinceLastDump = true;
    dumpIncremental(true);
    const allSolutions = Array.from(solutionsByKey.values());

    const agg = aggregatedStats();
    const elapsedMs = Date.now() - startedAt;

    console.log("\nSearch complete.");
    console.log(`Total nodes visited:         ${agg.nodesVisited}`);
    console.log(`Solutions found (pre-mirror): ${preMirrorSolutionCount}`);
    console.log(`Solutions saved (post-mirror): ${allSolutions.length}`);
    console.log(`Elapsed wall time:            ${formatDuration(elapsedMs)}`);
    console.log(`Written to:                   ${OUTPUT_PATH}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
