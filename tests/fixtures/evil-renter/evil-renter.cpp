/*
  Test-only adversary contract for the non-custodial rental reclaim path.

  The permissionless `reclaim` is the guaranteed revert the whole rental model
  rests on: at expiry anyone can return a leased asset to its title_owner, with
  no renter signature. The hazard (the original `move` action warned of it: "Cannot
  have notifications for the from & to, exploitable") is that a renter which is a
  CONTRACT can veto the reclaim by throwing inside a notification handler, since a
  throwing `require_recipient` target aborts the entire transaction. That would
  trap the asset with the renter forever, defeating the model.

  This contract is exactly such an adversary: it aborts ONLY when notified of
  `atomicassets::logreclaim`, and ignores every other notification (notably
  `loglock`, so it can still receive the asset at lease start). It pins down two
  things about the reclaim path:
    - Deployed as the RENTER, it proves the renter is NOT notified on reclaim
      (reclaim succeeds despite the veto) — the asset-trap theft vector is closed.
    - Deployed as a COLLECTION notify-account, it proves the collection IS notified
      on reclaim (reclaim reverts) — a deliberate trust tradeoff: collections can
      react to (and, if hostile, block) reclaim of their own collection's assets.

  Built by `make build` into build/evil-renter.{wasm,abi}; consumed by
  tests/asset-actions/renting-invariants.test.js. NOT a distributable artifact.
*/

#include <eosio/eosio.hpp>

using namespace eosio;

CONTRACT evilrenter : public contract {
public:
    using contract::contract;

    // The veto: abort whenever atomicassets emits the reclaim log to us. Pre-fix
    // (logreclaim require_recipient(renter)) this aborts every reclaim attempt and
    // traps the asset. Post-fix this handler is never invoked.
    [[eosio::on_notify("atomicassets::logreclaim")]]
    void onreclaim(name collection_name, uint64_t asset_id, name title_owner, name renter) {
        check(false, "evil renter vetoes the reclaim");
    }

    // No-op action; exists only so -abigen emits an ABI (a notification-only
    // contract is "empty" to abigen and produces none, which VeRT needs to load).
    ACTION noop() {}
};
