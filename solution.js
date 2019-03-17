const Pieces = require("./pieces.js");
const Challenge = require("./challenges.js");


module.exports = (() =>  {

    var self = this;

    self.pack = function(obj, x, y) {

    };

    this.putIf = function(field, shape, x, y, value) {
        if (y + shape.length > field.length || x + shape[0].length > field[0].length) {
            // console.log(y + "," + x);
            // console.log(shape);
            return false;
        }
        // console.log(shape);
        for (let i in shape) {
            for (let j in shape[i]) {
                // console.log(j + "," + i + " " + (x+parseInt(j)) + "," + (y+parseInt(i)));
                if (shape[i][j] != 0 && field[y+parseInt(i)][x+parseInt(j)] >= 0) {
                    return false;
                }
            }
        }

        for (let i in shape)
            for (let j in shape[i])
                if (shape[i][j] != 0)
                    field[y+parseInt(i)][x+parseInt(j)] = value;

        return false;
    };

    this.createField = function(width, height) {
        return new Array(height).fill(0).map(x => new Array(width).fill(-1));
    };

    return self;

})();