const Display = require("./console-display.js");
const Pieces = require("../lib/pieces.js");

const pieceLookup = (id) => Pieces.find((p) => p.id === id);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Events that represent a candidate placement decision (as opposed to a
// state that's already committed to the real field) get a preview overlay:
// the candidate's shape is stamped onto a cloned field with a sentinel value
// so it renders in a distinct "trying this" color, without touching the
// solver's actual field. Out-of-bounds/overlapping cells are silently
// skipped in the overlay (canPlace already failed for those — the preview
// just shows where the piece would sit, collisions and all).
const PREVIEW_EVENT_TYPES = new Set(["attempt", "reject-collision", "reject-pruned"]);

function withCandidatePreview(field, event) {
    const piece = pieceLookup(event.pieceId);
    const shape = piece.shapes[event.orientationIndex];
    const preview = field.map((row) => row.slice());
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (!shape[i][j]) continue;
            const y = event.y + i;
            const x = event.x + j;
            if (y < 0 || y >= preview.length || x < 0 || x >= preview[0].length) continue;
            if (preview[y][x] === -1) preview[y][x] = Display.PREVIEW_CELL_VALUE;
        }
    }
    return preview;
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

        const fieldToRender = PREVIEW_EVENT_TYPES.has(event.type)
            ? withCandidatePreview(event.field, event)
            : event.field;
        renderer.render(fieldToRender);

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
