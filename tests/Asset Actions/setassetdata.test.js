const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test setassetdata contract', () => {
    let blockchain;
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
        user1 = blockchain.createAccount('user1');
        user2 = blockchain.createAccount('user2');
        user3 = blockchain.createAccount('user3');
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

    test("set data of asset that previously didnt have data", async () => {
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.setassetdata([
            user1.name.toString(),
            user3.name.toString(),
            "1099511627776",
            [
                {"first": "name", "second": ["string", "ABC"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
        expect(user3_assets).toEqual([{
            asset_id: "1099511627776",
            collection_name: "testcollect1",
            schema_name: "testschema",
            template_id: -1,
            ram_payer: user1.name.toString(),
            backed_tokens: [],
            immutable_serialized_data: '',
            mutable_serialized_data: '0403414243'
        }]);
    });

    test("overwrite data of asset that already has data", async () => {
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user3.name.toString(),
            [],
            [
                {"first": "name", "second": ["string", "ABC"]}
            ],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.setassetdata([
            user1.name.toString(),
            user3.name.toString(),
            "1099511627776",
            [
                {"first": "level", "second": ["uint32", 100]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
        expect(user3_assets).toEqual([{
            asset_id: "1099511627776",
            collection_name: "testcollect1",
            schema_name: "testschema",
            template_id: -1,
            ram_payer: user1.name.toString(),
            backed_tokens: [],
            immutable_serialized_data: '',
            mutable_serialized_data: '0564'
        }]);
    });

    test("erase data of asset that already has data", async () => {
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user3.name.toString(),
            [],
            [
                {"first": "name", "second": ["string", "ABC"]}
            ],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.setassetdata([
            user1.name.toString(),
            user3.name.toString(),
            "1099511627776",
            []
        ]).send(`${user1.name.toString()}@active`);

        const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
        expect(user3_assets).toEqual([{
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

    test("throw when asset does not exist", async () => {
        await expect(atomicassets.actions.setassetdata([
            user1.name.toString(),
            user3.name.toString(),
            "1099511627776",
            [
                {"first": "name", "second": ["string", "ABC"]}
            ]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No asset with this id exists");
    });

    test("set data as authorized account but not author", async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user2.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createschema([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", type: "string"},
                {name: "level", type: "uint32"},
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user2.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user2.name.toString()}@active`);

        await atomicassets.actions.setassetdata([
            user2.name.toString(),
            user3.name.toString(),
            "1099511627776",
            [
                {"first": "name", "second": ["string", "ABC"]}
            ]
        ]).send(`${user2.name.toString()}@active`);

        const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
        expect(user3_assets).toEqual([{
            asset_id: "1099511627776",
            collection_name: "testcollect1",
            schema_name: "testschema",
            template_id: -1,
            ram_payer: user2.name.toString(),
            backed_tokens: [],
            immutable_serialized_data: '',
            mutable_serialized_data: '0403414243'
        }]);
    });

    test("throw without authorization from authorized editor", async () => {
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.setassetdata([
            user1.name.toString(),
            user3.name.toString(),
            "1099511627776",
            [
                {"first": "name", "second": ["string", "ABC"]}
            ]
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw when authorized_editor is not actually authorized", async () => {
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.setassetdata([
            user2.name.toString(),
            user3.name.toString(),
            "1099511627776",
            [
                {"first": "name", "second": ["string", "ABC"]}
            ]
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("Missing authorization for this collection");
    });

});