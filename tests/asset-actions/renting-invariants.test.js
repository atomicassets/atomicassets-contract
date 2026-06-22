const { Blockchain, nameToBigInt, mintTokens } = require("@vaulta/vert");
const { Name } = require('@wharfkit/antelope');
const fs = require('fs');

// GAP-FILL (audit: A-BURN-RENTED, A-XFER-RENTED). The `move` action records a
// "holdership" (a holders row: asset_id + owner + holder) without locking the
// underlying asset. These tests LOCK the CURRENT on-chain behavior of what
// happens to a rented (held) asset when the OWNER burns or transfers it out
// from under the holder, so the pre-mainnet invariant decision is
// regression-guarded. They are characterization tests: they assert what the
// contract does today, not what it ideally should do.
//
// Current behavior (atomicassets.cpp):
//   burnasset:        holders row for the asset is ERASED, asset is burned. The
//                     holder silently loses the asset; no guard prevents this.
//   internal_transfer: if `to` == holder, the holders row is ERASED (rental
//                     effectively settles to the holder). Otherwise the holders
//                     row's `owner` is REWRITTEN to the new owner and the
//                     holdership PERSISTS across the transfer.
describe("renting invariants characterization (burn / transfer of a held asset)", () => {
    let blockchain;
    let atomicassets;
    let eosioToken;
    let owner;   // asset owner / lessor
    let holder;  // current holder / lessee
    let third;   // unrelated third party

    beforeAll(async () => {
        blockchain = new Blockchain();
        atomicassets = blockchain.createContract(
            'atomicassets',
            './build/atomicassets'
        );
        eosioToken = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });
        owner = blockchain.createAccount('user1');
        holder = blockchain.createAccount('user2');
        third = blockchain.createAccount('user3');
    });

    beforeEach(async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);
        await mintTokens(eosioToken, 'WAX', 8, 1000000000, 10000, [owner, holder, third]);

        await atomicassets.actions.createcol([
            owner.name.toString(),
            "testcollect1",
            true,
            [owner.name.toString()],
            [],
            0.05,
            []
        ]).send(`${owner.name.toString()}@active`);

        await atomicassets.actions.createschema([
            owner.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", type: "string"},
                {name: "level", type: "uint32"},
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${owner.name.toString()}@active`);

        // Transferable + burnable template so move/transfer/burn are all allowed.
        await atomicassets.actions.createtempl([
            owner.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,     // max_supply
            []
        ]).send(`${owner.name.toString()}@active`);
    });

    // Mints one asset to `owner` and moves it out to `holder`, creating the
    // holders row. Returns the asset_id.
    async function mintAndRent() {
        await atomicassets.actions.mintasset([
            owner.name.toString(),
            "testcollect1",
            "testschema",
            1,
            owner.name.toString(),
            [],
            [],
            []
        ]).send(`${owner.name.toString()}@active`);

        const assetId = "1099511627776";

        await atomicassets.actions.move([
            owner.name.toString(),  // owner
            owner.name.toString(),  // from (owner)
            holder.name.toString(), // to (new holder)
            [assetId],
            'Rent out asset'
        ]).send(`${owner.name.toString()}@active`);

        // Holders row exists, owner still owns the asset row.
        const holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(1);
        expect(holders[0]).toMatchObject({
            asset_id: assetId,
            owner: owner.name.toString(),
            holder: holder.name.toString()
        });

        return assetId;
    }

    // A-BURN-RENTED: the OWNER can burn an asset that is currently held out by a
    // lessee. There is NO guard. The asset is burned and the holders row is
    // erased; the holder is left with nothing.
    test("CURRENT BEHAVIOR: owner can burn a rented-out asset (holder loses it)", async () => {
        const assetId = await mintAndRent();

        // Owner burns the held asset (no rejection).
        await expect(atomicassets.actions.burnasset([
            owner.name.toString(),
            assetId
        ]).send(`${owner.name.toString()}@active`)).resolves.not.toThrow();

        // Asset is gone from the owner's scope.
        const ownerAssets = atomicassets.tables.assets(nameToBigInt(owner.name)).getTableRows();
        expect(ownerAssets).toEqual([]);

        // Holder never had an asset row in their scope (move only records
        // holdership, it does not move the asset row).
        const holderAssets = atomicassets.tables.assets(nameToBigInt(holder.name)).getTableRows();
        expect(holderAssets).toEqual([]);

        // Holders row was erased by the burn.
        const holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toEqual([]);
    });

    // A-XFER-RENTED (transfer to an unrelated third party, NOT the holder):
    // the OWNER can transfer a held-out asset to someone else. The holders row
    // is NOT erased; instead its `owner` field is rewritten to the new owner and
    // the holdership PERSISTS. The asset row moves to the new owner's scope.
    test("CURRENT BEHAVIOR: owner transfers a rented-out asset to a third party (holdership persists, owner rewritten)", async () => {
        const assetId = await mintAndRent();

        // Owner transfers the held asset to `third` (not the holder).
        await expect(atomicassets.actions.transfer([
            owner.name.toString(),
            third.name.toString(),
            [assetId],
            'Sell rented asset out from under holder'
        ]).send(`${owner.name.toString()}@active`)).resolves.not.toThrow();

        // Asset row moved owner -> third.
        const ownerAssets = atomicassets.tables.assets(nameToBigInt(owner.name)).getTableRows();
        expect(ownerAssets).toEqual([]);
        const thirdAssets = atomicassets.tables.assets(nameToBigInt(third.name)).getTableRows();
        expect(thirdAssets).toHaveLength(1);
        expect(thirdAssets[0]).toMatchObject({ asset_id: assetId });

        // Holders row PERSISTS; owner rewritten to `third`, holder unchanged.
        const holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(1);
        expect(holders[0]).toMatchObject({
            asset_id: assetId,
            owner: third.name.toString(),
            holder: holder.name.toString()
        });
    });

    // A-XFER-RENTED (transfer TO the current holder): the rental "settles", the
    // holders row is erased and the asset row moves to the holder, who now owns
    // it outright.
    test("CURRENT BEHAVIOR: owner transfers a rented-out asset to the holder (holdership settles)", async () => {
        const assetId = await mintAndRent();

        await expect(atomicassets.actions.transfer([
            owner.name.toString(),
            holder.name.toString(),
            [assetId],
            'Settle rental to holder'
        ]).send(`${owner.name.toString()}@active`)).resolves.not.toThrow();

        // Asset row moved owner -> holder.
        const ownerAssets = atomicassets.tables.assets(nameToBigInt(owner.name)).getTableRows();
        expect(ownerAssets).toEqual([]);
        const holderAssets = atomicassets.tables.assets(nameToBigInt(holder.name)).getTableRows();
        expect(holderAssets).toHaveLength(1);
        expect(holderAssets[0]).toMatchObject({ asset_id: assetId });

        // Holders row erased (rental settled to holder).
        const holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toEqual([]);
    });
});
