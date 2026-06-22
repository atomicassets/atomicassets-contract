const { Blockchain } = require("@vaulta/vert");

/*
  Interface-header consumer coverage.

  atomicassets-interface.hpp is consumed by EXTERNAL contracts (atomicpacks,
  atomictools, atomicbridge, ...), never by atomicassets itself, so the main
  suite cannot catch regressions in it. These tests deploy a minimal consumer
  contract (tests/fixtures/interface-consumer, built by `make build`) at the
  account `ifaceconsumr` and read AtomicAssets tables THROUGH the header.

  The regression this guards against: anchoring the header's table getters at
  get_self() instead of ATOMICASSETS_ACCOUNT (fixed in PR #21). With get_self(),
  every lookup below would target ifaceconsumr's own empty scope: the positive
  tests fail and the negative control's message proves the check actually runs.
*/

describe('interface header consumer (external contract reads through atomicassets-interface.hpp)', () => {
    let blockchain;
    let atomicassets;
    let consumer;
    let user1;

    beforeAll(async () => {
        blockchain = new Blockchain();
        atomicassets = blockchain.createContract(
            'atomicassets',
            './build/atomicassets'
        );
        consumer = blockchain.createContract(
            'ifaceconsumr',
            './build/interface-consumer'
        );
        user1 = blockchain.createAccount('user1');
    });

    beforeEach(async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);

        await atomicassets.actions.createcol([
            user1.name.toString(),
            "testcollect1",
            true,
            [user1.name.toString()],
            [],
            0.05,
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createschema([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            [
                {name: "name", type: "string"},
            ]
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.createtempl2([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            true,
            true,
            10,
            [{first: "name", second: ["string", "iface nft"]}],
            []
        ]).send(`${user1.name.toString()}@active`);

        await atomicassets.actions.mintasset([
            user1.name.toString(),
            "testcollect1",
            "testschema",
            1,
            user1.name.toString(),
            [],
            [],
            []
        ]).send(`${user1.name.toString()}@active`);
    });

    test("consumer sees a collection through the interface header", async () => {
        await consumer.actions.assertcol([
            "testcollect1"
        ]).send(`${user1.name.toString()}@active`);
    });

    test("consumer sees an asset through the interface header (per-owner scope)", async () => {
        await consumer.actions.assertasset([
            user1.name.toString(),
            "1099511627776"
        ]).send(`${user1.name.toString()}@active`);
    });

    test("consumer sees a template through the interface header (per-collection scope)", async () => {
        await consumer.actions.asserttempl([
            "testcollect1",
            1
        ]).send(`${user1.name.toString()}@active`);
    });

    test("negative control: a missing collection throws the consumer's own check", async () => {
        await expect(consumer.actions.assertcol([
            "nonexistent1"
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow('collection not visible through interface header');
    });
});
