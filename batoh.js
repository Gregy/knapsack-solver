#!/usr/bin/node
"use strict";
var LineByLineReader = require('line-by-line');
var config = {};


try {
  config = require('./config.js');
} catch(e) {
  console.error(e.message);
  console.error("Cannot load ./config.js, trying ./config.default.js");
  config = require('./config.default.js');
}


function loadSolveProblems(file, solvers) {
  var lr = new LineByLineReader(file);
  lr.on('error', function (err) {
    console.log("Error reading the file", JSON.stringify(err));
  });
  var data = [];
  lr.on('line', function (line) {
    var linearr = line.split(" ");
    var things = [];
    for(var i=3; i<linearr.length; i+=2) {
      things.push({'weight':parseInt(linearr[i]), 'price':parseInt(linearr[i+1])});
    }
    console.log("Solving problem ID:",linearr[0]);
    data.push({id:linearr[0], thingCount: things.length, resolvers:{}});
    solvers.forEach(function(solver){
      var hrstart = process.hrtime();
      console.log('  '+solver.name+':');
      var solution = null;
      for(var i = 0; i< config.repeats; i++) {
        solution = solver(parseInt(linearr[0]), parseInt(linearr[2]), things);
        if(config.dontRepeat[solver.name]) {
          break;
        }
      }
      var hrend = process.hrtime(hrstart);
      console.log('   Solution:',linearr[0], things.length, solution.price, solution.weight, JSON.stringify(solution.solution));
      var time = (hrend[0] + hrend[1]/1000000000);
      if(!config.dontRepeat[solver.name])
        time = time / config.repeats;
      console.log('   Time:', time.toFixed(6), 's');
      data[data.length-1].resolvers[solver.name] = {time: time, price: solution.price, weight: solution.weight};
    });
    console.log(" ");
  });

  lr.on('end', function () {
    console.log("Finished");

    var times = {};
    var relativeErrors = {};

    solvers.forEach(function(solver) {
      times[solver.name] = 0;
      relativeErrors[solver.name] = {max:0, total:0};
    });
    data.forEach(function(instance) {
      for(var resolverName in instance.resolvers) {
        var resolver = instance.resolvers[resolverName];
        times[resolverName] += resolver.time;
        if(config.computeRelativeErrors) {
          var relativeError = (instance.resolvers[config.relativeErrorBase].price - resolver.price)/instance.resolvers[config.relativeErrorBase].price;
          relativeErrors[resolverName].total+=relativeError;
          if(relativeErrors[resolverName].max < relativeError) {
            relativeErrors[resolverName].max = relativeError;
          }
        }
      }
    });
    console.log("Mean runtime:");
    solvers.forEach(function(solver) {
      console.log('  ' + solver.name+":", (times[solver.name]/data.length).toFixed(6), 's');
    });
    if(config.computeRelativeErrors) {
      console.log("Mean relative error:");
      solvers.forEach(function(solver) {
        console.log('  ' + solver.name+":", (relativeErrors[solver.name].total/data.length).toFixed(5));
      });
      console.log("Max relative error:");
      solvers.forEach(function(solver) {
        console.log('  ' + solver.name+":", relativeErrors[solver.name].max.toFixed(5));
      });
    }
    console.log("\n\n");

    if(config.showRawResults)
      console.log(JSON.stringify(data));
  });
}

function bruteSolver(problemId, maxWeight, thingList) {
  var globalsolution = {'solution':null, 'price':null, 'weight':null};

  var resolve = function(solution, pricesofar, weightsofar) {
    var position = solution.length;
    if(position == thingList.length) {
      if(weightsofar <= maxWeight && (globalsolution.price === null || pricesofar > globalsolution.price)) {
        globalsolution.solution = solution.slice();
        globalsolution.price = pricesofar;
        globalsolution.weight = weightsofar;
      }
      return;
    }
    solution.push(0);
    resolve(solution, pricesofar, weightsofar);
    solution.pop();
    solution.push(1);
    resolve(solution, pricesofar+thingList[position].price, weightsofar + thingList[position].weight);
    solution.pop();
  }

  resolve([], 0, 0);
  return globalsolution;
}
function simpleHeuristicSolver(problemId, maxWeight, thingList) {
  var solution = {'solution':[], 'price':null, 'weight':null};
  thingList.sort(function(a,b) {
    return (b.price/b.weight - a.price/a.weight);
  });

  thingList.forEach(function(thing) {
    if(solution.weight + thing.weight <= maxWeight) {
      solution.solution.push(1);
      solution.price += thing.price;
      solution.weight +=thing.weight;
    }
    else {
      solution.solution.push(0);
    }
  });

  return solution;
}

