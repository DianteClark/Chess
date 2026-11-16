// Knight Club: reactor entry points for the single-threaded wasm32-wasi build.
#include <iostream>
#include <string>
#include "bitboard.h"
#include "endgame.h"
#include "position.h"
#include "psqt.h"
#include "search.h"
#include "syzygy/tbprobe.h"
#include "thread.h"
#include "tt.h"
#include "uci.h"
#include "piece.h"
#include "variant.h"
#include "xboard.h"
#include "evaluate.h"

using namespace Stockfish;
namespace Stockfish { extern std::string WasmInput; }
static char cmdBuf[1 << 16];

extern "C" __attribute__((export_name("fs_buf"))) char* fs_buf() { return cmdBuf; }

extern "C" __attribute__((export_name("fs_init"))) void fs_init() {
  static char arg0[] = "fairy-stockfish";
  static char* argv[] = { arg0, nullptr };
  pieceMap.init();
  variants.init();
  CommandLine::init(1, argv);
  UCI::init(Options);
  Tune::init();
  PSQT::init(variants.find(Options["UCI_Variant"])->second);
  Bitboards::init();
  Position::init();
  Bitbases::init();
  Endgames::init();
  Threads.set(size_t(Options["Threads"]));
  Search::clear();
  Eval::NNUE::init();
  WasmInput = "";
  UCI::loop(1, argv);
  std::cout.flush();
}

extern "C" __attribute__((export_name("fs_cmd"))) void fs_cmd() {
  static char arg0[] = "fairy-stockfish";
  static char* argv[] = { arg0, nullptr };
  WasmInput = cmdBuf;
  UCI::loop(1, argv);
  std::cout.flush();
}

// Stubs for symbols wasi-libc lacks in this single-threaded build.
extern "C" int __cxa_thread_atexit(void (*)(void*), void*, void*) { return 0; }
extern "C" int madvise(void*, unsigned long, int) { return 0; }
