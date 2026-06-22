const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test setversion contract', () => {
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

    test("set tokenconfigs table", async () => {
        await atomicassets.actions.setversion({
            new_version: "1.0.0"
        }).send(`${atomicassets.name.toString()}@active`);

        const tokenconfigs_row = atomicassets.tables.tokenconfigs(nameToBigInt(atomicassets.name)).getTableRows()[0];

        expect(tokenconfigs_row).toEqual({
            "standard": "atomicassets",
            "version": "1.0.0"
        });
    });

    test("throw without authorization", async () => {
        await expect(atomicassets.actions.setversion({
            new_version: "1.0.0"
        }).send(`${user1.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});