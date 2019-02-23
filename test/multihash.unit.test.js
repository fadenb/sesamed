// test framework
var chai = require("chai");
var  expect = chai.expect;

// local modules
var  multihash = require("../src/multihash");

// test data
var testData = require("./testdata.js").testData;

describe("multihash", function () {

    describe("getMultihashFromBase58", function () {

        it("should return a multihash from a base58 hash", async function () {
            let mhash = await multihash.getMultihashFromBase58(testData[0].ipfsHash);

            expect(mhash.digest).to.equal(testData[0].multihash.digest);
            expect(mhash.hashFunction).to.equal(testData[0].multihash.hashFunction);
            expect(mhash.size).to.equal(testData[0].multihash.size);
        });
    });

    describe("getBase58FromBaseMultihash", function () {

        it("should return a base58 hash from a multihash", async function () {
            let ipfsHash = await multihash.getBase58FromMultihash(testData[0].multihash);

            expect(ipfsHash).to.equal(testData[0].ipfsHash);
        });
    });

});
