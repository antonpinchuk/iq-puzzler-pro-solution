const clc = require("cli-color");

const Pieces = require("../lib/pieces.js");

const EMPTY_CELL = { clrCode: 7 };
const CELL_TEXT = " ○ ";
const CELL_WIDTH = CELL_TEXT.length;

function cellText(field, x, y) {
    const cellPiece = field[y][x];
    const cell = cellPiece >= 0 ? Pieces[cellPiece] : EMPTY_CELL;
    return clc.bgXterm(cell.clrCode)(CELL_TEXT);
}

// Full draw: writes the whole field once, top-left of the current cursor position.
function drawField(field) {
    let out = "";
    for (let y = 0; y < field.length; y++) {
        for (let x = 0; x < field[y].length; x++) {
            out += cellText(field, x, y);
        }
        out += "\n";
    }
    process.stdout.write(out);
}

function clearScreen() {
    process.stdout.write(clc.erase.screen);
}

// Cursor-positioning helpers, 1-indexed as ANSI expects. `originRow`/`originCol`
// mark where the field's top-left cell sits on screen, so callers can reserve
// header lines above the board.
function moveCursor(row, col) {
    process.stdout.write(`\x1b[${row};${col}H`);
}

function hideCursor() {
    process.stdout.write("\x1b[?25l");
}

function showCursor() {
    process.stdout.write("\x1b[?25h");
}

// Flicker-free field renderer: draws the full board once, then on each
// subsequent update only rewrites cells that actually changed, via cursor
// positioning instead of a full clear+redraw.
function createFieldRenderer({ originRow = 1, originCol = 1 } = {}) {
    let previous = null;

    function paintCell(field, x, y) {
        moveCursor(originRow + y, originCol + x * CELL_WIDTH);
        process.stdout.write(cellText(field, x, y));
    }

    function render(field) {
        if (!previous || previous.length !== field.length || previous[0].length !== field[0].length) {
            hideCursor();
            for (let y = 0; y < field.length; y++) {
                for (let x = 0; x < field[y].length; x++) {
                    paintCell(field, x, y);
                }
            }
        } else {
            for (let y = 0; y < field.length; y++) {
                for (let x = 0; x < field[y].length; x++) {
                    if (previous[y][x] !== field[y][x]) {
                        paintCell(field, x, y);
                    }
                }
            }
        }
        previous = field.map((row) => row.slice());
    }

    function reset() {
        previous = null;
    }

    return { render, reset };
}

module.exports = {
    drawField,
    clearScreen,
    moveCursor,
    hideCursor,
    showCursor,
    createFieldRenderer,
    CELL_WIDTH,
};
