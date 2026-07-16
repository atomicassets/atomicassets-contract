const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test createauswap contract', () => {
    let blockchain;
    let atomicassets;
    let user1;
    let user2;
    let user3;

    beforeAll(async () => {
        blockchain = new Blockchain();
        atomicassets = blockchain.createContract(
            'atomicassets',
            './build/atomicassets'
        );
        user1 = blockchain.createAccount('user1');
        user2 = blockchain.createAccount('user2');
        user3 = blockchain.createAccount('user3');
    });

    beforeEach(async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);
    });

    test("successfully create author swap with active permission", async () => {
        // Create collection
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create author swap with active permission (owner=false)
        await expect(atomicassets.actions.createauswap([
            "testcollect1",
            user2.name.toString(),
            false // owner permission = false (active permission)
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify author swap was created
        const authorSwaps = atomicassets.tables.authorswaps(nameToBigInt(atomicassets.name)).getTableRows();
        expect(authorSwaps).toHaveLength(1);
        expect(authorSwaps[0].collection_name).toBe("testcollect1");
        expect(authorSwaps[0].current_author).toBe(user1.name.toString());
        expect(authorSwaps[0].new_author).toBe(user2.name.toString());

        // With active permission, acceptance_date should be current time + 1 week
        // acceptance_date is stored as sec_since_epoch, so compare in seconds.
        const currentTime = Math.floor(blockchain.timestamp.toMilliseconds() / 1000);
        const oneWeek = 60 * 60 * 24 * 7;
        expect(parseInt(authorSwaps[0].acceptance_date)).toBe(currentTime + oneWeek);
    });

    test("successfully create author swap with owner permission", async () => {
        // Create collection
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create author swap with owner permission (owner=true)
        await expect(atomicassets.actions.createauswap([
            "testcollect1",
            user2.name.toString(),
            true // owner permission = true
        ]).send(`${user1.name.toString()}@owner`)).resolves.not.toThrow();

        // Verify author swap was created
        const authorSwaps = atomicassets.tables.authorswaps(nameToBigInt(atomicassets.name)).getTableRows();
        expect(authorSwaps).toHaveLength(1);
        expect(authorSwaps[0].collection_name).toBe("testcollect1");
        expect(authorSwaps[0].current_author).toBe(user1.name.toString());
        expect(authorSwaps[0].new_author).toBe(user2.name.toString());

        // With owner permission, acceptance_date should be current time (immediate)
        // acceptance_date is stored as sec_since_epoch, so compare in seconds.
        const currentTime = Math.floor(blockchain.timestamp.toMilliseconds() / 1000);
        expect(parseInt(authorSwaps[0].acceptance_date)).toBe(currentTime);
    });

    test("throw if collection does not exist", async () => {
        await expect(atomicassets.actions.createauswap([
            "nonexistent",
            user2.name.toString(),
            false
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw if missing author authorization with active permission", async () => {
        // Create collection
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Try to create author swap without proper authorization
        await expect(atomicassets.actions.createauswap([
            "testcollect1",
            user2.name.toString(),
            false // active permission
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw if missing owner authorization with owner permission", async () => {
        // Create collection
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Try to create author swap with owner=true but only active permission
        await expect(atomicassets.actions.createauswap([
            "testcollect1",
            user2.name.toString(),
            true // owner permission required
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw if author swap already exists for collection", async () => {
        // Create collection
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create first author swap
        await atomicassets.actions.createauswap([
            "testcollect1",
            user2.name.toString(),
            false
        ]).send(`${user1.name.toString()}@active`);

        // Try to create second author swap for same collection
        await expect(atomicassets.actions.createauswap([
            "testcollect1",
            user3.name.toString(),
            false
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("Can't swap author's while an authorswap is underway for this collection");
    });

    test("allow creating author swap for different collections", async () => {
        // Create first collection
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create second collection
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect2",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create author swap for first collection
        await expect(atomicassets.actions.createauswap([
            "testcollect1",
            user2.name.toString(),
            false
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Create author swap for second collection
        await expect(atomicassets.actions.createauswap([
            "testcollect2",
            user3.name.toString(),
            false
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify both author swaps exist
        const authorSwaps = atomicassets.tables.authorswaps(nameToBigInt(atomicassets.name)).getTableRows();
        expect(authorSwaps).toHaveLength(2);

        const swap1 = authorSwaps.find(swap => swap.collection_name === "testcollect1");
        const swap2 = authorSwaps.find(swap => swap.collection_name === "testcollect2");

        expect(swap1).toBeDefined();
        expect(swap1.new_author).toBe(user2.name.toString());

        expect(swap2).toBeDefined();
        expect(swap2.new_author).toBe(user3.name.toString());
    });

    test("allow same new_author for different collections", async () => {
        // Create first collection
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        // Create second collection with different author
        await atomicassets.actions.createcol([
            user2.name.toString(),
            "testcollect2",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user2.name.toString()}@active`);

        // Create author swap from user1 to user3
        await expect(atomicassets.actions.createauswap([
            "testcollect1",
            user3.name.toString(),
            false
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Create author swap from user2 to user3 (same new_author)
        await expect(atomicassets.actions.createauswap([
            "testcollect2",
            user3.name.toString(),
            false
        ]).send(`${user2.name.toString()}@active`)).resolves.not.toThrow();

        // Verify both author swaps exist with same new_author
        const authorSwaps = atomicassets.tables.authorswaps(nameToBigInt(atomicassets.name)).getTableRows();
        expect(authorSwaps).toHaveLength(2);

        authorSwaps.forEach(swap => {
            expect(swap.new_author).toBe(user3.name.toString());
        });
    });
});