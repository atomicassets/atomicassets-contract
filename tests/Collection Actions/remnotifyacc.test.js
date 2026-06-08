const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test remnotifyacc contract', () => {
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
    });

    test("remove single account", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [user1.name.toString()],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.remnotifyacc([
            "testcollect1",
            user1.name.toString()
        ]).send(`${user1.name.toString()}@active`);

        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toEqual([{
            collection_name: "testcollect1",
            author: user1.name.toString(),
            allow_notify: true,
            authorized_accounts: [],
            notify_accounts: [],
            market_fee: '0.05',
            serialized_data: ''
        }]);
    });

    test("remove one of many", async () => {
        const test1 = blockchain.createAccount('test1');
        const test2 = blockchain.createAccount('test2');
        const test3 = blockchain.createAccount('test3');

        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [test1.name.toString(), test2.name.toString(), user1.name.toString(), test3.name.toString()],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.remnotifyacc([
            "testcollect1",
            user1.name.toString()
        ]).send(`${user1.name.toString()}@active`);

        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toEqual([{
            collection_name: "testcollect1",
            author: user1.name.toString(),
            allow_notify: true,
            authorized_accounts: [],
            notify_accounts: [test1.name.toString(), test2.name.toString(), test3.name.toString()],
            market_fee: '0.05',
            serialized_data: ''
        }]);
    });

    test("throw when there are no notify accounts", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.remnotifyacc([
            "testcollect1",
            user1.name.toString()
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The account is not a notify account");
    });

    test("throw when account is not a notify account", async () => {
        const test1 = blockchain.createAccount('test1');
        const test2 = blockchain.createAccount('test2');
        const test3 = blockchain.createAccount('test3');

        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [test1.name.toString(), test2.name.toString(), test3.name.toString()],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.remnotifyacc([
            "testcollect1",
            user1.name.toString()
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The account is not a notify account");
    });

    test("throw when collection does not exist", async () => {
        await expect(atomicassets.actions.remnotifyacc([
            "nocol",
            user1.name.toString()
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw without authorization from author", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [user1.name.toString()],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.remnotifyacc([
            "testcollect1",
            user1.name.toString()
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});