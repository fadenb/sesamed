// npm packages
var rewire = require("rewire");

// local modules
var ipfs = rewire("../src/ipfs");

describe("ipfs", function () {

    let myIpfsGateway = {host: "ipfs.infura.io", port: 5001, protocol: "https"};
    let unset;
    let spyIPFS;

    beforeEach(function () {
        spyIPFS = jasmine.createSpy();
        unset = ipfs.__set__("IPFS", spyIPFS);
    });

    afterEach(function () {
        unset();
    });

    describe("setGateway", function () {

        it("should throw Error if ipfsGateway is not provided", function () {
            let err = new Error("setGateway: ipfsGateway is missing");
            let setGateway = function() {ipfs.setGateway();};

            return expect(setGateway).toThrow(err);
        });

        it("should throw Error if ipfsGateway is no object", function () {
            let err = new Error("setGateway: ipfsGateway is missing");
            return expect(() => ipfs.setGateway("gateway")).toThrow(err);
        });

        it("should throw Error if ipfsGateway is missing host", function () {
            let err = new Error("setGateway: ipfsGateway incomplete");
            let ipfsGateway = {port: 5001, protocol: "https"};

            return expect(() => ipfs.setGateway(ipfsGateway)).toThrow(err);
        });

        it("should throw Error if ipfsGateway is missing port", function () {
            let err = new Error("setGateway: ipfsGateway incomplete");
            let ipfsGateway = {host: "ipfs.infura.io", protocol: "https"};

            return expect(() => ipfs.setGateway(ipfsGateway)).toThrow(err);
        });

        it("should throw Error if ipfsGateway is missing protocol", function () {
            let err = new Error("setGateway: ipfsGateway incomplete");
            let ipfsGateway = {host: "ipfs.infura.io", port: 5001};

            return expect(() => ipfs.setGateway(ipfsGateway)).toThrow(err);
        });


        it("should call IPFS constructor", function () {
            ipfs.setGateway(myIpfsGateway);

            return expect(spyIPFS.calls.count()).toEqual(1);
        });

        it("should call IPFS constructor with ipfsGateway", function () {
            ipfs.setGateway(myIpfsGateway);

            return expect(spyIPFS).toHaveBeenCalledWith(myIpfsGateway);
        });

    });

    describe("read and write", function () {

        let stubIpfsAdd;
        let stubIpfsCat;

        beforeEach(function () {
            stubIpfsAdd = jasmine.createSpy().and.returnValue(
                new Promise(resolve => {
                    resolve("stubbedFileHash");
                })
            );

            stubIpfsCat = jasmine.createSpy().and.returnValue(
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

            it("should call ipfsMini.cat with fileHash", async function () {
                await ipfs.read("fileHash");

                return expect(stubIpfsCat).toHaveBeenCalledWith("fileHash");
            });

            it("should call ipfsMini.cat and resolve result", async function () {
                let data = await ipfs.read("fileHash");

                return expect(data).toEqual("stubbedData");
            });

        });

        describe("write", function () {

            it("should call ipfsMini.add with data", async function () {
                await ipfs.write("data");

                return expect(stubIpfsAdd).toHaveBeenCalledWith("data");
            });


            it("should call ipfsMini.add and resolve ipfsHash", async function () {
                let fileHash = await ipfs.write("data");

                return expect(fileHash).toEqual("stubbedFileHash");
            });
        });

    });

});
