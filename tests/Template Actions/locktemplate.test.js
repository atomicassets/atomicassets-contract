const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test locktemplate contract', () => {
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

    test("lock template that had no max supply previously", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Simulate 5 assets minted by directly updating template
        const templateId = 1;
        // Create 5 assets to simulate issued_supply = 5
        for (let i = 1; i <= 5; i++) {
            await atomicassets.actions.mintasset([
                user1.name.toString(),
                "testcollect1",
                "testschema",
                templateId,
                user1.name.toString(),
                [],
                [],
                []
            ]).send(`${user1.name.toString()}@active`);
        }

        await atomicassets.actions.locktemplate([
            user1.name.toString(),
            "testcollect1",
            1
        ]).send(`${user1.name.toString()}@active`);

        const collection_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_templates).toEqual([{
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 5,
            issued_supply: 5,
            immutable_serialized_data: ''
        }]);
    });

    test("lock template that had a max supply previously", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            10,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create 5 assets to simulate issued_supply = 5
        for (let i = 1; i <= 5; i++) {
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

        await atomicassets.actions.locktemplate([
            user1.name.toString(),
            "testcollect1",
            1
        ]).send(`${user1.name.toString()}@active`);

        const collection_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_templates).toEqual([{
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 5,
            issued_supply: 5,
            immutable_serialized_data: ''
        }]);
    });

    test("lock template where max supply is equal to issued supply", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            5,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create 5 assets to simulate issued_supply = 5
        for (let i = 1; i <= 5; i++) {
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

        await atomicassets.actions.locktemplate([
            user1.name.toString(),
            "testcollect1",
            1
        ]).send(`${user1.name.toString()}@active`);

        const collection_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_templates).toEqual([{
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 5,
            issued_supply: 5,
            immutable_serialized_data: ''
        }]);
    });

    test("throw when issued supply is 0", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            10,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.locktemplate([
            user1.name.toString(),
            "testcollect1",
            1
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can't lock a template that does not have at least one issued asset");
    });

    test("throw when template with this id does not exist in collection", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            10,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.locktemplate([
            user1.name.toString(),
            "testcollect1",
            2
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No template with the specified id exists for the specified collection");
    });

    test("throw when collection does not exist", async () => {
        await expect(atomicassets.actions.locktemplate([
            user1.name.toString(),
            "nocol",
            1
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("lock template as authorized account but not author", async () => {
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
            10,
            []
        ]).send(`${user2.name.toString()}@active`);

        // Create 5 assets to simulate issued_supply = 5
        for (let i = 1; i <= 5; i++) {
            await atomicassets.actions.mintasset([
                user2.name.toString(),
                "testcollect1",
                "testschema",
                1,
                user1.name.toString(),
                [],
                [],
                []
            ]).send(`${user2.name.toString()}@active`);
        }

        await atomicassets.actions.locktemplate([
            user2.name.toString(),
            "testcollect1",
            1
        ]).send(`${user2.name.toString()}@active`);

        const collection_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(collection_templates).toEqual([{
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 5,
            issued_supply: 5,
            immutable_serialized_data: ''
        }]);
    });

    test("throw without authorization from authorized creator", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            10,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.locktemplate([
            user1.name.toString(),
            "testcollect1",
            1
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw when template id is negative", async () => {
        await expect(atomicassets.actions.locktemplate([
            user1.name.toString(),
            "testcollect1",
            -1
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The template id must be positive");
    });

    test("throw when authorized_creator is not actually authorized", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            10,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.locktemplate([
            user2.name.toString(),
            "testcollect1",
            1
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("The editor is not authorized within the collection");
    });
});