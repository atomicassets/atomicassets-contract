const { Blockchain, nameToBigInt } = require("@vaulta/vert");
const { TimePoint } = require("@wharfkit/antelope");

describe('test acceptauswap contract', () => {
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

    test("successfully accept author swap with owner permission (immediate)", async () => {
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

        // Create author swap with owner permission (immediate acceptance)
        await atomicassets.actions.createauswap([
            "testcollect1",
            user2.name.toString(),
            true // owner permission = immediate
        ]).send(`${user1.name.toString()}@owner`);

        // produce 10 block, add 5 second to current time
        blockchain.addBlocks(10);

        // Accept the author swap immediately
        await atomicassets.actions.acceptauswap([
            "testcollect1"
        ]).send(`${user2.name.toString()}@active`);

        // Verify collection author was changed
        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toHaveLength(1);
        expect(collections[0].author).toBe(user2.name.toString());

        // Verify author swap was removed
        const authorSwaps = atomicassets.tables.authorswaps(nameToBigInt(atomicassets.name)).getTableRows();
        expect(authorSwaps).toHaveLength(0);
    });

    test("successfully accept author swap with active permission after time delay", async () => {
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

        // Create author swap with active permission (1 week delay)
        await atomicassets.actions.createauswap([
            "testcollect1",
            user2.name.toString(),
            false // active permission = 1 week delay
        ]).send(`${user1.name.toString()}@active`);

        // Advance time by 1 week
        const oneWeek = 60 * 60 * 24 * 7;
        blockchain.addTime(TimePoint.fromMilliseconds(oneWeek * 1000 + 1000));

        // Accept the author swap after time delay
        await expect(atomicassets.actions.acceptauswap([
            "testcollect1"
        ]).send(`${user2.name.toString()}@active`)).resolves.not.toThrow();

        // Verify collection author was changed
        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toHaveLength(1);
        expect(collections[0].author).toBe(user2.name.toString());

        // Verify author swap was removed
        const authorSwaps = atomicassets.tables.authorswaps(nameToBigInt(atomicassets.name)).getTableRows();
        expect(authorSwaps).toHaveLength(0);
    });

    test("throw if collection does not exist", async () => {
        await expect(atomicassets.actions.acceptauswap([
            "nonexistent"
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
    });

    test("throw if no author swap exists for collection", async () => {
        // Create collection but no author swap
        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await expect(atomicassets.actions.acceptauswap([
            "testcollect1"
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("No author swaps for this collection found");
    });

    test("throw if missing authorization from new_author", async () => {
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

        // Create author swap
        await atomicassets.actions.createauswap([
            "testcollect1",
            user2.name.toString(),
            true // immediate acceptance
        ]).send(`${user1.name.toString()}@owner`);

        // Try to accept with wrong authorization (user3 instead of user2)
        await expect(atomicassets.actions.acceptauswap([
            "testcollect1"
        ]).send(`${user3.name.toString()}@active`)).rejects.toThrow("missing required authority");

        // Try to accept with current author instead of new author
        await expect(atomicassets.actions.acceptauswap([
            "testcollect1"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });

    test("throw if accepting too early (before acceptance_date)", async () => {
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

        // Create author swap with active permission (1 week delay)
        await atomicassets.actions.createauswap([
            "testcollect1",
            user2.name.toString(),
            false // active permission = 1 week delay
        ]).send(`${user1.name.toString()}@active`);

        // Try to accept immediately (should fail)
        await expect(atomicassets.actions.acceptauswap([
            "testcollect1"
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("seconds remaining until this author swap can be accepted");
    });

    test("throw if accepting too late (after expiration)", async () => {
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

        // Create author swap with owner permission (immediate acceptance)
        await atomicassets.actions.createauswap([
            "testcollect1",
            user2.name.toString(),
            true // immediate acceptance
        ]).send(`${user1.name.toString()}@owner`);

        // Advance time by more than 1 week (expiration period)
        const oneWeek = 60 * 60 * 24 * 7;
        blockchain.addTime(TimePoint.fromMilliseconds(oneWeek * 1000 + 1000));

        // Try to accept after expiration (should fail)
        await expect(atomicassets.actions.acceptauswap([
            "testcollect1"
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow("Author swap for this collection has expired");
    });
});