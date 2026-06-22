const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test setcoldata contract', () => {
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
        await atomicassets.actions.admincoledit([
            [
                {"name": "name", "type": "string"},
                {"name": "img", "type": "ipfs"},
                {"name": "description", "type": "string"}
            ]
        ]).send(`${atomicassets.name.toString()}@active`);
    });

    test("set basic data", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.setcoldata([
            "testcollect1",
            [
                {"first": "name", "second": ["string", "ABC"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toEqual([{
            collection_name: "testcollect1",
            author: user1.name.toString(),
            allow_notify: true,
            authorized_accounts: [user1.name.toString()],
            notify_accounts: [],
            market_fee: '0.05',
            serialized_data: '0403414243'
        }]);
    });

    test("overwrite data", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.setcoldata([
            "testcollect1",
            [
                {"first": "name", "second": ["string", "ABC"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.setcoldata([
            "testcollect1",
            [
                {"first": "name", "second": ["string", "123"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toEqual([{
            collection_name: "testcollect1",
            author: user1.name.toString(),
            allow_notify: true,
            authorized_accounts: [user1.name.toString()],
            notify_accounts: [],
            market_fee: '0.05',
            serialized_data: '0403313233'
        }]);
    });

    test("erase data", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.setcoldata([
            "testcollect1",
            [
                {"first": "name", "second": ["string", "ABC"]}
            ]
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.setcoldata([
            "testcollect1",
            []
        ]).send(`${user1.name.toString()}@active`);

        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toEqual([{
            collection_name: "testcollect1",
            author: user1.name.toString(),
            allow_notify: true,
            authorized_accounts: [user1.name.toString()],
            notify_accounts: [],
            market_fee: '0.05',
            serialized_data: ''
        }]);
    });

    test("throw without authorization", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.setcoldata([
            "testcollect1",
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});