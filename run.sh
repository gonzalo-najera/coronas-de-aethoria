#!/bin/bash
# Uso: ./run.sh tests/sim.test.ts  -> empaqueta con esbuild y ejecuta en Node
out="${TMPDIR:-/tmp}/aethoria-run.mjs"
node_modules/.bin/esbuild "$1" --bundle --platform=node --format=esm --outfile="$out" --log-level=warning && node "$out"
