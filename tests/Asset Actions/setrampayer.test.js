const { Blockchain, nameToBigInt } = require("@vaulta/vert");

// Coverage for the v2 self-service RAM utilities (setrampayer / setlastpayer)
// and the shared logrampayer event. At mint the ram_payer is the authorized
// minter; these actions let the asset's current owner take over the RAM cost.
describe("setrampayer / setlastpayer", () => {
    let blockchain;
    let atomicassets;
    let user1; // collection author + minter
    let user2; // unrelated account
    let user3; // asset owner

    const FIRST_ASSET = "1099511627776";  // 2^40
    const SECOND_ASSET = "1099511627777"; // 2^40 + 1

    const assetsOf = (account) =>
        atomicassets.tables.assets(nameToBigInt(account.name)).getTableRows();

    const mintTo = (owner, collection = "testcollect1") =>
        atomicassets.actions.mintasset([
            user1.name.toString(), collection, "testschema", -1,
            owner.name.toString(), [], [], []
        ]).send(`${user1.name.toString()}@active`);

    beforeAll(async () => {
        blockchain = new Blockchain();
        atomicassets = blockchain.createContract("atomicassets", "./build/atomicassets");
        user1 = blockchain.createAccount("user1");
        user2 = blockchain.createAccount("user2");
        user3 = blockchain.createAccount("user3");
    });

    beforeEach(async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);
        for (const col of ["testcollect1", "testcollect2"]) {
            await atomicassets.actions.createcol([
                user1.name.toString(), col, true, [user1.name.toString()], [], 0.05, []
            ]).send(`${user1.name.toString()}@active`);
            await atomicassets.actions.createschema([
                user1.name.toString(), col, "testschema",
                [{ name: "name", type: "string" }]
            ]).send(`${user1.name.toString()}@active`);
        }
    });

    // ---- setrampayer -------------------------------------------------------

    test("owner takes over ram_payer of an asset minted by someone else", async () => {
        await mintTo(user3);
        expect(assetsOf(user3)[0].ram_payer).toEqual(user1.name.toString()); // minter pays at mint

        blockchain.executionTraces = [];
        await expect(atomicassets.actions.setrampayer([
            user3.name.toString(), FIRST_ASSET
        ]).send(`${user3.name.toString()}@active`)).resolves.not.toThrow();

        expect(assetsOf(user3)[0].ram_payer).toEqual(user3.name.toString());

        // logrampayer fires inline (drives collection notifications)
        const log = blockchain.executionTraces.find(
            (t) => t.action && t.action.toString() === "logrampayer");
        expect(log).toBeDefined();
    });

    test("requires the authorization of new_payer", async () => {
        await mintTo(user3);
        await expect(atomicassets.actions.setrampayer([
            user3.name.toString(), FIRST_ASSET
        ]).send(`${user2.name.toString()}@active`)).rejects.toThrow();
    });

    test("fails when new_payer does not own the asset", async () => {
        await mintTo(user3);
        await expect(atomicassets.actions.setrampayer([
            user2.name.toString(), FIRST_ASSET
        ]).send(`${user2.name.toString()}@active`))
            .rejects.toThrow("No asset with this id exists in the new_payer's account");
    });

    test("fails when new_payer is already the ram_payer", async () => {
        await mintTo(user1); // minter == owner, so ram_payer is already user1
        await expect(atomicassets.actions.setrampayer([
            user1.name.toString(), FIRST_ASSET
        ]).send(`${user1.name.toString()}@active`))
            .rejects.toThrow("new_payer is already the ram_payer of this asset");
    });

    // ---- setlastpayer ------------------------------------------------------

    test("owner takes over ram_payer of their newest asset in a collection", async () => {
        await mintTo(user3, "testcollect1");
        await expect(atomicassets.actions.setlastpayer([
            user3.name.toString(), "testcollect1"
        ]).send(`${user3.name.toString()}@active`)).resolves.not.toThrow();
        expect(assetsOf(user3).find((a) => a.asset_id === FIRST_ASSET).ram_payer)
            .toEqual(user3.name.toString());
    });

    test("fails when owner holds no assets", async () => {
        await expect(atomicassets.actions.setlastpayer([
            user2.name.toString(), "testcollect1"
        ]).send(`${user2.name.toString()}@active`))
            .rejects.toThrow("owner holds no assets");
    });

    test("fails when the newest owned asset is not in the expected collection", async () => {
        await mintTo(user3, "testcollect1");  // FIRST_ASSET
        await mintTo(user3, "testcollect2");  // SECOND_ASSET = newest
        await expect(atomicassets.actions.setlastpayer([
            user3.name.toString(), "testcollect1"
        ]).send(`${user3.name.toString()}@active`))
            .rejects.toThrow("newest owned asset is not in the expected collection");
    });

    test("fails when owner is already the ram_payer of the newest asset", async () => {
        await mintTo(user1, "testcollect1"); // owner == minter == ram_payer
        await expect(atomicassets.actions.setlastpayer([
            user1.name.toString(), "testcollect1"
        ]).send(`${user1.name.toString()}@active`))
            .rejects.toThrow("owner is already the ram_payer of this asset");
    });

    // ---- logrampayer -------------------------------------------------------

    test("logrampayer can only be called by the contract itself", async () => {
        await mintTo(user3);
        await expect(atomicassets.actions.logrampayer([
            user3.name.toString(), FIRST_ASSET, user1.name.toString(), user3.name.toString()
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow();
    });
});
