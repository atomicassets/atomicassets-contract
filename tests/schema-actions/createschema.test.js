const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test createschema contract', () => {
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
    });

    test("create minimal schema", async () => {
        await atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", type: "string"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        const collection_schemas = atomicassets.tables.schemas(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_schemas).toEqual([{
            schema_name: "testschema",
            format: [
                {name: "name", type: "string"}
            ]
        }]);
    });

    test("create bigger schema", async () => {
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

        const collection_schemas = atomicassets.tables.schemas(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_schemas).toEqual([{
            schema_name: "testschema",
            format: [
                {name: "name", type: "string"},
                {name: "level", type: "uint32"},
                {name: "img", type: "ipfs"}
            ]
        }]);
    });

    test("throw when format is empty", async () => {
        await expect(atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow(`A format line with {\"name\": \"name\" and \"type\": \"string\"} needs to be defined`);
    });

    test("throw when name attribute is not defined", async () => {
        await expect(atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow(`A format line with {\"name\": \"name\" and \"type\": \"string\"} needs to be defined`);
    });

    test("create schema with a name that already exists in another collection", async () => {
        // Create another collection first to test schema name collision
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect2",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create schema in testcollect2
        await atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect2",
            "testschema",
            [
                {name: "name", type: "string"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Create schema with same name in testcollect1 - should work
        await atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", type: "string"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        const collection_schemas = atomicassets.tables.schemas(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_schemas).toEqual([{
            schema_name: "testschema",
            format: [
                {name: "name", type: "string"}
            ]
        }]);
    });

    test("throw when schema with this name already exists in collection", async () => {
        // Create schema first
        await atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", type: "string"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Try to create schema with same name - should fail
        await expect(atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", type: "string"}
            ]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("A schema with this name already exists for this collection");
    });

    test("throw when collection does not exist", async () => {
        await expect(atomicassets.actions.createschema([
            user1.name.toString(),
            "nocol",
            "testschema",
            [
                {name: "name", type: "string"}
            ]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("create schema as authorized account but not author", async () => {
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

        const collection_schemas = atomicassets.tables.schemas(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_schemas).toEqual([{
            schema_name: "testschema",
            format: [
                {name: "name", type: "string"}
            ]
        }]);
    });

    test("throw without authorization from authorized creator", async () => {
        await expect(atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", type: "string"}
            ]
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw when authorized_creator is not actually authorized", async () => {
        await expect(atomicassets.actions.createschema([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", type: "string"}
            ]
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("Missing authorization for this collection");
    });
});