// Renders a range of solutions from a solutions.jsonl file (produced by
// `npm run solutions`) to the console, reusing the same board renderer as
// the rest of the tools. Streams the file line-by-line rather than loading
// it all into memory, so this works fine even on a multi-million-line file.
//
// Usage: node bin/view-solutions.js <jsonlFile> [startIndex] [count]
//   startIndex defaults to 0 (0-based), count defaults to 10
const fs = require("fs");

const Board = require("../lib/board.js");
const Pieces = require("../lib/pieces.js");
const Display = require("../render/console-display.js");
const SolutionsStore = require("../lib/solutions-store.js");

const pieceLookup = (id) => Pieces.find((p) => p.id === id);

async function main() {
    const [, , jsonlFile, startArg, countArg] = process.argv;
    if (!jsonlFile) {
        console.error("Usage: node bin/view-solutions.js <jsonlFile> [startIndex] [count]");
        process.exit(1);
    }
    if (!fs.existsSync(jsonlFile)) {
        console.error(`File not found: ${jsonlFile}`);
        process.exit(1);
    }

    const startIndex = Math.max(0, parseInt(startArg, 10) || 0);
    const count = Math.max(1, parseInt(countArg, 10) || 10);
    const endIndex = startIndex + count;

    let index = 0;
    let printed = 0;
    await SolutionsStore.readJsonlSolutions(jsonlFile, (placements) => {
        if (index >= startIndex && index < endIndex) {
            const field = Board.createField(Board.BOARD_WIDTH, Board.BOARD_HEIGHT);
            for (const p of placements) {
                const piece = pieceLookup(p.id);
                Board.place(field, piece.shapes[p.orientationIndex], p.x, p.y, p.id);
            }
            console.log(`#${index}`);
            Display.drawField(field);
            console.log("");
            printed++;
        }
        index++;
        if (index >= endIndex) return false;
    });

    if (printed === 0) {
        console.error(`No solutions found at index ${startIndex} (file may be shorter than that).`);
        process.exit(1);
    }
}

main();
