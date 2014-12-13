png("mygraph.png")

file='/home/gregy/annex/Data/CVUT/PAA/stats/9320.fitness'

data = read.table(file)
plot(data, cex=0.1)
