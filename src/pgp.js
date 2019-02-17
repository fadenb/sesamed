/**
 * @namespace pgp
 * @memberOf sesamed
 */
"use strict";
// global npm packages
const openpgp = require("openpgp");

/**
 * Creates a new pgp key pair
 * @alias module:sesamed.pgp.generateKeys
 * @param {Object} options
 * @param {Object} options.userIds
 * @param {String} options.userIds.name
 * @param {String} options.userIds.email
 * @param {String} options.passphrase
 * @returns {Promise}
 * @fulfil {PgpKeys} pgpKeys
 * @reject {Error}
 */
function generateKeys(options) {
    return openpgp.generateKey({
        userIds: options.userIds,
        curve: "ed25519",
        passphrase: options.passphrase
    }).then(key => {
        let privateKey = key.privateKeyArmored,
            publicKey = key.publicKeyArmored;

        return {
            privateKey: privateKey,
            publicKey: publicKey,
        };
    });
}

/**
 * Encrypts data with public key and signs if private key is provided
 * @alias module:"sesamed.pgp".encrypt
 * @memberof module:"sesamed.pgp"
 * @param {Object} options
 * @param {String} options.publicKey
 * @param {String} options.privateKey
 * @param {String} options.passphrase
 * @param {String} options.cleartext
 * @returns {Promise}
 * @fulfil {string} ciphertext
 * @reject {Error}
 */
async function encrypt(options) {
    let privateKey,
        privateKeys,
        publicKeys = [];

    if (options.privateKey) {
        privateKey = (await openpgp.key.readArmored(options.privateKey)).keys[0];
        await privateKey.decrypt(options.passphrase);
        privateKeys = [privateKey];
    }

    if (Array.isArray(options.publicKey)) {
        publicKeys = await Promise.all(options.publicKey.map(async (key) => {
            return (await openpgp.key.readArmored(key)).keys[0];
        }));
    } else {
        publicKeys = (await openpgp.key.readArmored(options.publicKey)).keys[0];
    }

    return openpgp.encrypt({
        message: openpgp.message.fromText(options.cleartext),
        publicKeys: publicKeys,
        privateKeys: privateKeys,
        compression: openpgp.enums.compression.zip
    }).then(ciphertext => ciphertext.data);
}

/**
 * Decrypts data with private key and checks signature if public key is provided
 * @alias module:"sesamed.pgp".decrypt
 * @memberof module:"sesamed.pgp"
 * @param {Object} options
 * @param {String} options.privateKey
 * @param {String} options.passphrase
 * @param {String} [options.publicKey]
 * @param {String} options.ciphertext
 * @returns {Promise}
 * @fulfil {string} cleartext
 * @reject {Error}
 */
async function decrypt(options) {
    let privateKey = (await openpgp.key.readArmored(options.privateKey)).keys[0],
        publicKeys;

    await privateKey.decrypt(options.passphrase);

    if (options.publicKey) {
        publicKeys = (await openpgp.key.readArmored(options.publicKey)).keys;
    }

    return openpgp.decrypt({
        message: await openpgp.message.readArmored(options.ciphertext),
        publicKeys: publicKeys,
        privateKeys: privateKey
    }).then(async plaintext => {
        let signature = plaintext.signatures[0];

        if (publicKeys) {
            if (!(await signature.verified)) {
                throw new Error("Signature not verified");
            }
        }
        return plaintext.data;
    });
}

/**
 * @module "sesamed.pgp"
 */

let pgp = {
    generateKeys: generateKeys,
    encrypt: encrypt,
    decrypt: decrypt
};

module.exports = pgp;