function bbSolver(problemId, maxWeight, thingList) {
  var globalsolution = {'solution':null, 'price':null, 'weight':null};
  var cumulativePrices = [];
  cumulativePrices[thingList.length] = 0;
  for(var i=thingList.length-1; i>=0; i--) {
    cumulativePrices[i] = thingList[i].price + cumulativePrices[i+1];
  }

  var resolve = function(solution, pricesofar, weightsofar) {
    var position = solution.length;
    if(position == thingList.length) {
      if(globalsolution.price === null || pricesofar > globalsolution.price) {
        globalsolution.solution = solution.slice();
        globalsolution.price = pricesofar;
        globalsolution.weight = weightsofar;
      }
      return;
    }
    if(pricesofar+cumulativePrices[position+1] > globalsolution.price || globalsolution.price === null) {
      solution.push(0);
      resolve(solution, pricesofar, weightsofar);
      solution.pop();
    }
    if(weightsofar+thingList[position].weight <= maxWeight) {
      solution.push(1);
      resolve(solution, pricesofar+thingList[position].price, weightsofar + thingList[position].weight);
      solution.pop();
    }
  }

  resolve([], 0, 0);
  return globalsolution;
}


function fptasSolver(problemId, maxWeight, thingList, desiredRelErr) {
  var infMin = function(x,y) {
    if(typeof y == 'undefined' || isNaN(y)) {
      return x;
    }
    if(typeof x == 'undefined' || isNaN(x) ||  y < x) {
      return y;
    }
    return x;
  }


  var globalsolution = {'solution':null, 'price':null, 'weight':null};
  var pricemax = thingList.reduce(function(max, thing) {
    return thing.price>max?thing.price:max;
  },0);
  var junkBits = Math.floor(Math.log(desiredRelErr*pricemax/thingList.length)/Math.log(2));
  if(junkBits < 0) {
    junkBits = 0;
  }
  var pricesum = 0;
  thingList.forEach(function(thing) {
    thing.cPrice = thing.price >> junkBits;
    pricesum+= thing.cPrice;
  });

  var dynTable = new Array(pricesum+1);
  for(var i=0; i<dynTable.length; i++){
    dynTable[i] = new Array(thingList.length);
  }
  dynTable[0][-1] = 0;

  for(var thing=0;thing<thingList.length;thing++) {
    for(var price=0; price<dynTable.length; price++) {

      if(price-thingList[thing].cPrice >= 0) {
        dynTable[price][thing] = infMin(dynTable[price][thing-1], 
            dynTable[price-thingList[thing].cPrice][thing-1] + thingList[thing].weight);
      }
      else {
        dynTable[price][thing] = dynTable[price][thing-1]; 
      }
    }
  }
  for(var i = dynTable.length-1; i>=0;i--) {
    if(dynTable[i][thingList.length-1] <= maxWeight) {
      globalsolution.price = i;
      globalsolution.weight = dynTable[i][thingList.length-1];
      break;
    }
  }
  if(globalsolution.price !== null) {
    var column = thingList.length-1;
    var row = globalsolution.price;
    globalsolution.price = 0;
    globalsolution.solution = [];
    while(column >= 0) {
      if(dynTable[row][column] == dynTable[row][column-1]) {
        globalsolution.solution.push(0);
      }
      else {
        globalsolution.solution.push(1);
        row -= thingList[column].cPrice;
        globalsolution.price += thingList[column].price;
        
      }
      column--;
    }
    globalsolution.solution.reverse();
  }

  return globalsolution;
}

function dynSolver(problemId, maxWeight, thingList) {
  return fptasSolver(problemId, maxWeight, thingList, 0);
}
function fptas01Solver(problemId, maxWeight, thingList) {
  return fptasSolver(problemId, maxWeight, thingList, 0.1);
}
function fptas05Solver(problemId, maxWeight, thingList) {
  return fptasSolver(problemId, maxWeight, thingList, 0.5);
}
function fptas09Solver(problemId, maxWeight, thingList) {
  return fptasSolver(problemId, maxWeight, thingList, 0.9);
}
function fptas1Solver(problemId, maxWeight, thingList) {
  return fptasSolver(problemId, maxWeight, thingList, 1);
}



loadSolveProblems( process.argv[2], [bruteSolver]);

