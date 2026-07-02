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
});