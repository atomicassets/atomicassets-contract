const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test redtemplmax contract', () => {
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
                {name: "level", type: "uint32"}
            ]
        ]).send(`${user1.name.toString()}@active`);
    });

    test("successfully reduce max supply from unlimited to limited", async () => {
        // Create template with unlimited supply (max_supply = 0)
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0, // unlimited supply
            []
        ]).send(`${user1.name.toString()}@active`);

        // Verify initial max_supply is 0 (unlimited)
        let templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates[0].max_supply).toBe(0);
        expect(templates[0].issued_supply).toBe(0);

        // Reduce max supply to 1000
        await expect(atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            1000
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify max_supply was updated
        templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates[0].max_supply).toBe(1000);
        expect(templates[0].issued_supply).toBe(0);
    });

    test("successfully reduce max supply from higher to lower value", async () => {
        // Create template with max_supply = 2000
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            2000,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Reduce max supply to 1000
        await expect(atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            1000
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify max_supply was reduced
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates[0].max_supply).toBe(1000);
    });

    test("successfully reduce max supply to equal issued supply", async () => {
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

        // Mint 3 assets
        for (let i = 0; i < 3; i++) {
            await atomicassets.actions.mintasset([
                user1.name.toString(),
                "testcollect1",
                "testschema",
                1, // template_id
                user1.name.toString(),
                [],
                [],
                []
            ]).send(`${user1.name.toString()}@active`);
        }

        // Verify issued_supply is 3
        let templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates[0].issued_supply).toBe(3);

        // Reduce max supply to equal issued supply (3)
        await expect(atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            3
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify max_supply was reduced to 3
        templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates[0].max_supply).toBe(3);
    });

    test("throw if collection does not exist", async () => {
        await expect(atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "nonexistent",
            1,
            100
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw if template does not exist", async () => {
        await expect(atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            999, // non-existent template ID
            100
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
            1000,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Try to reduce max supply without proper authorization
        await expect(atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            500
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
            1000,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Try to reduce max supply with unauthorized editor
        await expect(atomicassets.actions.redtemplmax([
            user2.name.toString(),
            "testcollect1",
            1,
            500
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("Missing authorization for this collection");
    });

    test("throw if new max supply is zero", async () => {
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

        // Try to set max supply to 0 (which would make it unlimited)
        await expect(atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            0
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The new max supply can't be set to zero (infinite)");
    });

    test("throw if new max supply is lower than issued supply", async () => {
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

        // Mint 5 assets
        for (let i = 0; i < 5; i++) {
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
        }

        // Try to set max supply lower than issued supply
        await expect(atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            3 // lower than issued_supply of 5
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The new max supply can't be lower than the issued supply");
    });

    test("throw if new max supply is not lower than existing max supply", async () => {
        // Create template with max_supply = 1000
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            1000,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Try to set max supply to same value
        await expect(atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            1000
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The new max supply must be lower than the existing max supply");

        // Try to set max supply to higher value
        await expect(atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            1500
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The new max supply must be lower than the existing max supply");
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
            2000,
            []
        ]).send(`${user2.name.toString()}@active`);

        // user2 should be able to reduce max supply as authorized account
        await expect(atomicassets.actions.redtemplmax([
            user2.name.toString(),
            "testcollect1",
            1,
            1000
        ]).send(`${user2.name.toString()}@active`)).resolves.not.toThrow();

        // Verify max_supply was reduced
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates[0].max_supply).toBe(1000);
    });

    test("reduce max supply multiple times", async () => {
        // Create template with unlimited supply
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0, // unlimited
            []
        ]).send(`${user1.name.toString()}@active`);

        // First reduction: unlimited -> 1000
        await atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            1000
        ]).send(`${user1.name.toString()}@active`);

        let templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates[0].max_supply).toBe(1000);

        // Second reduction: 1000 -> 500
        await atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            500
        ]).send(`${user1.name.toString()}@active`);

        templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates[0].max_supply).toBe(500);

        // Third reduction: 500 -> 100
        await atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            100
        ]).send(`${user1.name.toString()}@active`);

        templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates[0].max_supply).toBe(100);
    });

    test("reduce max supply affects specific template only", async () => {
        // Create multiple templates
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            1000,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            2000,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0, // unlimited
            []
        ]).send(`${user1.name.toString()}@active`);

        // Reduce max supply of second template only
        await atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            2,
            500
        ]).send(`${user1.name.toString()}@active`);

        // Verify only second template was affected
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates.find(t => t.template_id === 1).max_supply).toBe(1000); // unchanged
        expect(templates.find(t => t.template_id === 2).max_supply).toBe(500);  // changed
        expect(templates.find(t => t.template_id === 3).max_supply).toBe(0);    // unchanged
    });

    test("handle edge case with minimum valid new max supply", async () => {
        // Create template with max_supply = 2
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            2,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Reduce to minimum valid value (1)
        await expect(atomicassets.actions.redtemplmax([
            user1.name.toString(),
            "testcollect1",
            1,
            1
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify max_supply was reduced to 1
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates[0].max_supply).toBe(1);
    });
});