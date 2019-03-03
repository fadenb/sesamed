// local modules
var  multihash = require("../src/multihash");

// test data
var testData = require("./testdata.js").testData;

describe("multihash", function () {

    describe("getMultihashFromBase58", function () {

        it("should return a multihash from a base58 hash", async function () {
            let mhash = await multihash.getMultihashFromBase58(testData[0].ipfsHash);

            expect(mhash.digest).toEqual(testData[0].multihash.digest);
            expect(mhash.hashFunction).toEqual(testData[0].multihash.hashFunction);
            expect(mhash.size).toEqual(testData[0].multihash.size);
        });
    });

    describe("getBase58FromBaseMultihash", function () {

        it("should return a base58 hash from a multihash", async function () {
            let ipfsHash = await multihash.getBase58FromMultihash(testData[0].multihash);

            expect(ipfsHash).toEqual(testData[0].ipfsHash);
        });

        it("should return a base58 hash from the digest of a multihash", async function () {
            let ipfsHash = await multihash.getBase58FromMultihash(testData[0].multihash.digest);

            expect(ipfsHash).toEqual(testData[0].ipfsHash);
        });
    });

});
