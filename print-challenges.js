const Pieces = require("./pieces");
const Challenges = require("./challenges");
const Solution = require("./solution");
const Print = require("./print");

const field = Solution.createField(23, Challenges.length * 6 - 1);

Challenges.forEach((challenge, i) => {
    challenge.forEach((challengePiece) => {
        if (!challengePiece.isSolution) {
            Solution.putIf(field, Pieces[challengePiece.id].shapes[challengePiece.orientation],
                challengePiece.x, i * 5 + challengePiece.y, challengePiece.id);
        }
        Solution.putIf(field, Pieces[challengePiece.id].shapes[challengePiece.orientation],
            challengePiece.x + 12, i * 5 + challengePiece.y, challengePiece.id);
    });
});

// for (let i in challenge.solution)
//     Solution.putIf(field, Solution.getPieceByColor(i).shapes[challenge.puzzle[i][2]], challenge.puzzle[i][0], challenge.puzzle[i][1], 1);

Print.drawField(field);
