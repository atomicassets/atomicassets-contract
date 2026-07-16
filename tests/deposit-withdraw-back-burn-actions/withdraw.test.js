const { Blockchain, nameToBigInt, mintTokens } = require("@vaulta/vert");
const { Name } = require('@wharfkit/antelope');
const fs = require('fs');

describe("test withdraw contract", () => {
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
    });

    test("withdraw all of the only deposited token", async () => {
        expect.assertions(2);

        // Create token contract and set up deposit
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

        // Set up deposit
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

        // Withdraw
        await atomicassets.actions.withdraw([
            user1.name.toString(),
            "100.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([]);

        const user1_tokens = tokenContract.tables.accounts(nameToBigInt(user1.name)).getTableRows();
        expect(user1_tokens).toEqual([
            {
                balance: "10000.00000000 WAX"
            }
        ]);
    });

    test("withdraw a part of the only deposited token", async () => {
        expect.assertions(2);

        // Create token contract and set up deposit
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

        // Set up deposit
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

        // Withdraw partial amount
        await atomicassets.actions.withdraw([
            user1.name.toString(),
            "30.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["70.00000000 WAX"]
        }]);

        const user1_tokens = tokenContract.tables.accounts(nameToBigInt(user1.name)).getTableRows();
        expect(user1_tokens).toEqual([
            {
                balance: "9930.00000000 WAX"
            }
        ]);
    });

    test("withdraw all of one of multiple deposited token", async () => {
        expect.assertions(2);

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

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);
        await mintTokens(karmaContract, 'KARMA', 4, 1000000000, 10000, [user1]);

        // Set up deposits for both tokens
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);
        await atomicassets.actions.addconftoken([
            "karmatoken",
            "4,KARMA"
        ]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "4,KARMA"
        ]).send(`${user1.name.toString()}@active`);

        await tokenContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '100.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);
        await karmaContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '50.0000 KARMA',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        // Withdraw all WAX
        await atomicassets.actions.withdraw([
            user1.name.toString(),
            "100.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["50.0000 KARMA"]
        }]);

        const user1_tokens = tokenContract.tables.accounts(nameToBigInt(user1.name)).getTableRows();
        expect(user1_tokens).toEqual([
            {
                balance: "10000.00000000 WAX"
            }
        ]);
    });

    test("withdraw all of a non eosio.token token", async () => {
        expect.assertions(2);

        // Create karma token contract
        const karmaContract = blockchain.createAccount({
            name: Name.from('karmatoken'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(karmaContract, 'KARMA', 4, 1000000000, 10000, [user1]);

        // Set up deposit
        await atomicassets.actions.addconftoken([
            "karmatoken",
            "4,KARMA"
        ]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "4,KARMA"
        ]).send(`${user1.name.toString()}@active`);

        await karmaContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '50.0000 KARMA',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        // Withdraw all KARMA
        await atomicassets.actions.withdraw([
            user1.name.toString(),
            "50.0000 KARMA"
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([]);

        const user1_tokens = karmaContract.tables.accounts(nameToBigInt(user1.name)).getTableRows();
        expect(user1_tokens).toEqual([
            {
                balance: "10000.0000 KARMA"
            }
        ]);
    });

    test("throw when withdrawer does not have a balance row", async () => {
        // Add supported token but don't create any balance
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        await expect(atomicassets.actions.withdraw([
            user1.name.toString(),
            "100.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The specified account does not have a balance table row");
    });

    test("throw when withdrawer does not have a balance for the token to withdraw", async () => {
        // Create karma token contract and set up deposit for KARMA only
        const karmaContract = blockchain.createAccount({
            name: Name.from('karmatoken'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(karmaContract, 'KARMA', 4, 1000000000, 10000, [user1]);

        // Add both supported tokens
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);
        await atomicassets.actions.addconftoken([
            "karmatoken",
            "4,KARMA"
        ]).send(`${atomicassets.name.toString()}@active`);

        // Only announce and deposit KARMA, not WAX
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "4,KARMA"
        ]).send(`${user1.name.toString()}@active`);

        await karmaContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '50.0000 KARMA',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        // Try to withdraw WAX when user only has KARMA
        await expect(atomicassets.actions.withdraw([
            user1.name.toString(),
            "100.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The specified account does not have a balance for the symbol specified in the quantity");
    });

    test("throw when withdrawer has tokens, but less than the withdrawal", async () => {
        // Create token contract and set up partial deposit
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

        // Set up deposit
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

        // Try to withdraw more than available
        await expect(atomicassets.actions.withdraw([
            user1.name.toString(),
            "100.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The specified account's balance is lower than the specified quantity");
    });

    test("throw when the withdrawal amount is negative", async () => {
        // Create token contract and set up deposit
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

        // Set up deposit
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

        // Try to withdraw negative amount
        await expect(atomicassets.actions.withdraw([
            user1.name.toString(),
            "-100.00000000 WAX"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("token_to_withdraw must be positive");
    });

    test("throw without authorization from owner", async () => {
        // Create token contract and set up deposit
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

        // Set up deposit
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

        // Try to withdraw with wrong authorization
        await expect(atomicassets.actions.withdraw([
            user1.name.toString(),
            "50.00000000 WAX"
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});