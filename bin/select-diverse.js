// Standalone post-processing tool: run AFTER `npm run solutions` has produced
// a full build/solutions.jsonl (potentially millions of entries). Selects a
// small, visually diverse subset for the repo's checked-in solutions.json,
// since committing the entire solution set is impractical.
//
// Usage: node bin/select-diverse.js [inputPath] [outputPath] [selectCount]
//   inputPath   defaults to build/solutions.jsonl
//   outputPath  defaults to solutions.json (repo root)
//   selectCount defaults to 128
//
// Algorithm:
//   1. Reservoir-sample SAMPLE_SIZE candidates while streaming the (possibly
//      multi-million-line) .jsonl file, so only SAMPLE_SIZE solutions are
//      ever held in memory at once regardless of the input file's size.
//   2. Run greedy farthest-point sampling on that sample to pick SELECT_COUNT
//      solutions maximizing pairwise diversity: start from a random solution,
//      repeatedly add whichever remaining candidate has the largest minimum
//      distance to everything already selected (exact farthest-point over the
//      full set would mean comparing every pair — O(n^2) — impractical at
//      millions of entries, hence the sampling step first).
//   3. Diversity metric: cell-level Hamming distance between two solutions'
//      55-cell boards (count of cells where a different piece id occupies
//      that cell). Cheap, robust, and directly reflects "how different do
//      these two layouts look on the board."
const path = require("path");

const Board = require("../lib/board.js");
const Pieces = require("../lib/pieces.js");
const SolutionsStore = require("../lib/solutions-store.js");

const SAMPLE_SIZE = 10000;
const DEFAULT_SELECT_COUNT = 128;

const pieceLookup = (id) => Pieces.find((p) => p.id === id);

function placementsToField(placements) {
    const field = Board.createField(Board.BOARD_WIDTH, Board.BOARD_HEIGHT);
    for (const p of placements) {
        const piece = pieceLookup(p.id);
        Board.place(field, piece.shapes[p.orientationIndex], p.x, p.y, p.id);
    }
    return field;
}

function fieldToFlat(field) {
    const flat = new Int8Array(field.length * field[0].length);
    let i = 0;
    for (const row of field) for (const cell of row) flat[i++] = cell;
    return flat;
}

function hammingDistance(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
    return d;
}

// Classic reservoir sampling (Algorithm R): after seeing n items, the
// reservoir holds a uniformly random sample of min(n, size) of them, without
// ever needing to know the total count in advance or hold more than `size`
// items in memory at once.
function createReservoir(size) {
    const items = [];
    let seen = 0;
    return {
        offer(item) {
            seen++;
            if (items.length < size) {
                items.push(item);
            } else {
                const j = Math.floor(Math.random() * seen);
                if (j < size) items[j] = item;
            }
        },
        get items() { return items; },
        get seenCount() { return seen; },
    };
}

function greedyFarthestPoint(flats, count) {
    const n = flats.length;
    const selectedIdx = [Math.floor(Math.random() * n)];
    const minDist = new Float64Array(n).fill(Infinity);

    function updateMinDist(newIdx) {
        const newFlat = flats[newIdx];
        for (let i = 0; i < n; i++) {
            const d = hammingDistance(flats[i], newFlat);
            if (d < minDist[i]) minDist[i] = d;
        }
    }
    updateMinDist(selectedIdx[0]);

    while (selectedIdx.length < count && selectedIdx.length < n) {
        let bestIdx = -1;
        let bestDist = -1;
        for (let i = 0; i < n; i++) {
            if (minDist[i] > bestDist) {
                bestDist = minDist[i];
                bestIdx = i;
            }
        }
        selectedIdx.push(bestIdx);
        minDist[bestIdx] = -Infinity; // exclude from future consideration
        updateMinDist(bestIdx);
    }

    return selectedIdx;
}

async function main() {
    const inputPath = process.argv[2] || path.join(__dirname, "..", "build", "solutions.jsonl");
    const outputPath = process.argv[3] || path.join(__dirname, "..", "solutions.json");
    const selectCountArg = parseInt(process.argv[4], 10);
    const targetSelectCount = Number.isFinite(selectCountArg) && selectCountArg > 0 ? selectCountArg : DEFAULT_SELECT_COUNT;

    console.log(`Reading ${inputPath} ...`);
    const reservoir = createReservoir(SAMPLE_SIZE);
    await SolutionsStore.readJsonlSolutions(inputPath, (placements) => {
        reservoir.offer(placements);
    });
    console.log(`Total solutions read: ${reservoir.seenCount}`);

    const sampled = reservoir.items;
    console.log(`Reservoir-sampled ${sampled.length} candidates for diversity selection.`);

    const flats = sampled.map((placements) => fieldToFlat(placementsToField(placements)));

    const selectCount = Math.min(targetSelectCount, sampled.length);
    console.log(`Selecting ${selectCount} maximally diverse solutions (greedy farthest-point, Hamming distance)...`);
    const startedAt = Date.now();
    const selectedIdx = greedyFarthestPoint(flats, selectCount);
    console.log(`Selection done in ${Date.now() - startedAt}ms.`);

    const selected = selectedIdx.map((i) => sampled[i]);
    SolutionsStore.write(outputPath, selected);
    console.log(`Wrote ${selected.length} solutions to ${outputPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
