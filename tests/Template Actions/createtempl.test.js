const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test createtempl contract', () => {
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

    test("create minimal template", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        const collection_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_templates).toEqual([{
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 0,
            issued_supply: 0,
            immutable_serialized_data: ''
        }]);
    });

    test("create two minimal templates", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        const collection_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_templates).toEqual([
            {
                template_id: 1,
                schema_name: "testschema",
                transferable: true,
                burnable: true,
                max_supply: 0,
                issued_supply: 0,
                immutable_serialized_data: ''
            },
            {
                template_id: 2,
                schema_name: "testschema",
                transferable: true,
                burnable: true,
                max_supply: 0,
                issued_supply: 0,
                immutable_serialized_data: ''
            }
        ]);
    });

    test("create template with data", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            [
                {"first": "name", "second": ["string", "Tom"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        const collection_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_templates).toEqual([{
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 0,
            issued_supply: 0,
            immutable_serialized_data: '0403546f6d'
        }]);
    });

    test("create template with max supply / non transferable / non burnable", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            false,
            false,
            10,
            []
        ]).send(`${user1.name.toString()}@active`);

        const collection_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_templates).toEqual([{
            template_id: 1,
            schema_name: "testschema",
            transferable: false,
            burnable: false,
            max_supply: 10,
            issued_supply: 0,
            immutable_serialized_data: ''
        }]);
    });

    test("throw when collection does not exist", async () => {
        await expect(atomicassets.actions.createtempl([
            user1.name.toString(),
            "nocol",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw when schema does not exist in collection", async () => {
        await expect(atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "noschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No schema with this name exists");
    });

    test("create template as authorized account but not author", async () => {
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

        await atomicassets.actions.createtempl([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user2.name.toString()}@active`);

        const collection_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_templates).toEqual([{
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 0,
            issued_supply: 0,
            immutable_serialized_data: ''
        }]);
    });

    test("throw without authorization from authorized creator", async () => {
        await expect(atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw when authorized_creator is not actually authorized", async () => {
        await expect(atomicassets.actions.createtempl([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("The creator is not authorized within the collection");
    });
});