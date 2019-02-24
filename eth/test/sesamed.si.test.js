// THE library
const sesamed = require("../../src/sesamed.js");

// additional logger
const mlog = require("mocha-logger");

// the contracts
const Account = artifacts.require("./Account.sol");
const Channel = artifacts.require("./Channel.sol");
const Document = artifacts.require("./Document.sol");


// helper functions

contract("Sesamed", function (accounts) {
    let accountContract;
    let channelContract;
    let documentContract;

    class storage {
        constructor  () {
            this.writeChannelsObj = {};
            this.readChannelsObj = {};
        }
    }

    let alice = new storage();
    let bob = new storage();
    let chris = new storage();
    // let doris = new storage();
    // let ella = new storage();

    let waitForReceipt = false;

    (async function () {
        accountContract = await Account.deployed();
        channelContract = await Channel.deployed();
        documentContract = await Document.deployed();
    })();

    describe("preparations", async function () {

        it("sesamed.init()", async function () {
            await sesamed.init({
                rpcUrl: "http://localhost:8545",
                accountContractAddress: accountContract.address,
                channelContractAddress: channelContract.address,
                documentContractAddress: documentContract.address
            });
        });

    });

    let counter = 0;

    async function registerAccount (name) {
        let account,
            response;

        // this creates a new account but is is not yet written to the blockchain
        it("sesamed.getNewAccount(" + name + ")", async function () {
            account = await sesamed.getNewAccount(name);
            switch (counter) {
                case 0:
                    alice.account = account;
                    break;
                case 1:
                    bob.account = account;
                    break;
                case 2:
                    chris.account = account;
                    break;
            }
            counter++;
        });

        // you must set the account to be able to read and write to the blockchain as that account
        it("sesamed.setAccount(" + name + ")", async function () {
            await sesamed.setAccount(account);
        });

        // the new account has to be funded
        it("send ether to new account", async function () {
            await web3.eth.sendTransaction({
                from: accounts[0],
                to: account.address,
                value: web3.utils.toWei("1", "ether")
            });
        });

        // now the new account is written to the blockchain
        it("sesamed.registerAccount()", async function () {
            response = await sesamed.registerAccount(waitForReceipt);
        });

        it("--------------------------------------", () => {
            mlog.log("      RESULT: ");
            mlog.log("      - txHash : " + (response.hash || response.transactionHash));
            mlog.log("      - gasUsed: " + (waitForReceipt ? response.gasUsed : " [no receipt]"));
        });
    }

    function registerChannelFromTo (from, recipients, channelName) {

        let channel;

        it("setAccount(from.account)", async function () {
            await sesamed.setAccount(from.account);
        });

        it("registerChannel(recipients)", async function () {
            channel = await sesamed.registerChannel(recipients, waitForReceipt);
            from.writeChannelsObj[channelName] = channel;
        });

        it("--------------------------------------", () => {
            mlog.log("      RESULT: ");
            mlog.log("      - txHash: " + channel.tx);
            mlog.log("      - gasUsed: " + (waitForReceipt ? channel.receipt.gasUsed : " [no receipt]"));
            mlog.log("      - channeId: " + channel.channelId);
            mlog.log("      - aesKey  : " + channel.aesKey);
        });

    }

    function readChannelEventsFor (person) {

        it("setAccount(for.account)", async function () {
            await sesamed.setAccount(person.account);
        });

        it("getNewAccountChannels()", async () => {
            let channels = await sesamed.getNewAccountChannels();
            channels.forEach(channel => {
                person.readChannelsObj[channel.channelId] = channel;
            });
        });

        it("--------------------------------------", () => {
            let channelId;
            let i = 1;

            mlog.log("      RESULT: ");
            for (channelId in person.readChannelsObj) {
                let channel = person.readChannelsObj[channelId];
                mlog.log("      " + i + ") -----------");
                mlog.log("      - channeId: " + channel.channelId);
                mlog.log("      - aesKey  : " + channel.aesKey);
                mlog.log("      - name    : " + channel.name);
                i++;
            }
        });

    }

    function sendDocument (from, channelName, document) {
        let response;

        it("setAccount(from.account)", async function () {
            await sesamed.setAccount(from.account);
        });

        it("send(channel, document)", async function () {
            let channel = from.writeChannelsObj[channelName];
            response = await sesamed.sendDocument(channel, document, waitForReceipt);
        });

        it("--------------------------------------", () => {
            mlog.log("      RESULT: ");
            mlog.log("      - txHash: " + (response.hash || response.transactionHash));
            mlog.log("      - gasUsed: " + (waitForReceipt ? response.gasUsed : " [no receipt]"));
        });
    }
    
    function getTheChannelsOfAliceBobChris()  {
        describe("Alice", function () {
            
            describe("read channel events", () => {
                readChannelEventsFor(alice);
            });
            
        });

        describe("Bob", function () {
            
            describe("read channel events", () => {
                readChannelEventsFor(bob);
            });
        });

        describe("Chris", function () {
            
            describe("read channel events", () => {
                readChannelEventsFor(chris);
            });
        });
    }

    function getDocuments (person) {

        let documents;

        it("setAccount(person.account)", async function () {
            await sesamed.setAccount(person.account);
        });

        it("getDocuments(channelIds)", async function () {
            documents = await sesamed.getDocuments(sesamed.convertChannelsToArray(person.readChannelsObj));
        });

        it("--------------------------------------", () => {
            mlog.log("      RESULT: ");
            for (let i = 0; i < documents.length; i++) {
                mlog.log("      " + (i+1) + ") -----------");
                mlog.log("      - channelId: " + documents[i].channelId);
                mlog.log("      - fileHash : " + documents[i].fileHash);
                mlog.log("      - repo     : " + documents[i].repo);
                mlog.log("      - data     : " + documents[i].data);
            }
        });

    }

    describe("Alice", function () {
        registerAccount("alice");
    });

    describe("Bob", function () {
        registerAccount("bob");
    });

    describe("Chris", function () {
        registerAccount("chris");
    });

    describe("Establish first Channel", () => {

        describe("Alice", function () {

            describe("register channel to Bob", () => {
                registerChannelFromTo(alice, "bob", "toBob");
            });

        });

        describe("getting the channels for all three", () => {

            getTheChannelsOfAliceBobChris();

        });

    });

    describe("Establish second Channel", () => {

        describe("Alice", function () {
            describe("register channel to Chris", () => {
                registerChannelFromTo(alice, "chris", "toChris");
            });
        });
        
        describe("getting the channels for all three", () => {

            getTheChannelsOfAliceBobChris();
            
        }); 

    });

    describe("Establish third Channel", () => {

        describe("Chris", function () {
            describe("register channel to Bob", () => {
                registerChannelFromTo(chris, "bob", "toBob");
            });
        });

        describe("getting the channels for all three", () => {

            getTheChannelsOfAliceBobChris();

        });

    });

    describe("Alice", function () {

        describe("send document to Bob (Hello, Bob!)", () => {
            sendDocument(alice, "toBob", "Hello, Bob!");
        });

        describe("send document to Chris (Hello, Chris!)", () => {
            sendDocument(alice, "toChris", "Hello, Chris!");
        });


    });

    describe("Chris", function () {

        describe("send document to Chris (Hello, Bob! Here is Chris.)", () => {
            sendDocument(chris, "toBob", "Hello, Bob! Here is Chris.");
        });

    });

    describe("Alice", function () {

        describe("get document sent to Alice", () => {
            getDocuments(alice);
        });

    });

    describe("Bob", function () {

        describe("get document sent to Bob", () => {
            getDocuments(bob);
        });

    });

    describe("Chris", function () {

        describe("get document sent to Chris", () => {
            getDocuments(chris);
        });

    });

});