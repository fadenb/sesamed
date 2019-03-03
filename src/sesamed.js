/**
 *  @namespace sesamed
 */
"use strict";
// npm packages
var ethers = require ("ethers");

// local modules
const pgp = require("./pgp");
const aes = require("./aes");
const ipfs = require("./ipfs");
const multihash = require("./multihash");
const global = require("./global");

// contract json
const contracts = require("./contracts");
const accountContractJson = contracts.accountContractJson;
const channelContractJson = contracts.channelContractJson;
const documentContractJson = contracts.documentContractJson;

/**
 *
 * @typedef {Object} Account
 * @alias Account
 * @memberof module:sesamed
 * @property {String} mnemonic - the mnemonic of the account
 * @property {String} address - the address of the account
 * @property {String} privateKey - the privateKey of the account
 * @example
 ```js
 // example will follow
 ```
 */

/**
 *
 * @typedef {Object} UserIds
 * @alias UserIds
 * @memberof module:sesamed
 * @property {String} name - the account name
 * @property {String} [email] - the email of the account
 * @example
 ```js
 // example will follow
 ```
 */

/**
 *
 * @typedef {Object} Wallet
 * @alias Wallet
 * @memberof module:sesamed
 * @property {String} mnemonic - the mnemonic to restore the account
 * @property {String} path - the path of the mnemonic
 * @property {String} privateKey - the private key of the account
 * @property {String} address - the address of the account
 * @example
 ```js
 // example will follow
 ```
 */

/**
 *
 * @typedef {Object} PgpKeys
 * @alias PgpKeys
 * @memberof module:sesamed
 * @property {String} privateKey - the private pgp key
 * @property {String} publicKey - the public pgp key
 * @example
 ```js
 // example will follow
 ```
 */

/**
 *
 * @typedef {Object} IpfsGateway
 * @alias IpfsGateway
 * @memberof module:sesamed
 * @property {String} host - the host address (i.e. "ipfs.infura.io")
 * @property {Number} port - the gateway port (i.e. 5001)
 * @property {String} protocol - "https" / "http"
 * @example
 ```js
 // example will follow
 ```
 */

/**
 *
 * @typedef {Object} Channel
 * @alias Channel
 * @memberof module:sesamed
 * @property {String} channelId - the id of the channel
 * @property {String} aesKey - the AES key of the channel
 * @property {String} ciphertext - contains the encrypted aesKey and name (seperated by a space)
 * @property {String} name - the name of the sender
 * @property {String} nameHash - the hash of the name of the sender
 * @property {Object} [receipt] - the receipt of the transaction
 * @example
 ```js
 // example will follow
 ```
 *
 */

/**
 *
 * @typedef {Object} Document
 * @alias Document
 * @memberof module:sesamed
 * @property {String} channelId - the id of the channel the document came from
 * @property {String} fileHash - the hash of the encrypted document (digest of multihash)
 * @property {String} [aesKey] - the AES key of the channel can be temporarily part of the document
 * @property {String} data - the data of the document in cleartext
 * @example
 ```js
 // example will follow
 ```
 *
 */

/**
 * Initializes the configuration
 * @alias module:sesamed.init
 * @param {Object} [options]
 * @param {String} [options.accountContractAddress] - the address of the account contract
 * @param {String} [options.channelContractAddress] - the address of the channel contract
 * @param {String} [options.documentContractAddress] - the address of the document contract
 * @param {String} [options.rpcUrl] - the url of the rpc provider
 * @param {IpfsGateway} [options.ipfsGateway] - the ipfsGateway
 * @example
 ```js
 // init without any options
 sesamed.init();

 // init with a different ipfsGateway
 sesamed.init({ipfsGateway: {host: "ipfs.infura.io", port: 5001, protocol: "https"}});
 ```
 */
async function init(options) {
    options = options || {};

    // set the gateway for ipfs
    ipfs.setGateway(options.ipfsGateway || global.default.ipfsGateway);

    // set the url of the rpc provider
    global.provider = new ethers.providers.JsonRpcProvider(options.rpcUrl || global.default.rpcUrl);

    // get the current blocknumber at start up
    global.blockNumber  = await global.provider.getBlockNumber();

    // initialize the global cotracts object
    global.contracts = {};
    
    // define the account contract
    let accountContractAddress = options.accountContractAddress
        || accountContractJson.networks[global.default.network].address;
    global.contracts.account = new ethers.Contract(accountContractAddress, accountContractJson.abi, global.provider);

    // define the channel contract
    let channelContractAddress = options.channelContractAddress
        || channelContractJson.networks[global.default.network].address;
    global.contracts.channel = new ethers.Contract(channelContractAddress, channelContractJson.abi, global.provider);

    // define the document contract
    let documentContractAddress = options.documentContractAddress
        || documentContractJson.networks[global.default.network].address;
    global.contracts.document = new ethers.Contract(documentContractAddress, documentContractJson.abi, global.provider);
}


