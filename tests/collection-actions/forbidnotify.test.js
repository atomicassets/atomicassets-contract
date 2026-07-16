const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test forbidnotify contract', () => {
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

    test("forbid notify", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.forbidnotify([
            "testcollect1"
        ]).send(`${user1.name.toString()}@active`);

        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toEqual([{
            collection_name: "testcollect1",
            author: user1.name.toString(),
            allow_notify: false,
            authorized_accounts: [],
            notify_accounts: [],
            market_fee: '0.05',
            serialized_data: ''
        }]);
    });

    test("throw when notify is already forbidden", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            false,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.forbidnotify([
            "testcollect1"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("allow_notify is already false for this collection");
    });

    test("throw when one account is in the notfy list", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [user1.name.toString()],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.forbidnotify([
            "testcollect1"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The collection's notify_accounts vector must be empty");
    });

    test("throw when multiple accounts are in the notfy list", async () => {
        const abc = blockchain.createAccount('abc');
        const def = blockchain.createAccount('def');
        const test123 = blockchain.createAccount('test123');

        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [user1.name.toString(), abc.name.toString(), def.name.toString(), test123.name.toString()],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.forbidnotify([
            "testcollect1"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The collection's notify_accounts vector must be empty");
    });

    test("throw when collection does not exist", async () => {
        await expect(atomicassets.actions.forbidnotify([
            "nocol"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw without authorization from author", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.forbidnotify([
            "testcollect1"
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});