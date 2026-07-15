const path = require("path");
const { parseArgs } = require("node:util");
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
const OUTPUT_PATH = path.join(__dirname, "..", "build", "solutions.jsonl");
const MIN_FLUSH_INTERVAL_MS = 1000;
const MAX_FLUSH_INTERVAL_MS = 60000;

const pieceLookup = (id) => Pieces.find((p) => p.id === id);

function parseCliArgs() {
    const { values } = parseArgs({
        options: {
            silent: { type: "boolean", default: false },
        },
    });
    return { silent: values.silent };
}

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
    const { silent } = parseCliArgs();
    const startedAt = Date.now();
    const rootCandidates = computeRootCandidates();

    console.log(`Board ${Board.BOARD_WIDTH}x${Board.BOARD_HEIGHT}, ${Pieces.length} pieces.`);
    console.log(`Root candidates after mirror-dedup: ${rootCandidates.length} (searching with ${WORKER_COUNT} worker threads)`);
    console.log(`Solutions saved to: ${OUTPUT_PATH}`);
    if (silent) {
        console.log("--silent: board canvases suppressed. View a range later with:");
        console.log(`  node bin/view-solutions.js ${OUTPUT_PATH} <start> [count]`);
    }
    console.log("");

    const chunks = partitionRoundRobin(rootCandidates, WORKER_COUNT);

    const progress = ProgressLine.createProgressLine();
    const workerStats = chunks.map(() => ({
        nodesVisited: 0, placementsTried: 0, rejectedByCollision: 0,
        rejectedByFloodFill: 0, backtracks: 0, maxDepth: 0, solutionsFound: 0,
    }));
    const doneFlags = chunks.map(() => false);

    // Only canonical keys are kept for dedup (not full placement data) — at
    // millions of solutions this is the dominant memory cost, and a key
    // string is far smaller than the 12-placement array it dedups against.
    const seenKeys = new Set();
    let preMirrorSolutionCount = 0;
    let savedSolutionCount = 0;
    const appender = SolutionsStore.createJsonlAppender(OUTPUT_PATH);
    const pendingSolutions = [];

    // Flush interval doubles after each flush (1s, 2s, 4s, ... capped at 60s):
    // frequent early flushes so an early interrupt doesn't lose much, rare
    // late flushes once the run is clearly going to be long so flushing
    // itself doesn't become per-node overhead.
    let flushIntervalMs = MIN_FLUSH_INTERVAL_MS;
    let lastFlushAt = Date.now();

    function flushPending(force) {
        const now = Date.now();
        if (!force && now - lastFlushAt < flushIntervalMs) return;
        if (pendingSolutions.length > 0) {
            appender.appendMany(pendingSolutions);
            pendingSolutions.length = 0;
        }
        lastFlushAt = now;
        flushIntervalMs = Math.min(flushIntervalMs * 2, MAX_FLUSH_INTERVAL_MS);
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
            `nodes=${agg.nodesVisited} solutions=${preMirrorSolutionCount} saved=${savedSolutionCount} elapsed=${formatDuration(elapsedMs)} speed=${nodesPerSec} nodes/s`
        );
    }

    function handleSolution(placements) {
        preMirrorSolutionCount++;
        const variants = Symmetry.generateVariants(placements, Board.BOARD_WIDTH, Board.BOARD_HEIGHT, pieceLookup);

        const newVariants = [];
        for (const variant of variants) {
            const key = Symmetry.canonicalKey(variant);
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                newVariants.push(variant);
            }
        }

        if (newVariants.length > 0) {
            pendingSolutions.push(...newVariants);
            savedSolutionCount += newVariants.length;

            if (!silent) {
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
        }
        flushPending(false);
        renderProgress();
    }

    const workers = [];

    function reportInterrupted() {
        progress.newlineAfter();
        flushPending(true);
        appender.close();
        const agg = aggregatedStats();
        console.log("\nInterrupted. Partial results saved so far:");
        console.log(`Total nodes visited:         ${agg.nodesVisited}`);
        console.log(`Solutions found (pre-mirror): ${preMirrorSolutionCount}`);
        console.log(`Solutions saved (post-mirror): ${savedSolutionCount}`);
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

    flushPending(true);
    appender.close();

    const agg = aggregatedStats();
    const elapsedMs = Date.now() - startedAt;

    console.log("\nSearch complete.");
    console.log(`Total nodes visited:         ${agg.nodesVisited}`);
    console.log(`Solutions found (pre-mirror): ${preMirrorSolutionCount}`);
    console.log(`Solutions saved (post-mirror): ${savedSolutionCount}`);
    console.log(`Elapsed wall time:            ${formatDuration(elapsedMs)}`);
    console.log(`Written to:                   ${OUTPUT_PATH}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
