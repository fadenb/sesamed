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
const accountContractJson = require("../eth/build/contracts/Account.json");

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
 * Initializes the configuration
 * @alias module:sesamed.init
 * @param {Object} [options]
 * @param {String} options.accountContractAddress
 * @param {String} options.rpcUrl
 */
function init(options) {
    options = options || {};
    global.provider = new ethers.providers.JsonRpcProvider(options.rpcUrl || global.default.rpcUrl);
    let accountContractAddress = options.accountContractAddress || accountContractJson.networks[global.default.network].address;
    global.accountContract = new ethers.Contract(accountContractAddress, accountContractJson.abi, global.provider);
}


/**
 * creates a new account and sets
 * @alias module:sesamed.createAccount
 * @param {String} name - the name of the account
 * @returns {Account} account
 * @example
 * ```js
 * > sesamed.createAccount()
 * {
 *     wallet: {},
 *     pgp: {}
 * }
 * ```
 */
async function createAccount(name) {

    if (typeof name !== "string" || !name) {
        throw(new Error("createAccount: name missing"));
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

    // create the pgp keys
    global.privateKey = account.privateKey;
    global.publicKey = await pgp.getPublicKeyFromPrivateKey(global.privateKey, account.mnemonic);

    // set account name
    global.name = account.name;
}

/**
 * Registers a new account
 * @alias module:sesamed.register
 * @returns {Promise}
 * @resolve {TxReceipt}
 * @reject {Error}
 */
async function registerAccount() {
    if (!global.name) {
        throw(new Error("registerAccount: no account set - use setAccount before"));
    }
    let ipfsHash = await ipfs.write(global.publicKey);

    return global.accountContract.register(global.name, ipfsHash, global.default.repo);
}

async function getPublicKey(name) {
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


var sesamed = {
    init: init,
    createAccount: createAccount,
    setAccount: setAccount,
    registerAccount: registerAccount,
    getPublicKey: getPublicKey,
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
 * @example
 * ```js
 * const sesamed = require("sesamed")
 * ```
 */

module.exports = sesamed;



