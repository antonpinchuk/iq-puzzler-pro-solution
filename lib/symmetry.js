// Board symmetries for an 11x5 rectangle (11 != 5, so only reflections/180 deg
// rotation are valid, not 90/270 which would need a square board).

function mirrorPlacementsH(placements, boardWidth, pieceLookup) {
    return placements.map((p) => {
        const piece = pieceLookup(p.id);
        const shape = piece.shapes[p.orientationIndex];
        const shapeWidth = shape[0].length;
        return {
            id: p.id,
            x: boardWidth - p.x - shapeWidth,
            y: p.y,
            orientationIndex: piece.hFlipMap[p.orientationIndex],
        };
    });
}

function mirrorPlacementsV(placements, boardHeight, pieceLookup) {
    return placements.map((p) => {
        const piece = pieceLookup(p.id);
        const shape = piece.shapes[p.orientationIndex];
        const shapeHeight = shape.length;
        return {
            id: p.id,
            x: p.x,
            y: boardHeight - p.y - shapeHeight,
            orientationIndex: piece.vFlipMap[p.orientationIndex],
        };
    });
}

function mirrorPlacements180(placements, boardWidth, boardHeight, pieceLookup) {
    return mirrorPlacementsV(mirrorPlacementsH(placements, boardWidth, pieceLookup), boardHeight, pieceLookup);
}

function canonicalKey(placements) {
    return placements
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((p) => `${p.id}:${p.x}:${p.y}:${p.orientationIndex}`)
        .join("|");
}

// All distinct symmetric variants of a solution (original + up to 3 mirrors),
// deduped by canonicalKey (self-symmetric solutions collapse naturally).
function generateVariants(placements, boardWidth, boardHeight, pieceLookup) {
    const h = mirrorPlacementsH(placements, boardWidth, pieceLookup);
    const v = mirrorPlacementsV(placements, boardHeight, pieceLookup);
    const r180 = mirrorPlacements180(placements, boardWidth, boardHeight, pieceLookup);

    const seen = new Map();
    for (const variant of [placements, h, v, r180]) {
        const key = canonicalKey(variant);
        if (!seen.has(key)) seen.set(key, variant);
    }
    return Array.from(seen.values());
}

module.exports = {
    mirrorPlacementsH,
    mirrorPlacementsV,
    mirrorPlacements180,
    canonicalKey,
    generateVariants,
};
