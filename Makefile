build:
	mkdir -p build
	cdt-cpp -abigen -contract=atomicassets -I./include src/atomicassets.cpp -o build/atomicassets.wasm

# Release-only ABI normalization. CDT 4.1 changed two -abigen spellings
# (pair fields first/second; vector<uint8_t> as `bytes`) that break existing
# integrations. The VeRT test suite is written against the raw CDT 4.1 abi, so we
# patch ONLY for distribution/on-chain deploy — never for the test build. The wasm
# is identical either way (abi labels don't affect the binary wire format).
patch-abi:
	python3 scripts/patch-abi.py build/atomicassets.abi

# Build the distributable artifacts (wasm + legacy-compatible abi) for release /
# `cleos set contract`. Do NOT use for running tests — use `make build`.
# Sequence build -> patch-abi via sub-makes so `make -j release` cannot start
# patch-abi before build has produced build/atomicassets.abi.
release:
	$(MAKE) build
	$(MAKE) patch-abi

export-memory:
	wasm2wat build/atomicassets.wasm | sed -e 's|(memory |(memory (export "memory") |' > atomicassets.wat
	wat2wasm -o build/atomicassets.wasm atomicassets.wat
	rm atomicassets.wat

.PHONY: build patch-abi release export-memory clean
clean:
	-rm -rf build