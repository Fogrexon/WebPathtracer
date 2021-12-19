.PHONY: build testbuild

build: src/wasm/main.cpp
	@emcc src/wasm/main.cpp -std=c++1z -s WASM=1 -O2 -s NO_EXIT_RUNTIME=1 -s "EXPORTED_RUNTIME_METHODS=['ccall', 'getValue', 'setValue']" -s EXPORTED_FUNCTIONS="['_pathTracer', '_main', '_malloc', '_free']" -s ALLOW_MEMORY_GROWTH=1 -o build/wasm/main.js

testbuild: src/wasm/bvhtest.cpp
	@emcc src/wasm/bvhtest.cpp -std=c++1z -s WASM=1 -O2 -s NO_EXIT_RUNTIME=1 -s "EXPORTED_RUNTIME_METHODS=['ccall', 'getValue', 'setValue']" -s EXPORTED_FUNCTIONS="['_pathTracer', '_main', '_malloc', '_free']" -s ALLOW_MEMORY_GROWTH=1 -o build/wasm/main.js
