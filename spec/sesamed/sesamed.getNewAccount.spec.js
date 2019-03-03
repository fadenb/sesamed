// npm packages
var rewire = require("rewire");

// local modules
const sesamed = rewire("../../src/sesamed");

describe("getNewAccount", function () {
    let spyCreateMnemonic;
    let spyCreateWalletFromMnemonic;
    let spyPgp;
    let spyEthers;

    let err = new Error("getNewAccount: name missing");

    beforeEach(function () {
        spyCreateMnemonic = jasmine.createSpy("spyCreateMnemonic").and.returnValue("I am a mnemonic.");
        sesamed.__set__({createMnemonic: spyCreateMnemonic});

        spyCreateWalletFromMnemonic = jasmine.createSpy("spyCreateWalletFromMnemonic").and.returnValue({
            mnemonic: "I am a mnemonic.",
            address: "I am an address."
        });
        sesamed.__set__({createWalletFromMnemonic: spyCreateWalletFromMnemonic});

        spyPgp = {
            generateKeys: jasmine.createSpy("spyGenerateKeys").and.returnValue({privateKey: "I am a private key."}),
            getPublicKeyFromPrivateKey: jasmine.createSpy("getPKFPK").and.callFake(() => {
                return Promise.resolve("I am a public key.");
            })
        };
        sesamed.__set__({pgp: spyPgp});

        spyEthers = {
            utils: {
                id: jasmine.createSpy("ether.utils.id").and.callFake(str => {
                    return str + "Hashed";
                }),
            }
        };
        sesamed.__set__({ethers: spyEthers});
    });

    it("should be a function", async function () {
        expect(typeof sesamed.getNewAccount).toBe("function");
    });

    it("should throw Error if name is missing", async function () {
        return expectAsync(sesamed.getNewAccount()).toBeRejectedWith(err);
    });

    it("should throw Error if name is empty", async function () {
        return expectAsync(sesamed.getNewAccount("")).toBeRejectedWith(err);
    });

    it("should throw Error if name is no string", async function () {
        return expectAsync(sesamed.getNewAccount(1)).toBeRejectedWith(err);
    });

    it("should call createMnemioc once", async function () {
        await sesamed.getNewAccount("alice");
        return expect(spyCreateMnemonic.calls.count()).toEqual(1);
    });

    it("should call pgp.createKeys", async function () {
        await sesamed.getNewAccount("alice");
        return expect(spyPgp.generateKeys.calls.count()).toEqual(1);
    });

    it("should call pgp.createKeys with name and mnemonic", async function () {
        await sesamed.getNewAccount("alice");
        return expect(spyPgp.generateKeys).toHaveBeenCalledWith("alice", "I am a mnemonic.");
    });

    it("should return an object with a name", async function () {
        let account = await sesamed.getNewAccount("alice");
        return expect(account.name).toEqual("alice");
    });

    it("should return an object with a nameHash", async function () {
        let account = await sesamed.getNewAccount("alice");
        return expect(account.nameHash).toEqual("aliceHashed");
    });

    it("should return an object with a mnemonic", async function () {
        let account = await sesamed.getNewAccount("alice");
        return expect(account.mnemonic).toEqual("I am a mnemonic.");
    });

    it("should return an object with an address", async function () {
        let account = await sesamed.getNewAccount("alice");
        return expect(account.address).toEqual("I am an address.");
    });

    it("should return an object with a privateKey", async function () {
        let account = await sesamed.getNewAccount("alice");
        return expect(account.privateKey).toEqual("I am a private key.");
    });

    it("should return an object with an publicKey", async function () {
        let account = await sesamed.getNewAccount("alice");
        return expect(account.publicKey).toEqual("I am a public key.");
    });

    it("should return the full object", async function () {
        let account = await sesamed.getNewAccount("alice");
        return expect(account).toEqual({
            name: "alice",
            nameHash: "aliceHashed",
            mnemonic: "I am a mnemonic.",
            passphrase: "I am a mnemonic.",
            address: "I am an address.",
            privateKey: "I am a private key.",
            publicKey: "I am a public key."
        });
    });

});