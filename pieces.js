const cloneDeep = require("clone-deep");

const Pieces = require("./pieces.json");

var pieces = [];

pieces.getPieceByColor = function(clr) {
    return this.find((p) => { return p.clr == clr });
};

// Load pieces from JSON file
Pieces.forEach((piece, i) => {
    pieces.push(Object.assign(piece, {
        id: i,
        shapes: generatePieceOrientations(piece.shape)
    }));
});

// Return array
module.exports = pieces;


function generatePieceOrientations(shape) {
    var shapes = [ shape ];
    let hFlip = matrixHFlip(shape);
    if (!matrixIsEqual(shape, hFlip)) {
        shapes.push(hFlip);
    }
    let vFlip = matrixVFlip(shape);
    if (!matrixIsEqual(shape, vFlip) && !matrixIsEqual(hFlip, vFlip)) {
        shapes.push(vFlip);
    }
    if (shapes.length == 3) {
        shapes.push(matrixHFlip(vFlip));
    }
    var shapesT = [];
    shapes.map((s) => {
        var sT = matrixTranspose(s);
        if (shapes.filter((s) => { return matrixIsEqual(sT, s) }).length == 0) {
            shapesT.push(sT);
        }
    });
    shapes = shapes.concat(shapesT);
    // if (shapes.length == 4) {
    //     shapes = [ shapes[0], shapes[2], shapes[1], shapes[3] ];
    // } else {
    //     shapes = [ shapes[0], shapes[4], shapes[3], shapes[7], shapes[1], shapes[5], shapes[2], shapes[6] ];
    // }
    return shapes;
}


function matrixVFlip(arr) {
    return cloneDeep(arr).reverse();
}

function matrixHFlip(arr) {
    return cloneDeep(arr).map((row) => { return row.reverse() });
    // let res = cloneDeep(arr);
    // for (let i = 0; i <= Math.floor(res.length / 2); i++) {
    //     for (let j = 0; j <= res[i].length; j++) {
    //         let tmp = res[res.length - i - 1][j];
    //         res[res.length - i - 1][j] = res[i][j];
    //         res[i][j] = tmp;
    //     }
    // }
    // return res;
}

function matrixTranspose(arr) {
    let res = new Array(arr[0].length).fill(0).map(x => new Array(arr.length).fill(0))
    for (let i in arr)
        for (let j in arr[i])
            res[j][res[j].length - i - 1] = arr[i][j];
    return res;
}

function matrixIsEqual(arr1, arr2) {
    for (let i in arr1)
        for (let j in arr1[i])
            if (!arr2[i] || arr2[i][j] != arr1[i][j])
                return false;
    return true;
}

