const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test addcolauth contract', () => {
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

    test("add one account", async () => {
        // Create collection with empty authorized_accounts
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.addcolauth([
            "testcollect1",
            user1.name.toString()
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

    test("add second account", async () => {
        // Create collection with user1 as authorized
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.addcolauth([
            "testcollect1",
            user2.name.toString()
        ]).send(`${user1.name.toString()}@active`);

        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toEqual([{
            collection_name: "testcollect1",
            author: user1.name.toString(),
            allow_notify: true,
            authorized_accounts: [user1.name.toString(), user2.name.toString()],
            notify_accounts: [],
            market_fee: '0.05',
            serialized_data: ''
        }]);
    });

    test("throw when not an account", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.addcolauth([
            "testcollect1",
            "noaccount"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The account does not exist");
    });

    test("throw when duplicate", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.addcolauth([
            "testcollect1",
            user1.name.toString()
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The account is already an authorized account");
    });

    test("throw when collection does not exist", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.addcolauth([
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
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.addcolauth([
            "testcollect1",
            user1.name.toString()
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw when exceeding 24 authorized accounts limit", async () => {
        // Create additional accounts for testing
        const testAccounts = [];
        for (let i = 1; i <= 25; i++) {
            const a = i % 5 + 1;
            const b = Math.floor(i/5) + 1;
            const account = blockchain.createAccount(`testuser${a}${b}`);
            testAccounts.push(account);
        }

        // Create collection with first 23 authorized accounts (plus user1 as author makes 24 total)
        const initialAuthorizedAccounts = [];
        for (let i = 0; i < 24; i++) {
            initialAuthorizedAccounts.push(testAccounts[i].name.toString());
        }

        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            initialAuthorizedAccounts,
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Try to add the 24th account (which would make 25 total with author)
        await expect(atomicassets.actions.addcolauth([
            "testcollect1",
            testAccounts[24].name.toString()
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can only have up to 24 authorized accounts");
    });
});