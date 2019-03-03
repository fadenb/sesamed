// define global window to get test cover of 100 %
/*
if (typeof window === "undefined") {
    window = {};  // eslint-disable-line no-global-assign
}
*/
// npm packages
var rewire = require("rewire");

// local modules
const sesamed = rewire("../../src/sesamed");

// contract json
const contracts = require("../../src/contracts");
const accountContractJson =  contracts.accountContractJson;
const channelContractJson =  contracts.channelContractJson;


describe("init", function () {
    let spyEthers;
    let spyIpfs;
    let spyGlobal;

    let myRpcUrl = "myRpcUrl";
    let jsonRpcProvider = {
        getBlockNumber: function() {return Promise.resolve(4);}
    };

    beforeEach(function () {
        spyEthers = {
            providers: {
                JsonRpcProvider: jasmine.createSpy().and.returnValue(jsonRpcProvider)
            },
            Contract: jasmine.createSpy().and.callFake(function (address, abi) {
                return {
                    getValue: () => {return abi[1].name;}
                };
            })
        };
        spyIpfs = {
            setGateway: jasmine.createSpy()
        };
        spyGlobal = {
            default: {
                rpcUrl: "https://rpc.sesamed.de",
                ipfsGateway: {host: "ipfs.sesamed.de", port: 5001, protocol: "https"},
                network: "219"
            },
            eventListenerObjs: []
        };
        sesamed.__set__({
            ipfs: spyIpfs,
            ethers: spyEthers,
            global: spyGlobal
        });
    });


    it("should be a function", function () {
        return expect(typeof sesamed.init).toBe("function");
    });


    it("should use options.rpcUrl if provided", function (done) {
        sesamed.init({
            rpcUrl: myRpcUrl,
        }).then(() => {
            expect(spyEthers.providers.JsonRpcProvider).toHaveBeenCalledWith(myRpcUrl);
            done();
        });
    });

    it("should use standard.rpcUrl if options.rpcUrl is not provided", function () {
        sesamed.init();

        expect(spyEthers.providers.JsonRpcProvider).toHaveBeenCalledWith("https://rpc.sesamed.de");
    });


    it("should set global.provider", async function () {
        await sesamed.init();

        return expect(spyGlobal.provider).toEqual(jsonRpcProvider);
    });

    it("should set global.blockNumber", async function () {
        await sesamed.init();

        return expect(spyGlobal.blockNumber).toEqual(4);
    });

    it("should set global.contracts", async function () {
        await sesamed.init();

        expect(spyGlobal.contracts.account.getValue()).toEqual("newAccountEvent");
        expect(spyGlobal.contracts.channel.getValue()).toEqual("newChannelEvent");
        expect(spyGlobal.contracts.document.getValue()).toEqual("newDocumentEvent");
    });


    it("should use default params for ipfs.setGateway if options is not provided", async function () {
        await sesamed.init();

        return expect(spyIpfs.setGateway).toHaveBeenCalledWith({host: "ipfs.sesamed.de", port: 5001, protocol: "https"});
    });


    it("should call ethers.Contract thrice", async function () {
        await sesamed.init();
        expect(spyEthers.Contract.calls.count()).toEqual(3);
    });

    it("should call ethers.Contract first with correct params if accountContractAddress is provided", async function () {
        await sesamed.init({
            accountContractAddress: "accountContractAddress"
        });

        expect(spyEthers.Contract.calls.argsFor(0)).toEqual([
            "accountContractAddress",
            accountContractJson.abi,
            jsonRpcProvider
        ]);
    });

    it("should call ethers.Contract 1st with correct params if accountContractAddress is not provided", async function () {
        await sesamed.init();

        expect(spyEthers.Contract.calls.argsFor(0)).toEqual([
            accountContractJson.networks[219].address,
            accountContractJson.abi,
            jsonRpcProvider
        ]);
    });

    it("should call ethers.Contract 2nd with correct params if channelContractAddress is provided", async function () {
        await sesamed.init({
            channelContractAddress: "channelContractAddress"
        });

        expect(spyEthers.Contract.calls.argsFor(1)).toEqual([
            "channelContractAddress",
            channelContractJson.abi,
            jsonRpcProvider
        ]);
    });

    it("should call ethers.Contract 3rd with correct params if channelContractAddress is not provided", async function () {
        await sesamed.init();

        expect(spyEthers.Contract.calls.argsFor(1)).toEqual([
            channelContractJson.networks[219].address,
            channelContractJson.abi,
            jsonRpcProvider
        ]);
    });

});