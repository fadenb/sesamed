// npm packages
var rewire = require("rewire");

// local modules
const sesamed = rewire("../../src/sesamed");

describe("createMnemonic", function () {
    let spyEthers;
    let spyGetRandomBytes;
    let createMnemonic;


    beforeEach(function () {
        spyEthers = {
            utils: {
                HDNode: {
                    entropyToMnemonic: jasmine.createSpy("entropyToMnemonic").and.returnValue("I am a mnemonic.")
                }
            }
        };
        sesamed.__set__({ethers: spyEthers});

        spyGetRandomBytes = jasmine.createSpy("spyGetRandomBytes").and.returnValue("We are random bytes.");
        sesamed.__set__({getRandomBytes: spyGetRandomBytes});

        createMnemonic = sesamed.__get__("createMnemonic");
    });

    it("should be a function", async function () {
        expect(typeof createMnemonic).toBe("function");
    });

    describe("should call ethers.utils.HDNode.entropyToMnemonic", function () {

        it("once", async function () {
            createMnemonic();
            return expect(spyEthers.utils.HDNode.entropyToMnemonic.calls.count()).toEqual(1);
        });

        it("with the return value of getRandomBytes", async function () {
            createMnemonic();
            return expect(spyEthers.utils.HDNode.entropyToMnemonic).toHaveBeenCalledWith("We are random bytes.");
        });
    });

    describe("should call randomBytes", function () {

        it("once", async function () {
            createMnemonic();
            return expect(spyGetRandomBytes.calls.count()).toEqual(1);
        });

        it("with 16 as param", async function () {
            createMnemonic();
            return expect(spyGetRandomBytes).toHaveBeenCalledWith(16);
        });
    });


    it("should return correct Wallet", function () {
        let mnemonic = createMnemonic();
        return expect(mnemonic).toEqual("I am a mnemonic.");
    });

});