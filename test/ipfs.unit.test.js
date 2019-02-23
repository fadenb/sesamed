if (typeof window === "undefined") {
    // test framework
    var chai = require("chai");
    var expect = chai.expect;
    var sinon = require("sinon");
    var sinonChai = require("sinon-chai");
    chai.use(sinonChai);
    chai.should();

    // local modules
    var ipfs = require("../src/ipfs");

}

describe("ipfs", function () {

    describe("read", function () {

        it("should call ipfsMini.cat with fileHash and resolve result", async function () {
            let stubIpfsCat = sinon.stub(ipfs._ipfs, "cat").callsFake(function () {
            }).returns(new Promise(resolve => {
                resolve("stubbedData");
            }));

            let data = await ipfs.read("fileHash");

            stubIpfsCat.should.have.been.calledWith("fileHash");
            return expect(data).to.equal("stubbedData");
        });
    });

    describe("write", function () {

        it("should call ipfsMini.add with data and resolve ipfsHash", async function () {
            let stubIpfsAdd = sinon.stub(ipfs._ipfs, "add").callsFake(function () {
            }).returns(new Promise(resolve => {
                resolve("stubbedFileHash");
            }));

            let fileHash = await ipfs.write("data");

            stubIpfsAdd.should.have.been.calledWith("data");
            return expect(fileHash).to.equal("stubbedFileHash");
        });

    });
});
