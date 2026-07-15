const fs = require("fs");
const readline = require("readline");
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

// JSON Lines format for the (potentially huge) exhaustive search output: one
// placement-array per line. Appending never requires re-reading or
// re-serializing everything already written, and a truncated last line (from
// a hard kill mid-write) only loses that one solution, not the whole file.
function createJsonlAppender(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const fd = fs.openSync(filePath, "a");

    function appendMany(solutions) {
        if (solutions.length === 0) return;
        const chunk = solutions.map((s) => JSON.stringify(s)).join("\n") + "\n";
        fs.writeSync(fd, chunk);
    }

    function close() {
        fs.closeSync(fd);
    }

    return { appendMany, close };
}

// Streams a .jsonl file line-by-line via a callback, so callers never need
// to load a multi-million-entry file into memory at once. Skips a trailing
// partial line (possible if the writer was killed mid-write) instead of
// throwing. Returning `false` from onSolution stops reading early (e.g. once
// a viewer has collected the range it needs). Returns the number of
// solutions actually passed to onSolution.
async function readJsonlSolutions(filePath, onSolution) {
    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let count = 0;
    for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let solution;
        try {
            solution = JSON.parse(trimmed);
        } catch {
            break;
        }
        count++;
        if (onSolution(solution) === false) {
            rl.close();
            stream.destroy();
            break;
        }
    }
    return count;
}

module.exports = {
    serialize,
    write,
    read,
    exists,
    createJsonlAppender,
    readJsonlSolutions,
};
