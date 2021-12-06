build: src/wasm/test.cpp
	emcc -O3 src/wasm/test.cpp -o build/wasm/test.wasm -s STANDALONE_WASM