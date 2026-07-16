const { Blockchain, nameToBigInt, mintTokens } = require("@vaulta/vert");
const { Name } = require('@wharfkit/antelope');
const fs = require('fs');

// GAP-FILL (audit: A-MINTASSET-DEPRECATION-LATE, A-BACKASSET-DEAD-SURFACE,
// A-DEPOSIT-RAIL-OPEN). Characterizes the native-backing deprecation surface:
//   - backasset action is a dead surface (always reverts)
//   - mintasset with non-empty tokens_to_back reverts (no new backing can be created)
//   - the deposit rail (announcedepo / withdraw) still functions
//   - burning an asset that STILL carries backed_tokens credits the balance back
//     (the redeem-on-burn path is unreachable via mintasset now, so we seed the
//      asset row directly with backed_tokens to prove the path is still wired)
describe("backed-asset deprecation surface", () => {
    let blockchain;
    let atomicassets;
    let eosioToken;
    let user1, user2, user3;

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
        user1 = blockchain.createAccount('user1');
        user2 = blockchain.createAccount('user2');
        user3 = blockchain.createAccount('user3');
    });

    beforeEach(async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);
        await mintTokens(eosioToken, 'WAX', 8, 1000000000, 10000, [user1, user2, user3]);

        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString(), user2.name.toString(), user3.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", type: "string"},
                {name: "level", type: "uint32"},
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user1.name.toString()}@active`);
    });

    // A-BACKASSET-DEAD-SURFACE: the backasset action exists in the ABI but the
    // guard reverts unconditionally.
    test("backasset always reverts (dead surface)", async () => {
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user1.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.backasset([
            user1.name.toString(),
            user1.name.toString(),
            "1099511627776",
            "50.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow(
            'Native backing has been deprecated on the AtomicAssets Contract');
    });

    // A-MINTASSET-DEPRECATION-LATE: mintasset rejects ANY non-empty
    // tokens_to_back, so no new backing can ever be created at mint time.
    test("mintasset with one backed token reverts", async () => {
        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user1.name.toString(),
            [],
            [],
            ["100.00000000 WAX"]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow(
            'Native backing has been deprecated on the AtomicAssets Contract');

        // No asset row should have been created.
        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);
    });

    test("mintasset with multiple backed tokens reverts", async () => {
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "4,EOS"
        ]).send(`${atomicassets.name.toString()}@active`);

        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user1.name.toString(),
            [],
            [],
            ["100.00000000 WAX", "10.0000 EOS"]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow(
            'Native backing has been deprecated on the AtomicAssets Contract');
    });

    // A-DEPOSIT-RAIL-OPEN: announcedepo + on-notify deposit + withdraw still work.
    test("deposit rail (announcedepo -> deposit -> withdraw) still functions", async () => {
        expect.assertions(3);

        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        // Balance row seeded by announcedepo
        let balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["0.00000000 WAX"]
        }]);

        // Real deposit via token transfer notification
        await eosioToken.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '100.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["100.00000000 WAX"]
        }]);

        // Withdraw all
        await atomicassets.actions.withdraw([
            user1.name.toString(),
            "100.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`);

        balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([]);
    });

    // Burn-to-redeem still works: an asset that pre-dates the deprecation (or was
    // otherwise seeded) still carries backed_tokens; burning it credits the
    // owner's balance row. We seed the asset row directly because mintasset can no
    // longer create backed_tokens.
    test("burning an asset that still carries backed_tokens credits balance back", async () => {
        expect.assertions(3);

        // Mint a plain asset (no backing) to user1.
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user1.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        const assetId = "1099511627776";

        // Seed backed_tokens directly onto the existing asset row (simulating an
        // asset minted before native backing was deprecated). TableView.set lets
        // us overwrite the row in user1's assets scope.
        atomicassets.tables.assets(nameToBigInt(user1.name)).set(
            BigInt(assetId),
            user1.name,
            {
                asset_id: assetId,
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: ["75.00000000 WAX"],
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            }
        );

        // Sanity: the row now carries the backed token.
        const seeded = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(seeded).toEqual([{
            asset_id: assetId,
            collection_name: "testcollect1",
            schema_name: "testschema",
            template_id: -1,
            ram_payer: user1.name.toString(),
            backed_tokens: ["75.00000000 WAX"],
            immutable_serialized_data: "",
            mutable_serialized_data: ""
        }]);

        // Burn the asset.
        await atomicassets.actions.burnasset([
            user1.name.toString(),
            assetId
        ]).send(`${user1.name.toString()}@active`);

        // Asset gone.
        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);

        // Backed tokens credited back to the owner's balance row.
        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["75.00000000 WAX"]
        }]);
    });
});
