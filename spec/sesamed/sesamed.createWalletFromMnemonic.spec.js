// npm packages
var rewire = require("rewire");

// local modules
const sesamed = rewire("../../src/sesamed");

describe("createWalletFromMnemonic", function () {
    let spyEthers;

    let testWallet = {
        signingKey: {
            mnemonic: "mnemonic",
            path: "path",
            privateKey: "privateKey",
            address: "address"
        }
    };
    let createWalletFromMnemonic;


    beforeEach(function () {
        spyEthers = {
            Wallet: {
                fromMnemonic: jasmine.createSpy().and.returnValue(testWallet)
            }
        };
        sesamed.__set__({ethers: spyEthers});

        createWalletFromMnemonic = sesamed.__get__("createWalletFromMnemonic");
    });

    it("should be a function", async function () {
        expect(typeof createWalletFromMnemonic).toBe("function");
    });

    it("should call ethers.Wallet.fromMnemonic once", async function () {
        createWalletFromMnemonic();
        return expect(spyEthers.Wallet.fromMnemonic.calls.count()).toEqual(1);
    });

    it("should call ethers.Wallet.fromMnemonic with", async function () {
        createWalletFromMnemonic("mnemonic");
        return expect(spyEthers.Wallet.fromMnemonic).toHaveBeenCalledWith("mnemonic");
    });

    it("should call return correct Wallet", function () {
        let wallet = createWalletFromMnemonic();
        return expect(wallet).toEqual(testWallet.signingKey);
    });

});