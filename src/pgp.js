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
 * @param {String} name - the name associated with the pgp keys
 * @param {String} passphrase - the passphrase protecting the private key
 * @returns {Promise}
 * @resolve {PgpKeys} pgpKeys
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
function generateKeys(name, passphrase) {
    if (!name || !passphrase || typeof name !== "string" || typeof passphrase !== "string") {
        throw(new Error("pgp.generateKeys: missing name or passphrase"));
    }

    return openpgp.generateKey({
        userIds: {name: name},
        curve: "ed25519",
        passphrase: passphrase
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
 * returns a the publicKey from a privateKey and a passphrase
 * @alias module:"sesamed.pgp".getPublicKeyFromPrivateKey
 * @param {String} privateKey
 * @param {String} passphrase
 * @returns {Promise}
 * @resolve {String} publicKey
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
async function getPublicKeyFromPrivateKey(privateKey, passphrase) {
    let privateKeyObj = (await openpgp.key.readArmored(privateKey)).keys[0];
    privateKeyObj.decrypt(passphrase);
    let publicKey = privateKeyObj.toPublic().armor();
    return publicKey;
}

/**
 * Encrypts data with public key/keys and signs if private key is provided
 * @alias module:"sesamed.pgp".encrypt
 * @memberof module:"sesamed.pgp"
 * @param {Object} options
 * @param {String|String[]} options.publicKey - the public key/keys to encrypt with
 * @param {String} [options.privateKey] - the private key to sign with
 * @param {String} [options.passphrase] - the passphrase of the private key
 * @param {String} options.cleartext - the cleartext to encrypt
 * @returns {Promise}
 * @resolve {String} ciphertext
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
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
    }).then(ciphertext => {return deflateCiphertext(ciphertext.data);});
}

/**
 * removes the header and footer and all CR/LF from the ciphertext to use less space
 * @param {String} ciphertext - the full blown pgp ciphertext
 * @returns {String} ciphertext - the deflated ciphertext
 */
function deflateCiphertext(ciphertext) {
    return ciphertext.replace(/(-----BEGIN PGP MESSAGE-----\r\nVersion: OpenPGP.js v4.4.7\r\nComment: https:\/\/openpgpjs.org\r\n\r\n|\r\n-----END PGP MESSAGE-----\r\n|\r\n)/g, "");
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
 * @resolve {string} cleartext
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
async function decrypt(options) {
    let privateKey = (await openpgp.key.readArmored(options.privateKey)).keys[0],
        publicKeys;

    await privateKey.decrypt(options.passphrase);

    if (options.publicKey) {
        publicKeys = (await openpgp.key.readArmored(options.publicKey)).keys;
    }

    return openpgp.decrypt({
        message: await openpgp.message.readArmored(inflateCiphertext(options.ciphertext)),
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
 * returns a full blown pgp message with correct header and footer
 * @param {String} ciphertext - the deflated ciphertext without header and footer
 * @returns {String} ciphertext - the inflated ciphertext with header and footer
 */
function inflateCiphertext(ciphertext) {
    return "-----BEGIN PGP MESSAGE-----\n\n" + ciphertext + "\n-----END PGP MESSAGE-----";
}

/**
 * @module "sesamed.pgp"
 */

let pgp = {
    generateKeys: generateKeys,
    getPublicKeyFromPrivateKey: getPublicKeyFromPrivateKey,
    encrypt: encrypt,
    decrypt: decrypt
};

module.exports = pgp;
