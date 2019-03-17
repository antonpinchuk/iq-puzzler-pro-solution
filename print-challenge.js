const Pieces = require("./pieces");
const Challenges = require("./challenges");
const Solution = require("./solution");
const Print = require("./print");

const field = Solution.createField(11, 5);

const challenge = Challenges[0];

challenge.forEach((challenge) => {
    Solution.putIf(field, Pieces[challenge.id].shapes[challenge.orientation],
        challenge.x, challenge.y, challenge.id);
});

// for (let i in challenge.solution)
//     Solution.putIf(field, Solution.getPieceByColor(i).shapes[challenge.puzzle[i][2]], challenge.puzzle[i][0], challenge.puzzle[i][1], 1);

Print.drawField(field);
