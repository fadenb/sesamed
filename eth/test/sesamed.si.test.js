// THE library
const sesamed = require("../../src/sesamed.js");

// additional logger
const mlog = require("mocha-logger");

// the contracts
const Account = artifacts.require("./Account.sol");
const Channel = artifacts.require("./Channel.sol");
const Document = artifacts.require("./Document.sol");


const nameAlice = "Alice4";
const nameBob = "Bob4";
const nameChris = "Chris4";

contract("Sesamed", function (accounts) {
    let accountContract;
    let channelContract;
    let documentContract;

    class storage {
        constructor  () {
            this.lastChannelBlockNumber = 0;
            this.writeChannelsObj = {};
            this.readChannelsObj = {};
        }
    }

    let alice = new storage();
    let bob = new storage();
    let chris = new storage();
    // let doris = new storage();
    // let ella = new storage();

    (async function () {
        accountContract = await Account.deployed();
        channelContract = await Channel.deployed();
        documentContract = await Document.deployed();
    })();

    describe("preparations", async function () {

        it("sesamed.init()", async function () {
            await sesamed.init({
                ipfsGateway: {host: "localhost", port: 5001, protocol: "http"},
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
            receipt;

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

            expect(account.name).to.equal(name);
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
            receipt = await sesamed.registerAccount();
        });

        it("--------------------------------------", () => {
            mlog.log("      RESULT: ");
            mlog.log("      - txHash : " + receipt.transactionHash);
            mlog.log("      - gasUsed: " + receipt.gasUsed);

            expect(receipt.status).to.equal(1);
        });
    }

    function registerChannel (from, recipients, channelName) {
        let channel;

        it("setAccount(from.account)", async function () {
            await sesamed.setAccount(from.account);
        });

        it("registerChannel(recipients)", async function () {
            channel = await sesamed.registerChannel(recipients);
            from.writeChannelsObj[channelName] = channel;
        });

        it("--------------------------------------", () => {
            mlog.log("      RESULT: ");
            mlog.log("      - txHash: " + channel.receipt.transactionHash);
            mlog.log("      - blockNumber: " + (channel.receipt.blockNumber));
            mlog.log("      - gasUsed: " + channel.receipt.gasUsed);
            mlog.log("      - channeId: " + channel.channelId);
            mlog.log("      - aesKey  : " + channel.aesKey);

            expect(channel.receipt.status).to.equal(1);
        });
    }

    function readChannelEventsFor (person, expectedCount) {
        let channels;

        it("setAccount(for.account)", async function () {
            await sesamed.setAccount(person.account);
        });

        it("getChannels()", async () => {
            channels = await sesamed.getChannels(person.lastChannelBlockNumber + 1);
            channels.forEach(channel => {
                person.readChannelsObj[channel.channelId] = channel;
            });
        });

        it("getBlockNumer()", async function () {
            person.lastChannelBlockNumber = await sesamed.getBlockNumber();
        });

        it("--------------------------------------", () => {
            mlog.log("      RESULT: ");
            for (let i =0; i < channels.length; i++) {
                let channel = channels[i];
                mlog.log("      " + (i+1) + ") -----------");
                mlog.log("      - channeId: " + channel.channelId);
                mlog.log("      - aesKey  : " + channel.aesKey);
                mlog.log("      - name    : " + channel.name);
                i++;
            }

            expect(expectedCount).to.equal(channels.length);
        });

    }

    function sendDocument (from, channelName, document) {
        let receipt;

        it("setAccount(from.account)", async function () {
            await sesamed.setAccount(from.account);
        });

        it("send(channel, document)", async function () {
            let channel = from.writeChannelsObj[channelName];
            receipt = await sesamed.sendDocument(channel, document);
        });

        it("--------------------------------------", () => {
            mlog.log("      RESULT: ");
            mlog.log("      - txHash: " + receipt.transactionHash);
            mlog.log("      - gasUsed: " + receipt.gasUsed);

            expect(receipt.status).to.equal(1);
        });
    }
    
    function getTheChannelsOfAliceBobChris(expA, expB, expC)  {
        describe("Alice", function () {
            
            describe("read channel events", () => {
                readChannelEventsFor(alice, expA);
            });
            
        });

        describe("Bob", function () {
            
            describe("read channel events", () => {
                readChannelEventsFor(bob, expB);
            });
        });

        describe("Chris", function () {
            
            describe("read channel events", () => {
                readChannelEventsFor(chris, expC);
            });
        });
    }

    function getDocuments (person, messages) {

        let documents;

        it("setAccount(person.account)", async function () {
            await sesamed.setAccount(person.account);
        });

        it("getDocuments(channelIds)", async function () {
            let channels = sesamed.convertChannelsToArray(person.readChannelsObj);
            documents = await sesamed.getDocuments(channels, person.lastDocumentBlockNumber + 1);
        });

        it("getBlockNumer()", async function () {
            person.lastDocumentBlockNumber = await sesamed.getBlockNumber();
        });

        it("--------------------------------------", () => {
            mlog.log("      RESULT: ");
            for (let i = 0; i < documents.length; i++) {
                mlog.log("      " + (i+1) + ") -----------");
                mlog.log("      - channelId: " + documents[i].channelId);
                mlog.log("      - fileHash : " + documents[i].fileHash);
                mlog.log("      - data     : " + documents[i].data);

                expect(messages[i]).to.equal(documents[i].data);
            }
        });

    }

    function getDocumentsForAllThree(msgsA, msgsB, msgsC) {
        describe("Alice", function () {

            describe("get document sent to Alice", () => {
                getDocuments(alice, msgsA);
            });

        });

        describe("Bob", function () {

            describe("get document sent to Bob", () => {
                getDocuments(bob, msgsB);
            });

        });

        describe("Chris", function () {

            describe("get document sent to Chris", () => {
                getDocuments(chris, msgsC);
            });

        });
    }

    describe("Alice", function () {
        registerAccount(nameAlice);
    });

    describe("Bob", function () {
        registerAccount(nameBob);
    });

    describe("Chris", function () {
        registerAccount(nameChris);
    });

    describe("Establish first Channel", () => {

        describe("Alice", function () {

            describe("register channel to Bob", () => {
                registerChannel(alice, nameBob, "toBob");
            });

        });

        describe("getting the channels for all three", () => {

            getTheChannelsOfAliceBobChris(0, 1, 0);

        });

    });

    describe("Establish second Channel", () => {

        describe("Alice", function () {
            describe("register channel to Chris", () => {
                registerChannel(alice, nameChris, "toChris");
            });
        });
        
        describe("getting the channels for all three", () => {

            getTheChannelsOfAliceBobChris(0, 0, 1);
            
        }); 

    });

    describe("Establish third Channel", () => {

        describe("Chris", function () {
            describe("register channel to Bob", () => {
                registerChannel(chris, nameBob, "toBob");
            });
        });

        describe("getting the channels for all three", () => {

            getTheChannelsOfAliceBobChris(0, 1, 0);

        });

    });

    describe("sending documents first round", () => {

        describe("Alice", function () {

            describe("send document to Bob (Hello, Bob!)", () => {
                sendDocument(alice, "toBob", "Hello, Bob!");
            });

            describe("send document to Chris (Hello, Chris!)", () => {
                sendDocument(alice, "toChris", "Hello, Chris!");
            });

        });

    });

    describe("receiving documents of first round", () => {

        getDocumentsForAllThree([],["Hello, Bob!"], ["Hello, Chris!"]);

    });

    describe("sending documents second round", () => {

        describe("Chris", function () {

            describe("send document to Bob (Hello, Bob! Here is Chris.)", () => {
                sendDocument(chris, "toBob", "Hello, Bob! Here is Chris.");
            });

        });

    });

    describe("receiving documents of second round", () => {

        getDocumentsForAllThree([], ["Hello, Bob! Here is Chris."], []);

    });

    describe("register new channel from bob to alice and chris", () => {

        it("setAccount(from.account)", async function () {
            await sesamed.setAccount(bob.account);
        });

        it("registerChannel(recipients)", async function () {
            let channel = await sesamed.registerChannel([nameAlice, nameChris]);
            bob.writeChannelsObj["toAliceAndChris"] = channel;
        });

    });

    describe("sending documents third round", () => {

        describe("Alice", function () {

            describe("send document to Bob (Hello, Bob!)", () => {
                sendDocument(alice, "toBob", "Hello, Bob! Here Alice. Third round message!!!");
            });

            describe("send document to Chris (Hello, Chris!)", () => {
                sendDocument(alice, "toChris", "Hello, Chris! Here Alice. Third round message");
            });

        });

        describe("Bob", function () {

            describe("send document to Alice and Chris (Hello, U2! Here is Bob.)", () => {

                sendDocument(bob, "toAliceAndChris", "Hello, U2! Here is Bob.");
            });

        });

        describe("Chris", function () {

            describe("send document to Bob (Hello, Bob! Here is Chris.)", () => {
                sendDocument(chris, "toBob", "Hello, Bob! Here is Chris. Third round message");
            });

        });

        describe("receiving documents of third round", () => {

            getDocumentsForAllThree(
                ["Hello, U2! Here is Bob."],
                ["Hello, Bob! Here Alice. Third round message!!!", "Hello, Bob! Here is Chris. Third round message"],
                ["Hello, Chris! Here Alice. Third round message", "Hello, U2! Here is Bob."]
            );

        });


    });

});