if (typeof window === "undefined") {
    // test framework
    var chai = require("chai");
    var expect = chai.expect;
    var sinon = require("sinon");
    var sinonChai = require("sinon-chai");
    chai.use(sinonChai);
    chai.should();

    // define global window to get test cover of 100 %
    window = {};  // eslint-disable-line no-global-assign

    // local modules
    var global = require("../src/global");
    var sesamed = require("../src/sesamed");

    // contract json
    var accountContractJson =  require("./contracts.js").accountContractJson;

    // sinon sandbox
    var sandbox;
}

var ethers = sesamed._ethers;
var pgp = sesamed.pgp;
var ipfs = sesamed.ipfs;

describe("sesamed", async function () {

    let stubbedEthersContract;
    let stubbedAccountContractRegister;
    let accountContractAddress = "accountContractAddress";
    let stubbedProvider = "stubbedProvider";
    let myRpcUrl = "myRpcUrl";
    let myIpfsGateway = {test:"myIpfsGateway"};
    let stubbedJsonRpcProvider;
    let stubbedPgpGenerateKeys;
    let stubbedPgPgetPublicKeyFromPrivateKey;
    let stubbedEntropyToMnemonic;
    let stubbedEthersWalletFromMnemonic;
    let stubbedIpfsWrite;
    let stubbedIpfsRead;
    let stubbedIpfsSetGateway;
    let testWallet;

    beforeEach(function () {
        sandbox = sinon.createSandbox();

        stubbedEthersContract = sandbox.stub(ethers, "Contract");
        stubbedEthersContract.prototype.connect = sandbox.stub();
        stubbedAccountContractRegister = sandbox.stub();
        stubbedEthersContract.prototype.connect.returns({
            connect: stubbedEthersContract,
            register: stubbedAccountContractRegister
        });

        sandbox.stub(ethers, "Wallet");

        stubbedJsonRpcProvider = sandbox.stub(ethers.providers, "JsonRpcProvider");
        stubbedJsonRpcProvider.prototype.test = sandbox.stub().returns(stubbedProvider);


        stubbedPgpGenerateKeys = sandbox.stub(pgp, "generateKeys").callsFake(function () {
        }).returns(new Promise(resolve => {
            resolve({publicKey: "publicKey", privateKey: "privateKey"});
        }));
        stubbedPgPgetPublicKeyFromPrivateKey = sandbox.stub(pgp, "getPublicKeyFromPrivateKey");

        stubbedEntropyToMnemonic = sandbox.stub(ethers.utils.HDNode, "entropyToMnemonic").returns("mnemonic");
        stubbedEthersWalletFromMnemonic = sandbox.stub(ethers.Wallet, "fromMnemonic").returns(testWallet);

        stubbedIpfsWrite = sandbox.stub(ipfs, "write").returns("ipfsHash");
        stubbedIpfsRead = sandbox.stub(ipfs, "read").returns("data");
        stubbedIpfsSetGateway = sandbox.stub(ipfs, "setGateway");
    });

    afterEach(function () {
        sandbox.restore();
    });

    describe("module registration", function () {
        it("should define window.sesamed", function () {
            return expect(window.sesamed).to.be.an("object");
        });
    });

    describe("init", function () {

        it("should be a function", function () {
            return expect(sesamed.init).to.be.a("function");
        });


        it("should use options.rpcUrl if provided", function () {
            sesamed.init({
                rpcUrl: myRpcUrl,
            });

            stubbedJsonRpcProvider.should.have.been.calledWith(myRpcUrl);
        });

        it("should use standard.rpcUrl if options.rpcUrl is not provided", function () {
            sesamed.init();

            stubbedJsonRpcProvider.should.have.been.calledWith("https://rpc.sesamed.de");
        });


        it("should use options correctly if provided", function () {
            stubbedEthersContract.callsFake(fake);

            sesamed.init({
                rpcUrl: myRpcUrl,
                accountContractAddress: accountContractAddress,
                ipfsGateway: myIpfsGateway
            });

            stubbedEthersContract.should.have.been.calledOnce;

            function fake(param1, param2, param3) {
                expect(param1).to.equal(accountContractAddress);
                expect(param2).to.equal(accountContractJson.abi);
                expect(param3.test()).to.equal(stubbedProvider);
            }
        });

        it("should use default params for contract if options is not provided", function () {
            sesamed.init();

            return expect(stubbedEthersContract).to.be.calledWith(
                accountContractJson.networks[219].address,
                accountContractJson.abi,
            );
        });

        it("should use default params for provider if options is not provided", function () {
            sesamed.init();

            return expect(stubbedJsonRpcProvider).to.be.calledWith(global.default.rpcUrl);
        });

        it("should use default params for ipfs.setGateway if options is not provided", function () {
            sesamed.init();

            return expect(stubbedIpfsSetGateway).to.be.calledWith(global.default.ipfsGateway);
        });

    });

    describe("getNewAccount", async function () {

        let err = "getNewAccount: name missing";
        testWallet = {
            signingKey: {
                mnemonic: "mnemonic",
                path: "path",
                privateKey: "privateKey",
                address: "address"
            }
        };

        it("should be a function", async function () {
            expect(sesamed.getNewAccount).to.be.a("function");
        });

        it("should throw Error if name is missing", async function () {
            return expect(sesamed.getNewAccount()).to.be.rejectedWith(err);
        });

        it("should throw Error if name is empty", async function () {
            return expect(sesamed.getNewAccount("")).to.be.rejectedWith(err);
        });

        it("should throw Error if name is no string", async function () {
            return expect(sesamed.getNewAccount(1)).to.be.rejectedWith(err);
        });

        it("should call ethers.utils.HDNode.entropyToMnemonic", async function () {
            await sesamed.getNewAccount("alice");
            return expect(stubbedEntropyToMnemonic).to.have.been.calledOnce;
        });

        it("should call pgp.createKeys", async function () {
            await sesamed.getNewAccount("alice");
            return expect(stubbedPgpGenerateKeys).to.have.been.calledOnce;
        });

        it("should call pgp.createKeys with name and mnemonic", async function () {
            await sesamed.getNewAccount("alice");
            return expect(stubbedPgpGenerateKeys).to.have.been.calledWith("alice", "mnemonic");
        });

        it("should return an object with a name", async function () {
            let account = await sesamed.getNewAccount("alice");
            return expect(account.name).to.equal("alice");
        });

        it("should return an object with a mnemonic", async function () {
            let account = await sesamed.getNewAccount("alice");
            return expect(account.mnemonic).to.equal("mnemonic");
        });

        it("should return an object with a privateKey", async function () {
            let account = await sesamed.getNewAccount("alice");
            return expect(account.privateKey).to.equal("privateKey");
        });

        it("should return an object with an address", async function () {
            let account = await sesamed.getNewAccount("alice");
            return expect(account.address).to.equal("address");
        });

    });

    describe("setAccount", function () {

        let err = "setAccount: account incomplete";

        beforeEach(function () {
            sesamed.init();
        });

        it("should be a function", async function () {
            expect(sesamed.setAccount).to.be.a("function");
        });

        it("should throw Error if account is missing", async function () {
            return expect(sesamed.setAccount()).to.be.rejectedWith(err);
        });

        it("should throw Error if name is missing", async function () {
            return expect(sesamed.setAccount({
                mnenomic: "mnenomic", privateKey: "privateKey"
            })).to.be.rejectedWith(err);
        });

        it("should throw Error if mnenomic is missing", async function () {
            return expect(sesamed.setAccount({
                name: "alice", privateKey: "privateKey"
            })).to.be.rejectedWith(err);
        });

        it("should throw Error if privateKey is missing", async function () {
            return expect(sesamed.setAccount({
                name: "alice", mnemonic: "mnemonic"
            })).to.be.rejectedWith(err);
        });


        it("should call ethers.Wallet.fromMnemonic()", async function () {
            await sesamed.setAccount({
                name: "alice", mnemonic: "mnemonic", privateKey: "privateKey"
            });

            return expect(stubbedEthersWalletFromMnemonic).to.be.calledOnce;
        });

        it("should call ethers.Wallet.fromMnemonic() with mnemonic", async function () {
            await sesamed.setAccount({
                name: "alice", mnemonic: "mnemonic", privateKey: "privateKey"
            });

            return expect(stubbedEthersWalletFromMnemonic).to.be.calledOnce;
        });


        it("should call pgp.getPublicKeyFromPrivateKey", async function () {
            await sesamed.setAccount({
                name: "alice", mnemonic: "mnemonic", privateKey: "privateKey"
            });

            return expect(stubbedPgPgetPublicKeyFromPrivateKey).to.be.calledOnce;
        });

        it("should call pgp.getPublicKeyFromPrivateKey with privateKey and mnemonic", async function () {
            await sesamed.setAccount({
                name: "alice", mnemonic: "mnemonic", privateKey: "privateKey"
            });

            return expect(stubbedPgPgetPublicKeyFromPrivateKey).to.be.calledWith("privateKey", "mnemonic");
        });

    });

    describe("registerAccount", async function () {

        let err = "registerAccount: no account set - use setAccount before";

        beforeEach(async function () {
            sesamed.init();
            await sesamed.setAccount(await sesamed.getNewAccount("alice"));
        });

        it("should be a function", async function () {
            expect(sesamed.registerAccount).to.be.a("function");
        });

        it("should throw Error if global.name is not set", async function () {
            global.name = undefined;
            let ret = expect(sesamed.registerAccount()).to.be.rejectedWith(err);
            global.name = "alice";
            return ret;
        });

        it("should call ipfs.write", async function () {
            await sesamed.registerAccount();

            return expect(stubbedIpfsWrite).to.be.calledOnce;
        });

        it("should call ipfs.write with global.publicKey", async function () {
            await sesamed.registerAccount();

            return expect(stubbedIpfsWrite).to.be.calledWith(global.publicKey);
        });

        it("should call global.accountContract.register", async function () {
            await sesamed.registerAccount();

            return expect(global.accountContract.register).to.be.calledOnce;
        });

    });

    describe("getPublicKey", async function () {

        let resolve;

        beforeEach(async function () {
            sesamed.init();
            resolve = resolve => resolve([{data:["hash"]}]);
            global.provider.getLogs = sandbox.stub().returns(new Promise(resolve));
            sandbox.stub(ethers.utils.defaultAbiCoder, "decode").returns(["decoded"]);
            global.accountContract.address = "address";
        });

        it("should be a function", async function () {
            return expect(sesamed.getPublicKey).to.be.a("function");
        });

        it("should call global.provider.getLogs", async function () {
            await sesamed.getPublicKey("alice");
            return expect(global.provider.getLogs).to.be.calledOnce;
        });

        it("should call global.provider.getLogs with correct filter", async function () {
            await sesamed.getPublicKey("alice");

            return expect(global.provider.getLogs).to.be.calledWith({
                address: "address",
                fromBlock: 0,
                toBlock: "latest",
                topics: [
                    "0xdd7f130173afc54851d268a6dd39f66b104a449c2d3f1d81ad14103dcd1cbcae",
                    "0x9c0257114eb9399a2985f8e75dad7600c5d89fe3824ffa99ec1c3eb8bf3b0501"
                ]
            });
        });

        it("should call throw Error if getLogs returns empty array", async function () {
            let err = "getPublicKey: account not found";

            resolve = resolve => resolve([]);
            global.provider.getLogs.returns(new Promise(resolve));
            return expect(sesamed.getPublicKey("alice")).to.be.rejectedWith(err);
        });

        it("should call throw Error if getLogs returns array.length > 1", async function () {
            let err = "getPublicKey: multiple accounts found";

            resolve = resolve => resolve([{data:["hash1"]}, {data:["hash2"]}]);
            global.provider.getLogs.returns(new Promise(resolve));
            return expect(sesamed.getPublicKey("alice")).to.be.rejectedWith(err);
        });

        it("should call ipfs.read", async function () {
            await sesamed.getPublicKey("alice");

            return expect(stubbedIpfsRead).to.be.calledOnce;
        });

        it("should call ipfs.read with ipfsHash returned from getLogs", async function () {
            await sesamed.getPublicKey("alice");

            return expect(stubbedIpfsRead).to.be.calledWith("decoded");
        });

    });

});
