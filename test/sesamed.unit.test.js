if (typeof window === "undefined") {
    // test framework
    var chai = require("chai");
    var expect = chai.expect;
    var sinon = require("sinon");
    var sinonChai = require("sinon-chai");
    chai.use(sinonChai);
    chai.should();

    // local modules
    var sesamed = require("../src/sesamed");
    var accountContractJson = require("../eth/build/contracts/Account.json");

    // sinon sandbox
    var sandbox;
}

var ethers = sesamed.ethers;
var pgp = sesamed.pgp;

describe("sesamed", async function () {

    describe("init", function () {

        let accountContractAddress = "accountContractAddress";
        let stubbedProvider = "stubbedProvider";
        let stubbedWallet = "stubbedWallet";
        let stubbedContract = "stubbedContract";
        let myRpc = "myRpc";
        let myPrivateKey = "myPrivateKey";
        let stubWallet;
        let stubContract;
        let stubJsonRpcProvider;

        beforeEach(function () {
            sandbox = sinon.createSandbox();
            stubJsonRpcProvider = sandbox.stub(ethers.providers, "JsonRpcProvider");
            stubJsonRpcProvider.prototype.test = sandbox.stub().returns(stubbedProvider);

            stubWallet = sandbox.stub(ethers, "Wallet");
            stubContract = sandbox.stub(ethers, "Contract").returns({
                connect: sandbox.stub().callsFake()
            });
        });

        afterEach(function () {
            sandbox.restore();
        });

        it("should be a function", function () {
            expect(sesamed.init).to.be.a("function");
        });


        it("should call ethers.providers.JsonRpcProvider with options.rpc", function () {

            sesamed.init({
                rpc: myRpc,
                privateKey: myPrivateKey,
                accountContractAddress: accountContractAddress
            });

            stubJsonRpcProvider.should.have.been.calledWith(myRpc);
        });

        it("should call ethers.providers.JsonRpcProvider with standard.rpc", function () {

            sesamed.init({
                privateKey: myPrivateKey,
                accountContractAddress: accountContractAddress
            });

            stubJsonRpcProvider.should.have.been.calledWith("https://rpc.sesamed.de");
        });


        it("should call ethers.wallet() with privateKey and provider", function () {
            stubWallet.callsFake(fakeWallet);
            stubWallet.prototype.test = sandbox.stub().returns(stubbedWallet);

            sesamed.init({
                rpc: myRpc,
                privateKey: myPrivateKey,
                accountContractAddress: accountContractAddress
            });

            function fakeWallet(privateKey, provider) {
                expect(privateKey).to.equal(myPrivateKey);
                expect(provider.test()).to.equal(stubbedProvider);
            }
        });


        it("should call ethers.Contract() correctly", function () {
            stubContract.callsFake(fakeContract).returns({
                connect: sandbox.stub().callsFake()
            });

            sesamed.init({
                rpc: myRpc,
                privateKey: myPrivateKey,
                accountContractAddress: accountContractAddress
            });

            function fakeContract(address, abi, provider) {
                expect(address).to.equal(accountContractAddress);
                expect(abi).to.equal(accountContractJson.abi);
                expect(provider.test()).to.equal(stubbedProvider);
            }
        });


        it("should call [contract].connect() with wallet", function () {
            stubContract.returns({
                connect: sandbox.stub().callsFake(fakeConnect).returns(stubbedContract)
            });


            sesamed.init({
                rpc: myRpc,
                privateKey: myPrivateKey,
                accountContractAddress: accountContractAddress
            });


            function fakeConnect(wallet) {
                expect(wallet.test()).to.equal(stubbedWallet);
            }

        });
    });

    describe("createAccount", async function () {

        let options = {userIds: {name: "jochen"}, passphrase: "test"};

        beforeEach(function () {
            sandbox = sinon.createSandbox();
        });

        afterEach(function () {
            sandbox.restore();
        });

        it("should be a function", async function () {
            expect(sesamed.createAccount).to.be.a("function");
        });

        it("should return an object", async function () {
            let stubGenerateKeys = sandbox.stub(pgp, "generateKeys").callsFake(function() {
            }).returns(new Promise(resolve => {
                resolve("stubbedKeys");
            }));

            let account = await sesamed.createAccount(options);

            stubGenerateKeys.should.have.been.calledWith(options);
            expect(account.pgp).to.equal("stubbedKeys");

        });
    });

    describe("registerAccount", async function () {
        it("should be a function", async function () {
            expect(sesamed.registerAccount).to.be.a("function");
        });
    });

});