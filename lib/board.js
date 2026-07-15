const BOARD_WIDTH = 11;
const BOARD_HEIGHT = 5;

function createField(width, height) {
    return new Array(height).fill(0).map(() => new Array(width).fill(-1));
}

function cloneField(field) {
    return field.map((row) => row.slice());
}

function canPlace(field, shape, x, y) {
    const height = field.length;
    const width = field[0].length;
    if (y < 0 || x < 0 || y + shape.length > height || x + shape[0].length > width) {
        return false;
    }
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] && field[y + i][x + j] >= 0) {
                return false;
            }
        }
    }
    return true;
}

function place(field, shape, x, y, pieceId) {
    for (let i = 0; i < shape.length; i++)
        for (let j = 0; j < shape[i].length; j++)
            if (shape[i][j])
                field[y + i][x + j] = pieceId;
}

function remove(field, shape, x, y) {
    for (let i = 0; i < shape.length; i++)
        for (let j = 0; j < shape[i].length; j++)
            if (shape[i][j])
                field[y + i][x + j] = -1;
}

// Strict row-major scan: topmost row first, then leftmost column within that row.
function findNextEmptyCell(field) {
    for (let y = 0; y < field.length; y++)
        for (let x = 0; x < field[y].length; x++)
            if (field[y][x] === -1)
                return { x, y };
    return null;
}

function floodFillRegion(field, startX, startY, visited) {
    const height = field.length;
    const width = field[0].length;
    const region = [];
    const stack = [{ x: startX, y: startY }];
    visited[startY][startX] = true;
    while (stack.length) {
        const { x, y } = stack.pop();
        region.push({ x, y });
        const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of neighbors) {
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (visited[ny][nx]) continue;
            if (field[ny][nx] !== -1) continue;
            visited[ny][nx] = true;
            stack.push({ x: nx, y: ny });
        }
    }
    return region;
}

function findAllEmptyRegions(field) {
    const height = field.length;
    const width = field[0].length;
    const visited = new Array(height).fill(0).map(() => new Array(width).fill(false));
    const regions = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (field[y][x] === -1 && !visited[y][x]) {
                regions.push(floodFillRegion(field, x, y, visited));
            }
        }
    }
    return regions;
}

module.exports = {
    BOARD_WIDTH,
    BOARD_HEIGHT,
    createField,
    cloneField,
    canPlace,
    place,
    remove,
    findNextEmptyCell,
    floodFillRegion,
    findAllEmptyRegions,
};
