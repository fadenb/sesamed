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

// contract json
const accountContractJson = require("../eth/build/contracts/Account.json");

// global module variables
let privateKey,
    provider,
    accountContract;

let standard = {
    rpc: "https://rpc.sesamed.de",
    network: "219"
};

/**
 *
 * @typedef {Object} Account
 * @alias Account
 * @memberof module:sesamed
 * @property {Wallet}
 * @property {PgpKeys}
 */


/**
 *
 * @typedef {Object} Wallet
 * @alias Wallet
 * @memberof module:sesamed
 * @property {String} mnemonic The digest output of hash function in hex with prepended "0x"
 * @property {String} path The hash function code for the function used
 * @property {String} privateKey The length of digest
 * @property {String} address The length of digest
 */

/**
 *
 * @typedef {Object} PgpKeys
 * @alias PgpKeys
 * @memberof module:sesamed
 * @property {String} privateKey
 * @property {String} publicKey
 */


/**
 * Initializes the configuration
 * @alias module:sesamed.init
 * @param {Object} options
 * @param {String} options.accountContractAddress
 * @param {String} options.rpc
 * @param {String} options.privateKey
 */
function init(options) {
    provider = new ethers.providers.JsonRpcProvider(options.rpc || standard.rpc);
    privateKey = options.privateKey;
    let accountContractAddress = options.accountContractAddress || accountContractJson.networks[standard.network].address;
    let wallet = new ethers.Wallet(privateKey, provider);
    accountContract = new ethers.Contract(accountContractAddress, accountContractJson.abi, provider).connect(wallet);
}


/**
 * creates a new account and sets
 * @alias module:sesamed.createAccount
 * @param {Object} options
 * @param {Object} options.userIds
 * @param {String} options.userIds.name - name connected with pgp keys
 * @param {String} options.userIds.email - email address connected with pgp keys
 * @param {String} options.passphrase - passphrase to encrypt private pgp key
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
async function createAccount(options) {

    const newWallet = await createWallet();
    const pgpKeys = await pgp.generateKeys({userIds: options.userIds, passphrase: options.passphrase});

    return {
        wallet: newWallet,
        pgp: pgpKeys,
    };
}

/**
 *
 * @returns {Promise<{path: String, privateKey: String, address: String, mnemonic: String}>}
 */
async function createWallet() {
    const mnemonic = await createMnemonic();
    const newWallet = ethers.Wallet.fromMnemonic(mnemonic);

    return {
        mnemonic: newWallet.signingKey.mnemonic,
        path: newWallet.signingKey.path,
        privateKey: newWallet.signingKey.privateKey,
        address: newWallet.signingKey.address
    };
}

/**
 *
 * @returns {Promise<string>}
 */
async function createMnemonic() {
    return ethers.utils.HDNode.entropyToMnemonic(getRandomBytes(16));
}

/**
 *
 * @param {Number} n
 * @returns {Uint8Array}
 */
function getRandomBytes(n) {
    return ethers.utils.randomBytes(n);
}


/**
 * Registers a new account
 * @alias module:sesamed.register
 * @param {String} name
 * @param {String} publicPgpKey
 * @returns {Promise}
 */
function registerAccount(name, publicPgpKey) {
    return accountContract.register(name, publicPgpKey);
}

/**
 * Get all new Accounts
 * @param {Number} [from] - Block to Start
 * @param {Number} [to] - Block to End
 * @returns {Promise}
 */
function getNewAccounts(from, to) {
    var filter = {
        fromBlock: from || 0,
        toBlock: to || "latest",
        topics: [
            ethers.utils.id("newAccountEvent(bytes32,string,address,string)")
        ]
    };

    return provider.getLogs(filter).then(logs => {
        return logs.map(function(item) {
            var decodedData = ethers.utils.defaultAbiCoder.decode(
                [ "string", "address", "string"],
                item.data
            );
            item.data = {
                name: decodedData[0],
                owner: decodedData[1],
                publicKey: decodedData[2],
            };
            return item;
        });
    });
}

var sesamed = {
    init: init,
    createAccount: createAccount,
    registerAccount: registerAccount,
    getNewAccounts: getNewAccounts,
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
 * Blockchain for the Healthcare System
 * @module sesamed
 * @typicalname sesamed
 * @example
 * ```js
 * const sesamed = require("sesamed")
 * ```
 */

module.exports = sesamed;



