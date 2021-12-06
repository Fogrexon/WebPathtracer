#include <stdio.h>
#include <math.h>
#include <emscripten/emscripten.h>

int main(int argc, char **argv) {
  printf("Hello WASM World\n");
}

#ifdef __cplusplus
extern "C" {
#endif

int counter = 0;

int EMSCRIPTEN_KEEPALIVE count() {
  counter ++;
  printf("counter: %d\n", counter);
  return counter;
}

#ifdef __cplusplus
}
#endif