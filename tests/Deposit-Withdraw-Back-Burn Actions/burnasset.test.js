const { Blockchain, nameToBigInt, mintTokens } = require("@vaulta/vert");
const { Name } = require('@wharfkit/antelope');
const fs = require('fs');

describe("test burnasset contract", () => {
    let blockchain;
    let atomicassets;
    let user1, user2;

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

        // Create collection and schema with user1 as author
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString(), user2.name.toString()],
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

        // Add supported tokens
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.addconftoken([
            "karmatoken",
            "4,KARMA"
        ]).send(`${atomicassets.name.toString()}@active`);
    });

    test("burn basic asset", async () => {
        expect.assertions(2);

        // Mint basic asset without backed tokens
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user1.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([]);
    });

    test("burn asset with single backed token", async () => {
        expect.assertions(4);

        // Create token contract and set up tokens
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 100, [user1]);

        // Set up deposit
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        await tokenContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '100.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        // Mint asset and back it
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user1.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.backasset([
            user1.name.toString(),
            user1.name.toString(),
            "1099511627776",
            "100.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`);

        // Burn the asset
        await atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);

        const atomicassets_token_balance = tokenContract.tables.accounts(nameToBigInt(atomicassets.name)).getTableRows();
        expect(atomicassets_token_balance).toEqual([{
            balance: "100.00000000 WAX"
        }]);

        const user1_token_balance = tokenContract.tables.accounts(nameToBigInt(user1.name)).getTableRows();
        expect(user1_token_balance).toEqual([{
            balance: "0.00000000 WAX"
        }]);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["100.00000000 WAX"]
        }]);
    });

    test("burn asset with backed token when owner has a balance table", async () => {
        expect.assertions(4);

        // Create token contract and set up tokens
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 150, [user1]);

        // Set up deposit with extra tokens
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        await tokenContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '150.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        // Mint asset and back it with part of the balance
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user1.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.backasset([
            user1.name.toString(),
            user1.name.toString(),
            "1099511627776",
            "100.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`);

        // Burn the asset
        await atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);

        const atomicassets_token_balance = tokenContract.tables.accounts(nameToBigInt(atomicassets.name)).getTableRows();
        expect(atomicassets_token_balance).toEqual([{
            balance: "150.00000000 WAX"
        }]);

        const user1_token_balance = tokenContract.tables.accounts(nameToBigInt(user1.name)).getTableRows();
        expect(user1_token_balance).toEqual([{
            balance: "0.00000000 WAX"
        }]);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["150.00000000 WAX"]
        }]);
    });

    test("burn asset with multiple backed tokens", async () => {
        expect.assertions(4);

        // Create token contracts
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        const karmaContract = blockchain.createAccount({
            name: Name.from('karmatoken'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 100, [user1]);
        await mintTokens(karmaContract, 'KARMA', 4, 1000000000, 500, [user1]);

        // Set up deposits for both tokens
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        await tokenContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '100.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "4,KARMA"
        ]).send(`${user1.name.toString()}@active`);

        await karmaContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '500.0000 KARMA',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        // Mint asset and back it with both tokens
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user1.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.backasset([
            user1.name.toString(),
            user1.name.toString(),
            "1099511627776",
            "100.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.backasset([
            user1.name.toString(),
            user1.name.toString(),
            "1099511627776",
            "500.0000 KARMA"
        ]).send(`${user1.name.toString()}@active`);

        // Burn the asset
        await atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toEqual([]);

        const user1_token_balance = tokenContract.tables.accounts(nameToBigInt(user1.name)).getTableRows();
        expect(user1_token_balance).toEqual([{
            balance: "0.00000000 WAX"
        }]);

        const user1_karmatoken_balance = karmaContract.tables.accounts(nameToBigInt(user1.name)).getTableRows();
        expect(user1_karmatoken_balance).toEqual([{
            balance: "0.0000 KARMA"
        }]);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["100.00000000 WAX", "500.0000 KARMA"]
        }]);
    });

    test("issued supply in template stays the same after burning", async () => {
        expect.assertions(2);

        // Create template
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,   // transferable
            true,   // burnable
            0,      // max_supply
            []      // immutable_data
        ]).send(`${user1.name.toString()}@active`);

        // Mint multiple assets to increase issued supply
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

        // Burn one asset
        await atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`);

        const user1_assets = atomicassets.tables.assets(nameToBigInt(user1.name)).getTableRows();
        expect(user1_assets).toHaveLength(4); // 4 assets remaining

        const testcol_templates = atomicassets.tables.templates(nameToBigInt("testcollect1")).getTableRows();
        expect(testcol_templates).toEqual([{
            template_id: 1,
            schema_name: "testschema",
            transferable: true,
            burnable: true,
            max_supply: 0,
            issued_supply: 5,
            immutable_serialized_data: ""
        }]);
    });

    test("throw when asset does not exist", async () => {
        await expect(atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No asset with this id exists");
    });

    test("throw when asset is not burnable", async () => {
        // Create non-burnable template
        await atomicassets.actions.createtempl([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,   // transferable
            false,  // burnable = false
            0,      // max_supply
            []      // immutable_data
        ]).send(`${user1.name.toString()}@active`);

        // Mint asset with non-burnable template
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

        await expect(atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The asset is not burnable");
    });

    test("throw without authorization from asset owner", async () => {
        // Mint asset for user1
        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user1.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        // Try to burn with user2's authorization instead of user1's
        await expect(atomicassets.actions.burnasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});