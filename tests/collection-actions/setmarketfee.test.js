const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test setmarketfee contract', () => {
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
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);
    });

    test("set market fee", async () => {
        await atomicassets.actions.setmarketfee([
            "testcollect1",
            0.1
        ]).send(`${user1.name.toString()}@active`);

        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toEqual([{
            collection_name: "testcollect1",
            author: user1.name.toString(),
            allow_notify: true,
            authorized_accounts: [],
            notify_accounts: [],
            market_fee: '0.1',
            serialized_data: ''
        }]);
    });

    test("set market fee to 0", async () => {
        await atomicassets.actions.setmarketfee([
            "testcollect1",
            0
        ]).send(`${user1.name.toString()}@active`);

        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toEqual([{
            collection_name: "testcollect1",
            author: user1.name.toString(),
            allow_notify: true,
            authorized_accounts: [],
            notify_accounts: [],
            market_fee: '0',
            serialized_data: ''
        }]);
    });

    test("set market fee to max allowed", async () => {
        await atomicassets.actions.setmarketfee([
            "testcollect1",
            0.15
        ]).send(`${user1.name.toString()}@active`);

        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toEqual([{
            collection_name: "testcollect1",
            author: user1.name.toString(),
            allow_notify: true,
            authorized_accounts: [],
            notify_accounts: [],
            market_fee: '0.15',
            serialized_data: ''
        }]);
    });

    test("throw when market fee is negative", async () => {
        await expect(atomicassets.actions.setmarketfee([
            "testcollect1",
            -0.01
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The market_fee must be between");
    });

    test("throw when market fee is above max", async () => {
        await expect(atomicassets.actions.setmarketfee([
            "testcollect1",
            0.151
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The market_fee must be between");
    });

    test("throw when market fee is NaN", async () => {
        await expect(atomicassets.actions.setmarketfee([
            "testcollect1",
            "NaN"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The market_fee must be between");
    });

    test("throw when collection does not exist", async () => {
        await expect(atomicassets.actions.setmarketfee([
            "nonexistant",
            0
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw without authorization from author", async () => {
        await expect(atomicassets.actions.setmarketfee([
            "testcollect1",
            0
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});