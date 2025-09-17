const { Blockchain, nameToBigInt, mintTokens } = require("@vaulta/vert");
const { Name } = require('@wharfkit/antelope');
const fs = require('fs');

describe("test deposit_tokens contract", () => {
    let blockchain;
    let atomicassets;
    let user1;

    beforeAll(async () => {
        blockchain = new Blockchain();
        atomicassets = blockchain.createContract(
            'atomicassets',
            './build/atomicassets'
        );
        user1 = blockchain.createAccount('user1');
    });

    beforeEach(async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);
    });

    test("send first deposit of only announced token", async () => {
        // Create token contract and set up backing
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

        // Add supported token
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        // Announce deposit
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        // Transfer tokens with deposit memo
        await tokenContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '10.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["10.00000000 WAX"]
        }]);
    });

    test("send first deposit of one of many tokens", async () => {
        // Create token contract
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);
        await mintTokens(tokenContract, 'EOS', 4, 1000000000, 10000, [user1]);

        // Add supported tokens
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "4,EOS"
        ]).send(`${atomicassets.name.toString()}@active`);

        // Announce deposits for both tokens
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "4,EOS"
        ]).send(`${user1.name.toString()}@active`);
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        // Transfer WAX with deposit memo
        await tokenContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '10.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["0.0000 EOS", "10.00000000 WAX"]
        }]);
    });

    test("send deposit when balance table already has a balance for that token", async () => {
        // Create token contract
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

        // Add supported token
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        // Announce deposit and make first deposit
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

        // Make second deposit
        await tokenContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '10.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["20.00000000 WAX"]
        }]);
    });

    test("send deposit from non eosio.token token contract", async () => {
        // Create karma token contract
        const karmaContract = blockchain.createAccount({
            name: Name.from('karmatoken'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(karmaContract, 'KARMA', 4, 1000000000, 10000, [user1]);

        // Add supported token
        await atomicassets.actions.addconftoken([
            "karmatoken",
            "4,KARMA"
        ]).send(`${atomicassets.name.toString()}@active`);

        // Announce deposit
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "4,KARMA"
        ]).send(`${user1.name.toString()}@active`);

        // Transfer tokens with deposit memo
        await karmaContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '10.0000 KARMA',
            'deposit'
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["10.0000 KARMA"]
        }]);
    });

    test("throw when token is not supported (same symbol as supported token)", async () => {
        // Create karma token contract with WAX symbol (different from eosio.token)
        const karmaContract = blockchain.createAccount({
            name: Name.from('karmatoken'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(karmaContract, 'WAX', 8, 1000000000, 10000, [user1]);

        // Add only eosio.token WAX as supported (not karmatoken WAX)
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        // Announce deposit for the supported token
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        // Try to deposit from wrong contract
        await expect(karmaContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '10.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The transferred token is not supported");
    });

    test("throw when balance row of depositer has not been initialized", async () => {
        // Create token contract
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

        // Add supported token but don't announce deposit
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        // Try to deposit without announcing first
        await expect(tokenContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '10.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("You need to first initialize the balance table row using the announcedepo action");
    });

    test("throw when balance row of depositer does not have an entry for the deposited token", async () => {
        // Create token contract
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

        // Add both supported tokens
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);
        await atomicassets.actions.addconftoken([
            "karmatoken",
            "4,KARMA"
        ]).send(`${atomicassets.name.toString()}@active`);

        // Announce only KARMA, not WAX
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "4,KARMA"
        ]).send(`${user1.name.toString()}@active`);

        // Try to deposit WAX without announcing it first
        await expect(tokenContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '10.00000000 WAX',
            'deposit'
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("You first need to announce the asset type you're backing using the announcedepo action");
    });

    test("throw when memo is invalid", async () => {
        // Create token contract
        const tokenContract = blockchain.createAccount({
            name: Name.from('eosio.token'),
            wasm: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.wasm'),
            abi: fs.readFileSync('./tests/fixtures/eosio.token/eosio.token.abi', 'utf8'),
        });

        await mintTokens(tokenContract, 'WAX', 8, 1000000000, 10000, [user1]);

        // Add supported token and announce deposit
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        // Try to deposit with invalid memo
        await expect(tokenContract.actions.transfer([
            user1.name.toString(),
            atomicassets.name.toString(),
            '10.00000000 WAX',
            'this memo is probably invalid'
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("invalid memo");
    });
});