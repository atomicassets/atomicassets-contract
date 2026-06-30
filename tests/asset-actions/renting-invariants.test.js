const { Blockchain, nameToBigInt } = require("@vaulta/vert");
const { TimePoint } = require("@wharfkit/antelope");

// Non-custodial "renter-as-owner" rental primitives. In this model the renter
// becomes the real AtomicAssets owner during a lease; the lister's reclaim right
// is parked in a `leases` row (the "title"); the asset is LOCKED (no
// transfer/burn/offer-out) while that row exists; and a permissionless `reclaim`
// force-returns it to the title_owner at expiry.
//
// These tests cover: the lock guards on every renter-reachable extraction path,
// the leasestart/leaseextend lifecycle, the configured-market authority (stored
// in the rentalcfg singleton), the permissionless reclaim, and the fact that a
// pre-existing offer survives a rental rather than being cleared.
describe("non-custodial rental primitives", () => {
    let blockchain;
    let atomicassets;
    let market;   // the rental market we authorize via setrentmkt (leasing is opt-in)
    let lister;   // title_owner / lessor
    let renter;   // becomes the AA owner during the lease
    let third;    // unrelated third party / random reclaim caller
    let evil;     // adversary contract: throws on the atomicassets::logreclaim notification

    const ASSET1 = "1099511627776"; // 2^40, first minted asset id
    const ONE_HOUR = 3600;
    const MAX_LEASE_SECONDS = 60 * 60 * 24 * 28; // mirrors the contract's protocol backstop

    function nowSec() {
        return Math.floor(blockchain.timestamp.toMilliseconds() / 1000);
    }
    function leases() {
        return atomicassets.tables.leases(nameToBigInt(atomicassets.name)).getTableRows();
    }
    function assetsOf(account) {
        return atomicassets.tables.assets(nameToBigInt(account.name)).getTableRows();
    }
    function offers() {
        return atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
    }

    beforeAll(async () => {
        blockchain = new Blockchain();
        atomicassets = blockchain.createContract('atomicassets', './build/atomicassets');
        // Leasing is opt-in (rentalcfg defaults to disabled); this is the market account we
        // authorize via setrentmkt in beforeEach.
        market = blockchain.createAccount('atomicmarket');
        lister = blockchain.createAccount('lister');
        renter = blockchain.createAccount('renter');
        third = blockchain.createAccount('thirduser11');
        // Adversary contract that vetoes the reclaim notification (see fixtures/evil-renter).
        evil = blockchain.createContract('evilrenter11', './build/evil-renter');
    });

    beforeEach(async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);

        // Leasing is opt-in (rentalcfg defaults to name("") = disabled). Enable it for
        // the rental tests by authorizing the market; the "default disabled" test below
        // covers the un-configured state explicitly.
        await atomicassets.actions.setrentmkt([
            market.name.toString()
        ]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.createcol([
            lister.name.toString(),
            "testcollect1",
            true,
            [lister.name.toString()],
            [],
            0.05,
            []
        ]).send(`${lister.name.toString()}@active`);

        await atomicassets.actions.createschema([
            lister.name.toString(),
            "testcollect1",
            "testschema",
            [
                { name: "name", type: "string" },
                { name: "level", type: "uint32" },
                { name: "img", type: "ipfs" }
            ]
        ]).send(`${lister.name.toString()}@active`);

        // template 1: transferable + burnable
        await atomicassets.actions.createtempl([
            lister.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,
            []
        ]).send(`${lister.name.toString()}@active`);

        // template 2: NON-transferable
        await atomicassets.actions.createtempl([
            lister.name.toString(),
            "testcollect1",
            "testschema",
            false, // transferable
            true,  // burnable
            0,
            []
        ]).send(`${lister.name.toString()}@active`);
    });

    // Mints one asset of the given template to the lister and returns its id.
    async function mint(templateId = 1) {
        await atomicassets.actions.mintasset([
            lister.name.toString(),
            "testcollect1",
            "testschema",
            templateId,
            lister.name.toString(),
            [],
            [],
            []
        ]).send(`${lister.name.toString()}@active`);
        return ASSET1;
    }

    // Opens a lease (market-signed) for the given duration.
    async function leaseFor(seconds = ONE_HOUR) {
        const rentalEnd = nowSec() + seconds;
        await atomicassets.actions.leasestart([
            lister.name.toString(),
            renter.name.toString(),
            ASSET1,
            rentalEnd,
            "lease start"
        ]).send(`${market.name.toString()}@active`);
        return rentalEnd;
    }

    // ---------------------------------------------------------------- lifecycle

    test("leasestart makes the renter the real owner and records the title", async () => {
        await mint();
        const rentalEnd = await leaseFor();

        // ownership flipped lister -> renter
        expect(assetsOf(lister)).toHaveLength(0);
        expect(assetsOf(renter)).toHaveLength(1);
        expect(assetsOf(renter)[0]).toMatchObject({ asset_id: ASSET1 });
        // active lease row
        expect(leases()).toEqual([{
            asset_id: ASSET1,
            title_owner: lister.name.toString(),
            renter: renter.name.toString(),
            collection_name: "testcollect1",
            rental_start: rentalEnd - ONE_HOUR,
            rental_end: rentalEnd
        }]);
    });

    test("leasing is DISABLED by default; enabling requires setrentmkt", async () => {
        await mint();
        // reset rentalcfg to its on-deploy default (the unconfigured/disabled state)
        await atomicassets.actions.setrentmkt([""]).send(`${atomicassets.name.toString()}@active`);

        const rentalEnd = nowSec() + ONE_HOUR;
        await expect(atomicassets.actions.leasestart([
            lister.name.toString(), renter.name.toString(),
            ASSET1, rentalEnd, "lease"
        ]).send(`${market.name.toString()}@active`)).rejects.toThrow("Leasing is disabled");

        // re-enable and confirm leasing works
        await atomicassets.actions.setrentmkt([
            market.name.toString()
        ]).send(`${atomicassets.name.toString()}@active`);
        await expect(leaseFor()).resolves.toBeDefined();
        expect(assetsOf(renter)).toHaveLength(1);
    });

    test("throw when leasing an already-leased asset", async () => {
        await mint();
        await leaseFor();
        const rentalEnd = nowSec() + ONE_HOUR;
        await expect(atomicassets.actions.leasestart([
            lister.name.toString(), renter.name.toString(),
            ASSET1, rentalEnd, "second lease"
        ]).send(`${market.name.toString()}@active`)).rejects.toThrow("already leased");
    });

    test("throw when leasing a non-transferable asset", async () => {
        await mint(2); // non-transferable template
        const rentalEnd = nowSec() + ONE_HOUR;
        await expect(atomicassets.actions.leasestart([
            lister.name.toString(), renter.name.toString(),
            ASSET1, rentalEnd, "lease"
        ]).send(`${market.name.toString()}@active`)).rejects.toThrow("not transferable");
    });

    test("leaseextend bumps the end without changing ownership", async () => {
        await mint();
        await leaseFor();
        const newEnd = nowSec() + ONE_HOUR * 5;
        await atomicassets.actions.leaseextend([
            ASSET1, newEnd
        ]).send(`${market.name.toString()}@active`);

        expect(assetsOf(renter)).toHaveLength(1); // still the renter's
        expect(leases()[0].rental_end).toBe(newEnd);
    });

    test("leaseextend cannot revive an expired lease (no racing the reclaim)", async () => {
        await mint();
        await leaseFor(ONE_HOUR);

        // jump past expiry, then the market tries to push rental_end out
        blockchain.addTime(TimePoint.fromMilliseconds((ONE_HOUR + 1) * 1000));
        await expect(atomicassets.actions.leaseextend([
            ASSET1, nowSec() + ONE_HOUR
        ]).send(`${market.name.toString()}@active`)).rejects.toThrow("already expired");

        // reclaim is still available and returns the asset to the lister
        await atomicassets.actions.reclaim([ASSET1]).send(`${third.name.toString()}@active`);
        expect(assetsOf(lister).map((a) => a.asset_id)).toContain(ASSET1);
    });

    // -------------------------------------------------------------- lock guards

    test("a leased asset cannot be transferred by the renter (its owner)", async () => {
        await mint();
        await leaseFor();
        await expect(atomicassets.actions.transfer([
            renter.name.toString(), third.name.toString(), [ASSET1], "escape"
        ]).send(`${renter.name.toString()}@active`)).rejects.toThrow("leased and locked");
    });

    test("a leased asset cannot be burned", async () => {
        await mint();
        await leaseFor();
        await expect(atomicassets.actions.burnasset([
            renter.name.toString(), ASSET1
        ]).send(`${renter.name.toString()}@active`)).rejects.toThrow("leased and locked");
    });

    test("a leased asset cannot be offered out by the renter", async () => {
        await mint();
        await leaseFor();
        await expect(atomicassets.actions.createoffer([
            renter.name.toString(), third.name.toString(), [ASSET1], [], ""
        ]).send(`${renter.name.toString()}@active`)).rejects.toThrow("leased and locked");
    });

    test("DELIBERATE NON-GUARD: collection can still setassetdata on a leased asset", async () => {
        await mint();
        await leaseFor();
        // setassetdata is collection-auth gated, never renter-reachable, and only
        // mutates metadata — it must keep working during a lease.
        await expect(atomicassets.actions.setassetdata([
            lister.name.toString(),  // authorized_editor (collection auth)
            renter.name.toString(),  // asset_owner (the renter, now the owner)
            ASSET1,
            [{ "first": "name", "second": ["string", "leased-but-editable"] }]
        ]).send(`${lister.name.toString()}@active`)).resolves.not.toThrow();
    });

    test("NO REGRESSION: an unleased asset transfers normally", async () => {
        await mint();
        await expect(atomicassets.actions.transfer([
            lister.name.toString(), renter.name.toString(), [ASSET1], ""
        ]).send(`${lister.name.toString()}@active`)).resolves.not.toThrow();
        expect(assetsOf(renter)).toHaveLength(1);
    });

    // ----------------------------------------------------------------- authority

    test("throw when an account other than the configured market opens a lease", async () => {
        await mint();
        const rentalEnd = nowSec() + ONE_HOUR;
        // signed by `third`, not the configured market (atomicmarket), so the
        // required authority of the configured market is missing
        await expect(atomicassets.actions.leasestart([
            lister.name.toString(), renter.name.toString(),
            ASSET1, rentalEnd, "lease"
        ]).send(`${third.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("setrentmkt requires contract authority and reconfigures the market", async () => {
        await mint();
        await expect(atomicassets.actions.setrentmkt([
            third.name.toString()
        ]).send(`${lister.name.toString()}@active`)).rejects.toThrow("missing required authority");

        // Re-point the market to `third`, who can now open leases; the default
        // market ("atomicmarket") can no longer.
        await atomicassets.actions.setrentmkt([
            third.name.toString()
        ]).send(`${atomicassets.name.toString()}@active`);

        const rentalEnd = nowSec() + ONE_HOUR;
        await expect(atomicassets.actions.leasestart([
            lister.name.toString(), renter.name.toString(),
            ASSET1, rentalEnd, "lease"
        ]).send(`${market.name.toString()}@active`)).rejects.toThrow("missing required authority");

        await expect(atomicassets.actions.leasestart([
            lister.name.toString(), renter.name.toString(),
            ASSET1, rentalEnd, "lease"
        ]).send(`${third.name.toString()}@active`)).resolves.not.toThrow();
        expect(assetsOf(renter)).toHaveLength(1);
    });

    // ------------------------------------------------------------------- reclaim

    test("throw when reclaiming before expiry", async () => {
        await mint();
        await leaseFor(ONE_HOUR);
        await expect(atomicassets.actions.reclaim([
            ASSET1
        ]).send(`${third.name.toString()}@active`)).rejects.toThrow("has not expired");
    });

    test("anyone can reclaim after expiry, returning the asset to the lister", async () => {
        await mint();
        await leaseFor(ONE_HOUR);

        blockchain.addTime(TimePoint.fromMilliseconds((ONE_HOUR + 1) * 1000));

        // a random, unrelated account triggers the reclaim
        await expect(atomicassets.actions.reclaim([
            ASSET1
        ]).send(`${third.name.toString()}@active`)).resolves.not.toThrow();

        expect(assetsOf(renter)).toHaveLength(0);
        expect(assetsOf(lister)).toHaveLength(1);
        expect(assetsOf(lister)[0]).toMatchObject({ asset_id: ASSET1 });
        expect(leases()).toEqual([]); // lock cleared
    });

    test("reclaim throws when the asset is not leased", async () => {
        await mint();
        await expect(atomicassets.actions.reclaim([
            ASSET1
        ]).send(`${third.name.toString()}@active`)).rejects.toThrow("not leased");
    });

    // ------------------------------------------------ offers survive a rental

    test("a pre-existing offer survives a rental and is acceptable again after reclaim", async () => {
        await mint();
        // lister offers the asset to `third` BEFORE leasing it
        await atomicassets.actions.createoffer([
            lister.name.toString(), third.name.toString(), [ASSET1], [], ""
        ]).send(`${lister.name.toString()}@active`);
        expect(offers()).toHaveLength(1);

        await leaseFor(ONE_HOUR);

        // the offer is NOT cleared by lease-start; it just can't settle while the
        // asset is locked / owned by the renter
        expect(offers()).toHaveLength(1);
        await expect(atomicassets.actions.acceptoffer([
            1
        ]).send(`${third.name.toString()}@active`)).rejects.toThrow();

        // after reclaim the asset is back with the lister and unlocked, so the same
        // offer can now be accepted
        blockchain.addTime(TimePoint.fromMilliseconds((ONE_HOUR + 1) * 1000));
        await atomicassets.actions.reclaim([ASSET1]).send(`${third.name.toString()}@active`);

        await expect(atomicassets.actions.acceptoffer([
            1
        ]).send(`${third.name.toString()}@active`)).resolves.not.toThrow();
        expect(assetsOf(third).map((a) => a.asset_id)).toContain(ASSET1);
    });

    // ----------------------------------- the RENTER cannot veto the permissionless reclaim
    // The permissionless reclaim is the model's guaranteed revert. The renter is an
    // arbitrary, possibly hostile account that profits from keeping the asset, so it
    // must NEVER be able to abort the reclaim by throwing in a notification handler.
    // The `evil` fixture throws on the atomicassets::logreclaim notification; reclaim
    // no longer notifies the renter, so the veto can't fire.
    // (Re-adding require_recipient(renter) to logreclaim makes this test RED.)

    test("a malicious renter contract cannot veto the permissionless reclaim", async () => {
        await mint();
        // lease to the EVIL contract account; it becomes the real owner. loglock is
        // delivered at lease-start but evil only vetoes logreclaim, so this succeeds.
        const rentalEnd = nowSec() + ONE_HOUR;
        await atomicassets.actions.leasestart([
            lister.name.toString(), evil.name.toString(),
            ASSET1, rentalEnd, "lease to evil renter"
        ]).send(`${market.name.toString()}@active`);
        expect(assetsOf(evil)).toHaveLength(1);

        blockchain.addTime(TimePoint.fromMilliseconds((ONE_HOUR + 1) * 1000));

        // the renter is no longer notified on reclaim, so its veto never fires
        await expect(atomicassets.actions.reclaim([
            ASSET1
        ]).send(`${third.name.toString()}@active`)).resolves.not.toThrow();

        expect(assetsOf(evil)).toHaveLength(0);
        expect(assetsOf(lister).map((a) => a.asset_id)).toContain(ASSET1);
        expect(leases()).toEqual([]); // lock cleared, asset returned
    });

    test("the collection IS notified on reclaim (trusted; can react, by design)", async () => {
        // By design reclaim notifies the asset's collection (mirrors loglock on
        // lease-start) so collections can react to their assets returning. This is a
        // deliberate trust tradeoff: a collection notify-account that throws CAN abort
        // the reclaim — accepted under the same trust model that lets collections gate
        // transfers, and in pointed contrast to the renter, which cannot (test above).
        // We prove the collection is actually reached by making its notify-account the
        // `evil` fixture (throws on logreclaim) and observing the reclaim revert.
        await mint();
        await atomicassets.actions.addnotifyacc([
            "testcollect1", evil.name.toString()
        ]).send(`${lister.name.toString()}@active`);

        await leaseFor(ONE_HOUR); // ordinary renter
        blockchain.addTime(TimePoint.fromMilliseconds((ONE_HOUR + 1) * 1000));

        // the collection notify-account is in the reclaim path, so its veto reverts it
        await expect(atomicassets.actions.reclaim([
            ASSET1
        ]).send(`${third.name.toString()}@active`)).rejects.toThrow("evil renter vetoes the reclaim");
    });

    // ----------------------------------------- duration cap (protocol backstop, #2)

    test("leasestart rejects a rental_end beyond MAX_LEASE_SECONDS", async () => {
        await mint();
        const tooLong = nowSec() + MAX_LEASE_SECONDS + ONE_HOUR;
        await expect(atomicassets.actions.leasestart([
            lister.name.toString(), renter.name.toString(),
            ASSET1, tooLong, "too long"
        ]).send(`${market.name.toString()}@active`)).rejects.toThrow("maximum lease duration");
    });

    test("leasestart allows a rental_end exactly at MAX_LEASE_SECONDS", async () => {
        await mint();
        const atCap = nowSec() + MAX_LEASE_SECONDS;
        await expect(atomicassets.actions.leasestart([
            lister.name.toString(), renter.name.toString(),
            ASSET1, atCap, "at cap"
        ]).send(`${market.name.toString()}@active`)).resolves.not.toThrow();
        expect(assetsOf(renter)).toHaveLength(1);
    });

    test("leaseextend cannot push the total window past MAX_LEASE_SECONDS from rental_start", async () => {
        await mint();
        const rentalStart = nowSec();
        await leaseFor(ONE_HOUR);
        // total window measured from the fixed rental_start, not from "now"
        await expect(atomicassets.actions.leaseextend([
            ASSET1, rentalStart + MAX_LEASE_SECONDS + ONE_HOUR
        ]).send(`${market.name.toString()}@active`)).rejects.toThrow("maximum lease duration");
    });
});
