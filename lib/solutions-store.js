const fs = require("fs");
const path = require("path");
const board = require("./board");

function serialize(solutions) {
    return {
        board: { width: board.BOARD_WIDTH, height: board.BOARD_HEIGHT },
        pieceCount: 12,
        generatedAt: new Date().toISOString(),
        solutions,
    };
}

function write(filePath, solutions) {
    const data = serialize(solutions);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return data;
}

function read(filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if (data.board.width !== board.BOARD_WIDTH || data.board.height !== board.BOARD_HEIGHT) {
        throw new Error(
            `solutions.json board size ${data.board.width}x${data.board.height} does not match expected ${board.BOARD_WIDTH}x${board.BOARD_HEIGHT}`
        );
    }
    if (data.pieceCount !== 12) {
        throw new Error(`solutions.json pieceCount ${data.pieceCount} does not match expected 12`);
    }
    return data;
}

function exists(filePath) {
    return fs.existsSync(filePath);
}

module.exports = {
    serialize,
    write,
    read,
    exists,
};
