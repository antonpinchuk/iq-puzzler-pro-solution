const Pieces = require("./pieces");
const Challenges = require("./challenges.json");

var challenges = [];

// Load challenges from JSON file
Challenges.forEach((challengeData, i) => {
    var challenge = [];
    var loadChallengePiece = function(pieceData, isSolution) {
        return {
            id: Pieces.getPieceByColor(pieceData[0]).id,
            x: pieceData[1],
            y: pieceData[2],
            orientation: pieceData[3],
            isSolution: isSolution
        };
    };
    challengeData.puzzle.forEach((pieceData) => {
        challenge.push(loadChallengePiece(pieceData, false));
    });
    challengeData.solution.forEach((pieceData) => {
        challenge.push(loadChallengePiece(pieceData, true));
    });
    challenges.push(challenge);
});

module.exports = challenges;
