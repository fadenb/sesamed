var bs58 = require("bs58");

/**
 * @typedef {Object} Multihash
 * @alias Multihash
 * @memberof module:sesamed
 * @property {string} digest The digest output of hash function in hex with prepended "0x"
 * @property {number} hashFunction The hash function code for the function used
 * @property {number} size The length of digest
 * @example
 ```js
 // example will follow
 ```
 */

/**
 * Partition multihash string into object representing multihash
 * @alias module:"sesamed.multihash".getMultihashFromBase58
 * @param {string} b58hash A base58 encoded multihash string
 * @returns {Multihash}
 * @example
 ```js
 // example will follow
 ```
 */
function getMultihashFromBase58(b58hash) {
    const decoded = bs58.decode(b58hash);

    return {
        digest: `0x${decoded.slice(2).toString("hex")}`,
        hashFunction: decoded[0],
        size: decoded[1],
    };
}

/**
 * Encode a multihash structure into base58 encoded multihash string
 * @alias module:"sesamed.multihash".getBase58FromMultihash
 * @param {Multihash|String} multihash - the multihash or the digest (hash function and size are then default)
 * @returns {string} base58 encoded multihash string
 * @example
 ```js
 // example will follow
 ```
 */
function getBase58FromMultihash(multihash) {
    let digest,
        hashFunction,
        size;

    if (typeof multihash === "string") {
        digest = multihash;
        hashFunction = 18;
        size = 32;
    } else {
        digest = multihash.digest;
        hashFunction = multihash.hashFunction;
        size = multihash.size;
    }

    // cut off leading "0x"
    const hashBytes = new Buffer.from(digest.slice(2), "hex");

    // prepend hashFunction and digest size
    const multihashBytes = new Buffer.alloc(2 + hashBytes.length);
    multihashBytes[0] = hashFunction;
    multihashBytes[1] = size;
    multihashBytes.set(hashBytes, 2);

    return bs58.encode(multihashBytes);
}

/**
 * @module "sesamed.multihash"
 */
let multihash = {
    getMultihashFromBase58: getMultihashFromBase58,
    getBase58FromMultihash: getBase58FromMultihash,
};

module.exports = multihash;