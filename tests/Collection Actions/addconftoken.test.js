const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test addconftoken contract', () => {
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

    test("add one token", async () => {
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        const config_row = atomicassets.tables.config(nameToBigInt(atomicassets.name)).getTableRows()[0];

        expect(config_row.supported_tokens).toEqual([{
            contract: "eosio.token",
            sym: "8,WAX"
        }]);
    });

    test("add two tokens of same contract", async () => {
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.addconftoken([
            "eosio.token",
            "0,SYS"
        ]).send(`${atomicassets.name.toString()}@active`);

        const config_row = atomicassets.tables.config(nameToBigInt(atomicassets.name)).getTableRows()[0];

        expect(config_row.supported_tokens).toEqual([
            {
                contract: "eosio.token",
                sym: "8,WAX"
            },
            {
                contract: "eosio.token",
                sym: "0,SYS"
            }
        ]);
    });

    test("throw when adding two tokens with same symbol", async () => {
        await atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`);

        await expect(atomicassets.actions.addconftoken([
            "fakewaxtoken",
            "8,WAX"
        ]).send(`${atomicassets.name.toString()}@active`)).rejects.toThrow("A token with this symbol is already supported");
    });

    test("throw without authorization from author", async () => {
        await expect(atomicassets.actions.addconftoken([
            "eosio.token",
            "8,WAX"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});