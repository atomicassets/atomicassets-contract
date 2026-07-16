const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test settempldata contract', () => {

// Locate an inline action's trace by action name. Indexing executionTraces by
// position breaks whenever the number or order of inline actions changes, which
// is unrelated to what these assertions are checking.
const findTrace = (actionName) => {
    const trace = blockchain.executionTraces.find(
        (t) => t.action.toString() === actionName
    );
    expect(trace).toBeDefined();
    return trace;
};
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

        // Create test template
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            1000,
            []
        ]).send(`${user1.name.toString()}@active`);
    });

    test("successfully set mutable data for template without existing mutable data", async () => {
        // Verify no mutable data exists initially
        let templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(0);

        // Set mutable data
        await expect(atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            1,
            [
                {first: "level", second: ["uint32", 10]},
                {first: "img", second: ["string", "QmHash123"]},
                {first: "rarity", second: ["string", "rare"]}
            ]
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify mutable data was created
        templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(1);
        expect(templateMutables[0]).toMatchObject({
            template_id: 1,
            schema_name: "testschema"
        });
        expect(templateMutables[0].mutable_serialized_data.length).toBeGreaterThan(0);
    });

    test("successfully modify existing mutable data", async () => {
        // First, set initial mutable data
        await atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            1,
            [
                {first: "level", second: ["uint32", 5]},
                {first: "rarity", second: ["string", "common"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Verify initial data exists
        let templateMutablesBefore = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutablesBefore).toHaveLength(1);
        expect(templateMutablesBefore[0].mutable_serialized_data.length).toBeGreaterThan(0);

        // Modify the mutable data
        await expect(atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            1,
            [
                {first: "level", second: ["uint32", 25]},
                {first: "img", second: ["string", "QmNewHash456"]},
                {first: "rarity", second: ["string", "epic"]}
            ]
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify data was modified (still 1 entry but different content)
        const templateMutablesAfter = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutablesAfter).toHaveLength(1);
        expect(templateMutablesAfter[0].template_id).toBe(1);
        expect(templateMutablesAfter[0].mutable_serialized_data.length).toBeGreaterThan(0);
        expect(templateMutablesAfter[0].mutable_serialized_data).not.toBe(templateMutablesBefore[0].mutable_serialized_data);
    });

    test("successfully erase mutable data by setting empty data", async () => {
        // First, set initial mutable data
        await atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            1,
            [
                {first: "level", second: ["uint32", 15]},
                {first: "name", second: ["string", "Test Item"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Verify data exists
        let templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(1);
        expect(templateMutables[0].mutable_serialized_data.length).toBeGreaterThan(0);

        // Erase the mutable data by setting empty array
        await expect(atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            1,
            [] // empty mutable data
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify data was erased
        templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(0);
    });

    test("successfully set empty data when no existing mutable data (no-op)", async () => {
        // Verify no mutable data exists
        let templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(0);

        // Set empty mutable data (should be no-op)
        await expect(atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            1,
            [] // empty mutable data
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify still no mutable data
        templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(0);
    });

    test("throw if collection does not exist", async () => {
        await expect(atomicassets.actions.settempldata([
            user1.name.toString(),
            "nonexistent",
            1,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw if template does not exist", async () => {
        await expect(atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            999, // non-existent template ID
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No template with the specified id exists for the specified collection");
    });

    test("throw if missing authorization", async () => {
        await expect(atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            1,
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw if authorized_editor is not actually authorized", async () => {
        await expect(atomicassets.actions.settempldata([
            user2.name.toString(),
            "testcollect1",
            1,
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("Missing authorization for this collection");
    });

    test("throw if name attribute is too long", async () => {
        const longName = "a".repeat(65); // > 64 character limit
        await expect(atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            1,
            [
                {first: "name", second: ["string", longName]}
            ]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Names (attribute with name: \"name\") can only be 64 characters max");
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

        await atomicassets.actions.createtempl([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user2.name.toString()}@active`);

        // user2 should be able to set template data as authorized account
        await expect(atomicassets.actions.settempldata([
            user2.name.toString(),
            "testcollect1",
            1,
            [
                {first: "level", second: ["uint32", 42]}
            ]
        ]).send(`${user2.name.toString()}@active`)).resolves.not.toThrow();

        // Verify mutable data was set
        const templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(1);
        expect(templateMutables[0].template_id).toBe(1);
        expect(templateMutables[0].mutable_serialized_data.length).toBeGreaterThan(0);
    });

    test("handle multiple templates - set data for specific template only", async () => {
        // Create additional templates
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            500,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            false,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Set mutable data for second template only
        await atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            2,
            [
                {first: "level", second: ["uint32", 99]},
                {first: "rarity", second: ["string", "legendary"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        // Verify only second template has mutable data
        const templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(1);
        expect(templateMutables[0].template_id).toBe(2);
        expect(templateMutables[0].mutable_serialized_data.length).toBeGreaterThan(0);
    });

    test("verify logsetdatatl action is called", async () => {
        await atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            1,
            [
                {first: "level", second: ["uint32", 7]},
                {first: "img", second: ["string", "QmLogTest"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        const templateMutables = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutables).toHaveLength(1);
        expect(templateMutables[0].template_id).toBe(1);
        expect(templateMutables[0].mutable_serialized_data.length).toBeGreaterThan(0);

        // Verify logsetdatatl action was called
        const logAction = findTrace('logsetdatatl');
        expect(logAction.contract.toString()).toBe(atomicassets.name.toString());
        expect(logAction.action.toString()).toBe('logsetdatatl');
        expect(logAction.data.collection_name.toString()).toBe('testcollect1');
        expect(logAction.data.schema_name.toString()).toBe('testschema');
        expect(logAction.data.old_data.toString()).toBe('');
        expect(logAction.data.new_data[0].second[1].toString()).toBe('QmLogTest');
    });

    test("verify old data is passed to log action when modifying", async () => {
        // First, set initial data
        await atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            1,
            [
                {first: "level", second: ["uint32", 1]},
                {first: "name", second: ["string", "Initial Name"]}
            ]
        ]).send(`${user1.name.toString()}@active`);
        const templateMutablesBefore = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutablesBefore).toHaveLength(1);
        expect(templateMutablesBefore[0].template_id).toBe(1);
        expect(templateMutablesBefore[0].mutable_serialized_data.length).toBeGreaterThan(0);

        // Reset execution traces to capture only the next action
        blockchain.executionTraces = [];

        // Modify the data
        await atomicassets.actions.settempldata([
            user1.name.toString(),
            "testcollect1",
            1,
            [
                {first: "level", second: ["uint32", 50]},
                {first: "name", second: ["string", "Updated Name"]}
            ]
        ]).send(`${user1.name.toString()}@active`);
        const templateMutablesAfter = atomicassets.tables.templates2(nameToBigInt("testcollect1")).getTableRows();
        expect(templateMutablesAfter).toHaveLength(1);
        expect(templateMutablesAfter[0].template_id).toBe(1);
        expect(templateMutablesAfter[0].mutable_serialized_data.length).toBeGreaterThan(0);

        // Verify logsetdatatl was called with old and new data
        const logAction = findTrace('logsetdatatl');
        expect(logAction.contract.toString()).toBe(atomicassets.name.toString());
        expect(logAction.action.toString()).toBe('logsetdatatl');
        expect(logAction.data.template_id.toString()).toBe('1');
        expect(logAction.data.old_data[0].second[1].toString()).toBe('1');
        expect(logAction.data.new_data[0].second[1].toString()).toBe('50');
    });
});