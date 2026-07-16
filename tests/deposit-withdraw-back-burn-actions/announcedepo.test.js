const { Blockchain, nameToBigInt, mintTokens } = require("@vaulta/vert");
const { Name } = require('@wharfkit/antelope');
const fs = require('fs');

describe("test announcedepo contract", () => {
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

    test("announce first deposit of only supported token", async () => {
        // Add supported token
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["0.00000000 WAX"]
        }]);
    });

    test("announce first deposit of one of many supported tokens", async () => {
        // Add supported tokens
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "4,EOS"
        ]).send(`${atomicassets.name.toString()}@active`);
        await atomicassets.actions.addconftoken([
            "karmatoken",
            "4,KARMA"
        ]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "4,EOS"
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["0.0000 EOS"]
        }]);
    });

    test("announce deposit when balance table already has an entry", async () => {
        // Create token contract and set up backing
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

        // Create actual deposit by transferring tokens to atomicassets with 'deposit' memo
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

        // Now announce deposit for another token when balance table already has an entry
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "4,EOS"
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt(atomicassets.name)).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["50.00000000 WAX", "0.0000 EOS"]
        }]);
    });

    test("throw when token is not supported", async () => {
        await expect(atomicassets.actions.announcedepo([
            user1.name.toString(),
            "4,EOS"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The specified symbol is not supported");
    });

    test("do nothing when token has already been announced", async () => {
        // Add supported token
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);;

        // First announcement
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        // Second announcement of same token (should do nothing)
        await atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`);

        const balances = atomicassets.tables.balances(nameToBigInt("atomicassets")).getTableRows();
        expect(balances).toEqual([{
            owner: user1.name.toString(),
            quantities: ["0.00000000 WAX"]
        }]);
    });

    test("throw without authorization from owner", async () => {
        // Add supported token
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        await expect(atomicassets.actions.announcedepo([
            user1.name.toString(),
            "8,WAX"
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});