module.exports = {
  showRawResults: false,
  computeRelativeErrors: true,
  relativeErrorBase: 'dynSolver',
  repeats: 20,
  dontRepeat: {
    bruteSolver: true,
    dynSolver: true,
    genSolver: true
  },
  /* ### GENETICS OPTIONS ### */
  maxPopulationSize: 200,
  minPopulationSize: 150,
  bestPercentToNextGeneration: 0.2,
  mutationProbability: 0.05,
  brawlSize: 10, //how many specimen from old generation are to fight for right to enter the next generation
  maxGenerations: 800,
  breakOnGenerationsSame: 200,
  statsDirectory: './stats',
}
