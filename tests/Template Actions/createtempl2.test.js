const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test createtempl2 contract', () => {
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

    test("successfully create template with both immutable and mutable data", async () => {
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            1000,  // max_supply
            [
                {first: "name", second: ["string", "Test Asset"]},
                {first: "rarity", second: ["string", "common"]}
            ],
            [
                {first: "level", second: ["uint32", 1]},
                {first: "img", second: ["string", "QmHash123"]}
            ]
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify template was created
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(1);
        expect(templates[0]).toMatchObject({
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 1000,
            issued_supply: 0
        });
        expect(templates[0].immutable_serialized_data.length).toBeGreaterThan(0);

        // Verify mutable data was stored in template_mutables table
        const templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(1);
        expect(templateMutables[0]).toMatchObject({
            template_id: 1,
            schema_name: "testschema"
        });
        expect(templateMutables[0].mutable_serialized_data.length).toBeGreaterThan(0);
    });

    test("successfully create template with only immutable data", async () => {
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,     // unlimited supply
            [
                {first: "name", second: ["string", "Immutable Only"]},
                {first: "rarity", second: ["string", "rare"]}
            ],
            [] // empty mutable data
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify template was created
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(1);
        expect(templates[0]).toMatchObject({
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 0,
            issued_supply: 0
        });
        expect(templates[0].immutable_serialized_data.length).toBeGreaterThan(0);

        // Verify no mutable data entry (since mutable_data was empty)
        const templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(0);
    });

    test("successfully create template with only mutable data", async () => {
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            500,   // max_supply
            [], // empty immutable data
            [
                {first: "name", second: ["string", "Mutable Only"]},
                {first: "level", second: ["uint32", 5]}
            ]
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify template was created
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(1);
        expect(templates[0]).toMatchObject({
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 500,
            issued_supply: 0
        });
        expect(templates[0].immutable_serialized_data.length).toBe(0);

        // Verify mutable data was stored
        const templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(1);
        expect(templateMutables[0].mutable_serialized_data.length).toBeGreaterThan(0);
    });

    test("successfully create template with empty data", async () => {
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,  // transferable
            true,  // burnable
            0,     // unlimited supply
            [], // empty immutable data
            [] // empty mutable data
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify template was created
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(1);
        expect(templates[0]).toMatchObject({
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 0,
            issued_supply: 0
        });
        expect(templates[0].immutable_serialized_data.length).toBe(0);

        // Verify no mutable data entry
        const templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(0);
    });

    test("throw if collection does not exist", async () => {
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "nonexistent",
            "testschema",
            true,
            true,
            0,
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw if schema does not exist", async () => {
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "nonexistent",
            true,
            true,
            0,
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No schema with this name exists");
    });

    test("throw if missing authorization", async () => {
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            [],
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw if authorized_creator is not actually authorized", async () => {
        await expect(atomicassets.actions.createtempl2([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            [],
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("Missing authorization for this collection");
    });

    test("throw if template is both non-transferable and non-burnable", async () => {
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            false, // non-transferable
            false, // non-burnable
            0,
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("A template cannot be both non-transferable and non-burnable");
    });

    test("throw if immutable data name is too long", async () => {
        const longName = "a".repeat(65); // > 64 character limit
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            [
                {first: "name", second: ["string", longName]}
            ],
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Names (attribute with name: \"name\") can only be 64 characters max");
    });

    test("throw if mutable data name is too long", async () => {
        const longName = "a".repeat(65); // > 64 character limit
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            [],
            [
                {first: "name", second: ["string", longName]}
            ]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow('Names (attribute with name: \"name\") can only be 64 characters max');
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
                {name: "level", type: "uint32"}
            ]
        ]).send(`${user2.name.toString()}@active`);

        // user2 should be able to create template as authorized account
        await expect(atomicassets.actions.createtempl2([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            100,
            [
                {first: "name", second: ["string", "Authorized Test"]}
            ],
            [
                {first: "level", second: ["uint32", 10]}
            ]
        ]).send(`${user2.name.toString()}@active`)).resolves.not.toThrow();

        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(1);
        expect(templates[0].template_id).toBe(1);
    });

    test("create multiple templates with incremental IDs", async () => {
        // Create first template
        await atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            100,
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create second template
        await atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            false,
            true,
            200,
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        // Verify both templates exist with correct IDs
        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(2);
        expect(templates[0].template_id).toBe(1);
        expect(templates[1].template_id).toBe(2);
    });

    test("accept valid transferable/burnable combinations", async () => {
        // transferable and burnable
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // transferable but not burnable
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            false,
            0,
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // not transferable but burnable
        await expect(atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            false,
            true,
            0,
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        const templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(templates).toHaveLength(3);
    });

    test("verify template counter increments globally", async () => {
        // Create template in first collection
        await atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create second collection and schema
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
            "schema2",
            [
                {name: "name", type: "string"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Create template in second collection
        await atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect2",
            "schema2",
            true,
            true,
            0,
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        // Verify template IDs are globally incremental
        const templates1 = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        const templates2 = atomicassets.tables.templates(nameToBigInt("testcollect2")).getTableRows();

        expect(templates1[0].template_id).toBe(1);
        expect(templates2[0].template_id).toBe(2);
    });

    test("verify lognewtempl action is called", async () => {
        await atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            1000,
            [
                {first: "name", second: ["string", "Log Test"]},
                {first: "rarity", second: ["string", "epic"]}
            ],
            [
                {first: "level", second: ["uint32", 50]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Verify lognewtempl action was called
        const expectLogAction = blockchain.executionTraces[1];
        expect(expectLogAction.contract.toString()).toBe(atomicassets.name.toString());
        expect(expectLogAction.action.toString()).toBe('lognewtempl');
        expect(expectLogAction.data.template_id.toString()).toBe("1");
        expect(expectLogAction.data.authorized_creator.toString()).toBe(user1.name.toString());
        expect(expectLogAction.data.collection_name.toString()).toBe('testcollect1');
        expect(expectLogAction.data.schema_name.toString()).toBe('testschema');
        expect(expectLogAction.data.transferable).toBe(true);
        expect(expectLogAction.data.burnable).toBe(true);
        expect(expectLogAction.data.max_supply.toString()).toBe('1000');
    });

    test("verify logsetdatatl action is called when mutable data exists", async () => {
        await atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            [],
            [
                {first: "level", second: ["uint32", 25]},
                {first: "img", second: ["string", "QmTest456"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Verify logsetdatatl action was called for mutable data
        const expectLogDataAction = blockchain.executionTraces[2];
        expect(expectLogDataAction.contract.toString()).toBe(atomicassets.name.toString());
        expect(expectLogDataAction.action.toString()).toBe('logsetdatatl');
        expect(expectLogDataAction.data.collection_name.toString()).toBe('testcollect1');
        expect(expectLogDataAction.data.schema_name.toString()).toBe('testschema');
        expect(expectLogDataAction.data.template_id.toString()).toBe('1');
    });
});