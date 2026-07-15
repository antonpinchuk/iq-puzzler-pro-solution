const clc = require("cli-color");

// Maintains a single self-overwriting status line at the cursor's current row.
// Callers that need to print other output (e.g. newly found solution boards)
// must call clear() first, print their block with plain stdout writes, then
// call update() again to resume the progress line underneath.
function createProgressLine() {
    let hasContent = false;

    function update(text) {
        if (hasContent) process.stdout.write(clc.erase.line + "\r");
        process.stdout.write(text);
        hasContent = true;
    }

    function clear() {
        if (hasContent) {
            process.stdout.write(clc.erase.line + "\r");
            hasContent = false;
        }
    }

    function newlineAfter() {
        if (hasContent) {
            process.stdout.write("\n");
            hasContent = false;
        }
    }

    return { update, clear, newlineAfter };
}

module.exports = { createProgressLine };
