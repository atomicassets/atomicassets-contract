const { Blockchain, nameToBigInt, mintTokens } = require("@vaulta/vert");
const { Name } = require('@wharfkit/antelope');
const fs = require('fs');

describe('test mintasset contract', () => {
    let blockchain;
    let eosioToken;
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
        eosioToken = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
          });
        user1 = blockchain.createAccount('user1');
        user2 = blockchain.createAccount('user2');
        user3 = blockchain.createAccount('user3');
    });

    beforeEach(async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);
        await mintTokens(eosioToken, 'WAX', 8, 1000000000, 10000, [user1, user2, user3]);
        await mintTokens(eosioToken, 'EOS', 4, 1000000000, 10000, [user1, user2, user3]);

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

    test("mint minimal asset", async () => {
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

    test("mint two minimal assets", async () => {
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

        const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
        expect(user3_assets).toEqual([
            {
                asset_id: "1099511627776",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: '',
                mutable_serialized_data: ''
            },
            {
                asset_id: "1099511627777",
                collection_name: "testcollect1",
                schema_name: "testschema",
                template_id: -1,
                ram_payer: user1.name.toString(),
                backed_tokens: [],
                immutable_serialized_data: '',
                mutable_serialized_data: ''
            }
        ]);
    });

    test("throw when new owner account does not exist", async () => {
        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            "noaccount",
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The new_asset_owner account does not exist");
    });

    test("mint asset with data", async () => {
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user3.name.toString(),
            [
                {"first": "name", "second": ["string", "Tom"]}
            ],
            [
                {"first": "level", "second": ["uint32", 100]}
            ],
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
            immutable_serialized_data: '0403546f6d',
            mutable_serialized_data: '0564'
        }]);
    });

    test("Throw if mint asset with one backed token (deprecated)", async () => {
        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user3.name.toString(),
            [],
            [],
            ["100.00000000 WAX"]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow('Native backing has been deprecated on the AtomicAssets Contract');
    });

    test("throw if mint asset with two backed tokens", async () => {
        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user3.name.toString(),
            [],
            [],
            ["100.00000000 WAX", "10.0000 EOS"]
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow('Native backing has been deprecated on the AtomicAssets Contract');
    });

    test("mint asset referencing a template", async () => {
        expect.assertions(2);

        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
        expect(user3_assets).toEqual([{
            asset_id: "1099511627776",
            collection_name: "testcollect1",
            schema_name: "testschema",
            template_id: 1,
            ram_payer: user1.name.toString(),
            backed_tokens: [],
            immutable_serialized_data: '',
            mutable_serialized_data: ''
        }]);

        const testcol_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(testcol_templates).toEqual([{
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 0,
            issued_supply: 1,
            immutable_serialized_data: ''
        }]);
    });

    test("throw when minting asset referencing a template that reached its max supply", async () => {
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            5,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Mint 5 assets to reach max supply
        for (let i = 0; i < 5; i++) {
            await atomicassets.actions.mintasset([
                user1.name.toString(),
                "testcollect1",
                "testschema",
                1,
                user3.name.toString(),
                [],
                [],
                []
            ]).send(`${user1.name.toString()}@active`);
        }

        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The template's maxsupply has already been reached");
    });

    test("throw when template id is a negative number other than -1", async () => {
        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -2,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The template id must either be an existing template or -1");
    });

    test("throw when template belongs to another schema", async () => {
        await atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "different",
            [
                {name: "name", type: "string"}
            ]
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "different",
            true,
            false,
            0,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The template belongs to another schema");
    });

    test("throw when collection does not exist", async () => {
        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "nocol",
            "testschema",
            -1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw when schema does not exist", async () => {
        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "noschema",
            -1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No schema with this name exists");
    });

    test("throw when template does not exist", async () => {
        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No template with this id exists");
    });

    test("mint asset as authorized account but not author", async () => {
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

        const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
        expect(user3_assets).toEqual([{
            asset_id: "1099511627776",
            collection_name: "testcollect1",
            schema_name: "testschema",
            template_id: -1,
            ram_payer: user2.name.toString(),
            backed_tokens: [],
            immutable_serialized_data: '',
            mutable_serialized_data: ''
        }]);
    });

    test("throw without authorization from authorized minter", async () => {
        await expect(atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw when authorized_creator is not actually authorized", async () => {
        await expect(atomicassets.actions.mintasset([
            user2.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user3.name.toString(),
            [],
            [],
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("Missing authorization for this collection");
    });
});