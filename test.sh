#!/bin/bash
set -e
for i in `ls data/*sol* | cut -d'.' -f1`; do
    echo running $i
    diff <(node uloha1.js ${i}.inst.dat | grep -A 1 bruteSolver | grep Solution | cut -d' ' -f 5- ) <(cat ${i}.sol.dat| cut -d' ' -f1-3)
done
