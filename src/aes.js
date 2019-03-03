// crypto must not be declared with var, let or const due to browser compatibility
crypto = require("@trust/webcrypto"); // eslint-disable-line no-global-assign
const base64ArrayBuffer = require("base64-arraybuffer");

/**
 * Returns a base64 encoded AES key
 * @alias module:"sesamed.aes".generateKey
 * @returns {Promise}
 * @resolve {String} key - a base64 encoded AES key
 * @reject {Error} - this should not happen
 * @example
 ```js
 // example will follow
 ```
 */
async function generateKey() {
    let key = await crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );

    return crypto.subtle.exportKey(
        "jwk",
        key
    ).then(keydata => keydata.k);
}

/**
 * imports a base64 encoded key into a CryptoKey
 * @alias module:"sesamed.aes".importKey
 * @param {string} key - the base64 encoded AES key
 * @returns {Promise}
 * @resolve {CryptoKey}
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
async function importKey(key) {
    return crypto.subtle.importKey(
        "jwk",
        {
            kty: "oct",
            k: key,
            alg: "A256GCM",
            ext: true,
        },
        {
            name: "AES-GCM",
        },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * AES-encrypts cleartext to cyphertext with the given key
 * @alias module:"sesamed.aes".encrypt
 * @param {String} key
 * @param {String} cleartext
 * @returns {Promise}
 * @resolve {string} ciphertext - the base64 encoded ciphertext
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
async function encrypt(key, cleartext) {
    let cryptoKey = await importKey(key);
    let b64 = new Buffer.from(cleartext, "utf8").toString("base64");
    let b64Buff = base64ArrayBuffer.decode(b64);
    let iv = crypto.getRandomValues(new Uint8Array(16));
    return crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
            tagLength: 128
        },
        cryptoKey,
        b64Buff,
    ).then(encrypted => {
        let info = new Uint8Array([0, 0]); // reserved for later use
        let cipherBuff = concatUint8Arrays(info, iv, new Uint8Array(encrypted));
        return base64ArrayBuffer.encode(cipherBuff);
    });
}

/**
 * AES-decryptfs cyphertext to cleartext with the given key
 * @alias module:"sesamed.aes".decrypt
 * @param {String} key
 * @param {String} ciphertext
 * @returns {Promise}
 * @resolve {String} ciphertext - the base64 encoded ciphertext
 * @reject {Error}
 * @example
 ```js
 // example will follow
 ```
 */
async function decrypt(key, ciphertext) {
    let cipherBuff = base64ArrayBuffer.decode(ciphertext);
    // let info = cipherBuff.slice(0, 2);                 // reserved for later use
    let iv = cipherBuff.slice(2, 18);
    let encrypted = cipherBuff.slice(18, cipherBuff.length);
    let cryptoKey = await importKey(key);
    return crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv,
            tagLength: 128
        },
        cryptoKey,
        encrypted
    ).then(function (decrypted) {
        let b64 =  base64ArrayBuffer.encode(decrypted);
        return new Buffer.from(b64, "base64").toString("utf8");
    });
}

/**
 * Concatenates three Uint8Arrays
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @param {Uint8Array} c
 * @returns {Int8Array}
 * @example
 ```js
 // example will follow
 ```
 */
function concatUint8Arrays(a, b, c) {
    var d = new Int8Array(a.length + b.length + c.length);
    d.set(a);
    d.set(b, a.length);
    d.set(c, a.length + b.length);
    return d;
}

/**
 * @module "sesamed.aes"
 */
let aes = {
    generateKey: generateKey,
    encrypt: encrypt,
    decrypt: decrypt
};

module.exports = aes;