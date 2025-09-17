const { Blockchain, nameToBigInt, expectToThrow } = require("@vaulta/vert");

describe('test admincoledit', () => {
    let blockchain;
    let atomicassets;
    let user1;

    beforeAll(async () => {
        blockchain = new Blockchain();
        atomicassets = blockchain.createContract(
            'atomicassets',
        './build/atomicassets' 
        );
        user1 = blockchain.createAccount('user11111111');
    });

    beforeEach(async () => {
        blockchain.resetTables();
        await atomicassets.actions.init([]).send(`${atomicassets.name.toString()}@active`);
    });

    it("set single valid line", async () => {
        await atomicassets.actions.admincoledit([
                [{"name": "name", "type": "string"}]
        ]).send(`${atomicassets.name.toString()}@active`);
    
        const config_row = atomicassets.tables.config(nameToBigInt(atomicassets.name)).getTableRows()[0];
        expect(config_row["collection_format"]).toEqual(
            [
                {"name": "name", "type": "string"}
            ]
        );
    });
    
    it("set two valid lines at once", async () => {
        await atomicassets.actions.admincoledit([
            [
                {"name": "name", "type": "string"},
                {"name": "img", "type": "ipfs"}
            ]
        ]).send(`${atomicassets.name.toString()}@active`);
    
        const config_row = atomicassets.tables.config(nameToBigInt(atomicassets.name)).getTableRows()[0];
        expect(config_row["collection_format"]).toEqual(
            [
                {"name": "name", "type": "string"},
                {"name": "img", "type": "ipfs"}
            ]
        );
    });
    
    it("set two valid lines in two actions", async () => {
        await atomicassets.actions.admincoledit([
            [
                {"name": "name", "type": "string"}
            ]
        ]).send(`${atomicassets.name.toString()}@active`);
    
        await atomicassets.actions.admincoledit([
            [
                {"name": "img", "type": "ipfs"}
            ]
        ]).send(`${atomicassets.name.toString()}@active`);
    
        const config_row = atomicassets.tables.config(nameToBigInt(atomicassets.name)).getTableRows()[0];
        expect(config_row["collection_format"]).toEqual(
            [
                {"name": "name", "type": "string"},
                {"name": "img", "type": "ipfs"}
            ]
        );
    });
    
    it("throw if nothing is added", async () => {
        await expect(atomicassets.actions.admincoledit([
            []
        ]).send(`${atomicassets.name.toString()}@active`)).rejects.toThrow("Need to add at least one new line");
    });
    
    it("throw if no name attribute is defined", async () => {
        await expect(atomicassets.actions.admincoledit([
            [
                {"name": "img", "type": "ipfs"}
            ]
        ]).send(`${atomicassets.name.toString()}@active`)).rejects.toThrow(`A format line with {\"name\": \"name\" and \"type\": \"string\"} needs to be defined`);
    });
    
    it("throw if two attributes have same name", async () => {
        await expect(atomicassets.actions.admincoledit([
            [
                {"name": "name", "type": "string"},
                {"name": "name", "type": "string"}
            ]
        ]).send(`${atomicassets.name.toString()}@active`)).rejects.toThrow("there already is an attribute with the same name");
    });
    
    it("throw if type is invalid", async () => {
        await expect(atomicassets.actions.admincoledit([
            [
                {"name": "name", "type": "banana"}
            ]
        ]).send(`${atomicassets.name.toString()}@active`)).rejects.toThrow("'type' attribute has an invalid format");
    });
    
    it("throw without authorization", async () => {
        await expect(atomicassets.actions.admincoledit([
            []
        ]).send(`${user1.name.toString()}@active`)).rejects.toThrow("missing required authority");
    });
});