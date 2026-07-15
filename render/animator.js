const Display = require("./console-display.js");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const EVENT_LABELS = {
    attempt: "trying",
    "reject-collision": "rejected (collision)",
    "reject-pruned": "rejected (would seal off a region)",
    place: "placed",
    backtrack: "backtrack",
    solution: "solved!",
};

// Events visualized by default: every successful placement/undo at any
// recursion depth ("stacked 11, 12th didn't fit, backtracked one level,
// tried a different piece"). Candidate-orientation churn inside a single
// placement decision (attempt/reject-collision/reject-pruned) is internal
// bookkeeping, hidden unless --verbose is set.
const DEFAULT_VISIBLE_TYPES = new Set(["place", "backtrack", "solution"]);

const STATUS_ROW_OFFSET = 1; // blank line between the board and the status line

// Redraws only the cells that changed on each visualized solver step, with a
// fixed `speed`ms cadence between frames (wall-clock pace, not "speed plus
// however long the step's own computation took").
function makeStepHandler({ speed, startedAt, boardHeight, verbose = false }) {
    const renderer = Display.createFieldRenderer({ originRow: 1, originCol: 1 });
    const statusRow = boardHeight + STATUS_ROW_OFFSET + 1;

    function drawStatus(text) {
        Display.moveCursor(statusRow, 1);
        process.stdout.write(`\x1b[K${text}`);
    }

    // Paints the starting board before any solver event has fired, so the
    // diff renderer has a baseline frame to compare the first real step against.
    // Also used to reset the baseline when starting a fresh attempt from a
    // different board state (e.g. play's seed-retry trying the next seed piece).
    function drawInitial(field, statusText = "Solving...") {
        renderer.reset();
        renderer.render(field);
        drawStatus(statusText);
    }

    async function onStep(event) {
        if (!verbose && !DEFAULT_VISIBLE_TYPES.has(event.type)) {
            return;
        }

        const frameStart = Date.now();

        renderer.render(event.field);

        const elapsedMs = Date.now() - startedAt;
        const label = EVENT_LABELS[event.type] || event.type;
        const pieceInfo = event.pieceId !== undefined
            ? `piece=${event.pieceId} orient=${event.orientationIndex} pos=(${event.x},${event.y})`
            : "";
        drawStatus(`${label} depth=${event.depth} ${pieceInfo} elapsed=${elapsedMs}ms`);

        if (speed > 0) {
            const remaining = speed - (Date.now() - frameStart);
            if (remaining > 0) await sleep(remaining);
        }
    }

    return { onStep, drawInitial };
}

module.exports = { makeStepHandler };
