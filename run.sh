#!/bin/bash
for i in `ls data/*`; do
    echo running $i since `date`
    node uloha1.js $i > out2/`basename ${i}`.solution
done
