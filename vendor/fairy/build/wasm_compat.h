// Single-threaded stand-ins for the parts of <mutex>, <condition_variable>, <thread> and
// <fstream> that wasi-libc++ (no threads, no filesystem) lacks. Used only for the
// Knight Club wasm32-wasi build of Fairy-Stockfish. Files can never be opened.
#pragma once
#include <utility>
#include <chrono>
#include <mutex>
#include <istream>
#include <ostream>
#include <string>
_LIBCPP_BEGIN_NAMESPACE_STD
struct mutex { void lock() {} void unlock() {} bool try_lock() { return true; } };
template<class... M> struct scoped_lock { explicit scoped_lock(M&...) {} };
struct condition_variable {
  void notify_one() {} void notify_all() {}
  template<class L, class P> void wait(L&, P) {}
};
struct thread {
  thread() {}
  template<class F, class... A> explicit thread(F&& f, A&&... a) { std::forward<F>(f)(std::forward<A>(a)...); }
  void join() {} void detach() {} bool joinable() const { return false; }
  static unsigned hardware_concurrency() { return 1; }
};
namespace this_thread { template<class R, class P> void sleep_for(const chrono::duration<R,P>&) {} inline void yield() {} }
template<class C, class T> class basic_ifstream : public basic_istream<C,T> {
public:
  basic_ifstream() : basic_istream<C,T>(nullptr) {}
  template<class S> explicit basic_ifstream(const S&, ios_base::openmode = ios_base::in) : basic_istream<C,T>(nullptr) {}
  template<class S> void open(const S&, ios_base::openmode = ios_base::in) { this->setstate(ios_base::failbit); }
  bool is_open() const { return false; } void close() {}
};
template<class C, class T> class basic_ofstream : public basic_ostream<C,T> {
public:
  basic_ofstream() : basic_ostream<C,T>(nullptr) {}
  template<class S> explicit basic_ofstream(const S&, ios_base::openmode = ios_base::out) : basic_ostream<C,T>(nullptr) {}
  template<class S> void open(const S&, ios_base::openmode = ios_base::out) { this->setstate(ios_base::failbit); }
  bool is_open() const { return false; } void close() {}
};
_LIBCPP_END_NAMESPACE_STD
