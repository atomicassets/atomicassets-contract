const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test createoffer contract', () => {
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

    test("create offer 1 for 0", async () => {
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

        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([{
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
        expect(offers).toEqual([{
            offer_id: 1,
            sender: user1.name.toString(),
            recipient: user2.name.toString(),
            sender_asset_ids: ["1099511627776"],
            recipient_asset_ids: [],
            memo: "",
            ram_payer: user1.name.toString()
        }]);
    });

    test("create offer 0 for 1", async () => {
        expect.assertions(2);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            [],
            ["1099511627776"],
            ""
        ]).send(`${user1.name.toString()}@active`);

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
        expect(offers).toEqual([{
            offer_id: 1,
            sender: user1.name.toString(),
            recipient: user2.name.toString(),
            sender_asset_ids: [],
            recipient_asset_ids: ["1099511627776"],
            memo: "",
            ram_payer: user1.name.toString()
        }]);
    });

    test("create two equal offers 1 for 0", async () => {
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
            ["1099511627776"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([
            {
                offer_id: 1,
                sender: user1.name.toString(),
                recipient: user2.name.toString(),
                sender_asset_ids: ["1099511627776"],
                recipient_asset_ids: [],
                memo: "",
                ram_payer: user1.name.toString()
            },
            {
                offer_id: 2,
                sender: user1.name.toString(),
                recipient: user2.name.toString(),
                sender_asset_ids: ["1099511627776"],
                recipient_asset_ids: [],
                memo: "",
                ram_payer: user1.name.toString()
            }
        ]);
    });

    test("create offer 2 for 0", async () => {
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

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([{
            offer_id: 1,
            sender: user1.name.toString(),
            recipient: user2.name.toString(),
            sender_asset_ids: ["1099511627776", "1099511627777"],
            recipient_asset_ids: [],
            memo: "",
            ram_payer: user1.name.toString()
        }]);
    });

    test("create offer 0 for 2", async () => {
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            [],
            ["1099511627776", "1099511627777"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([{
            offer_id: 1,
            sender: user1.name.toString(),
            recipient: user2.name.toString(),
            sender_asset_ids: [],
            recipient_asset_ids: ["1099511627776", "1099511627777"],
            memo: "",
            ram_payer: user1.name.toString()
        }]);
    });

    test("create offer 2 for 2", async () => {
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

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            ["1099511627778", "1099511627779"],
            ""
        ]).send(`${user1.name.toString()}@active`);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([{
            offer_id: 1,
            sender: user1.name.toString(),
            recipient: user2.name.toString(),
            sender_asset_ids: ["1099511627776", "1099511627777"],
            recipient_asset_ids: ["1099511627778", "1099511627779"],
            memo: "",
            ram_payer: user1.name.toString()
        }]);
    });

    test("create offer with assets of different collections", async () => {
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

        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([{
            offer_id: 1,
            sender: user1.name.toString(),
            recipient: user2.name.toString(),
            sender_asset_ids: ["1099511627776", "1099511627777"],
            recipient_asset_ids: [],
            memo: "",
            ram_payer: user1.name.toString()
        }]);
    });

    test("create offer with memo", async () => {
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
            ["1099511627776"],
            [],
            "This is an example memo"
        ]).send(`${user1.name.toString()}@active`);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([{
            offer_id: 1,
            sender: user1.name.toString(),
            recipient: user2.name.toString(),
            sender_asset_ids: ["1099511627776"],
            recipient_asset_ids: [],
            memo: "This is an example memo",
            ram_payer: user1.name.toString()
        }]);
    });

    test("create offer with asset that has a template", async () => {
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

        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([{
            offer_id: 1,
            sender: user1.name.toString(),
            recipient: user2.name.toString(),
            sender_asset_ids: ["1099511627776"],
            recipient_asset_ids: [],
            memo: "",
            ram_payer: user1.name.toString()
        }]);
    });

    test("throw when sender does not own one of the assets", async () => {
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

        await expect(atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Offer sender doesn't own at least one of the provided assets");
    });

    test("throw when recipient does not own one of the assets", async () => {
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            [],
            ["1099511627776", "1099511627777"],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Offer recipient doesn't own at least one of the provided assets");
    });

    test("throw when one of sender's assets is not transferable", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            false,
            true,
            0,
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

        await expect(atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("At least one asset isn't transferable");
    });

    test("throw when one of recipient's assets is not transferable", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            false,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            [],
            ["1099511627776", "1099511627777"],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("At least one asset isn't transferable");
    });

    test("throw when recipient account does not exist", async () => {
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

        await expect(atomicassets.actions.createoffer([
            user1.name.toString(),
            "noaccount",
            [],
            ["1099511627776"],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The recipient account deos not exist");
    });

    test("throw when sender and recipient is the same account", async () => {
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

        await expect(atomicassets.actions.createoffer([
            user1.name.toString(),
            user1.name.toString(),
            ["1099511627776"],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can't send an offer to yourself");
    });

    test("throw when the offer is empty on both sides", async () => {
        await expect(atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            [],
            [],
            ""
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can't create an empty offer");
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

        await expect(atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            [],
            "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor " +
                "invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et " +
                "accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata s"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("An offer memo can only be 256 characters max");
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

        await expect(atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776"],
            [],
            ""
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});