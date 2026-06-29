const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test init contract', () => {
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
    });

    test("initialize config table", async () => {
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);

        const config_row = atomicassets.tables.config(nameToBigInt(atomicassets.name)).getTableRows()[0];

        expect(config_row).toEqual({
            "asset_counter": "1099511627776",
            "template_counter": 1,
            "offer_counter": 1,
            "collection_format": [],
            "supported_tokens": [],
            "rental_market": "atomicmarket"
        });
    });

    test("change nothing when config already exists", async () => {
        // First initialize with defaults
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.admincoledit([
            [{"name": "name", "type": "string"}]
        ]).send(`${atomicassets.name.toString()}@active`);

        // Call init again - should not change existing values
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);

        const config_row = atomicassets.tables.config(nameToBigInt(atomicassets.name)).getTableRows()[0];

        expect(config_row).toEqual({
            "asset_counter": "1099511627776",
            "template_counter": 1,
            "offer_counter": 1,
            "collection_format": [{"name": "name", "type": "string"}],
            "supported_tokens": [],
            "rental_market": "atomicmarket"
        });
    });

    test("throw without authorization", async () => {
        await expect(atomicassets.actions.init([]).send(`${user1.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});