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
  maxPopulationSize: 15, //times problem size^0.9
  minPopulationPercent: 0.75, // minPopulation = maxPopulation*minPopulationPercent
  bestPercentToNextGeneration: 0.05,
  mutationProbability: 0.2,
  brawlSize: 4, //how many specimen from old generation are to fight for right to enter the next generation
  maxGenerations: 6000,
  breakOnGenerationsSame: 250,
  statsDirectory: './stats',
}
