var clc = require("cli-color");

var Pieces = require("./pieces.json");

module.exports = (() => {

    var self = this;
    const emptyCell = { id: 0, clrCode: 7 };

    this.drawField = function(field) {
        process.stdout.write(clc.erase.screen);
        var i = 0;
        field.forEach(function (row) {
            row.forEach(function (cellPiece) {
                let cell = cellPiece >= 0 ? Pieces[cellPiece] : emptyCell;
                process.stdout.write(clc.bgXterm(cell.clrCode)(' ○ '));
                //process.stdout.write(clc.bgXterm(i++)(' '+i));
    });
            process.stdout.write('\n');
        });
    };

    return self;
})();