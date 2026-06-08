#!/usr/bin/env python3
"""Restore the legacy ABI spellings after CDT >= 4.1 -abigen.

Background
----------
The AtomicAssets contract deployed on WAX mainnet was compiled with an older CDT.
Modern CDT (4.1.x) changed two -abigen spellings in wire-compatible but
tool-visible ways. ABI field/type *names* are how external tools (atomicassets-js,
wallets, the ECA indexer, cleos JSON) pack/unpack data, so each change breaks
existing integrations even though the compiled wasm and the binary wire format are
identical. This script restores the deployed spellings; the wasm is untouched.

Two regressions are reverted:

1. std::pair fields  `first`/`second`  ->  `key`/`value`
   (only the `ATTRIBUTE_MAP` element type `pair_string_ATOMIC_ATTRIBUTE` today).
   Old CDT named pair fields key/value; CDT 4.1 hardcodes the C++ member names.

2. std::vector<uint8_t>  `bytes`  ->  `uint8[]`
   Old CDT spelled vector<uint8_t> as `uint8[]` and vector<int8_t> as `bytes`;
   CDT 4.1 collapses BOTH to `bytes`. The deployed ABI keeps `bytes` only for the
   `INT8_VEC` alias (vector<int8_t>), so we convert every `bytes` EXCEPT that one.

Verified against https://wax.greymass.com get_abi(atomicassets): after patching,
the rc ABI's shared surface (pre-v2 types/structs/actions/tables) is byte-for-byte
equivalent to on-chain; the only remaining differences are additive v2 features.

Idempotent. Usage: patch-abi.py [path/to/contract.abi]  (default build/atomicassets.abi)
"""
import json
import sys

PAIR_FIELDS = {"first": "key", "second": "value"}
# vector<int8_t> legitimately stays `bytes` on the deployed ABI; everything else
# spelled `bytes` by CDT 4.1 is vector<uint8_t> and must become `uint8[]`.
KEEP_BYTES_TYPES = {"INT8_VEC"}


def main(path: str) -> None:
    with open(path) as fh:
        abi = json.load(fh)

    pair_renames = 0
    bytes_fixes = 0

    # 1. pair field names first/second -> key/value (scoped to pair_* structs).
    for struct in abi.get("structs", []):
        if not struct["name"].startswith("pair_"):
            continue
        for field in struct.get("fields", []):
            new = PAIR_FIELDS.get(field["name"])
            if new:
                field["name"] = new
                pair_renames += 1

    # 2. bytes -> uint8[] for vector<uint8_t> (type aliases + struct fields),
    #    preserving `bytes` only for the int8 vector alias.
    for typedef in abi.get("types", []):
        if typedef["new_type_name"] in KEEP_BYTES_TYPES:
            continue
        if typedef["type"] == "bytes":
            typedef["type"] = "uint8[]"
            bytes_fixes += 1
    for struct in abi.get("structs", []):
        for field in struct.get("fields", []):
            if field["type"] == "bytes":
                field["type"] = "uint8[]"
                bytes_fixes += 1

    # Fail closed: no stray pair field names may remain on any struct.
    leftover = [
        struct["name"]
        for struct in abi.get("structs", [])
        for field in struct.get("fields", [])
        if field["name"] in PAIR_FIELDS
    ]
    if leftover:
        sys.exit(f"patch-abi: refusing — first/second remain on structs: {sorted(set(leftover))}")

    with open(path, "w") as fh:
        json.dump(abi, fh, indent=4)
        fh.write("\n")

    print(f"patch-abi: {path}: pair fields={pair_renames}, bytes->uint8[]={bytes_fixes}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "build/atomicassets.abi")
