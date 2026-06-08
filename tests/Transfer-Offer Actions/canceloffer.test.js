const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test canceloffer contract', () => {
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
    });

    test("cancel offer", async () => {
        // Create assets that will be in the offer
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

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create the offer
        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            ["1099511627778"],
            "Example memo. Doesn't matter anyways."
        ]).send(`${user1.name.toString()}@active`);

        // Cancel the offer
        await atomicassets.actions.canceloffer([
            1
        ]).send(`${user1.name.toString()}@active`);

        const offers = atomicassets.tables.offers(nameToBigInt(atomicassets.name)).getTableRows();
        expect(offers).toEqual([]);
    });

    test("throw without authorization from the offer sender", async () => {
        // Create assets that will be in the offer
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

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            -1,
            user2.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create the offer
        await atomicassets.actions.createoffer([
            user1.name.toString(),
            user2.name.toString(),
            ["1099511627776", "1099511627777"],
            ["1099511627778"],
            "Example memo. Doesn't matter anyways."
        ]).send(`${user1.name.toString()}@active`);

        // Try to cancel offer with wrong authorization
        await expect(atomicassets.actions.canceloffer([
            1
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});