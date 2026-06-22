const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test setschematyp contract', () => {
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
                {name: "name", type: "string"},
                {name: "level", type: "uint32"},
                {name: "img", type: "ipfs"},
                {name: "rarity", type: "string"}
            ]
        ]).send(`${user1.name.toString()}@active`);
    });

    test("successfully create new schema type", async () => {
        await expect(atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", mediatype: "image/png", info: "Character portrait"},
                {name: "rarity", mediatype: "text/plain", info: "Asset rarity level"}
            ]
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify schema type was created
        const schemaTypes = atomicassets.tables.schematypes(nameToBigInt("testcollect1")).getTableRows();
        expect(schemaTypes).toHaveLength(1);
        expect(schemaTypes[0]).toEqual({
            schema_name: "testschema",
            format_type: [
                {name: "img", mediatype: "image/png", info: "Character portrait"},
                {name: "rarity", mediatype: "text/plain", info: "Asset rarity level"}
            ]
        });
    });

    test("successfully modify existing schema type", async () => {
        // Create initial schema type
        await atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", mediatype: "image/jpg", info: "Old description"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Modify the schema type
        await expect(atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", mediatype: "image/png", info: "Updated description"},
                {name: "name", mediatype: "text/plain", info: "Asset name"}
            ]
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify schema type was modified
        const schemaTypes = atomicassets.tables.schematypes(nameToBigInt("testcollect1")).getTableRows();
        expect(schemaTypes).toHaveLength(1);
        expect(schemaTypes[0]).toEqual({
            schema_name: "testschema",
            format_type: [
                {name: "img", mediatype: "image/png", info: "Updated description"},
                {name: "name", mediatype: "text/plain", info: "Asset name"}
            ]
        });
    });

    test("successfully set empty schema type (clear existing)", async () => {
        // Create initial schema type
        await atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", mediatype: "image/png", info: "Test"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Clear schema type with empty array
        await expect(atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            []
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify schema type was cleared
        const schemaTypes = atomicassets.tables.schematypes(nameToBigInt("testcollect1")).getTableRows();
        expect(schemaTypes).toHaveLength(1);
        expect(schemaTypes[0]).toEqual({
            schema_name: "testschema",
            format_type: []
        });
    });

    test("throw if collection does not exist", async () => {
        await expect(atomicassets.actions.setschematyp([
            user1.name.toString(),
            "nonexistent",
            "testschema",
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw if schema does not exist", async () => {
        await expect(atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "nonexistent",
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Schema name not found within the collection");
    });

    test("throw if missing authorization", async () => {
        await expect(atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw if authorized_editor is not actually authorized", async () => {
        await expect(atomicassets.actions.setschematyp([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("Missing authorization for this collection");
    });

    test("throw if schema format type contains duplicate entries", async () => {
        await expect(atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", mediatype: "image/png", info: "First"},
                {name: "img", mediatype: "image/jpg", info: "Duplicate"}
            ]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Schema format type cannot contain duplicate entries");
    });

    test("throw if schema format type name doesn't match schema format", async () => {
        await expect(atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "nonexistent", mediatype: "text/plain", info: "Invalid attribute"}
            ]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No attribute in the Schema format matches the Schema format type of 'nonexistent'");
    });

    test("accept all valid schema format names", async () => {
        await expect(atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", mediatype: "text/plain", info: "Asset name"},
                {name: "level", mediatype: "text/plain", info: "Asset level"},
                {name: "img", mediatype: "image/png", info: "Asset image"},
                {name: "rarity", mediatype: "text/plain", info: "Asset rarity"}
            ]
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify all format types were set
        const schemaTypes = atomicassets.tables.schematypes(nameToBigInt("testcollect1")).getTableRows();
        expect(schemaTypes[0].format_type).toHaveLength(4);
        expect(schemaTypes[0].format_type.map(ft => ft.name).sort()).toEqual(["img", "level", "name", "rarity"]);
    });

    test("work with authorized account but not author", async () => {
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
                {name: "name", type: "string"},
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user2.name.toString()}@active`);

        // user2 should be able to set schema type as authorized account
        await expect(atomicassets.actions.setschematyp([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", mediatype: "image/png", info: "Test image"}
            ]
        ]).send(`${user2.name.toString()}@active`)).resolves.not.toThrow();

        const schemaTypes = atomicassets.tables.schematypes(nameToBigInt("testcollect1")).getTableRows();
        expect(schemaTypes).toHaveLength(1);
        expect(schemaTypes[0].format_type).toEqual([
            {name: "img", mediatype: "image/png", info: "Test image"}
        ]);
    });

    test("handle multiple schemas in same collection", async () => {
        // Create second schema
        await atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "schema2",
            [
                {name: "name", type: "string"},
                {name: "power", type: "uint32"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Set schema types for both schemas
        await atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "img", mediatype: "image/png", info: "First schema image"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "schema2",
            [
                {name: "power", mediatype: "text/plain", info: "Power level"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Verify both schema types exist
        const schemaTypes = atomicassets.tables.schematypes(nameToBigInt("testcollect1")).getTableRows();
        expect(schemaTypes).toHaveLength(2);

        const testschemaType = schemaTypes.find(st => st.schema_name === "testschema");
        const schema2Type = schemaTypes.find(st => st.schema_name === "schema2");

        expect(testschemaType.format_type).toEqual([
            {name: "img", mediatype: "image/png", info: "First schema image"}
        ]);

        expect(schema2Type.format_type).toEqual([
            {name: "power", mediatype: "text/plain", info: "Power level"}
        ]);
    });

    test("handle complex format types with various media types", async () => {
        await expect(atomicassets.actions.setschematyp([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", mediatype: "text/plain", info: "Asset name"},
                {name: "img", mediatype: "image/png", info: "PNG image file"},
                {name: "level", mediatype: "application/json", info: "Level data in JSON format"},
                {name: "rarity", mediatype: "text/html", info: "Rarity description with HTML"}
            ]
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        const schemaTypes = atomicassets.tables.schematypes(nameToBigInt("testcollect1")).getTableRows();
        expect(schemaTypes[0].format_type).toHaveLength(4);

        // Verify different media types
        const formatTypes = schemaTypes[0].format_type;
        expect(formatTypes.find(ft => ft.name === "name").mediatype).toBe("text/plain");
        expect(formatTypes.find(ft => ft.name === "img").mediatype).toBe("image/png");
        expect(formatTypes.find(ft => ft.name === "level").mediatype).toBe("application/json");
        expect(formatTypes.find(ft => ft.name === "rarity").mediatype).toBe("text/html");
    });
});