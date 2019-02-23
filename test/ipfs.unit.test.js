// test framework
var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var sinonChai = require("sinon-chai");
chai.use(sinonChai);
chai.should();

// npm packages
var rewire = require("rewire");

// local modules
var ipfs = rewire("../src/ipfs");

describe("ipfs", function () {

    let myIpfsGateway = {host: "ipfs.infura.io", port: 5001, protocol: "https"};
    let sandbox;
    let unset;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    describe("setGateway", function () {

        it("should throw Error if ipfsGateway is not provided", function () {
            let err = "setGateway: ipfsGateway is missing";
            let stubIPFS = sandbox.stub();
            unset = ipfs.__set__("IPFS", stubIPFS);

            return expect(() => ipfs.setGateway()).to.throw(err);
        });

        it("should throw Error if ipfsGateway is no object", function () {
            let err = "setGateway: ipfsGateway is missing";
            let stubIPFS = sandbox.stub();
            unset = ipfs.__set__("IPFS", stubIPFS);

            return expect(() => ipfs.setGateway("gateway")).to.throw(err);
        });

        it("should throw Error if ipfsGateway is missing host", function () {
            let err = "setGateway: ipfsGateway incomplete";
            let stubIPFS = sandbox.stub();
            unset = ipfs.__set__("IPFS", stubIPFS);

            let ipfsGateway = {port: 5001, protocol: "https"};
            return expect(() => ipfs.setGateway(ipfsGateway)).to.throw(err);
        });

        it("should throw Error if ipfsGateway is missing port", function () {
            let err = "setGateway: ipfsGateway incomplete";
            let stubIPFS = sandbox.stub();
            unset = ipfs.__set__("IPFS", stubIPFS);

            let ipfsGateway = {host: "ipfs.infura.io", protocol: "https"};
            return expect(() => ipfs.setGateway(ipfsGateway)).to.throw(err);
        });

        it("should throw Error if ipfsGateway is missing protocol", function () {
            let err = "setGateway: ipfsGateway incomplete";
            let stubIPFS = sandbox.stub();
            unset = ipfs.__set__("IPFS", stubIPFS);

            let ipfsGateway = {host: "ipfs.infura.io", port: 5001};
            return expect(() => ipfs.setGateway(ipfsGateway)).to.throw(err);
        });


        it("should call IPFS constructor", function () {
            let stubIPFS = sandbox.stub();
            unset = ipfs.__set__("IPFS", stubIPFS);

            ipfs.setGateway(myIpfsGateway);

            return expect(stubIPFS).to.be.calledOnce;
        });

        it("should call IPFS constructor with ipfsGateway", function () {
            let stubIPFS = sandbox.stub();
            unset = ipfs.__set__("IPFS", stubIPFS);

            ipfs.setGateway(myIpfsGateway);

            return expect(stubIPFS).to.be.calledWith(myIpfsGateway);
        });

    });


    describe("read and write", function () {

        let stubIpfsAdd;
        let stubIpfsCat;

        beforeEach(function () {
            stubIpfsAdd = sandbox.stub().returns(
                new Promise(resolve => {
                    resolve("stubbedFileHash");
                })
            );

            stubIpfsCat = sandbox.stub().returns(
                new Promise(resolve => {
                    resolve("stubbedData");
                })
            );

            ipfs.setGateway(myIpfsGateway);

            unset = ipfs.__set__("ipfs", {add: stubIpfsAdd, cat: stubIpfsCat});
        });

        afterEach(function () {
            unset();
        });

        describe("read", function () {

            it("should call ipfsMini.cat with fileHash and resolve result", async function () {
                let data = await ipfs.read("fileHash");

                stubIpfsCat.should.have.been.calledWith("fileHash");
                return expect(data).to.equal("stubbedData");
            });
        });

        describe("write", function () {

            it("should call ipfsMini.add with data and resolve ipfsHash", async function () {
                let fileHash = await ipfs.write("data");

                stubIpfsAdd.should.have.been.calledWith("data");
                return expect(fileHash).to.equal("stubbedFileHash");
            });

        });

    });

});
