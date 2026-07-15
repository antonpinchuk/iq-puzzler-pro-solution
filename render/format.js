function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [minutes, seconds].map((n) => String(n).padStart(2, "0"));
    if (hours > 0) parts.unshift(String(hours).padStart(2, "0"));
    return parts.join(":");
}

function formatSolveStats(stats) {
    const lines = [
        `Attempts tried:        ${stats.placementsTried}`,
        `Successful placements: ${stats.nodesVisited}`,
        `Rejected (collision):  ${stats.rejectedByCollision}`,
        `Rejected (pruned):     ${stats.rejectedByFloodFill}`,
        `Backtracks:            ${stats.backtracks}`,
        `Max depth reached:     ${stats.maxDepth}`,
        `Elapsed time:          ${formatDuration(stats.elapsedMs)} (${stats.elapsedMs}ms)`,
    ];

    const deadEnds = stats.rejectedByFloodFill + stats.backtracks;
    if (deadEnds > 0) {
        const pruneEfficiency = ((stats.rejectedByFloodFill / deadEnds) * 100).toFixed(1);
        lines.push(`Prune efficiency:       ${pruneEfficiency}% of dead ends caught early by flood-fill pruning`);
    }
    if (stats.nodesVisited > 0) {
        const avgBranching = (stats.placementsTried / stats.nodesVisited).toFixed(2);
        lines.push(`Avg branching explored: ${avgBranching} candidates tried per successful placement`);
    }

    return lines.join("\n");
}

module.exports = {
    formatDuration,
    formatSolveStats,
};
