const { Blockchain, nameToBigInt, mintTokens, bigIntToName } = require("@vaulta/vert");
const { Name } = require('@wharfkit/antelope');
const fs = require('fs');

describe('test move asset', () => {
    let blockchain;
    let eosioToken;
    let atomicassets;
    let user1;
    let user2;
    let user3;

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
        await mintTokens(eosioToken, 'EOS', 4, 1000000000, 10000, [user1, user2, user3]);

        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
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

    test("throw if missing owner permission", async () => {
        await expect(atomicassets.actions.move([
            user1.name.toString(),
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            ''
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow('missing required authority user1');
    });

    test("throw if from account does not exist", async () => {
        await expect(atomicassets.actions.move([
            user1.name.toString(),
            "nonexistent",
            user2.name.toString(),
            ["1099511627776"],
            ''
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow('from account does not exist');
    });

    test("throw if to account does not exist", async () => {
        await expect(atomicassets.actions.move([
            user1.name.toString(),
            user1.name.toString(),
            "nonexistent",
            ["1099511627776"],
            ''
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow('to account does not exist');
    });

    test("throw if from and to are the same", async () => {
        await expect(atomicassets.actions.move([
            user1.name.toString(),
            user1.name.toString(),
            user1.name.toString(),
            ["1099511627776"],
            ''
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow('from & to fields cannot be the same');
    });

    test("throw if asset_ids is empty", async () => {
        await expect(atomicassets.actions.move([
            user1.name.toString(),
            user1.name.toString(),
            user2.name.toString(),
            [],
            ''
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow('asset_ids needs to contain at least one id');
    });

    test("throw if memo is too long", async () => {
        const longMemo = 'a'.repeat(257); // 257 characters > 256 limit
        await expect(atomicassets.actions.move([
            user1.name.toString(),
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            longMemo
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow('A move memo can only be 256 characters max');
    });

    test("throw if duplicate asset IDs provided", async () => {
        await expect(atomicassets.actions.move([
            user1.name.toString(),
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627776"],
            ''
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can't move the same asset multiple times");
    });

    test("throw if owner doesn't own the asset", async () => {
        // Create template and mint asset to user2
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,     // max_supply (unlimited)
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1,
            user2.name.toString(), // mint to user2
            [], // immutable_data
            [], // mutable_data
            []  // tokens_to_back
        ]).send(`${user1.name.toString()}@active`);

        // user1 tries to move asset they don't own
        await expect(atomicassets.actions.move([
            user1.name.toString(), // user1 claims ownership
            user2.name.toString(), // from user2
            user3.name.toString(), // to user3
            ["1099511627776"],
            ''
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Owner doesn't own at least one of the provided assets");
    });

    test("throw if asset is not transferable", async () => {
        // Create non-transferable template and mint asset
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            false, // not transferable
            true,  // burnable
            0,     // max_supply (unlimited)
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1, // template_id: 1 (non-transferable)
            user1.name.toString(),
            [], // immutable_data
            [], // mutable_data
            []  // tokens_to_back
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.move([
            user1.name.toString(),
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"], // asset_id of first minted asset
            ''
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("At least one asset isn't transferable");
    });

    test("throw if holder constraint violated", async () => {
        // Create template and mint asset
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,     // max_supply (unlimited)
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1, // template_id: 1
            user1.name.toString(),
            [], // immutable_data
            [], // mutable_data
            []  // tokens_to_back
        ]).send(`${user1.name.toString()}@active`);

        // First move from owner (user1) to holder (user2)
        await atomicassets.actions.move([
            user1.name.toString(), // owner
            user1.name.toString(), // from (owner)
            user2.name.toString(), // to (new holder)
            ["1099511627776"],
            'Initial move to holder'
        ]).send(`${user1.name.toString()}@active`);

        // Try to move from wrong holder (user3 instead of user2)
        await expect(atomicassets.actions.move([
            user1.name.toString(), // owner
            user3.name.toString(), // from (wrong holder)
            user1.name.toString(), // to (back to owner)
            ["1099511627776"],
            'Wrong holder attempt'
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("At least one asset invalidates the 'from:holder' constraint");
    });

    test("successfully move asset from owner to holder", async () => {
        // Create template and mint asset
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,     // max_supply (unlimited)
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1, // template_id: 1
            user1.name.toString(),
            [], // immutable_data
            [], // mutable_data
            []  // tokens_to_back
        ]).send(`${user1.name.toString()}@active`);

        // Move from owner to holder
        await expect(atomicassets.actions.move([
            user1.name.toString(), // owner
            user1.name.toString(), // from (owner)
            user2.name.toString(), // to (new holder)
            ["1099511627776"],
            'Move to holder'
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify holder entry was created
        const holdersTable = atomicassets.tables.holders(nameToBigInt(atomicassets.name));
        const holderEntry = holdersTable.getTableRow('1099511627776');
        expect(holderEntry).toBeDefined();
        expect(holderEntry.owner).toBe(user1.name.toString());
        expect(holderEntry.holder).toBe(user2.name.toString());

        const expectLogmoveAction = blockchain.executionTraces[1];
        expect(expectLogmoveAction.contract.toString()).toBe(atomicassets.name.toString());
        expect(expectLogmoveAction.action.toString()).toBe('logmove');
        expect(expectLogmoveAction.data.collection_name.toString()).toBe('testcollect1');
        expect(expectLogmoveAction.data.owner.toString()).toBe(user1.name.toString());
        expect(expectLogmoveAction.data.from.toString()).toBe(user1.name.toString());
        expect(expectLogmoveAction.data.to.toString()).toBe(user2.name.toString());
        expect(expectLogmoveAction.data.asset_ids.length).toBe(1);
        expect(expectLogmoveAction.data.asset_ids[0].toString()).toBe("1099511627776");
        expect(expectLogmoveAction.data.memo).toBe('Move to holder');
    });

    test("successfully move asset between holders", async () => {
        // Create template and mint asset
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,     // max_supply (unlimited)
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1, // template_id: 1
            user1.name.toString(),
            [], // immutable_data
            [], // mutable_data
            []  // tokens_to_back
        ]).send(`${user1.name.toString()}@active`);

        // First move from owner to holder
        await atomicassets.actions.move([
            user1.name.toString(), // owner
            user1.name.toString(), // from (owner)
            user2.name.toString(), // to (new holder)
            ["1099511627776"],
            'Initial move to holder'
        ]).send(`${user1.name.toString()}@active`);

        // Move between holders
        await expect(atomicassets.actions.move([
            user1.name.toString(), // owner
            user2.name.toString(), // from (current holder)
            user3.name.toString(), // to (new holder)
            ["1099511627776"],
            'Move between holders'
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify holder entry was updated
        const holdersTable = atomicassets.tables.holders(nameToBigInt(atomicassets.name));
        const holderEntry = holdersTable.getTableRow('1099511627776');
        expect(holderEntry).toBeDefined();
        expect(holderEntry.owner).toBe(user1.name.toString());
        expect(holderEntry.holder).toBe(user3.name.toString());
    });

    test("successfully move asset from holder back to owner", async () => {
        // Create template and mint asset
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,     // max_supply (unlimited)
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1, // template_id: 1
            user1.name.toString(),
            [], // immutable_data
            [], // mutable_data
            []  // tokens_to_back
        ]).send(`${user1.name.toString()}@active`);

        // First move from owner to holder
        await atomicassets.actions.move([
            user1.name.toString(), // owner
            user1.name.toString(), // from (owner)
            user2.name.toString(), // to (new holder)
            ["1099511627776"],
            'Initial move to holder'
        ]).send(`${user1.name.toString()}@active`);

        // Move back to owner
        await expect(atomicassets.actions.move([
            user1.name.toString(), // owner
            user2.name.toString(), // from (current holder)
            user1.name.toString(), // to (back to owner)
            ["1099511627776"],
            'Return to owner'
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify holder entry was deleted
        const holdersTable = atomicassets.tables.holders(nameToBigInt(atomicassets.name));
        const holderEntry = holdersTable.getTableRow('1099511627776');
        expect(holderEntry).toBeUndefined();
    });

    test("successfully move multiple assets", async () => {
        // Create template and mint multiple assets
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,     // max_supply (unlimited)
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1, // template_id: 1
            user1.name.toString(),
            [], // immutable_data
            [], // mutable_data
            []  // tokens_to_back
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1, // template_id: 1
            user1.name.toString(),
            [], // immutable_data
            [], // mutable_data
            []  // tokens_to_back
        ]).send(`${user1.name.toString()}@active`);

        // Move multiple assets
        await expect(atomicassets.actions.move([
            user1.name.toString(), // owner
            user1.name.toString(), // from (owner)
            user2.name.toString(), // to (new holder)
            ["1099511627776", "1099511627777"], // multiple assets
            'Move multiple assets'
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify both holder entries were created
        const holdersTable = atomicassets.tables.holders(nameToBigInt(atomicassets.name));
        const holderEntry1 = holdersTable.getTableRow('1099511627776');
        const holderEntry2 = holdersTable.getTableRow('1099511627777');

        expect(holderEntry1).toBeDefined();
        expect(holderEntry1.owner).toBe(user1.name.toString());
        expect(holderEntry1.holder).toBe(user2.name.toString());

        expect(holderEntry2).toBeDefined();
        expect(holderEntry2.owner).toBe(user1.name.toString());
        expect(holderEntry2.holder).toBe(user2.name.toString());
    });

    test("throw if only owner can move from owner position", async () => {
        // Create template and mint asset
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,     // max_supply (unlimited)
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1, // template_id: 1
            user1.name.toString(),
            [], // immutable_data
            [], // mutable_data
            []  // tokens_to_back
        ]).send(`${user1.name.toString()}@active`);

        // user2 tries to move asset from user1 (owner) but user2 is not the owner
        await expect(atomicassets.actions.move([
            user1.name.toString(),
            user2.name.toString(), // should be user1
            user3.name.toString(), // to
            ["1099511627776"],
            'Unauthorized move attempt'
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Only the owner can move this asset");
    });

    test("accept memo up to 256 characters", async () => {
        // Create template and mint asset
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,     // max_supply (unlimited)
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1, // template_id: 1
            user1.name.toString(),
            [], // immutable_data
            [], // mutable_data
            []  // tokens_to_back
        ]).send(`${user1.name.toString()}@active`);

        const validMemo = 'a'.repeat(256); // Exactly 256 characters
        await expect(atomicassets.actions.move([
            user1.name.toString(),
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            validMemo
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();
    });
});