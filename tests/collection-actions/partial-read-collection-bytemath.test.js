const { Blockchain, nameToBigInt } = require("@vaulta/vert");

// Regression guard for the partial_read_collection auth-path over-read. The auth path's
// 330-byte read buffer fits only authorized_accounts; before the fix it also deserialized
// notify_accounts, overflowing once a collection had >~38 combined accounts and throwing
// "datastream attempted to read past the end". These assert the fixed behavior, so the 24+24
// and 20+20 cases fail on an unfixed build. Byte math lives in src/atomicassets.cpp.
describe("partial_read_collection byte-math (A-BYTEMATH)", () => {
    let blockchain;
    let atomicassets;
    let author;

    // Deterministic, collision-free 12-char eosio name (valid chars a-z, 1-5).
    const NAME_CHARS = "abcdefghijklmnopqrstuvwxyz12345"; // valid eosio name chars
    function genName(prefix, i) {
        const base = NAME_CHARS.length;
        let n = i;
        let suffix = "";
        for (let k = 0; k < 8; k++) {
            suffix += NAME_CHARS[n % base];
            n = Math.floor(n / base);
        }
        return (prefix + suffix).slice(0, 12);
    }

    // Pre-create a pool of accounts for both vectors (49 distinct names).
    let authPool;   // 24 distinct accounts (prefix "auth")
    let notifyPool; // 24 distinct accounts (prefix "noti")

    beforeAll(async () => {
        blockchain = new Blockchain();
        atomicassets = blockchain.createContract(
            'atomicassets',
            './build/atomicassets'
        );
        author = blockchain.createAccount('author');
        authPool = [];
        notifyPool = [];
        for (let i = 0; i < 24; i++) {
            authPool.push(blockchain.createAccount(genName("auth", i)).name.toString());
        }
        for (let i = 0; i < 24; i++) {
            notifyPool.push(blockchain.createAccount(genName("noti", i)).name.toString());
        }
    });

    beforeEach(async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);
        // String field so serialized_data can be made large.
        await atomicassets.actions.admincoledit([
            [
                {"name": "name", "type": "string"},
                {"name": "description", "type": "string"}
            ]
        ]).send(`${atomicassets.name.toString()}@active`);
    });

    // Create a collection whose authorized_accounts has `nAuth` entries (always
    // including `author` first so author actions are authorized) and whose
    // notify_accounts has `nNotify` entries. Optionally attach a large
    // serialized_data so data_size exceeds the read windows (forcing min()).
    async function makeCollection(nAuth, nNotify, bigData) {
        const auth = [author.name.toString(), ...authPool].slice(0, nAuth);
        const notify = notifyPool.slice(0, nNotify);
        await atomicassets.actions.createcol([
            author.name.toString(),
            "bytemathcoll",
            true,
            auth,
            notify,
            0.05,
            []
        ]).send(`${author.name.toString()}@active`);

        if (bigData) {
            await atomicassets.actions.setcoldata([
                "bytemathcoll",
                [{"first": "description", "second": ["string", "X".repeat(2000)]}]
            ]).send(`${author.name.toString()}@active`);
        }
    }

    // ---- AUTH PATH (type=false, 330 window) -------------------------------

    // Baseline. After the early-return fix the auth path reads only authorized_accounts
    // and never deserializes notify_accounts, so it finds `author` and proceeds. This case
    // also passed pre-fix, where N + M = 38 sat just under the 330-byte overflow boundary.
    test("auth path succeeds at 19 authorized + 19 notify (within the 330-byte budget)", async () => {
        await makeCollection(19, 19, true);

        // createschema -> check_has_collection_auth(author): must find `author`
        // inside the fully-read authorized_accounts vector.
        await expect(atomicassets.actions.createschema([
            author.name.toString(),
            "bytemathcoll",
            "testschema",
            [
                {name: "name", type: "string"},
                {name: "level", type: "uint32"}
            ]
        ]).send(`${author.name.toString()}@active`)).resolves.not.toThrow();

        const schemas = atomicassets.tables.schemas(nameToBigInt("bytemathcoll")).getTableRows();
        expect(schemas).toHaveLength(1);
        expect(schemas[0].schema_name).toBe("testschema");
    });

    // FIXED: at the max 24 authorized + 24 notify (N + M = 48, formerly an overflow),
    // the auth path early-returns after authorized_accounts and no longer over-reads
    // notify_accounts, so the authorized action succeeds. This is the regression guard
    // for the A-BYTEMATH fix, it FAILS (throws) against an unfixed build.
    test("auth path succeeds at 24 authorized + 24 notify (max caps) after the early-return fix", async () => {
        await makeCollection(24, 24, true);

        await expect(atomicassets.actions.createschema([
            author.name.toString(),
            "bytemathcoll",
            "testschema",
            [
                {name: "name", type: "string"},
                {name: "level", type: "uint32"}
            ]
        ]).send(`${author.name.toString()}@active`)).resolves.not.toThrow();

        const schemas = atomicassets.tables.schemas(nameToBigInt("bytemathcoll")).getTableRows();
        expect(schemas).toHaveLength(1);
        expect(schemas[0].schema_name).toBe("testschema");
    });

    // The former 38-account overflow boundary (20 + 20 = 40) is gone after the fix.
    test("auth path succeeds at the former 20 + 20 overflow boundary after the fix", async () => {
        await makeCollection(20, 20, true);

        await expect(atomicassets.actions.createschema([
            author.name.toString(),
            "bytemathcoll",
            "testschema",
            [{name: "name", type: "string"}]
        ]).send(`${author.name.toString()}@active`)).resolves.not.toThrow();

        const schemas = atomicassets.tables.schemas(nameToBigInt("bytemathcoll")).getTableRows();
        expect(schemas).toHaveLength(1);
    });

    // ---- NOTIFY PATH (type=true, 523 window) ------------------------------

    // The notify path reads a full 24-element notify_accounts vector (with a
    // minimal authorized_accounts) and require_recipient's every entry, even past
    // a large serialized_data (data_size >> 523, so min() truncates the buffer).
    test("notify path reads a full 24-account notify vector past a large serialized_data", async () => {
        await makeCollection(1, 24, true);

        // Confirm the stored row really is far past the 523-byte window and holds
        // the full 24-element notify vector.
        const collections = atomicassets.tables.collections(
            nameToBigInt(atomicassets.name)).getTableRows();
        expect(collections).toHaveLength(1);
        expect(collections[0].notify_accounts).toHaveLength(24);
        expect(collections[0].serialized_data.length).toBeGreaterThan(523 * 2); // hex chars

        // mintasset -> (inline) logmint -> notify_collection_accounts(collection):
        // logmint deserializes the full notify_accounts vector out of the 523-byte
        // window and require_recipient's each. If the read TRUNCATED the 24-element
        // notify vector, the datastream would overflow and the inline logmint would
        // throw, rolling back the whole mintasset transaction. So a clean,
        // non-throwing mint that leaves a persisted asset row is the observable
        // proof that all 24 notify accounts were read in full. (The VM does not
        // surface require_recipient to code-less accounts as separate traces, so we
        // assert via the inline action completing rather than counting recipients.)
        await atomicassets.actions.createschema([
            author.name.toString(),
            "bytemathcoll",
            "testschema",
            [{name: "name", type: "string"}]
        ]).send(`${author.name.toString()}@active`);
        await atomicassets.actions.createtempl([
            author.name.toString(),
            "bytemathcoll",
            "testschema",
            true, true, 0, []
        ]).send(`${author.name.toString()}@active`);

        await expect(atomicassets.actions.mintasset([
            author.name.toString(),
            "bytemathcoll",
            "testschema",
            1,
            author.name.toString(),
            [], [], []
        ]).send(`${author.name.toString()}@active`)).resolves.not.toThrow();

        // The inline logmint (with the 24-account notify read) committed: a new
        // asset row persisted, and the logmint inline action ran without overflow.
        const assets = atomicassets.tables.assets(nameToBigInt(author.name)).getTableRows();
        expect(assets).toHaveLength(1);
        expect(assets[0]).toMatchObject({ collection_name: "bytemathcoll", template_id: 1 });

        const logmint = blockchain.executionTraces.find(
            (t) => t.action && t.action.toString() === "logmint");
        expect(logmint).toBeDefined();
    });
});
