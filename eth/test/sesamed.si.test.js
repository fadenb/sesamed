// const truffleAssert = require("truffle-assertions");
const sesamed = require("../../src/sesamed.js");

const Account = artifacts.require("./Account.sol");
// const Channel = artifacts.require("./Channel.sol");
// const Document = artifacts.require("./Document.sol");




contract("Sesamed", function (accounts) {
    let accountContract;
    // let channelContract;
    // let documentContract;

    (async function () {
        accountContract = await Account.deployed();
        // channelContract = await Channel.deployed();
        // documentContract = await Document.deployed();
    })();


    describe("preparations", async function () {

        it("sesamed.init()", async function () {
            await sesamed.init({
                rpcUrl: "http://localhost:8545",
                accountContractAddress: accountContract.address
            });
        });

    });

    async function registerAccount(name) {
        let account;

        it("sesamed.getNewAccount(" + name + ")", async function () {
            account = await sesamed.getNewAccount(name);
        });

        it("sesamed.setAccount(" + name + ")", function () {
            sesamed.setAccount(account);
        });

        it("send ether to new account", async function () {
            await web3.eth.sendTransaction({
                from: accounts[0],
                to: account.address,
                value: web3.utils.toWei("1", "ether")
            });
        });

        it("sesamed.registerAccount()", async function () {
            (await sesamed.registerAccount());
        });
    }

    describe("Alice", async function () {
        registerAccount("alice");
    });

    describe("Bob", async function () {
        registerAccount("bob");
    });

    describe("Chris", async function () {
        registerAccount("chris");
    });
});
