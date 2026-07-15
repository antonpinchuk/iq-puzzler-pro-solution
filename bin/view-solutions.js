// Renders a range of solutions from a solutions file to the console, reusing
// the same board renderer as the rest of the tools. Accepts either format:
//   - .jsonl (produced by `npm run solutions`): streamed line-by-line, so
//     this works fine even on a multi-million-line file.
//   - .json (produced by `npm run select-diverse`, e.g. the repo's
//     solutions.json): small enough to load into memory directly.
//
// Usage: node bin/view-solutions.js <file> [startIndex] [count]
//   startIndex and count are both optional — omit either (or both) to print
//   everything from index 0 to the end of the file.
const fs = require("fs");
const path = require("path");

const Board = require("../lib/board.js");
const Pieces = require("../lib/pieces.js");
const Display = require("../render/console-display.js");
const SolutionsStore = require("../lib/solutions-store.js");

const pieceLookup = (id) => Pieces.find((p) => p.id === id);

function printSolution(index, placements) {
    const field = Board.createField(Board.BOARD_WIDTH, Board.BOARD_HEIGHT);
    for (const p of placements) {
        const piece = pieceLookup(p.id);
        Board.place(field, piece.shapes[p.orientationIndex], p.x, p.y, p.id);
    }
    console.log(`#${index}`);
    Display.drawField(field);
    console.log("");
}

async function main() {
    const [, , file, startArg, countArg] = process.argv;
    if (!file) {
        console.error("Usage: node bin/view-solutions.js <file> [startIndex] [count]");
        process.exit(1);
    }
    if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        process.exit(1);
    }

    const startIndex = Math.max(0, parseInt(startArg, 10) || 0);
    // No count given: print through to the end of the file (Infinity keeps
    // the "index < endIndex" checks below correct with no special-casing).
    const hasCount = countArg !== undefined && Number.isFinite(parseInt(countArg, 10));
    const count = hasCount ? Math.max(1, parseInt(countArg, 10)) : Infinity;
    const endIndex = startIndex + count;

    const isJsonl = path.extname(file).toLowerCase() === ".jsonl";
    let printed = 0;

    if (isJsonl) {
        let index = 0;
        await SolutionsStore.readJsonlSolutions(file, (placements) => {
            if (index >= startIndex && index < endIndex) {
                printSolution(index, placements);
                printed++;
            }
            index++;
            if (index >= endIndex) return false;
        });
    } else {
        const store = SolutionsStore.read(file);
        const solutions = store.solutions;
        const end = Math.min(endIndex, solutions.length);
        for (let index = startIndex; index < end; index++) {
            printSolution(index, solutions[index]);
            printed++;
        }
    }

    if (printed === 0) {
        console.error(`No solutions found at index ${startIndex} (file may be shorter than that).`);
        process.exit(1);
    }
}

main();