/**
 * creates a new account and sets
 * @alias module:sesamed.getNewAccount
 * @param {String} name - the name of the account
 * @returns {Account} account
 * @example
 ```js
 sesamed.getNewAccount()
 ```
 */
async function getNewAccount(name) {

    if (typeof name !== "string" || !name) {
        throw(new Error("getNewAccount: name missing"));
    }
    const mnemonic = await createMnemonic();
    const wallet = await createWalletFromMnemonic(mnemonic);
    const pgpKeys = await pgp.generateKeys(name, mnemonic);

    return {
        name: name,
        nameHash: ethers.utils.id(name),
        mnemonic: wallet.mnemonic,
        address: wallet.address,
        passphrase: wallet.mnemonic,
        privateKey: pgpKeys.privateKey,
        publicKey: await pgp.getPublicKeyFromPrivateKey(pgpKeys.privateKey, wallet.mnemonic)
    };
}

/**
 * returns a new wallet
 * @param {String} mnemonic - the mnemonic to create the wallet from
 * @returns {Promise}
 * @resolve {Wallet}
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
function createWalletFromMnemonic(mnemonic) {
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);

    return {
        mnemonic: wallet.signingKey.mnemonic,
        path: wallet.signingKey.path,
        privateKey: wallet.signingKey.privateKey,
        address: wallet.signingKey.address,
    };
}

/**
 * returns a mnemonic string
 * @returns {Promise}
 * @resolve {String} mnemonic
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
function createMnemonic() {
    return ethers.utils.HDNode.entropyToMnemonic(getRandomBytes(16));
}

/**
 * returns an Array of n random bytes
 * @param {Number} n
 * @returns {Uint8Array}
 */
function getRandomBytes(n) {
    return ethers.utils.randomBytes(n);
}

/**
 * sets an account to be used by sesamed
 * @alias module:sesamed.setAccount
 * @param {Account} account
 * @example
 ```js
 // example will follow
 ```
 */
async function setAccount(account) {
    if (!account || typeof account !== "object"
        || !account.name || typeof account.name !== "string"
        || !account.mnemonic || typeof account.mnemonic !== "string"
        || !account.privateKey || typeof account.privateKey !== "string"
    ) {
        throw(new Error("setAccount: account incomplete"));
    }

    // create the wallet
    let wallet = await createWalletFromMnemonic(account.mnemonic);
    wallet = new ethers.Wallet(wallet.privateKey, global.provider);
    // get contract with signer (wallet)
    global.contracts = {
        account: global.contracts.account.connect(wallet),
        channel: global.contracts.channel.connect(wallet),
        document: global.contracts.document.connect(wallet)
    };

    // set the account
    global.account = account;
}

