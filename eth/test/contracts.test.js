const expect = require("chai").expect;
const truffleAssert = require("truffle-assertions");

const Account = artifacts.require("./Account.sol");
const Channel = artifacts.require("./Channel.sol");
const Document = artifacts.require("./Document.sol");

contract("Sesamed",  function (accounts) {
    var account1 = accounts[0],
        account2 = accounts[1],
        account3 = accounts[2],
        account4 = accounts[3],
        name1 = "Jochen",
        name2 = "Jan",
        name3 = "Katy",
        name4 = "Jörg",
        hashedName1 = web3.utils.sha3(name1),
        hashedName2 = web3.utils.sha3(name2),
        hashedName3 = web3.utils.sha3(name3),
        ipfsHash1 = web3.utils.randomHex(32),
        ipfsHash2 = web3.utils.randomHex(32),
        ipfsHash3 = web3.utils.randomHex(32),
        repo = 1,
        channelId12 = web3.utils.randomHex(32),
        channelId21 = web3.utils.randomHex(32),
        channelId31 = web3.utils.randomHex(32),
        channelId41 = web3.utils.randomHex(32),
        channelId51 = web3.utils.randomHex(32),
        ciphertext12 = "cipher12",
        ciphertext31 = "cipher31",
        ciphertext21 = "cipher21",
        ciphertext41 = "cipher41",
        ipfsHash12 = "ipfs12",
        ipfsHash21 = "ipfs21",
        ipfsHash31 = "ipfs31",
        ipfsHash41 = "ipfs41",
        ipfsHash51 = "ipfs51",
        blockNumberAtStart;

    var accountContract;
    var channelContract;
    var documentContract;

    (async function() {
        accountContract = await Account.deployed();
        channelContract = await Channel.deployed();
        documentContract = await Document.deployed();
        blockNumberAtStart = await web3.eth.getBlockNumber();
    })();

    describe("Account", async function () {
        describe("register()", async function () {
            it("should add account Jochen from account 1", async function () {
                var response = await accountContract.register(name1, ipfsHash1, repo, {from: account1});
                truffleAssert.eventEmitted(response, "newAccountEvent", (ev) => {
                    return (ev.nameHash === hashedName1
                        && ev.fileHash === ipfsHash1
                        && ev.repo == repo
                    );
                });
            });

            it("should add account Jan from account 1 and get reverted", async function () {
                await truffleAssert.fails(
                    accountContract.register(name2, ipfsHash2, repo, {from: account1}),
                    truffleAssert.ErrorType.REVERT,
                    "existsAddress"
                );
            });

            it("should add account Jan from account 2", async function () {
                let response = await accountContract.register(name2, ipfsHash2, repo, {from: account2});
                truffleAssert.eventEmitted(response, "newAccountEvent", (ev) => {
                    return (ev.nameHash === hashedName2
                        && ev.fileHash === ipfsHash2
                        && ev.repo == repo
                    );
                });
            });

            it("should add account Jochen from account3 and get reverted", async function () {
                await truffleAssert.fails(
                    accountContract.register(name1, ipfsHash1, repo, {from: account3}),
                    truffleAssert.ErrorType.REVERT,
                    "existsName"

                );
            });

            it("should add account Katy from account2 and get reverted", async function () {
                await truffleAssert.fails(
                    accountContract.register(name3, ipfsHash3, repo, {from: account2}),
                    truffleAssert.ErrorType.REVERT,
                    "existsAddress"
                );
            });

            it("should add account Katy from account3", async function () {
                var response = await accountContract.register(name3, ipfsHash3, repo, {from: account3});
                truffleAssert.eventEmitted(response, "newAccountEvent", (ev) => {
                    return (ev.nameHash === hashedName3
                        && ev.fileHash === ipfsHash3
                        && ev.repo == repo
                    );
                });
            });
        });

        describe("the event log", async function () {
            it("should contain the three correct entries", async function () {

                let logs = (await accountContract.getPastEvents(
                    "newAccountEvent",
                    {
                        filter: {
                            nameHash: [
                                hashedName1,
                                hashedName2,
                                hashedName3
                            ]
                        },
                        fromBlock: blockNumberAtStart,
                        toBlock: "latest"
                    }
                )).map(function (item) {
                    return item.args;
                });

                expect(logs.length).to.equal(3);
                expect(logs[0].nameHash).to.equal(hashedName1);
                expect(logs[1].nameHash).to.equal(hashedName2);
                expect(logs[2].nameHash).to.equal(hashedName3);
            });
        });
            
    });

    describe("Channel", async function () {
        describe("register", async function () {
            it("should register channel12 from account1 successfully", async function () {

                let response = await channelContract.register(channelId12, ciphertext12, name1);
                truffleAssert.eventEmitted(response, "newChannelEvent", (ev) => {
                    return (
                        ev.channelId === channelId12
                        && ev.ciphertext === ciphertext12
                    );
                });
            });


            it("should register channel31 from account3 successfully", async function () {
                let response = await channelContract.register(channelId31, ciphertext31, name3, {from: account3});
                truffleAssert.eventEmitted(response, "newChannelEvent", (ev) => {
                    return (
                        ev.channelId === channelId31
                        && ev.ciphertext === ciphertext31
                    );

                });
            });

            it("should register channel31 from account2 and get reverted", async function () {
                let ciphertext = "cipher31";

                await truffleAssert.fails(
                    channelContract.register(channelId31, ciphertext, name2, {from: account2}),
                    truffleAssert.ErrorType.REVERT,
                    "existsChannel"
                );
            });

            it("should register channel31 from account2 and get reverted", async function () {
                await truffleAssert.fails(
                    channelContract.register(channelId21, ciphertext21, name1, {from: account2}),
                    truffleAssert.ErrorType.REVERT,
                    "notExistsAccount"

                );
            });

            it("should register channel21 from account2 successfully", async function () {
                let response = await channelContract.register(channelId21, ciphertext21, name2, {from: account2});
                truffleAssert.eventEmitted(response, "newChannelEvent", (ev) => {
                    return (
                        ev.channelId === channelId21
                        && ev.ciphertext === ciphertext21
                    );

                });
            });


            it("should register channel41 from (not registered) account4 an get reverted", async function () {
                await truffleAssert.fails(
                    channelContract.register(channelId41, ciphertext41, name4, {from: account4}),
                    truffleAssert.ErrorType.REVERT,
                    "notExistsAccount"
                );
            });

        });
        describe("the event log", async function () {
            it("should contain the three correct entries", async function () {

                let logs = (await channelContract.getPastEvents(
                    "newChannelEvent",
                    {
                        fromBlock: blockNumberAtStart,
                        toBlock: "latest"
                    }
                )).map(function (item) {
                    return item.args;
                });

                expect(logs.length).to.equal(3);
                expect(logs[0].ciphertext).to.equal(ciphertext12);
                expect(logs[1].ciphertext).to.equal(ciphertext31);
                expect(logs[2].ciphertext).to.equal(ciphertext21);
                expect(logs[0].channelId).to.equal(channelId12);
                expect(logs[1].channelId).to.equal(channelId31);
                expect(logs[2].channelId).to.equal(channelId21);
            });
        });
    });

    describe("Document", async function () {

        describe("send", async function () {

            it("should send from account1 to channel12 successfully", async function () {
                let response = await documentContract.send(channelId12, ipfsHash12, repo);
                truffleAssert.eventEmitted(response, "newDocumentEvent", (ev) => {
                    return (
                        ev.channelId === channelId12
                        && ev.repo == repo
                        && ev.fileHash === ipfsHash12
                    );
                });
            });

            it("send from account1 to channelId31 and get reverted", async function () {
                await truffleAssert.fails(
                    documentContract.send(channelId31, ipfsHash31, repo),
                    truffleAssert.ErrorType.REVERT,
                    "notChannelOwner"
                );
            });

            it("send from account2 with channelId12 and get reverted", async function () {
                await truffleAssert.fails(
                    documentContract.send(channelId12, ipfsHash12, repo, {from: account2}),
                    truffleAssert.ErrorType.REVERT,
                    "notChannelOwner"
                );
            });

            it("send from account4 with channelId12 and get reverted", async function () {
                await truffleAssert.fails(
                    documentContract.send(channelId12, ipfsHash12, repo, {from: account4}),
                    truffleAssert.ErrorType.REVERT,
                    "notChannelOwner"
                );
            });

            it("send from account4 with channelId41 and get reverted", async function () {
                await truffleAssert.fails(
                    documentContract.send(channelId41, ipfsHash41, repo, {from: account4}),
                    truffleAssert.ErrorType.REVERT,
                    "notChannelOwner"
                );
            });

            it("send from account4 with channelId51 and get reverted", async function () {
                await truffleAssert.fails(
                    documentContract.send(channelId51, ipfsHash51, repo, {from: account4}),
                    truffleAssert.ErrorType.REVERT,
                    "notChannelOwner"
                );
            });

            it("should send from account2 to channel21 successfully", async function () {
                let response = await documentContract.send(channelId21, ipfsHash21, repo, {from: account2});
                truffleAssert.eventEmitted(response, "newDocumentEvent", (ev) => {
                    return (
                        ev.channelId === channelId21
                        && ev.repo == repo
                        && ev.fileHash === ipfsHash21
                    );
                });
            });

            describe("the event log", async function () {
                it("should contain one entry for channel21", async function () {

                    let logs = (await documentContract.getPastEvents(
                        "newDocumentEvent",
                        {
                            filter: {
                                channelId: channelId21
                            },
                            fromBlock: blockNumberAtStart,
                            toBlock: "latest"
                        }
                    )).map(function (item) {
                        return item.args;
                    });

                    expect(logs.length).to.equal(1);
                    expect(logs[0].channelId).to.equal(channelId21);
                    expect(logs[0].fileHash).to.equal(ipfsHash21);
                });

                it("should contain the two correct entries", async function () {

                    let logs = (await documentContract.getPastEvents(
                        "newDocumentEvent",
                        {
                            filter: {
                                channelId: [channelId12, channelId21]
                            },
                            fromBlock: blockNumberAtStart,
                            toBlock: "latest"
                        }
                    )).map(function (item) {
                        return item.args;
                    });

                    expect(logs.length).to.equal(2);
                    expect(logs[0].channelId).to.equal(channelId12);
                    expect(logs[1].channelId).to.equal(channelId21);
                    expect(logs[0].fileHash).to.equal(ipfsHash12);
                    expect(logs[1].fileHash).to.equal(ipfsHash21);
                });

            });

        });
    });
});
