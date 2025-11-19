build:
	mkdir -p build
	cdt-cpp -abigen -contract=atomicassets -I./include src/atomicassets.cpp -o build/atomicassets.wasm

export-memory:
	wasm2wat build/atomicassets.wasm | sed -e 's|(memory |(memory (export "memory") |' > atomicassets.wat
	wat2wasm -o build/atomicassets.wasm atomicassets.wat
	rm atomicassets.wat

.PHONY: clean
clean:
	-rm -rf build