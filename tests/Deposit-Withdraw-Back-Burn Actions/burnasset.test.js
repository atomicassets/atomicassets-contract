const { Blockchain, nameToBigInt, mintTokens } = require("@vaulta/vert");
const { Name } = require('@wharfkit/antelope');
const fs = require('fs');

describe("test burnasset contract", () => {
    let blockchain;
    let atomicassets;
    let user1, user2;

    beforeAll(async () => {
        blockchain = new Blockchain();
        atomicassets = blockchain.createContract(
            'atomicassets',
            './build/atomicassets'
        );
        user1 = blockchain.createAccount('user1');
        user2 = blockchain.createAccount('user2');
    });

    beforeEach(async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);

        // Create collection and schema with user1 as author
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString(), user2.name.toString()],
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

        // Add supported tokens
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.addconftoken([
            "karmatoken",
            "4,KARMA"
        ]).send(`${atomicassets.name.toString()}@active`);
    });

    test("burn basic asset", async () => {
        expect.assertions(2);

        // Mint basic asset without backed tokens
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

        await atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([]);
    });

    test("issued supply in template stays the same after burning", async () => {
        expect.assertions(2);

        // Create template
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,   // transferable
            true,   // burnable
            0,      // max_supply
            []      // immutable_data
        ]).send(`${user1.name.toString()}@active`);

        // Mint multiple assets to increase issued supply
        for (let i = 0; i < 5; i++) {
            await atomicassets.actions.mintasset([
                user1.name.toString(),
                "testcollect1",
                "testschema",
                1,
                user1.name.toString(),
                [],
                [],
                []
            ]).send(`${user1.name.toString()}@active`);
        }

        // Burn one asset
        await atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toHaveLength(4); // 4 assets remaining

        const testcol_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(testcol_templates).toEqual([{
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 0,
            issued_supply: 5,
            immutable_serialized_data: ""
        }]);
    });

    test("throw when asset does not exist", async () => {
        await expect(atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No asset with this id exists");
    });

    test("throw when asset is not burnable", async () => {
        // Create non-burnable template
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,   // transferable
            false,  // burnable = false
            0,      // max_supply
            []      // immutable_data
        ]).send(`${user1.name.toString()}@active`);

        // Mint asset with non-burnable template
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1,
            user1.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The asset is not burnable");
    });

    test("throw without authorization from asset owner", async () => {
        // Mint asset for user1
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

        // Try to burn with user2's authorization instead of user1's
        await expect(atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("burn asset with holder record deletes the holder entry", async () => {
        expect.assertions(3);

        // Mint asset for user1
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

        // Move asset from owner (user1) to holder (user2)
        await atomicassets.actions.move([
            user1.name.toString(), // owner
            user1.name.toString(), // from (owner)
            user2.name.toString(), // to (new holder)
            ["1099511627776"],
            'Move to holder for burning test'
        ]).send(`${user1.name.toString()}@owner`);

        // Verify holder record exists
        let holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(1);
        expect(holders[0]).toMatchObject({
            asset_id: "1099511627776",
            owner: user1.name.toString(),
            holder: user2.name.toString()
        });

        // Burn the asset (owner can burn even when held by someone else)
        await atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`);

        // Verify holder record was deleted along with the asset
        holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(0);
    });
});