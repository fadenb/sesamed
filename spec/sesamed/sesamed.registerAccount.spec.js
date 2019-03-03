// npm packages
var rewire = require("rewire");

// local modules
const sesamed = rewire("../../src/sesamed");

describe("registerAccount", function () {
    let spyCreateWalletFromMnemonic;
    let spyIpfs;
    let spyMultihash;
    let spyGlobal;

    let err = new Error("registerAccount: no account set - use setAccount before");

    beforeEach(function () {
        spyCreateWalletFromMnemonic = jasmine.createSpy("spyCreateWalletFromMnemonic").and.returnValue({
            mnemonic: "I am a mnemonic.",
            address: "I am an address."
        });
        sesamed.__set__({createWalletFromMnemonic: spyCreateWalletFromMnemonic});

        spyIpfs = {
            write: jasmine.createSpy("ipfs.write").and.returnValue("I am an ipfsHash.")
        };
        sesamed.__set__({ipfs: spyIpfs});

        spyMultihash = {
            getMultihashFromBase58: jasmine.createSpy("getMultihashFromBase58").and.returnValue({
                digest: "I am a digest."
            })
        };
        sesamed.__set__({multihash: spyMultihash});

        spyGlobal = {
            account: {
                name: "I am a name.",
                nameHash: "I am a nameHash.",
                publicKey: "I am a public key."
            },
            contracts: {
                account: {
                    register: jasmine.createSpy("global.contracts.account.connect").and.returnValue({
                        hash: "I am a txHash."
                    })
                }
            },
            provider: {
                waitForTransaction: jasmine.createSpy("waitForTransaction").and.returnValue("I am a receipt.")
            }
        };
        sesamed.__set__({global: spyGlobal});
    });


    it("should be a function", async function () {
        expect(typeof sesamed.registerAccount).toBe("function");
    });

    it("should throw Error if global.name is not set", async function () {
        delete spyGlobal.name;
        expectAsync(sesamed.registerAccount()).toBeRejectedWith(err);
    });

    it("should call ipfs.write", async function () {
        await sesamed.registerAccount();

        return expect(spyIpfs.write).toHaveBeenCalledWith("I am a public key.");
    });

    it("should call multihash.getMultihashFromBase58", async function () {
        await sesamed.registerAccount();

        return expect(spyMultihash.getMultihashFromBase58).toHaveBeenCalledWith("I am an ipfsHash.");
    });

    it("should call global.accountContract.register with correct params", async function () {
        await sesamed.registerAccount();

        return expect(spyGlobal.contracts.account.register).toHaveBeenCalledWith(
            "I am a nameHash.",
            "I am a digest.",
            {gasLimit: 150000}
        );
    });

    it("should call global.provider.waitForTransaction with tx.Hash", async function () {
        await sesamed.registerAccount();

        return expect(spyGlobal.provider.waitForTransaction).toHaveBeenCalledWith("I am a txHash.");
    });

    it("should return a receipt", async function () {
        let receipt = await sesamed.registerAccount();

        return expect(receipt).toEqual("I am a receipt.");
    });

});