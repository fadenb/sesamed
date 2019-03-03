// npm packages
var rewire = require("rewire");

// local modules
const sesamed = rewire("../../src/sesamed");

describe("setAccount", function () {
    let spyCreateWalletFromMnemonic;
    let spyEthers;
    let spyGlobal;

    let err = new Error("setAccount: account incomplete");

    beforeEach(function () {
        spyCreateWalletFromMnemonic = jasmine.createSpy("spyCreateWalletFromMnemonic").and.returnValue({
            mnemonic: "I am a mnemonic.",
            address: "I am an address."
        });
        sesamed.__set__({createWalletFromMnemonic: spyCreateWalletFromMnemonic});

        spyEthers = {
            Wallet: jasmine.createSpy("ethers.Wallet").and.returnValue({
                getValue: () => {return "I am a wallet.";}
            })
        };
        sesamed.__set__({ethers: spyEthers});

        spyGlobal = {
            contracts: {
                account: {
                    connect: jasmine.createSpy("global.contracts.account.connect").and.callFake(wallet => {
                        return wallet.getValue() + "account";
                    })
                },
                channel: {
                    connect: jasmine.createSpy("global.contracts.channel.connect").and.callFake(wallet => {
                        return wallet.getValue() + "channel";
                    })
                },
                document: {
                    connect: jasmine.createSpy("global.contracts.document.connect").and.callFake(wallet => {
                        return wallet.getValue() + "document";
                    })
                }
            }
        };
        sesamed.__set__({global: spyGlobal});
    });


    it("should be a function", async function () {
        expect(typeof sesamed.setAccount).toBe("function");
    });

    it("should throw Error if account is missing", async function () {
        return expectAsync(sesamed.setAccount()).toBeRejectedWith(err);
    });

    it("should throw Error if name is missing", async function () {
        return expectAsync(sesamed.setAccount({
            mnenomic: "mnenomic", privateKey: "privateKey"
        })).toBeRejectedWith(err);
    });

    it("should throw Error if mnenomic is missing", async function () {
        return expectAsync(sesamed.setAccount({
            name: "alice", privateKey: "privateKey"
        })).toBeRejectedWith(err);
    });

    it("should throw Error if privateKey is missing", async function () {
        return expectAsync(sesamed.setAccount({
            name: "alice", mnemonic: "mnemonic"
        })).toBeRejectedWith(err);
    });


    it("should call createWalletFromMnemonic()", async function () {
        await sesamed.setAccount({
            name: "alice", mnemonic: "mnemonic", privateKey: "privateKey"
        });

        return expect(spyCreateWalletFromMnemonic.calls.count()).toEqual(1);
    });

    it("should call createWalletFromMnemonic() with mnemonic", async function () {
        await sesamed.setAccount({
            name: "alice", mnemonic: "mnemonic", privateKey: "privateKey"
        });

        return expect(spyCreateWalletFromMnemonic).toHaveBeenCalledWith("mnemonic");
    });

    it("should call global.contracts.account.connect with wallet", async function () {
        await sesamed.setAccount({
            name: "alice", mnemonic: "mnemonic", privateKey: "privateKey"
        });

        expect(spyGlobal.contracts.account).toEqual("I am a wallet.account");
    });

    it("should call global.contracts.channel.connect with wallet", async function () {
        await sesamed.setAccount({
            name: "alice", mnemonic: "mnemonic", privateKey: "privateKey"
        });

        expect(spyGlobal.contracts.channel).toEqual("I am a wallet.channel");
    });

    it("should call global.contracts.document.connect with wallet", async function () {
        await sesamed.setAccount({
            name: "alice", mnemonic: "mnemonic", privateKey: "privateKey"
        });

        expect(spyGlobal.contracts.document).toEqual("I am a wallet.document");
    });

    it("should set global.account", async function () {
        let account = {
            name: "alice", mnemonic: "mnemonic", privateKey: "privateKey"
        };
        await sesamed.setAccount(account);

        return expect(spyGlobal.account).toEqual(account);
    });

});