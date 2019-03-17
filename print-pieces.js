const Pieces = require("./pieces");
const Solution = require("./solution");
const Print = require("./print");

const field = Solution.createField(40, 60);

for (let i in Pieces) {
    for (let j in Pieces[i].shapes) {
        Solution.putIf(field, Pieces[i].shapes[j], j * 5 + 1, i * 5 + 1, Pieces[i].id);
    }
}

Print.drawField(field);
