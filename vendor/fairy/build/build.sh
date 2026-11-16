#!/bin/bash
# Rebuilds vendor/fairy/fairy-stockfish.wasm: Fairy-Stockfish, single-threaded, wasm32-wasi.
# Needs Python 3 with pip. Uses the Zig toolchain from PyPI (clang + wasi-libc + libc++) and the
# Fairy-Stockfish sources from the pyffish 0.0.91 source package. Run from anywhere.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${WORK:-/tmp/fairy-wasm-build}"
rm -rf "$WORK"; mkdir -p "$WORK/obj"; cd "$WORK"
pip download pyffish==0.0.91 --no-deps --no-binary :all: -d .
python3 -m pip show ziglang >/dev/null 2>&1 || pip install ziglang==0.17.1
tar xzf pyffish-0.0.91.tar.gz
cd pyffish-0.0.91
patch -p1 < "$HERE/no-threads.patch"
cp "$HERE/wasm_main.cpp" src/
cd src
FLAGS="-target wasm32-wasi -std=c++17 -O3 -fno-exceptions -DNDEBUG -DLARGEBOARDS -DALLVARS -DPRECOMPUTED_MAGICS -DNNUE_EMBEDDING_OFF -DNO_PREFETCH -DFS_NO_THREADS -D_WASI_EMULATED_MMAN -include $HERE/wasm_compat.h -Wno-date-time"
for f in $(ls *.cpp nnue/*.cpp nnue/features/*.cpp syzygy/*.cpp | grep -v -e ffishjs -e pyffish -e '^main.cpp'); do
  echo "$f"; python3 -m ziglang c++ $FLAGS -c "$f" -o "$WORK/obj/$(echo "$f" | tr / _).o"
done
python3 -m ziglang c++ -target wasm32-wasi -O3 -mexec-model=reactor "$WORK"/obj/*.o -o "$WORK/fairy-stockfish.wasm" \
  -lwasi-emulated-mman -Wl,--strip-all -Wl,--initial-memory=67108864 -Wl,--max-memory=1073741824 -Wl,-z,stack-size=8388608
ls -la "$WORK/fairy-stockfish.wasm"
echo "copy it to $HERE/../fairy-stockfish.wasm"
