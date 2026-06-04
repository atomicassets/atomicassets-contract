const { Blockchain, nameToBigInt } = require("@vaulta/vert");

// A-BYTEMATH regression tests for partial_read_collection().
//
// REQUIRES the contract fix on branch `fix/partial-read-collection-bytemath`
// (src/atomicassets.cpp). These assertions describe the FIXED behavior and will
// FAIL against an unfixed dev-production-3 build (where the auth path throws at
// N + M > 38). Build the fixed contract before running this file.
//
// partial_read_collection() does NOT read the whole collection row; it reads only a
// fixed prefix and datastream-deserializes it:
//
//   read_size = min(data_size, type ? 523 : 330)   // 330 = auth path, 523 = notify path
//   ds >> collection_name;     // 8
//   ds >> author;              // 8
//   ds >> allow_notify;        // 1
//   ds >> authorized_accounts; // 1 + 8*N
//   if (!type) return authorized_accounts;   // FIX: auth path stops here
//   ds >> notify_accounts;     // 1 + 8*M
//   return notify_accounts;
//
// THE BUG (pre-fix): the auth path (type=false, 330-byte window) deserialized
// notify_accounts unconditionally, so it had to read to byte 19 + 8*(N + M); for
// the 330 window that overflowed once N + M > 38, throwing "datastream attempted to
// read past the end" and bricking every check_has_collection_auth caller. The
// contract's byte-math comment had budgeted 330 = 128 + 9 + 192, assuming a phantom
// 128-byte row/PK prefix db_get_i64 does NOT return and that the auth path needed
// only authorized_accounts.
//
// THE FIX: the auth path early-returns after authorized_accounts (<=210 bytes,
// well within 330), so it never over-reads. The notify path still reads through
// notify_accounts (<=403 bytes, within 523). Both 24-account caps are now safe.
describe("partial_read_collection byte-math (A-BYTEMATH)", () => {
    let blockchain;
    let atomicassets;
    let author;

    // Deterministic, collision-free 12-char eosio name (valid chars a-z, 1-5).
    const NAME_CHARS = "abcdefghijklmnopqrstuvwxyz12345"; // 31 valid name chars
    function genName(prefix, i) {
        let n = i;
        let suffix = "";
        for (let k = 0; k < 8; k++) {
            suffix += NAME_CHARS[n % 31];
            n = Math.floor(n / 31);
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

    // Within budget (N + M <= 38): the auth path reads BOTH vectors fine and the
    // authorized action proceeds.
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
    // for the A-BYTEMATH fix — it FAILS (throws) against an unfixed build.
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
