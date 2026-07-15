const cloneDeep = require("clone-deep");

const PiecesData = require("../pieces.json");

const pieces = [];

pieces.getPieceByColor = function (clr) {
    return this.find((p) => p.clr === clr);
};

PiecesData.forEach((piece, i) => {
    const shapes = generatePieceOrientations(piece.shape);
    pieces.push(Object.assign({}, piece, {
        id: i,
        cellCount: countCells(piece.shape),
        shapes,
        hFlipMap: buildFlipMap(shapes, matrixHFlip),
        vFlipMap: buildFlipMap(shapes, matrixVFlip),
    }));
});

module.exports = pieces;

function countCells(shape) {
    let n = 0;
    for (const row of shape) for (const cell of row) if (cell) n++;
    return n;
}

function generatePieceOrientations(shape) {
    let shapes = [shape];
    const hFlip = matrixHFlip(shape);
    if (!matrixIsEqual(shape, hFlip)) {
        shapes.push(hFlip);
    }
    const vFlip = matrixVFlip(shape);
    if (!matrixIsEqual(shape, vFlip) && !matrixIsEqual(hFlip, vFlip)) {
        shapes.push(vFlip);
    }
    if (shapes.length === 3) {
        shapes.push(matrixHFlip(vFlip));
    }
    const shapesT = [];
    shapes.forEach((s) => {
        const sT = matrixTranspose(s);
        if (shapes.filter((s2) => matrixIsEqual(sT, s2)).length === 0) {
            shapesT.push(sT);
        }
    });
    shapes = shapes.concat(shapesT);
    return shapes;
}

// Builds orientationIndex -> orientationIndex map for a given mirror transform,
// used by lib/symmetry.js to remap placements without re-deriving shapes.
function buildFlipMap(shapes, flipFn) {
    return shapes.map((shape) => {
        const flipped = flipFn(shape);
        const idx = shapes.findIndex((s) => matrixIsEqual(s, flipped));
        if (idx === -1) {
            throw new Error("Flip map could not find matching orientation - orientation set is not closed under this flip");
        }
        return idx;
    });
}

function matrixVFlip(arr) {
    return cloneDeep(arr).reverse();
}

function matrixHFlip(arr) {
    return cloneDeep(arr).map((row) => row.reverse());
}

function matrixTranspose(arr) {
    const res = new Array(arr[0].length).fill(0).map(() => new Array(arr.length).fill(0));
    for (let i = 0; i < arr.length; i++)
        for (let j = 0; j < arr[i].length; j++)
            res[j][res[j].length - i - 1] = arr[i][j];
    return res;
}

function matrixIsEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (!arr2[i] || arr1[i].length !== arr2[i].length) return false;
        for (let j = 0; j < arr1[i].length; j++)
            if (arr2[i][j] !== arr1[i][j])
                return false;
    }
    return true;
}
