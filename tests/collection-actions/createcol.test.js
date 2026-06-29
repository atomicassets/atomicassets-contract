const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test createcol contract', () => {
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

    test("create basic collection", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
            [],
            0.05,
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

    test("create collection with notify account and two auth accounts", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString(), user2.name.toString()],
            [user1.name.toString()],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toEqual([{
            collection_name: "testcollect1",
            author: user1.name.toString(),
            allow_notify: true,
            authorized_accounts: [user1.name.toString(), user2.name.toString()],
            notify_accounts: [user1.name.toString()],
            market_fee: "0.05",
            serialized_data: ''
        }]);
    });

    test("throw when two auth accounts are duplicate", async () => {
        await expect(atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString(), user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("You can't have duplicates in the authorized_accounts");
    });

    test("throw when two notify accounts are duplicate", async () => {
        await expect(atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [user1.name.toString(), user1.name.toString()],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("You can't have duplicates in the notify_accounts");
    });

    test("throw when auth account does not exist", async () => {
        await expect(atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            ["noaccount"],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("At least one account does not exist");
    });

    test("throw when notify account does not exist", async () => {
        await expect(atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            ["noaccount"],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("At least one account does not exist");
    });

    test("throw when notify is not allowed but notify account is added", async () => {
        await expect(atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            false,
            [],
            ["noaccount"],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can't add notify_accounts if allow_notify is false");
    });

    test("throw when market_fee is too high", async () => {
        await expect(atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            false,
            [],
            [],
            0.5,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The market_fee must be between");
    });

    test("throw when market_fee is negative", async () => {
        await expect(atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            false,
            [],
            [],
            -0.05,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("The market_fee must be between");
    });

    test("throw when name is an account name", async () => {
        await expect(atomicassets.actions.createcol([
            user1.name.toString(),
            user2.name.toString(),
            false,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("When the collection has the name of an existing account, its authorization is required");
    });

    test("collection name is account name but with auth", async () => {
        await expect(atomicassets.actions.createcol([
            user1.name.toString(),
            user2.name.toString(),
            false,
            [],
            [],
            0.05,
            []
        ]).send([
            { actor: user1.name.toString(), permission: 'active' },
            { actor: user2.name.toString(), permission: 'active' }
        ])).resolves.toBeTruthy();
    });

    test("throw when collection name already exists", async () => {
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("A collection with this name already exists");
    });

    test("throw without author auth from author", async () => {
        await expect(atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            false,
            [],
            [],
            0.05,
            []
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    // createcol writes authorized_accounts / notify_accounts verbatim. addcolauth and
    // addnotifyacc cap each at 24; createcol must enforce the same cap, otherwise a single
    // createcol can seed a collection past the partial_read_collection read window and brick
    // its own auth/notify path. These guard that the cap is enforced at creation too.
    describe('24-account caps (match addcolauth / addnotifyacc)', () => {
        const NAME_CHARS = "abcdefghijklmnopqrstuvwxyz12345"; // valid eosio name chars
        function genName(i) {
            let n = i, s = "";
            for (let k = 0; k < 8; k++) { s += NAME_CHARS[n % 31]; n = Math.floor(n / 31); }
            return ("cap" + s).slice(0, 12);
        }
        let pool; // 48 distinct accounts: [0,24) auth, [24,48) notify
        beforeAll(() => {
            pool = [];
            for (let i = 0; i < 48; i++) pool.push(blockchain.createAccount(genName(i)).name.toString());
        });

        test("throw when createcol has 25 authorized accounts", async () => {
            await expect(atomicassets.actions.createcol([
                user1.name.toString(), "testcollect1", true,
                pool.slice(0, 25), [], 0.05, []
            ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can only have up to 24 authorized accounts");
        });

        test("throw when createcol has 25 notify accounts", async () => {
            await expect(atomicassets.actions.createcol([
                user1.name.toString(), "testcollect1", true,
                [user1.name.toString()], pool.slice(0, 25), 0.05, []
            ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can only have up to 24 notify accounts");
        });

        test("allow createcol at the 24 authorized + 24 notify boundary", async () => {
            await expect(atomicassets.actions.createcol([
                user1.name.toString(), "testcollect1", true,
                pool.slice(0, 24), pool.slice(24, 48), 0.05, []
            ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

            const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
            expect(collections).toHaveLength(1);
            expect(collections[0].authorized_accounts).toHaveLength(24);
            expect(collections[0].notify_accounts).toHaveLength(24);
        });
    });
});