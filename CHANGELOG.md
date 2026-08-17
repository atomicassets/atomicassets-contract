# Changelog

Notable changes to the AtomicAssets contract. This file starts at 2.0.0; the
releases published before it live in
[GitHub Releases](https://github.com/atomicassets/atomicassets-contract/releases).

Entry headings keep the `## [X.Y.Z] - YYYY-MM-DD` form. Each entry opens with a
summary line, then carries the sections that `RELEASING.md` defines, in that
order; the entry is the editorial text of the version's GitHub Release. This
project follows semantic versioning.

## [2.0.0] - 2026-08-03

The AtomicAssets v2 standard contract: mutable templates, per-field schema media types, collection author succession, template maintenance actions and a contract-wide CPU reduction.

### Breaking changes

- `backasset` fails unconditionally with `Native backing has been deprecated on the AtomicAssets Contract`, and `mintasset` rejects a non-empty `tokens_to_back`. Both actions stay in the ABI, so an ABI diff does not show the change and an integration that backs assets starts failing at the upgrade. Value already backed is not stranded: burning an asset still releases its `backed_tokens` to the owner's balance, and `withdraw`, `announcedepo` and the deposit path are unchanged. `0907db9`
- `createtempl` and `createtempl2` reject a template whose assets would be neither transferable nor burnable, with `A template cannot be both non-transferable and non-burnable`. Such an asset could never move and could never be destroyed, so it would hold its owner's RAM permanently. Every other flag combination stays valid, and the check runs at creation, so templates already in that state keep working. `0907db9`
- `addcolauth` and `addnotifyacc` refuse to extend a list that already holds 24 accounts, where v1 enforced no limit. These lists are walked on every notifying action. A collection already above the cap keeps every entry it has and can still remove them. `89774e9`
- `createcol` rejects more than 24 accounts in either list, the cap the incremental actions enforce. Without it, one transaction seeds a collection past the read budget. (#23)
- `atomicassets-interface.hpp` reaches its tables through accessor methods, `get_collections()`, `get_offers()`, `get_assets(owner)` and the rest, rather than the member instances v1 declared. A consumer contract that vendors the header changes its call sites. `0036796`

### Upgrading

| Asset | sha256 |
| --- | --- |
| `atomicassets.wasm` | `962a93e1adde9779d3afb84983cee076c3d2b50b0473c99fb0fe02573a7b7242` |
| `atomicassets.abi` | `b6389fdde10a16f2d94b12bb10a67b676f6449b1293b57cc0b18256652cfef68` |

- The wasm sha256 equals the on-chain code hash, so `get_code_hash` confirms which bytes are running. The attached `SHA256SUMS` carries the same two values.
- The ABI is additive against v1: nothing is removed and no existing struct changes shape. The published ABI is the legacy-compat build, where `vector<uint8_t>` fields render as `uint8[]` and the attribute-map pair fields keep their v1 `key` and `value` spellings (CDT 4.1 emits `first` and `second`, and the release build patches them back), so a v1 client or indexer keeps working unchanged. The ABI version moves from `eosio::abi/1.1` to `1.2`, and the behavior changes above are not expressed in the ABI at all.
- The final surface is 47 actions and 11 tables. Existing tables (`assets`, `templates`, `schemas`, `collections`, `config`, `offers`, `balances`, `tokenconfigs`) keep their layout, and the added tables are `templates2`, `schematypes` and `authorswaps`.
- The deploy is a `setcode` plus `setabi`. On-chain state is preserved and no migration action runs.
- A chain that ran the rc1 to rc3 candidates clears the `holders` table before this deploy. No action in this release can erase such a row, and the RAM it occupies is stranded. A chain coming from v1 has no `holders` rows and needs no cleanup.
- `setversion` takes `2.0.0`.
- Signers of an msig proposal check the proposal's wasm sha256 against the table above, and its packed ABI against the published `.abi`, because the chain does not validate `setabi` payloads.

### Features

- `redtemplmax` lowers a template's `max_supply`, never below the supply already issued. `0907db9`
- `deltemplate` removes a template that has no issued assets and erases its `templates2` row. `0907db9`
- `createtempl2` creates a template that carries mutable data and `settempldata` updates it, each change emitting `logsetdatatl`. The mutable data lives in the new `templates2` table beside the immutable `templates` row, so a reader that knows only `templates` still works. `0907db9`
- `setschematyp` records per-field media-type descriptors for a schema in the new `schematypes` table, so a consumer can tell how to render a field instead of inferring it from the field name. The action replaces the whole descriptor array, so a client reads the stored descriptors before it writes, or it writes its own inferred view back to chain. `0907db9`
- `createauswap` proposes a new collection author and `acceptauswap` or `rejectauswap` completes or cancels the handover, with pending swaps in the new `authorswaps` table. The collection's `author` changes only on acceptance, so no single party moves a collection on its own. `0907db9`
- `setrampayer` and `setlastpayer` reassign an asset's RAM payer and emit `logrampayer`. `setrampayer` moves a named asset to the caller and refunds the previous payer, and `setlastpayer` does the same for the caller's newest asset in a collection. (#19)
- The collection-authorization path reads only the bytes it needs from the collection row through a low-level partial read, instead of loading a row that can carry several KB of serialized data on every schema, template and asset action. The transfer and offer paths also stop building their failure message on the success path, since `check(cond, msg)` evaluates the message before the call. `89774e9`

### Other changes

- Custodial rentals are not part of v2. The implementation is preserved on the [`archive/v2-custodial-rentals`](https://github.com/atomicassets/atomicassets-contract/tree/archive/v2-custodial-rentals) branch. (#27)
