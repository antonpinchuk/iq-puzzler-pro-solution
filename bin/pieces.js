const Board = require("../lib/board.js");
const Pieces = require("../lib/pieces.js");
const Display = require("../render/console-display.js");

const field = Board.createField(40, 60);

Pieces.forEach((piece) => {
    piece.shapes.forEach((shape, orientationIndex) => {
        const x = orientationIndex * 5 + 1;
        const y = piece.id * 5 + 1;
        if (Board.canPlace(field, shape, x, y)) {
            Board.place(field, shape, x, y, piece.id);
        }
    });
});

Display.clearScreen();
Display.drawField(field);
