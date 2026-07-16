const { Blockchain, nameToBigInt } = require("@vaulta/vert");

describe('test rejectauswap contract', () => {
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

    test("successfully reject author swap by current author", async () => {
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
            false // active permission
        ]).send(`${user1.name.toString()}@active`);

        // Verify author swap exists
        let authorSwaps = atomicassets.tables.authorswaps(nameToBigInt(atomicassets.name)).getTableRows();
        expect(authorSwaps).toHaveLength(1);

        // Reject the author swap by current author
        await expect(atomicassets.actions.rejectauswap([
            "testcollect1"
        ]).send(`${user1.name.toString()}@active`)).resolves.not.toThrow();

        // Verify author swap was removed
        authorSwaps = atomicassets.tables.authorswaps(nameToBigInt(atomicassets.name)).getTableRows();
        expect(authorSwaps).toHaveLength(0);

        // Verify collection author remains unchanged
        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections[0].author).toBe(user1.name.toString());
    });

    test("successfully reject author swap by new author", async () => {
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
            true // owner permission
        ]).send(`${user1.name.toString()}@owner`);

        // Verify author swap exists
        let authorSwaps = atomicassets.tables.authorswaps(nameToBigInt(atomicassets.name)).getTableRows();
        expect(authorSwaps).toHaveLength(1);

        // Reject the author swap by new author
        await expect(atomicassets.actions.rejectauswap([
            "testcollect1"
        ]).send(`${user2.name.toString()}@active`)).resolves.not.toThrow();

        // Verify author swap was removed
        authorSwaps = atomicassets.tables.authorswaps(nameToBigInt(atomicassets.name)).getTableRows();
        expect(authorSwaps).toHaveLength(0);

        // Verify collection author remains unchanged
        const collections = atomicassets.tables.collections(nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections[0].author).toBe(user1.name.toString());
    });

    test("throw if collection does not exist", async () => {
        await expect(atomicassets.actions.rejectauswap([
            "nonexistent"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No collection with this name exists");
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

        await expect(atomicassets.actions.rejectauswap([
            "testcollect1"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("No author swaps for this collection found");
    });

    test("throw if missing required authorization", async () => {
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
            false
        ]).send(`${user1.name.toString()}@active`);

        // Try to reject with unauthorized account (user3)
        await expect(atomicassets.actions.rejectauswap([
            "testcollect1"
        ]).send(`${user3.name.toString()}@active`)).rejects.toThrow("Missing required authorizations");
    });
});