const { Blockchain, nameToBigInt, mintTokens } = require("@vaulta/vert");
const { Name } = require('@wharfkit/antelope');
const fs = require('fs');

describe("test backasset contract", () => {
    let blockchain;
    let atomicassets;
    let user1, user2, user3;

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

        // Create collection and schema
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString(), user2.name.toString(), user3.name.toString()],
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

    test("back first token", async () => {
        expect.assertions(2);

        // Create token contract and set up deposit
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

        // Set up supported token and deposit
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        await tokenContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '50.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        // Mint asset to user3
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

        // Back the asset
        await atomicassets.actions.backasset([
            user1.name.toString(),
            user3.name.toString(),
            "1099511627776",
            "50.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([]);

        const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
        expect(user3_assets).toEqual([{
            asset_id: "1099511627776",
            collection_name: "testcollect1",
            schema_name: "testschema",
            template_id: -1,
            ram_payer: user1.name.toString(),
            backed_tokens: ["50.00000000 WAX"],
            immutable_serialized_data: "",
            mutable_serialized_data: ""
        }]);
    });

test("back same token again", async () => {
    expect.assertions(2);

    // Create token contract and set up deposit
    const tokenContract = blockchain.createAccount({
        name: Name.from('eosio.token'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

    // Set up supported token and deposit
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

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

    // Mint asset and back it first time
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

    await atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "50.00000000 WAX"
    ]).send(`${user1.name.toString()}@active`);

    // Back the same token again
    await atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "50.00000000 WAX"
    ]).send(`${user1.name.toString()}@active`);

    const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
    expect(balances).toEqual([]);

    const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
    expect(user3_assets).toEqual([{
        asset_id: "1099511627776",
        collection_name: "testcollect1",
        schema_name: "testschema",
        template_id: -1,
        ram_payer: user1.name.toString(),
        backed_tokens: ["100.00000000 WAX"],
        immutable_serialized_data: "",
        mutable_serialized_data: ""
    }]);
});

test("back part of only token in the payers balance", async () => {
    expect.assertions(2);

    // Create token contract and set up deposit
    const tokenContract = blockchain.createAccount({
        name: Name.from('eosio.token'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

    // Set up supported token and deposit
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    await atomicassets.actions.announcedepo([
        user1.name.toString(),
        "8,WAX"
    ]).send(`${user1.name.toString()}@active`);

    await tokenContract.actions.transfer([
        user1.name.toString(),
        atomicassets.name.toString(),
        '50.00000000 WAX',
        'deposit'
    ]).send(`${user1.name.toString()}@active`);

    // Mint asset
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

    // Back part of the token
    await atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "30.00000000 WAX"
    ]).send(`${user1.name.toString()}@active`);

    const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
    expect(balances).toEqual([{
        owner: user1.name.toString(),
        quantities: ["20.00000000 WAX"]
    }]);

    const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
    expect(user3_assets).toEqual([{
        asset_id: "1099511627776",
        collection_name: "testcollect1",
        schema_name: "testschema",
        template_id: -1,
        ram_payer: user1.name.toString(),
        backed_tokens: ["30.00000000 WAX"],
        immutable_serialized_data: "",
        mutable_serialized_data: ""
    }]);
});

test("back second token", async () => {
    expect.assertions(2);

    // Create WAX token contract
    const tokenContract = blockchain.createAccount({
        name: Name.from('eosio.token'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    // Create KARMA token contract
    const karmaContract = blockchain.createAccount({
        name: Name.from('karmatoken'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);
    await mintTokens(karmaContract, 'KARMA', 4, 1000000000, 10000, [user1]);

    // Set up supported tokens
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    await atomicassets.actions.addconftoken([
        "karmatoken",
        "4,KARMA"
    ]).send(`${atomicassets.name.toString()}@active`);

    // Deposit WAX tokens
    await atomicassets.actions.announcedepo([
        user1.name.toString(),
        "8,WAX"
    ]).send(`${user1.name.toString()}@active`);

    await tokenContract.actions.transfer([
        user1.name.toString(),
        atomicassets.name.toString(),
        '10.00000000 WAX',
        'deposit'
    ]).send(`${user1.name.toString()}@active`);

    // Deposit KARMA tokens
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

    // Mint asset and back with WAX first
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

    await atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "10.00000000 WAX"
    ]).send(`${user1.name.toString()}@active`);

    // Back with KARMA (second token)
    await atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "500.0000 KARMA"
    ]).send(`${user1.name.toString()}@active`);

    const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
    expect(balances).toEqual([]);

    const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
    expect(user3_assets).toEqual([{
        asset_id: "1099511627776",
        collection_name: "testcollect1",
        schema_name: "testschema",
        template_id: -1,
        ram_payer: user1.name.toString(),
        backed_tokens: ["10.00000000 WAX", "500.0000 KARMA"],
        immutable_serialized_data: "",
        mutable_serialized_data: ""
    }]);
});

test("back all of one of multiple tokens in the payers balance", async () => {
    expect.assertions(2);

    // Create WAX token contract
    const tokenContract = blockchain.createAccount({
        name: Name.from('eosio.token'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    // Create KARMA token contract
    const karmaContract = blockchain.createAccount({
        name: Name.from('karmatoken'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);
    await mintTokens(karmaContract, 'KARMA', 4, 1000000000, 10000, [user1]);

    // Set up supported tokens
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    await atomicassets.actions.addconftoken([
        "karmatoken",
        "4,KARMA"
    ]).send(`${atomicassets.name.toString()}@active`);

    // Deposit both tokens
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

    // Mint asset
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

    // Back all KARMA tokens
    await atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "500.0000 KARMA"
    ]).send(`${user1.name.toString()}@active`);

    const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
    expect(balances).toEqual([{
        owner: user1.name.toString(),
        quantities: ["100.00000000 WAX"]
    }]);

    const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
    expect(user3_assets).toEqual([{
        asset_id: "1099511627776",
        collection_name: "testcollect1",
        schema_name: "testschema",
        template_id: -1,
        ram_payer: user1.name.toString(),
        backed_tokens: ["500.0000 KARMA"],
        immutable_serialized_data: "",
        mutable_serialized_data: ""
    }]);
});

test("back part of one of multiple tokens in the payers balance", async () => {
    expect.assertions(2);

    // Create WAX token contract
    const tokenContract = blockchain.createAccount({
        name: Name.from('eosio.token'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    // Create KARMA token contract
    const karmaContract = blockchain.createAccount({
        name: Name.from('karmatoken'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);
    await mintTokens(karmaContract, 'KARMA', 4, 1000000000, 10000, [user1]);

    // Set up supported tokens
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    await atomicassets.actions.addconftoken([
        "karmatoken",
        "4,KARMA"
    ]).send(`${atomicassets.name.toString()}@active`);

    // Deposit both tokens
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

    // Mint asset
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

    // Back part of KARMA tokens
    await atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "200.0000 KARMA"
    ]).send(`${user1.name.toString()}@active`);

    const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
    expect(balances).toEqual([{
        owner: user1.name.toString(),
        quantities: ["100.00000000 WAX", "300.0000 KARMA"]
    }]);

    const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
    expect(user3_assets).toEqual([{
        asset_id: "1099511627776",
        collection_name: "testcollect1",
        schema_name: "testschema",
        template_id: -1,
        ram_payer: user1.name.toString(),
        backed_tokens: ["200.0000 KARMA"],
        immutable_serialized_data: "",
        mutable_serialized_data: ""
    }]);
});

test("ram payer changes when payer is different than existing ram payer", async () => {
    expect.assertions(2);

    // Create token contract
    const tokenContract = blockchain.createAccount({
        name: Name.from('eosio.token'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user2]);

    // Set up supported token
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    // Deposit tokens for user2
    await atomicassets.actions.announcedepo([
        user2.name.toString(),
        "8,WAX"
    ]).send(`${user2.name.toString()}@active`);

    await tokenContract.actions.transfer([
        user2.name.toString(),
        atomicassets.name.toString(),
        '100.00000000 WAX',
        'deposit'
    ]).send(`${user2.name.toString()}@active`);

    // Mint asset with user1 as ram payer
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

    // Back asset with user2 as payer (different from original ram payer user1)
    await atomicassets.actions.backasset([
        user2.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "100.00000000 WAX"
    ]).send(`${user2.name.toString()}@active`);

    const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
    expect(balances).toEqual([]);

    const user3_assets = atomicassets.tables.assets(nameToBigInt(user3.name)).getTableRows();
    expect(user3_assets).toEqual([{
        asset_id: "1099511627776",
        collection_name: "testcollect1",
        schema_name: "testschema",
        template_id: -1,
        ram_payer: user2.name.toString(),
        backed_tokens: ["100.00000000 WAX"],
        immutable_serialized_data: "",
        mutable_serialized_data: ""
    }]);
});

test("throw when payer does not have a balance row", async () => {
    // Set up supported token
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    // Mint asset without setting up any balance for user1
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

    await expect(atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "10.00000000 WAX"
    ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The specified account does not have a balance table row");
});

test("throw when payer does not have a balance for the token to back", async () => {
    // Create KARMA token contract
    const karmaContract = blockchain.createAccount({
        name: Name.from('karmatoken'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    await mintTokens(karmaContract, 'KARMA', 4, 1000000000, 10000, [user1]);

    // Set up both supported tokens
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    await atomicassets.actions.addconftoken([
        "karmatoken",
        "4,KARMA"
    ]).send(`${atomicassets.name.toString()}@active`);

    // Only deposit KARMA tokens, not WAX
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

    // Mint asset
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

    // Try to back with WAX (which user1 doesn't have)
    await expect(atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "10.00000000 WAX"
    ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The specified account does not have a balance for the symbol specified in the quantity");
});

test("throw when payer has tokens, but less than required", async () => {
    // Create token contract
    const tokenContract = blockchain.createAccount({
        name: Name.from('eosio.token'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

    // Set up supported token
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    // Deposit less than what will be required
    await atomicassets.actions.announcedepo([
        user1.name.toString(),
        "8,WAX"
    ]).send(`${user1.name.toString()}@active`);

    await tokenContract.actions.transfer([
        user1.name.toString(),
        atomicassets.name.toString(),
        '50.00000000 WAX',
        'deposit'
    ]).send(`${user1.name.toString()}@active`);

    // Mint asset
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

    // Try to back with more than available
    await expect(atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "100.00000000 WAX"
    ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The specified account's balance is lower than the specified quantity");
});

test("throw when token to back is negative", async () => {
    // Set up supported token
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    // Mint asset
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

    // Try to back with negative amount
    await expect(atomicassets.actions.backasset([
        user2.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "-10.00000000 WAX"
    ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("token_to_back must be positive");
});

test("throw when the specified owner does not own the asset", async () => {
    // Create token contract
    const tokenContract = blockchain.createAccount({
        name: Name.from('eosio.token'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

    // Set up supported token and deposit
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    await atomicassets.actions.announcedepo([
        user1.name.toString(),
        "8,WAX"
    ]).send(`${user1.name.toString()}@active`);

    await tokenContract.actions.transfer([
        user1.name.toString(),
        atomicassets.name.toString(),
        '50.00000000 WAX',
        'deposit'
    ]).send(`${user1.name.toString()}@active`);

    // Try to back an asset that doesn't exist or isn't owned by user3
    await expect(atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "10.00000000 WAX"
    ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The specified owner does not own the asset with the specified ID");
});

test("throw when the asset is not burnable", async () => {
    // Create token contract
    const tokenContract = blockchain.createAccount({
        name: Name.from('eosio.token'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

    // Set up supported token and deposit
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    await atomicassets.actions.announcedepo([
        user1.name.toString(),
        "8,WAX"
    ]).send(`${user1.name.toString()}@active`);

    await tokenContract.actions.transfer([
        user1.name.toString(),
        atomicassets.name.toString(),
        '50.00000000 WAX',
        'deposit'
    ]).send(`${user1.name.toString()}@active`);

    // Create a non-burnable template
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
        1,      // template_id = 1
        user3.name.toString(),
        [],
        [],
        []
    ]).send(`${user1.name.toString()}@active`);

    // Try to back a non-burnable asset
    await expect(atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "10.00000000 WAX"
    ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The asset is not burnable. Only burnable assets can be backed.");
});

test("throw withour authorization from payer", async () => {
    // Create token contract
    const tokenContract = blockchain.createAccount({
        name: Name.from('eosio.token'),
        wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
        abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
    });

    await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

    // Set up supported token and deposit
    await atomicassets.actions.addconftoken([
        "eosio.token",
        "8,WAX"
    ]).send(`${atomicassets.name.toString()}@active`);

    await atomicassets.actions.announcedepo([
        user1.name.toString(),
        "8,WAX"
    ]).send(`${user1.name.toString()}@active`);

    await tokenContract.actions.transfer([
        user1.name.toString(),
        atomicassets.name.toString(),
        '50.00000000 WAX',
        'deposit'
    ]).send(`${user1.name.toString()}@active`);

    // Mint asset
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

    // Try to back with wrong authorization (user2 instead of user1)
    await expect(atomicassets.actions.backasset([
        user1.name.toString(),
        user3.name.toString(),
        "1099511627776",
        "10.00000000 WAX"
    ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
});

});