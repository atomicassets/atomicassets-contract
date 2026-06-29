/*
  Test-only consumer contract for atomicassets-interface.hpp.

  This fixture exists to close a blind spot the main VeRT suite cannot cover:
  the interface header is consumed by EXTERNAL contracts (atomicpacks,
  atomictools, atomicbridge, ...), never by atomicassets itself, so a bug in
  the header is invisible to tests that only exercise the atomicassets wasm.

  Each action here reads an AtomicAssets table THROUGH the interface header
  from a contract account that is NOT `atomicassets`. If the header's table
  getters ever anchor at get_self() again (the v2 regression fixed in PR #21),
  every lookup targets this contract's own (empty) scope and the checks below
  fail, turning the regression into a red test instead of a silent break for
  every downstream consumer.

  Built by `make build` into build/interface-consumer.{wasm,abi}; deployed by
  tests/interface-header/interface-consumer.test.js at account `ifaceconsumr`.
  NOT a distributable artifact.
*/

#include <eosio/eosio.hpp>
#include <atomicassets-interface.hpp>

using namespace eosio;

CONTRACT ifaceconsumr : public contract {
public:
    using contract::contract;

    ACTION assertcol(name collection_name) {
        auto collections = atomicassets::get_collections();
        check(collections.find(collection_name.value) != collections.end(),
            "collection not visible through interface header");
    }

    ACTION assertasset(name owner, uint64_t asset_id) {
        auto assets = atomicassets::get_assets(owner);
        check(assets.find(asset_id) != assets.end(),
            "asset not visible through interface header");
    }

    ACTION asserttempl(name collection_name, int32_t template_id) {
        auto templates = atomicassets::get_templates(collection_name);
        check(templates.find((uint64_t) template_id) != templates.end(),
            "template not visible through interface header");
    }
};
