const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test extendschema contract', () => {
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

        // Create test collection
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create test schema
        await atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", type: "string"}
            ]
        ]).send(`${user1.name.toString()}@active`);
    });

    test("extend schema by one attribute", async () => {
        await atomicassets.actions.extendschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        const collection_schemas = atomicassets.tables.schemas(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_schemas).toEqual([{
            schema_name: "testschema",
            format: [
                {name: "name", type: "string"},
                {name: "img", type: "ipfs"}
            ]
        }]);
    });

    test("extend schema by multiple attributes", async () => {
        await atomicassets.actions.extendschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", type: "ipfs"},
                {name: "level", type: "uint16"},
                {name: "gender", type: "string"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        const collection_schemas = atomicassets.tables.schemas(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_schemas).toEqual([{
            schema_name: "testschema",
            format: [
                {name: "name", type: "string"},
                {name: "img", type: "ipfs"},
                {name: "level", type: "uint16"},
                {name: "gender", type: "string"}
            ]
        }]);
    });

    test("throw when format extension is empty", async () => {
        await expect(atomicassets.actions.extendschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Need to add at least one new line");
    });

    test("throw when collection does not exist", async () => {
        await expect(atomicassets.actions.extendschema([
            user1.name.toString(),
            "nocol",
            "testschema",
            [
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw when schema does not exist in collection", async () => {
        await expect(atomicassets.actions.extendschema([
            user1.name.toString(),
            "testcollect1",
            "noschema",
            [
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No schema with this name exists for this collection");
    });

    test("extend schema as authorized account but not author", async () => {
        // Reset and create collection with user2 as authorized account
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
                {name: "name", type: "string"}
            ]
        ]).send(`${user2.name.toString()}@active`);

        await atomicassets.actions.extendschema([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user2.name.toString()}@active`);

        const collection_schemas = atomicassets.tables.schemas(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_schemas).toEqual([{
            schema_name: "testschema",
            format: [
                {name: "name", type: "string"},
                {name: "img", type: "ipfs"}
            ]
        }]);
    });

    test("throw without authorization from authorized editor", async () => {
        await expect(atomicassets.actions.extendschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw when authorized_editor is not actually authorized", async () => {
        await expect(atomicassets.actions.extendschema([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("The editor is not authorized within the collection");
    });
});