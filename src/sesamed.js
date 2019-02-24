/**
 *  @namespace sesamed
 */
"use strict";
// npm packages
const ethers = require ("ethers");

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
 */


/**
*
* @typedef {Object} UserIds
* @alias UserIds
* @memberof module:sesamed
* @property {String} name - the account name
* @property {String} [email] - the email of the account
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
 */


/**
 *
 * @typedef {Object} PgpKeys
 * @alias PgpKeys
 * @memberof module:sesamed
 * @property {String} privateKey - the private pgp key
 * @property {String} publicKey - the public pgp key
 */


/**
 *
 * @typedef {Object} IpfsGateway
 * @alias IpfsGateway
 * @memberof module:sesamed
 * @property {String} host - the host address (i.e. "ipfs.infura.io")
 * @properry {Number} port - the gateway port (i.e. 5001)
 * @property {String} protocol - "https" / "http"
 */


/**
 *
 * @typedef {Object} Channel
 * @alias Channel
 * @memberof module:sesamed
 * @property {String} channelId - the id of the channel
 * @property {String} aesKey - the AES key of the channel
 * @property {Object} [tx]- the transaction if channel was written
 * @property {Object} [receipt] - the receipt if channel was written and waitForReceipt:true
 *
 */

/**
 *
 * @typedef {Object} Document
 * @alias Document
 * @memberof module:sesamed
 * @property {String} channelId - the id of the channel the document came from
 * @property {String} fileHash - the hash of the encrypted document
 * @property {Number} repo - the repo the document is stored (at the moment repo:1 (ipfs) is fixed
 * @property {String} [aesKey] - the AES key of the channel can be temporarily part of the document
 * @property {String} data - the data of the document in cleartext
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
 */
function init(options) {
    options = options || {};

    // set the gateway for ipfs
    ipfs.setGateway(options.ipfsGateway || global.default.ipfsGateway);

    // set the url of the rpc provider
    global.provider = new ethers.providers.JsonRpcProvider(options.rpcUrl || global.default.rpcUrl);

    // get the current blocknumber at start up
    global.startBlockNumber = global.provider.getBlockNumber();

    // define the account contract
    let accountContractAddress = options.accountContractAddress
        || accountContractJson.networks[global.default.network].address;
    global.accountContract = new ethers.Contract(accountContractAddress, accountContractJson.abi, global.provider);

    // define the channel contract
    let channelContractAddress = options.channelContractAddress
        || channelContractJson.networks[global.default.network].address;
    global.channelContract = new ethers.Contract(channelContractAddress, channelContractJson.abi, global.provider);

    // define the document contract
    let documentContractAddress = options.documentContractAddress
        || documentContractJson.networks[global.default.network].address;
    global.documentContract = new ethers.Contract(documentContractAddress, documentContractJson.abi, global.provider);
}


/**
 * creates a new account and sets
 * @alias module:sesamed.getNewAccount
 * @param {String} name - the name of the account
 * @returns {Account} account
 * @example
 * ```js
 * > sesamed.getNewAccount()
 * {
 *     wallet: {},
 *     pgp: {}
 * }
 * ```
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
        mnemonic: wallet.mnemonic,
        address: wallet.address,
        privateKey: pgpKeys.privateKey
    };
}

/**
 * returns a new wallet
 * @param {String} mnemonic - the mnemonic to create the wallet from
 * @returns {Promise}
 * @resolve {Wallet}
 * @reject {Error}
 */
async function createWalletFromMnemonic(mnemonic) {
    const newWallet = ethers.Wallet.fromMnemonic(mnemonic);

    return {
        mnemonic: newWallet.signingKey.mnemonic,
        path: newWallet.signingKey.path,
        privateKey: newWallet.signingKey.privateKey,
        address: newWallet.signingKey.address,
    };
}

/**
 * returns a mnemonic string
 * @returns {Promise}
 * @resolve {String} mnemonic
 * @reject {Error}
 */
async function createMnemonic() {
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
    global.accountContract = global.accountContract.connect(wallet);
    global.channelContract = global.channelContract.connect(wallet);
    global.documentContract = global.documentContract.connect(wallet);

    // create the pgp keys
    global.privateKey = account.privateKey;
    global.passphrase = account.mnemonic;
    global.publicKey = await pgp.getPublicKeyFromPrivateKey(global.privateKey, account.mnemonic);

    // set account name
    global.name = account.name;
}

/**
 * Registers a new account
 * @alias module:sesamed.register
 * @param {boolean} [waitForReceipt] - if true the receipt is returned else the transaction
 * @returns {Promise}
 * @resolve {Object} returns the transaction or the receipt depending on waitForReceipt
 * @reject {Error}
 */
async function registerAccount(waitForReceipt) {
    if (!global.name) {
        throw(new Error("registerAccount: no account set - use setAccount before"));
    }
    let ipfsHash = await ipfs.write(global.publicKey);

    let tx = await global.accountContract.register(global.name, ipfsHash, global.default.repo);

    if (!waitForReceipt) {
        return tx;
    }
    return await global.provider.waitForTransaction(tx.hash);
}


/**
 * returns the public key of an Account
 * @alias module:sesamed.getPublicKey
 * @param {String} name - the name of the account
 * @returns {Promise}
 * @resolve {String} publicKey
 * @reject {Error}
 */