/**
 * Registers a new account
 * @alias module:sesamed.register
 * @returns {Promise}
 * @resolve {Object} returns the receipt
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
async function registerAccount() {
    if (!global.account.name) {
        throw(new Error("registerAccount: no account set - use setAccount before"));
    }

    let ipfsHash = await ipfs.write(global.account.publicKey);
    let fileHash = multihash.getMultihashFromBase58(ipfsHash).digest;

    let tx = await global.contracts.account.register(global.account.nameHash, fileHash, {gasLimit: 150000});

    return await global.provider.waitForTransaction(tx.hash);
}


/**
 * returns the public key of an Account
 * @alias module:sesamed.getPublicKey
 * @param {String} name - the name of the account
 * @returns {Promise}
 * @resolve {String} publicKey
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
async function getPublicKey(name) {
    if (!global.account.name) {
        throw(new Error("registerAccount: no account set - use setAccount before"));
    }

    let accounts = await getLogEntries(
        0,
        "latest",
        global.contracts.account.address,
        "newAccountEvent",
        ["bytes32","bytes32"],
        ethers.utils.id(name)
    );

    if (accounts.length === 0) {
        throw (new Error("getPublicKey: account not found"));
    }

    if (accounts.length > 1) {
        throw (new Error("getPublicKey: multiple accounts found"));
    }

    let fileHash = accounts[0].dataArr[0];
    let ipfsHash = multihash.getBase58FromMultihash(fileHash);
    let publicKey = await ipfs.read(ipfsHash);

    return publicKey;
}

/**
 * returns the log entries of a given contract
 * @param {Number|String} from - the blocknumber to start with
 * @param {Number|String} to - the blocknumber to end with
 * @param {String} contractAddress - the contract's address
 * @param {String} eventName - the name of the event to look for
 * @param {String[]} params - the typeofs of the events params
 * @param {String|String[]} [topic] - the topic/topcs to search for
 * @returns {Promise}
 * @resolve {Object[]} entries - the log entries
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
function getLogEntries(from, to, contractAddress, eventName, params, topic) {
    let topics = [
        ethers.utils.id(eventName + "(" + params.join(",") + ")"),
    ];

    if (topic) {
        topics.push(topic);
    }

    var filter = {
            fromBlock: from,
            toBlock: to,
            address: contractAddress,
            topics: topics
        },
        decodeData = async function (item) {
            item.dataArr = ethers.utils.defaultAbiCoder.decode(
                params.slice(1),
                item.data
            );
            return item;
        };

    return global.provider.getLogs(filter).then(function (messages) {
        return Promise.all(messages.map(decodeData));
    });
}

/**
 * registers a new channel on the blockchain and returns the new channel
 * @alias module:sesamed.registerChannel
 * @param {String|String[]} recipients - the names of the recipients
 * @returns {Promise}
 * @resolve {Channel} the new Channel - consists of an additional property "receipt"
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
async function registerChannel(recipients) {
    if (!global.account.name) {
        throw(new Error("registerAccount: no account set - use setAccount before"));
    }

    if (!recipients
        || (!Array.isArray(recipients) && typeof recipients !== "string")
    ) {
        throw (new Error("registerNewChannel: missing recipients"));
    }

    if (typeof recipients === "string") {
        recipients = [recipients];
    }

    // get the publicKeys of the recipients
    let publicKeys = await Promise.all(recipients.map(async recipient => {
        return await getPublicKey(recipient);
    }));

    // get the aes key
    let aesKey = await aes.generateKey();

    // encrypt the aes key and the name with the public keys of the recipients
    let ciphertext = await pgp.encrypt({
        publicKey: publicKeys,
        privateKey: global.account.privateKey,
        passphrase: global.account.passphrase,
        cleartext: aesKey + " " + global.account.name
    });

    let channelId = ethers.utils.id(aesKey);

    let channel = {
        channelId: channelId,
        aesKey: aesKey
    };

    let tx = await global.contracts.channel.register(channelId, global.account.nameHash, ciphertext, {gasLimit: 150000});
    channel.receipt = await global.provider.waitForTransaction(tx.hash);

    return channel;
}

/**
 * gets all new channels for the current account since the given start block
 * @alias module:sesamed.getChannels
 * @param {Number} [startBlockNumber] - the block number to start with (default: 0)
 * @returns {Promise}
 * @resolve {Channel[]}
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
async function getChannels (startBlockNumber) {
    let from = (startBlockNumber > global.startBlockNumber ? startBlockNumber : global.startBlockNumber);
    let events = await getLogEntries(
        from,
        "latest",
        global.contracts.channel.address,
        "newChannelEvent",
        ["bytes32", "bytes32", "string"]
    );

    let encryptedChannels = events.map(mapEventToChannel);

    return await filterAndDecryptAccountChannels(encryptedChannels);
}

function mapEventToChannel (event) {
    return {
        channelId: event.topics[1],
        nameHash: event.dataArr[0],
        ciphertext: event.dataArr[1],
    };
}

/**
 *
 * @typedef {Object} EncryptedChannel
 * @alias EncryptedChannel
 * @property {String} channelId - the id of the channel
 * @properry {String} ciphertext - the encrypted AES key of the channel
 * @example
 ```js
 // example will follow
 ```
 */

/**
 * filtes out all channels for the current account
 * @param {Channel[]} channels
 * @returns {Promise}
 * @resolve {Channel[]}
 * @reject {Error}
 */
async function filterAndDecryptAccountChannels(channels) {
    return channels.reduce(async function(prevPromise, channel) {
        let accountChannels = await prevPromise;
        await pgp.decrypt({
            privateKey: global.account.privateKey,
            passphrase: global.account.passphrase,
            ciphertext: channel.ciphertext
        }).then(cleartext => {
            // cleartext = aesKey + " " + name
            let cleartextArr = cleartext.split(" ");
            channel.aesKey = cleartextArr[0];
            channel.name = cleartextArr[1];

            // check if name and nameHash fit
            checkChannelNameHash(channel);

            accountChannels.push(channel);
        }).catch(() => {
            // do nothing
        });
        return accountChannels;
    }, Promise.resolve([]));
}


/**
 * returns if channel.nameHash equals the hash of channel.name
 * @param {Channel} channel - the channel to be checked
 * @returns {boolean}
 */
function checkChannelNameHash(channel) {
    return ethers.utils.id(channel.name) !== channel.nameHash;
}

/**
 * sends a document into a channel
 * @alias module:sesamed.sendDocument
 * @param {Channel} channel - the channel to which the document should be sent
 * @param {String } document - the document to be sent
 * @returns {Promise}
 * @resolve {Object} the receipt of the transaction
 * @example
 ```js
 // example will follow
 ```
 */
