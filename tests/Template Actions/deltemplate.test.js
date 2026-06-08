const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test deltemplate contract', () => {
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
                {name: "img", type: "ipfs"}
            ]
        ]).send(`${user1.name.toString()}@active`);
    });

    test("successfully delete template with zero issued supply", async () => {
        // Create template
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            1000,  // max_supply
            []
        ]).send(`${user1.name.toString()}@active`);

        // Verify template exists
        let templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(1);
        expect(templates[0].template_id).toBe(1);
        expect(templates[0].issued_supply).toBe(0);

        // Delete the template
        await expect(atomicassets.actions.deltemplate([
            user1.name.toString(),
            "testcollect1",
            1
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify template was deleted
        templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(0);
    });

    test("successfully delete template with mutable data", async () => {
        // Create template with mutable data
        await atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            [
                {first: "name", second: ["string", "Test Template"]}
            ],
            [
                {first: "level", second: ["uint32", 1]},
                {first: "img", second: ["string", "QmHash123"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Verify template and mutable data exist
        let templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        let templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(1);
        expect(templates[0].immutable_serialized_data.length).toBeGreaterThan(0);
        expect(templateMutables).toHaveLength(1);
        expect(templateMutables[0].mutable_serialized_data.length).toBeGreaterThan(0);

        // Delete the template
        await expect(atomicassets.actions.deltemplate([
            user1.name.toString(),
            "testcollect1",
            1
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify both template and mutable data were deleted
        templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(0);
        expect(templateMutables).toHaveLength(0);
    });

    test("throw if collection does not exist", async () => {
        await expect(atomicassets.actions.deltemplate([
            user1.name.toString(),
            "nonexistent",
            1
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw if template does not exist", async () => {
        await expect(atomicassets.actions.deltemplate([
            user1.name.toString(),
            "testcollect1",
            999 // non-existent template ID
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No template with the specified id exists for the specified collection");
    });

    test("throw if missing authorization", async () => {
        // Create template
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Try to delete without proper authorization
        await expect(atomicassets.actions.deltemplate([
            user1.name.toString(),
            "testcollect1",
            1
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw if authorized_editor is not actually authorized", async () => {
        // Create template
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Try to delete with unauthorized editor
        await expect(atomicassets.actions.deltemplate([
            user2.name.toString(),
            "testcollect1",
            1
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("Missing authorization for this collection");
    });

    test("throw if template has issued assets", async () => {
        // Create template
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            1000,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Mint an asset from the template
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1, // template_id
            user1.name.toString(),
            [], // immutable_data
            [], // mutable_data
            []  // tokens_to_back
        ]).send(`${user1.name.toString()}@active`);

        // Verify template has issued supply > 0
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates[0].issued_supply).toBe(1);

        // Try to delete template with issued assets
        await expect(atomicassets.actions.deltemplate([
            user1.name.toString(),
            "testcollect1",
            1
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can't delete a template that has any assets issued");
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
                {name: "name", type: "string"}
            ]
        ]).send(`${user2.name.toString()}@active`);

        // Create template as authorized account
        await atomicassets.actions.createtempl([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user2.name.toString()}@active`);

        // user2 should be able to delete template as authorized account
        await expect(atomicassets.actions.deltemplate([
            user2.name.toString(),
            "testcollect1",
            1
        ]).send(`${user2.name.toString()}@active`)).resolves.not.toThrow();

        // Verify template was deleted
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(0);
    });

    test("delete specific template among multiple templates", async () => {
        // Create multiple templates
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            100,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            false,
            true,
            200,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            false,
            300,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Verify all templates exist
        let templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(3);

        // Delete middle template (ID 2)
        await atomicassets.actions.deltemplate([
            user1.name.toString(),
            "testcollect1",
            2
        ]).send(`${user1.name.toString()}@active`);

        // Verify only template 2 was deleted
        templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(2);
        expect(templates.find(t => t.template_id === 1)).toBeDefined();
        expect(templates.find(t => t.template_id === 2)).toBeUndefined();
        expect(templates.find(t => t.template_id === 3)).toBeDefined();
    });

    test("delete template without mutable data does not affect template_mutables table", async () => {
        // Create template without mutable data
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Verify no mutable data exists
        let templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(0);

        // Delete the template
        await atomicassets.actions.deltemplate([
            user1.name.toString(),
            "testcollect1",
            1
        ]).send(`${user1.name.toString()}@active`);

        // Verify template was deleted and no issues with template_mutables table
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(0);
        expect(templateMutables).toHaveLength(0);
    });

    test("delete template with partial mutable data cleanup", async () => {
        // Create two templates with mutable data
        await atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            [],
            [
                {first: "level", second: ["uint32", 1]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            [],
            [
                {first: "level", second: ["uint32", 2]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Verify both templates and mutable data exist
        let templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        let templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(2);
        expect(templateMutables).toHaveLength(2);

        // Delete first template
        await atomicassets.actions.deltemplate([
            user1.name.toString(),
            "testcollect1",
            1
        ]).send(`${user1.name.toString()}@active`);

        // Verify only first template and its mutable data were deleted
        templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(1);
        expect(templates[0].template_id).toBe(2);
        expect(templateMutables).toHaveLength(1);
        expect(templateMutables[0].template_id).toBe(2);
    });
});