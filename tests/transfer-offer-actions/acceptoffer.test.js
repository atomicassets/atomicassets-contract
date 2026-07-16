const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test acceptoffer contract', () => {
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
            "testcollect1", // 12 characters as required
            true,
            [user1.name.toString(), user2.name.toString()], // Add both users to authorized_accounts
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


    test("accept offer 1 for 0", async () => {
        expect.assertions(3);

        // Create asset for user1
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

        // Create offer from user1 to user2 for asset 1099511627776
        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        // Accept the offer
        await atomicassets.actions.acceptoffer([1]).send(`${user2.name.toString()}@active`);

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
            immutable_serialized_data: "",
            mutable_serialized_data: ""
        }]);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([]);
    });

    test("accept offer 0 for 1", async () => {
        expect.assertions(3);

        // Create asset for user2
        await atomicassets.actions.mintasset([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user2.name.toString()}@active`);

        // Create offer from user1 to user2 requesting asset 1099511627776 from user2
        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            [],
            ["1099511627776"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        // Accept the offer
        await atomicassets.actions.acceptoffer([1]).send(`${user2.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([{
            asset_id: "1099511627776",
            collection_name: "testcollect1",
            schema_name: "testschema",
            template_id: -1,
            ram_payer: user2.name.toString(),
            backed_tokens: [],
            immutable_serialized_data: "",
            mutable_serialized_data: ""
        }]);

        const user2_assets = atomicassets.tables.assets(nameToBigInt(user2.name)).getTableRows();
        expect(user2_assets).toEqual([]);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([]);
    });

    test("accept offer 2 for 0", async () => {
        expect.assertions(3);

        // Create two assets for user1
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

        // Create offer from user1 to user2 for both assets
        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        // Accept the offer
        await atomicassets.actions.acceptoffer([1]).send(`${user2.name.toString()}@active`);

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
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            },
            {
                asset_id: "1099511627777",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            }
        ]);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([]);
    });

    test("accept offer 0 for 2", async () => {
        expect.assertions(3);

        // Create two assets for user2
        await atomicassets.actions.mintasset([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user2.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user2.name.toString()}@active`);

        // Create offer from user1 to user2 requesting both assets from user2
        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            [],
            ["1099511627776", "1099511627777"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        // Accept the offer
        await atomicassets.actions.acceptoffer([1]).send(`${user2.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([
            {
                asset_id: "1099511627776",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user2.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            },
            {
                asset_id: "1099511627777",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user2.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            }
        ]);

        const user2_assets = atomicassets.tables.assets(nameToBigInt(user2.name)).getTableRows();
        expect(user2_assets).toEqual([]);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([]);
    });

    test("accept offer 2 for 2", async () => {
        expect.assertions(3);

        // Create two assets for user1
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

        // Create two assets for user2
        await atomicassets.actions.mintasset([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user2.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user2.name.toString()}@active`);

        // Create offer from user1 to user2 for 2 assets each
        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            ["1099511627778", "1099511627779"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        // Accept the offer
        await atomicassets.actions.acceptoffer([1]).send(`${user2.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([
            {
                asset_id: "1099511627778",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user2.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            },
            {
                asset_id: "1099511627779",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user2.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            }
        ]);

        const user2_assets = atomicassets.tables.assets(nameToBigInt(user2.name)).getTableRows();
        expect(user2_assets).toEqual([
            {
                asset_id: "1099511627776",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            },
            {
                asset_id: "1099511627777",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            }
        ]);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([]);
    });

    test("accept offer with assets from different collections", async () => {
        expect.assertions(3);

        // Create second collection
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect2", // 12 characters as required
            true,
            [user1.name.toString(), user2.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create schema for second collection
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

        // Create assets in different collections
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

        // Create offer with assets from different collections
        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        // Accept the offer
        await atomicassets.actions.acceptoffer([1]).send(`${user2.name.toString()}@active`);

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
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            },
            {
                asset_id: "1099511627777",
                collection_name: "testcollect2",
                schema_name: "testschema2",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            }
        ]);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([]);
    });

    test("accept offer with asset that has a template", async () => {
        expect.assertions(3);

        // Create template first
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create asset without template
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

        // Create asset with template
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

        // Create offer with both assets
        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        // Accept the offer
        await atomicassets.actions.acceptoffer([1]).send(`${user2.name.toString()}@active`);

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
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            },
            {
                asset_id: "1099511627777",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: 1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: "",
                mutable_serialized_data: ""
            }
        ]);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([]);
    });

    test("throw when sender does not own one of the assets", async () => {
        // Create only one asset for user1
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

        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.transfer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        // Try to create offer with asset that user1 doesn't own (1099511627777)
        await expect(atomicassets.actions.acceptoffer([1]).send(`${user2.name.toString()}@active`)).rejects.toThrow("Offer sender doesn't own at least one of the provided assets");
    });

    test("throw when recipient does not own one of the assets", async () => {
        // Create only one asset for user2
        await atomicassets.actions.mintasset([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user2.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user2.name.toString()}@active`);

        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            [],
            ["1099511627776", "1099511627777"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.transfer([
            user2.name.toString(),
            user1.name.toString(),
            ["1099511627776"],
            ""
        ]).send(`${user2.name.toString()}@active`);

        // Try to create offer with asset that user1 doesn't own (1099511627777)
        await expect(atomicassets.actions.acceptoffer([1]).send(`${user2.name.toString()}@active`)).rejects.toThrow("Offer recipient doesn't own at least one of the provided assets");
    });

    test("throw without authorization from recipient", async () => {
        // Create asset for user1
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

        // Create offer from user1 to user2
        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        // Try to accept offer with wrong authorization (user1 instead of user2)
        await expect(atomicassets.actions.acceptoffer([1]).send(`${user1.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw when offer doesn't exist", async () => {
        // Try to accept non-existent offer
        await expect(atomicassets.actions.acceptoffer([999]).send(`${user2.name.toString()}@active`)).rejects.toThrow("No offer with this id exists");
    });

    test("throw when offer has already been accepted", async () => {
        // Create asset for user1
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

        // Create offer from user1 to user2
        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        // Accept the offer
        await atomicassets.actions.acceptoffer([1]).send(`${user2.name.toString()}@active`);

        // Try to accept the same offer again
        await expect(atomicassets.actions.acceptoffer([1]).send(`${user2.name.toString()}@active`)).rejects.toThrow("No offer with this id exists");
    });

});