async function sendDocument(channel, document) {
    let encDoc = await aes.encrypt(channel.aesKey, document);
    let ipfsHash = await ipfs.write(encDoc);
    let fileHash = multihash.getMultihashFromBase58(ipfsHash).digest;
    let tx = await global.contracts.document.send(channel.channelId, fileHash, {gasLimit: 150000});
    return await global.provider.waitForTransaction(tx.hash);
}

/**
 * gets all documents from the givens channels starting with the given blocknumber
 * @param {Channel[]} channels - an array of the channels to get the documents from
 * @param {Number} [startBlockNumber] - the blocknumber to start with  (default: from contractStart)
 * @returns {Promise}
 * @resolve {Documents[]} the documents
 * @reject {Error}
 */
async function getDocuments(channels, startBlockNumber) {
    if (channels.length === 0) {
        return [];
    }

    let channelsObj = convertChannelsToObject(channels);
    let events = await getLogEntries(
        startBlockNumber || global.startBlockNumber,
        "latest",
        global.contracts.document.address,
        "newDocumentEvent",
        ["bytes32", "bytes32"],
        Object.keys(channelsObj)
    );

    let documentsWithKey = events.map(event => {
        return mapEventsToDocuments(channelsObj, event);
    });

    let documentsWithDataWithoutKey = (await getDocumentsFromIpfs(documentsWithKey)).map(document => {
        delete document.aesKey;
        return document;
    });

    return documentsWithDataWithoutKey;
}

/**
 * maps an event to a document
 * @param {Object} channelsObj - the channelsObject containing the aesKeys of the channels
 * @param {Object} event
 * @returns {Document}
 */
function mapEventsToDocuments (channelsObj, event) {
    let channelId = event.topics[1];

    return {
        channelId: channelId,
        fileHash: event.dataArr[0],
        aesKey: channelsObj[channelId].aesKey
    };
}

/**
 * converts an array of chanels into an object in which the channelID is the property and the value is the channel
 * @alias module:sesamed.convertChannelsToObject
 * @param  {Channel[]} channels
 * @returns {Object} channelsObj - {channelId1: {...}, channelId2, {...}, ...}
 */
function convertChannelsToObject(channels) {
    let channelsObj = {};

    channels.forEach(channel => {
        channelsObj[channel.channelId] = channel;
    });

    return channelsObj;
}

/**
 * converts an object of chanels into an an array (see convertChannelsToObject())
 * @alias module:sesamed.convertChannelsToArray
 * @param  {Object} channelsObj - {channelId1: {...}, channelId2, {...}, ...}
 * @returns {Channel[]} channels
 * @example
 ```js
 // example will follow
 ```
 */
function convertChannelsToArray(channelsObj) {
    let channelId;
    let channels = [];

    for (channelId in channelsObj) {
        channels.push(channelsObj[channelId]);
    }
    return channels;
}

/**
 * gets the documents from ipfs and puts the decrypted data into the data property of the channels
 * @param {Documents[]} documentsWithKey
 * @returns {Promise}
 * @resolve {Documents[]} - the documents with data
 * @reject {Error}
 */
async function getDocumentsFromIpfs(documentsWithKey) {
    return Promise.all(documentsWithKey.map(async documentWithKey => {
        let ipfsHash = multihash.getBase58FromMultihash(documentWithKey.fileHash);
        let encData = await ipfs.read(ipfsHash);
        let data = await aes.decrypt(documentWithKey.aesKey, encData);
        documentWithKey.data = data;
        return documentWithKey;
    }));
}

/**
 * returns the current block number
 * @alias module:sesamed.getBlockNumber
 * @returns {Promise}
 * @resolve {Number} the current block number
 * @example
 ```js
 sesamed.getBlockNumber().then((blockNumber) => {
     console.log("Current block number: " + blockNumber);
 });
 ```
 */
async function getBlockNumber() {
    return await global.provider.getBlockNumber();
}

var sesamed = {
    init: init,
    getNewAccount: getNewAccount,
    setAccount: setAccount,
    registerAccount: registerAccount,
    getPublicKey: getPublicKey,
    registerChannel: registerChannel,
    getChannels: getChannels,
    sendDocument: sendDocument,
    getDocuments: getDocuments,
    convertChannelsToArray: convertChannelsToArray,
    convertChannelsToObject: convertChannelsToObject,
    getBlockNumber: getBlockNumber,
    pgp: pgp,
    aes: aes,
    ipfs: ipfs,
    multihash: multihash,
};

if (typeof window !== "undefined") {
    window.sesamed = sesamed;
}

/**
 * @module sesamed
 * @typicalname sesamed
 */

module.exports = sesamed;



