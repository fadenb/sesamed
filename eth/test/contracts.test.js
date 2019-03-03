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
        nameHash1 = web3.utils.sha3(name1),
        nameHash2 = web3.utils.sha3(name2),
        nameHash3 = web3.utils.sha3(name3),
        nameHash4 = web3.utils.sha3(name4),
        fileHash1 = web3.utils.randomHex(32),
        fileHash2 = web3.utils.randomHex(32),
        fileHash3 = web3.utils.randomHex(32),
        channelId12 = web3.utils.randomHex(32),
        channelId21 = web3.utils.randomHex(32),
        channelId31 = web3.utils.randomHex(32),
        channelId41 = web3.utils.randomHex(32),
        channelId51 = web3.utils.randomHex(32),
        ciphertext12 = "cipher12",
        ciphertext31 = "cipher31",
        ciphertext21 = "cipher21",
        ciphertext41 = "cipher41",
        fileHash12 = web3.utils.sha3("ipfs12"),
        fileHash21 = web3.utils.sha3("ipfs21"),
        fileHash31 = web3.utils.sha3("ipfs31"),
        fileHash41 = web3.utils.sha3("ipfs41"),
        fileHash51 = web3.utils.sha3("ipfs51"),
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
                var response = await accountContract.register(nameHash1, fileHash1, {from: account1});
                truffleAssert.eventEmitted(response, "newAccountEvent", (ev) => {
                    return (ev.nameHash === nameHash1
                        && ev.fileHash === fileHash1
                    );
                });
            });

            it("should add account Jan from account 1 and get reverted", async function () {
                await truffleAssert.fails(
                    accountContract.register(nameHash2, fileHash2, {from: account1}),
                    truffleAssert.ErrorType.REVERT,
                    "existsAddress"
                );
            });

            it("should add account Jan from account 2", async function () {
                let response = await accountContract.register(nameHash2, fileHash2, {from: account2});
                truffleAssert.eventEmitted(response, "newAccountEvent", (ev) => {
                    return (ev.nameHash === nameHash2
                        && ev.fileHash === fileHash2
                    );
                });
            });

            it("should add account Jochen from account3 and get reverted", async function () {
                await truffleAssert.fails(
                    accountContract.register(nameHash1, fileHash1, {from: account3}),
                    truffleAssert.ErrorType.REVERT,
                    "existsName"
                );
            });

            it("should add account Katy from account2 and get reverted", async function () {
                await truffleAssert.fails(
                    accountContract.register(nameHash3, fileHash3, {from: account2}),
                    truffleAssert.ErrorType.REVERT,
                    "existsAddress"
                );
            });

            it("should add account Katy from account3", async function () {
                var response = await accountContract.register(nameHash3, fileHash3, {from: account3});
                truffleAssert.eventEmitted(response, "newAccountEvent", (ev) => {
                    return (ev.nameHash === nameHash3
                        && ev.fileHash === fileHash3
                    );
                });
            });

        });

        describe("getFileHash()", async function () {

            it("should return fileHash for account 1", async function () {
                var fileHash = await accountContract.getFileHash(nameHash1);
                expect(fileHash).to.equal(fileHash1);
            });

            it("should return fileHash for account 2", async function () {
                var fileHash = await accountContract.getFileHash(nameHash2);
                expect(fileHash).to.equal(fileHash2);
            });

            it("should return fileHash for account 3", async function () {
                var fileHash = await accountContract.getFileHash(nameHash3);
                expect(fileHash).to.equal(fileHash3);
            });

        });


        describe("the event log", async function () {
            it("should contain the three correct entries", async function () {

                let logs = (await accountContract.getPastEvents(
                    "newAccountEvent",
                    {
                        filter: {
                            nameHash: [
                                nameHash1,
                                nameHash2,
                                nameHash3
                            ]
                        },
                        fromBlock: blockNumberAtStart,
                        toBlock: "latest"
                    }
                )).map(function (item) {
                    return item.args;
                });

                expect(logs.length).to.equal(3);
                expect(logs[0].nameHash).to.equal(nameHash1);
                expect(logs[1].nameHash).to.equal(nameHash2);
                expect(logs[2].nameHash).to.equal(nameHash3);
            });
        });

    });

    describe("Channel", async function () {
        describe("register", async function () {
            it("should register channel12 from account1 successfully", async function () {

                let response = await channelContract.register(channelId12, nameHash1, ciphertext12 );
                truffleAssert.eventEmitted(response, "newChannelEvent", (ev) => {
                    return (
                        ev.channelId === channelId12
                            && ev.nameHash === nameHash1
                            && ev.ciphertext === ciphertext12
                    );
                });
            });


            it("should register channel31 from account3 successfully", async function () {
                let response = await channelContract.register(channelId31, nameHash3, ciphertext31, {from: account3});
                truffleAssert.eventEmitted(response, "newChannelEvent", (ev) => {
                    return (
                        ev.channelId === channelId31
                            && ev.nameHash === nameHash3
                            && ev.ciphertext === ciphertext31
                    );

                });
            });

            it("should register channel31 from account2 and get reverted", async function () {
                let ciphertext = "cipher31";

                await truffleAssert.fails(
                    channelContract.register(channelId31, nameHash2,ciphertext,  {from: account2}),
                    truffleAssert.ErrorType.REVERT,
                    "existsChannel"
                );
            });

            it("should register channel31 from account2 and get reverted", async function () {
                await truffleAssert.fails(
                    channelContract.register(channelId21, nameHash1, ciphertext21,  {from: account2}),
                    truffleAssert.ErrorType.REVERT,
                    "notExistsAccount"

                );
            });

            it("should register channel21 from account2 successfully", async function () {
                let response = await channelContract.register(channelId21, nameHash2, ciphertext21,  {from: account2});
                truffleAssert.eventEmitted(response, "newChannelEvent", (ev) => {
                    return (
                        ev.channelId === channelId21
                            && ev.nameHash === nameHash2
                            && ev.ciphertext === ciphertext21
                    );

                });
            });


            it("should register channel41 from (not registered) account4 an get reverted", async function () {
                await truffleAssert.fails(
                    channelContract.register(channelId41, nameHash4, ciphertext41, {from: account4}),
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
                expect(logs[0].nameHash).to.equal(nameHash1);
                expect(logs[1].nameHash).to.equal(nameHash3);
                expect(logs[2].nameHash).to.equal(nameHash2);
            });
        });
    });

    describe("Document", async function () {

        describe("send", async function () {

            it("should send from account1 to channel12 successfully", async function () {
                let response = await documentContract.send(channelId12, fileHash12);
                truffleAssert.eventEmitted(response, "newDocumentEvent", (ev) => {
                    return (
                        ev.channelId === channelId12
                        && ev.fileHash === fileHash12
                    );
                });
            });

            it("send from account1 to channelId31 and get reverted", async function () {
                await truffleAssert.fails(
                    documentContract.send(channelId31, fileHash31),
                    truffleAssert.ErrorType.REVERT,
                    "notChannelOwner"
                );
            });

            it("send from account2 with channelId12 and get reverted", async function () {
                await truffleAssert.fails(
                    documentContract.send(channelId12, fileHash12, {from: account2}),
                    truffleAssert.ErrorType.REVERT,
                    "notChannelOwner"
                );
            });

            it("send from account4 with channelId12 and get reverted", async function () {
                await truffleAssert.fails(
                    documentContract.send(channelId12, fileHash12, {from: account4}),
                    truffleAssert.ErrorType.REVERT,
                    "notChannelOwner"
                );
            });

            it("send from account4 with channelId41 and get reverted", async function () {
                await truffleAssert.fails(
                    documentContract.send(channelId41, fileHash41, {from: account4}),
                    truffleAssert.ErrorType.REVERT,
                    "notChannelOwner"
                );
            });

            it("send from account4 with channelId51 and get reverted", async function () {
                await truffleAssert.fails(
                    documentContract.send(channelId51, fileHash51, {from: account4}),
                    truffleAssert.ErrorType.REVERT,
                    "notChannelOwner"
                );
            });

            it("should send from account2 to channel21 successfully", async function () {
                let response = await documentContract.send(channelId21, fileHash21, {from: account2});
                truffleAssert.eventEmitted(response, "newDocumentEvent", (ev) => {
                    return (
                        ev.channelId === channelId21
                        && ev.fileHash === fileHash21
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
                    expect(logs[0].fileHash).to.equal(fileHash21);
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
                    expect(logs[0].fileHash).to.equal(fileHash12);
                    expect(logs[1].fileHash).to.equal(fileHash21);
                });

            });

        });
    });
});
