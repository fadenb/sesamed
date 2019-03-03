// local modules
var aes = require("../src/aes");

// test data
var testData = require("./testdata.js").testData;

describe("aes", function () {
    describe("generateKey", function () {

        it("should return a valid key", async function () {
            let key = await aes.generateKey();

            expect(typeof key).toBe("string");
        });
    });

    describe("encrypt", function () {

        it("should encrypt cleartext to ciphertext", async function () {
            let ciphertext = await aes.encrypt(testData[0].aesKey, testData[0].cleartext);
            let cleartext = await aes.decrypt(testData[0].aesKey, ciphertext);

            expect(cleartext).toEqual(testData[0].cleartext);
        });

    });

    describe("decrypt", function () {

        it("should decrypt ciphertext to cleartext", async function () {
            let cleartext = await aes.decrypt(testData[0].aesKey, testData[0].aesCiphertext);

            expect(cleartext).toEqual(testData[0].cleartext);
        });

    });
});