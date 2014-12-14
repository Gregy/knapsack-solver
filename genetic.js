"use strict";
var crypto = require('crypto');
var fs = require('fs');

var config;
try {
  config = require('./config.js');
} catch(e) {
  config = require('./config.default.js');
}

var population = [];
var thingList = [];
var maxWeight = 0;
var priceSum = 0;
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}
function isSolution(genome) {
  var sumweight = 0;
  for(var i=0;i<genome.length;i++) {
    sumweight+=genome[i]?thingList[i].weight:0;
  }
  return (sumweight <= maxWeight);
}

function getFitness(genome) {
  var genomeFitness= 0;
  if(isSolution(genome)) {
    for(var i=0;i<genome.length;i++) {
      genomeFitness+=genome[i]?thingList[i].price:0;
    }
  }
  else {
    for(var i=0;i<genome.length;i++) {
      genomeFitness-=(genome[i]?1:0);
    }
  }
  return genomeFitness;
}

function generateRandomPopulation(populationSize, specimenSize) {
  for(var i=0;i<populationSize;i++) {
    var buf = crypto.randomBytes(Math.ceil(specimenSize/8));
    var specimen = [];
    for(var variable = 0; variable<specimenSize; variable++) {
      var b = buf[Math.floor(variable/8)];
      specimen.push(!!(b & (1<<(variable%8))));
    }
    population.push({genome: specimen, fitness: getFitness(specimen)});
  }
}
function genomeToString(genome) {
  return genome.reduce(function(sum, thing) {
    return sum+(thing?'1':'0');
  },'');
}
function genomeToInt(genome) {
  return genome.reduce(function(sum, thing) {
    sum = sum<<1;
    return thing?sum|1:sum;
  },0);
}
function newGeneration(populationSize) {
  population.sort(function(a,b){ return b.fitness - a.fitness});
  var newGen = [];
  var unique = {};

  for(var i=0; newGen.length < config.bestPercentToNextGeneration*populationSize;i++) {
    var s = population.splice(0,1)[0];
    if(!(genomeToString(s.genome) in unique)) {
      newGen.push(s); 
      unique[genomeToString(s.genome)] = 1;
    }
  }

  while(newGen.length<populationSize && population.length > 0) {
    var brawl = [];
    while(brawl.length < config.brawlSize && population.length > 0) {
      var selected = getRandomInt(0,population.length);
      brawl.push(population.splice(selected,1)[0]);
    }
    brawl.sort(function(a,b){ return b.fitness - a.fitness});
    while(brawl.length > 0) {
      var s = brawl.splice(0,1)[0];
      if(!(genomeToString(s.genome) in unique)) {
        newGen.push(s); 
        unique[genomeToString(s.genome)] = 1;
      }
    }
  }
  population = newGen;
}

function mutate(specimen) {
  if(config.mutationProbability > Math.random()) {
    var flipgene = getRandomInt(0,specimen.genome.length);
    specimen.genome[flipgene] = !specimen.genome[flipgene];
    specimen.fitness = getFitness(specimen.genome);
  }
  return specimen;
}

function crossBreed(maxPopulation) {
  while(population.length < maxPopulation) {
    var father = population[getRandomInt(0,population.length)];
    var mother = population[getRandomInt(0,population.length)];
    var genomeBreakPoint = getRandomInt(0,father.genome.length);
    var son = {genome: []};
    var daughter = {genome: []};
    for(var i =0;i<father.genome.length;i++) {
      if(i < genomeBreakPoint) {
        son.genome.push(father.genome[i]);
        daughter.genome.push(mother.genome[i]);
      }
      else {
        son.genome.push(mother.genome[i]);
        daughter.genome.push(father.genome[i]);
      }
    }
    son.fitness = getFitness(son.genome);
    daughter.fitness = getFitness(daughter.genome);

    son = mutate(son);
    daughter = mutate(daughter);

    population.push(son);
    population.push(daughter);
  }
}


function writeStats(problemId, generation, label) {
  if(!label) {
    label = '';
  }
  var maxFitness = null;
  var meanFitness = null;
  var fitnesses = "";
  var specimens = "";
  for(var i=0;i<population.length;i++) {
    fitnesses+=generation+" "+population[i].fitness+"\n";
    specimens+=generation+" "+genomeToInt(population[i].genome)+"\n";
  }
  if(generation == 0) {
    fs.writeFileSync(config.statsDirectory+"/"+problemId+"."+label+"fitness", fitnesses);
    fs.writeFileSync(config.statsDirectory+"/"+problemId+"."+label+"specimen", specimens);
  }
  else {
    fs.appendFileSync(config.statsDirectory+"/"+problemId+"."+label+"fitness", fitnesses);
    fs.appendFileSync(config.statsDirectory+"/"+problemId+"."+label+"specimen", specimens);
  }
}

function getBest() {
  var best = population[0];
  for(var i=1;i<population.length;i++) {
    if(population[i].fitness > best.fitness) {
      best = population[i];
    }
  }
  return best;
}

function genSolver(problemId, maxW, thingL) {
  var maxPopulationSize = config.maxPopulationSize * Math.pow(thingL.length, 0.6);
  var minPopulationSize = config.minPopulationPercent * maxPopulationSize;
  population = [];
  maxWeight = maxW;
  thingList = thingL;
  priceSum = thingL.reduce(function(sum, thing) {
    return sum+thing.price;
  },0);

  var bestFitness = null;
  var bestFitnessSameRounds = 0;
  generateRandomPopulation(maxPopulationSize, thingL.length);
  for(var generation=0;generation<config.maxGenerations;generation++) {
    newGeneration(minPopulationSize);
    crossBreed(maxPopulationSize);
    if(config.statsDirectory) {
      writeStats(problemId, generation);
    }

    //END EARLY?
    var fit = getBest();
    if(fit.fitness > bestFitness || bestFitness == null) {
      bestFitness = fit.fitness;
      bestFitnessSameRounds = 0;
    }
    else if(fit.fitness == bestFitness) {
      bestFitnessSameRounds++;
    }
    if(bestFitnessSameRounds > config.breakOnGenerationsSame && bestFitness > 0) {
      break;
    }
  }
  var solution = getBest();
  var globalsolution = {'solution':null, 'price':null, 'weight':null};

  if(isSolution(solution.genome)) {
    globalsolution.price = thingL.reduce(function(sum, thing, i) {
      return sum+(solution.genome[i]?thing.price:0);
    },0);

    globalsolution.weight= thingL.reduce(function(sum, thing, i) {
      return sum+(solution.genome[i]?thing.weight:0);
    },0);

    globalsolution.solution = solution.genome.map(function(item) {
      return item?1:0;
    });
    
  }
  return globalsolution;
}

module.exports = genSolver;