async function getPublicKey(name) {
    if (!global.name) {
        throw(new Error("registerAccount: no account set - use setAccount before"));
    }

    let accounts = await getLogEntries(
        0,
        "latest",
        global.accountContract.address,
        "newAccountEvent",
        ["bytes32","string","uint8"],
        ethers.utils.id(name)
    );

    if (accounts.length === 0) {
        throw (new Error("getPublicKey: account not found"));
    }

    if (accounts.length > 1) {
        throw (new Error("getPublicKey: multiple accounts found"));
    }

    let fileHash = accounts[0].data[0];
    let publicKey = await ipfs.read(fileHash);

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
 */
function getLogEntries(from, to, contractAddress, eventName, params, topic) {
    var filter = {
            fromBlock: from,
            toBlock: to,
            address: contractAddress,
            topics: [
                ethers.utils.id(eventName + "(" + params.join(",") + ")"),
                topic
            ]
        },
        decodeData = async function (item) {
            item.data = ethers.utils.defaultAbiCoder.decode(
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
 * @param {Bool} [waitForReceipt] if true the returned channel contains a property "receipt"
 * @returns {Promise}
 * @resolve {Channel}
 * @reject {Error}
 */
async function registerChannel(recipients, waitForReceipt) {
    if (!global.name) {
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

    // encrypt the aes key with the public keys of the recipients
    let aesKeyEncrypted = await pgp.encrypt({
        publicKey: publicKeys,
        privateKey: global.privateKey,
        passphrase: global.passphrase,
        cleartext: aesKey
    });

    let channelId = ethers.utils.id(aesKey);

    let channel = {
        channelId: channelId,
        aesKey: aesKey
    };

    let tx = await global.channelContract.register(channelId, aesKeyEncrypted, global.name);
    channel.tx = tx;

    if (waitForReceipt) {
        channel.receipt = await global.provider.waitForTransaction(tx.hash);
    }
    return channel;
}

/**
 * gets all new channels for the current account since startup
 * @alias module:sesamed.getNewAccountChannels
 * @returns {Promise}
 * @resolve {Channel[]}
 * @reject {Error}
 */
async function getNewAccountChannels() {
    let events = await getLogEntries(
        global.startBlockNumber,
        "latest",
        global.channelContract.address,
        "newChannelEvent",
        ["bytes32", "string", "string"]
    );

    let encryptedChannels = events.map(event => {
        return {
            channelId: event.topics[1],
            aesKeyEncrypted: event.data[0],
            name: event.data[1]
        };
    });

    return await filterAccountChannels(encryptedChannels);
}


/**
 *
 * @typedef {Object} EncryptedChannel
 * @alias EncryptedChannel
 * @property {String} channelId - the id of the channel
 * @properry {String} aesKeyEncrypted - the encrypted AES key of the channel
 */


/**
 * filtes out all channels for the current account
 * @param {EncryptedChannel[]} encryptedChannels
 * @returns {Promise}
 * @resolve {Channel[]}
 * @reject {Error}
 */
async function filterAccountChannels(encryptedChannels) {
    return encryptedChannels.reduce(async function(prevPromise, encryptedChannel) {
        let accountChannels = await prevPromise;
        await pgp.decrypt({
            privateKey: global.privateKey,
            passphrase: global.passphrase,
            ciphertext: encryptedChannel.aesKeyEncrypted
        }).then(aesKey => {
            encryptedChannel.aesKey = aesKey;
            accountChannels.push(encryptedChannel);
        }).catch(() => {
            // do nothing
        });
        return accountChannels;
    }, Promise.resolve([]));
}

/**
 * sends a document into a channel
 * @alias module:sesamed.sendDocument
 * @param {Channel} channel - the channel to which the document should be sent
 * @param {String } document - the document to be sent
 * @param {Bool} [waitForReceipt] if true the receipt os returned else the the transaction
 * @returns {Promise}
 * @resolve {Objcect} the transaction or the receipt depending on waitForReceipt
 */
async function sendDocument(channel, document, waitForReceipt) {
    let encDoc = await aes.encrypt(channel.aesKey, document);
    let ipfsHash = await ipfs.write(encDoc);
    let tx = await global.documentContract.send(channel.channelId, ipfsHash, global.default.repo);
    if (!waitForReceipt) {
        return tx;
    }
    return await global.provider.waitForTransaction(tx.hash);
}

/**
 * gets all documents from the givens channels
 * @param {Channel[]} channels - an array of the channels to get the documents from
 * @returns {Promise}
 * @resolve {Documents[]} the documents
 * @reject {Error}
 */
async function getDocuments(channels) {
    let channelsObj = convertChannelsToObject(channels);

    let events = await getLogEntries(
        global.startBlockNumber,
        "latest",
        global.documentContract.address,
        "newDocumentEvent",
        ["bytes32", "string", "uint8"],
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
        fileHash: event.data[0],
        repo: event.data[1],
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
        let encData = await ipfs.read(documentWithKey.fileHash);
        let data = await aes.decrypt(documentWithKey.aesKey, encData);
        documentWithKey.data = data;
        return documentWithKey;
    }));
}



var sesamed = {
    init: init,
    getNewAccount: getNewAccount,
    setAccount: setAccount,
    registerAccount: registerAccount,
    getPublicKey: getPublicKey,
    registerChannel: registerChannel,
    getNewAccountChannels: getNewAccountChannels,
    sendDocument: sendDocument,
    getDocuments: getDocuments,
    convertChannelsToArray: convertChannelsToArray,
    convertChannelsToObject: convertChannelsToObject,
    pgp: pgp,
    aes: aes,
    ipfs: ipfs,
    multihash: multihash,
    // for testing only
    _ethers: ethers
};

if (typeof window !== "undefined") {
    window.sesamed = sesamed;
}

/**
 * @module sesamed
 * @typicalname sesamed
 */

module.exports = sesamed;



