// Standalone post-processing tool: run AFTER `npm run solutions` has produced
// a full build/solutions.json (potentially millions of entries). Selects a
// small, visually diverse subset for the repo's checked-in solutions.json,
// since committing the entire solution set is impractical.
//
// Usage: node bin/select-diverse.js [inputPath] [outputPath] [selectCount]
//   inputPath   defaults to build/solutions.json
//   outputPath  defaults to solutions.json (repo root)
//   selectCount defaults to 128
//
// Algorithm:
//   1. Randomly downsample the full set to SAMPLE_SIZE candidates (exact
//      greedy farthest-point selection is O(n^2) comparisons, impractical
//      directly against a multi-million-entry set).
//   2. Run greedy farthest-point sampling on that sample to pick SELECT_COUNT
//      solutions maximizing pairwise diversity: start from a random solution,
//      repeatedly add whichever remaining candidate has the largest minimum
//      distance to everything already selected.
//   3. Diversity metric: cell-level Hamming distance between two solutions'
//      55-cell boards (count of cells where a different piece id occupies
//      that cell). Cheap, robust, and directly reflects "how different do
//      these two layouts look on the board" (renamed here as diversity, not
//      a hard distance metric).
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

function shuffleSample(array, sampleSize) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0 && copy.length - i <= sampleSize; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(Math.max(0, copy.length - sampleSize));
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

function main() {
    const inputPath = process.argv[2] || path.join(__dirname, "..", "build", "solutions.json");
    const outputPath = process.argv[3] || path.join(__dirname, "..", "solutions.json");
    const selectCountArg = parseInt(process.argv[4], 10);
    const targetSelectCount = Number.isFinite(selectCountArg) && selectCountArg > 0 ? selectCountArg : DEFAULT_SELECT_COUNT;

    console.log(`Reading ${inputPath} ...`);
    const store = SolutionsStore.read(inputPath);
    const total = store.solutions.length;
    console.log(`Total solutions available: ${total}`);

    const sampled = total <= SAMPLE_SIZE ? store.solutions : shuffleSample(store.solutions, SAMPLE_SIZE);
    console.log(`Downsampled to ${sampled.length} candidates for diversity selection.`);

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

main();
