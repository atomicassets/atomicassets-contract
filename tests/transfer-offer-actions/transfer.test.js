const { Blockchain, nameToBigInt, mintTokens } = require("@vaulta/vert");
const { Name } = require('@wharfkit/antelope');
const fs = require('fs');

describe('test transfer contract', () => {
    let blockchain;
    let atomicassets;
    let user1;
    let user2;

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

    test("transfer basic asset", async () => {
        expect.assertions(2);

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

        await atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);

        const user2_assets = atomicassets.tables.assets(nameToBigInt(user2.name)).getTableRows();
        expect(user2_assets).toEqual([{
            asset_id: "1099511627776",
            collection_name: "testcollect1",
            schema_name: "testschema",
            template_id: -1,
            ram_payer: user1.name.toString(),
            backed_tokens: [],
            immutable_serialized_data: '',
            mutable_serialized_data: ''
        }]);
    });

    test("transfer multiple basic assets", async () => {
        expect.assertions(2);

        // Mint 3 assets
        for (let i = 0; i < 3; i++) {
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
        }

        await atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([{
            asset_id: "1099511627778",
            collection_name: "testcollect1",
            schema_name: "testschema",
            template_id: -1,
            ram_payer: user1.name.toString(),
            backed_tokens: [],
            immutable_serialized_data: '',
            mutable_serialized_data: ''
        }]);

        const user2_assets = atomicassets.tables.assets(nameToBigInt(user2.name)).getTableRows();
        expect(user2_assets).toEqual([
            {
                asset_id: "1099511627776",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: '',
                mutable_serialized_data: ''
            },
            {
                asset_id: "1099511627777",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: '',
                mutable_serialized_data: ''
            }
        ]);
    });

    test("transfer multiple assets of different collections", async () => {
        expect.assertions(2);

        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect2",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect2",
            "testschema2",
            [
                {name: "name", type: "string"},
                {name: "level", type: "uint32"},
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user1.name.toString()}@active`);

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

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect2",
            "testschema2",
            -1,
            user1.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);

        const user2_assets = atomicassets.tables.assets(nameToBigInt(user2.name)).getTableRows();
        expect(user2_assets).toEqual([
            {
                asset_id: "1099511627776",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: '',
                mutable_serialized_data: ''
            },
            {
                asset_id: "1099511627777",
                collection_name: "testcollect2",
                schema_name: "testschema2",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: '',
                mutable_serialized_data: ''
            }
        ]);
    });

    test("transfer with a memo", async () => {
        expect.assertions(2);

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

        await atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            "This is an example memo!"
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);

        const user2_assets = atomicassets.tables.assets(nameToBigInt(user2.name)).getTableRows();
        expect(user2_assets).toEqual([
            {
                asset_id: "1099511627776",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: '',
                mutable_serialized_data: ''
            }
        ]);
    });

    test("transfer assets with a template", async () => {
        expect.assertions(2);

        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

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

        await atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);

        const user2_assets = atomicassets.tables.assets(nameToBigInt(user2.name)).getTableRows();
        expect(user2_assets).toEqual([
            {
                asset_id: "1099511627776",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: 1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: '',
                mutable_serialized_data: ''
            }
        ]);
    });

    test("transfer assets with data", async () => {
        expect.assertions(2);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user1.name.toString(),
            [{"first": "name", "second": ["string", "Tom"]}],
            [{"first": "level", "second": ["uint32", 100]}],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);

        const user2_assets = atomicassets.tables.assets(nameToBigInt(user2.name)).getTableRows();
        expect(user2_assets).toEqual([
            {
                asset_id: "1099511627776",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: '0403546f6d',
                mutable_serialized_data: '0564'
            }
        ]);
    });

    test("throw when transferring the same asset multiple times", async () => {
        // Mint 2 assets
        for (let i = 0; i < 2; i++) {
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
        }

        await expect(atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777", "1099511627777"],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can't transfer the same asset multiple times");
    });

    test("throw when the sender does not own at least one of the assets", async () => {
        // Mint only one asset
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

        await expect(atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"], // Trying to transfer non-existent asset
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Sender doesn't own at least one of the provided assets");
    });

    test("throw when at least one asset is not transferable", async () => {
        // Create a non-transferable template
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            false, // transferable = false
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Mint one asset without template (transferable)
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

        // Mint one asset with non-transferable template
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

        await expect(atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("At least one asset isn't transferable");
    });

    test.skip("throw when to account does not exist", async () => {
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

        await expect(atomicassets.actions.transfer([
            user1.name.toString(),
            "noaccount",
            ["1099511627776"],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("to account does not exist");
    });

    test("throw when to and from is the same", async () => {
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

        await expect(atomicassets.actions.transfer([
            user1.name.toString(),
            user1.name.toString(),
            ["1099511627776"],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can't transfer assets to yourself");
    });

    test("throw when asset_ids vector is empty", async () => {
        await expect(atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            [],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("asset_ids needs to contain at least one id");
    });

    test("throw when memo is over 256 chars", async () => {
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

        await expect(atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor " +
            "invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et " +
            "accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata s"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("A transfer memo can only be 256 characters max");
    });

    test("throw without authorization from sender", async () => {
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

        await expect(atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            ""
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("transfer asset with holder record - transfer to holder deletes holder entry", async () => {
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

        // Move asset from owner (user1) to holder (user2) using move action
        await atomicassets.actions.move([
            user1.name.toString(), // owner
            user1.name.toString(), // from (owner)
            user2.name.toString(), // to (new holder)
            ["1099511627776"],
            'Create holder relationship for transfer test'
        ]).send(`${user1.name.toString()}@owner`);

        // Verify holder record exists
        let holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(1);
        expect(holders[0]).toMatchObject({
            asset_id: "1099511627776",
            owner: user1.name.toString(),
            holder: user2.name.toString()
        });

        // Transfer asset from owner (user1) to the current holder (user2)
        // This should delete the holder record since we're transferring to the holder
        await atomicassets.actions.transfer([
            user1.name.toString(), // from (owner)
            user2.name.toString(), // to (current holder)
            ["1099511627776"],
            "Transfer to current holder"
        ]).send(`${user1.name.toString()}@active`);

        // Verify holder record was deleted
        holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(0);

        // Verify asset is now owned by user2
        const user2_assets = atomicassets.tables.assets(nameToBigInt(user2.name)).getTableRows();
        expect(user2_assets).toHaveLength(1);
        expect(user2_assets[0].asset_id).toBe("1099511627776");
    });

    test("transfer asset with holder record - transfer to new owner updates holder ownership", async () => {
        const user3 = blockchain.createAccount('user3');

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
            'Create holder relationship for transfer test'
        ]).send(`${user1.name.toString()}@owner`);

        // Verify initial holder record
        let holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(1);
        expect(holders[0]).toMatchObject({
            asset_id: "1099511627776",
            owner: user1.name.toString(),
            holder: user2.name.toString()
        });

        // Transfer asset from owner (user1) to new owner (user3)
        // This should update the holder record to show user3 as the new owner
        await atomicassets.actions.transfer([
            user1.name.toString(), // from (current owner)
            user3.name.toString(), // to (new owner)
            ["1099511627776"],
            "Transfer to new owner while held by someone else"
        ]).send(`${user1.name.toString()}@active`);

        // Verify holder record was updated with new ownership
        holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(1);
        expect(holders[0]).toMatchObject({
            asset_id: "1099511627776",
            owner: user3.name.toString(), // updated to new owner
            holder: user2.name.toString()  // holder remains the same
        });

        // Verify asset is now owned by user3
        const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
        expect(user3_assets).toHaveLength(1);
        expect(user3_assets[0].asset_id).toBe("1099511627776");
    });

    test("transfer asset without holder record - no holder table interactions", async () => {
        // Mint asset for user1 (no holder relationship created)
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

        // Verify no holder records exist initially
        let holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(0);

        // Transfer asset normally (owner to new owner, no holder involved)
        await atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            "Normal transfer without holder"
        ]).send(`${user1.name.toString()}@active`);

        // Verify still no holder records (normal transfer case)
        holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(0);

        // Verify asset was transferred successfully
        const user2_assets = atomicassets.tables.assets(nameToBigInt(user2.name)).getTableRows();
        expect(user2_assets).toHaveLength(1);
        expect(user2_assets[0].asset_id).toBe("1099511627776");
    });

    test("transfer multiple assets with mixed holder scenarios", async () => {
        const user3 = blockchain.createAccount('user3');

        // Mint two assets for user1
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

        // Create holder relationship for first asset only
        await atomicassets.actions.move([
            user1.name.toString(), // owner
            user1.name.toString(), // from (owner)
            user2.name.toString(), // to (new holder)
            ["1099511627776"], // only first asset
            'Create holder for first asset only'
        ]).send(`${user1.name.toString()}@owner`);

        // Verify only one holder record exists
        let holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(1);
        expect(holders[0].asset_id).toBe("1099511627776");

        // Transfer both assets to user3
        // First asset has holder (should update ownership)
        // Second asset has no holder (normal transfer)
        await atomicassets.actions.transfer([
            user1.name.toString(),
            user3.name.toString(),
            ["1099511627776", "1099511627777"],
            "Transfer assets with mixed holder scenarios"
        ]).send(`${user1.name.toString()}@active`);

        // Verify holder record was updated for first asset
        holders = atomicassets.tables.holders(nameToBigInt(atomicassets.name)).getTableRows();
        expect(holders).toHaveLength(1);
        expect(holders[0]).toMatchObject({
            asset_id: "1099511627776",
            owner: user3.name.toString(), // ownership updated
            holder: user2.name.toString()  // holder unchanged
        });

        // Verify both assets are now owned by user3
        const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
        expect(user3_assets).toHaveLength(2);
        expect(user3_assets.map(a => a.asset_id).sort()).toEqual(["1099511627776", "1099511627777"]);
    });
});