/**
 * @namespace ipfs
 * @memberOf sesamed
 */
"use strict";
// global npm packages
const IPFS = require("ipfs-mini");


// the ipfs provider
const ipfs = new IPFS({host: "ipfs.infura.io", port: 5001, protocol: "https"});


/**
 * Writes data to the ipfs
 * @alias module:"sesamed.ipfs".write
 * @memberof module:"sesamed.ipfs"
 * @param {String} data - the data to be written
 * @returns {Promise}
 * @resolve {String} fileHash
 * @reject {Error}
 */
function write(data) {
    return ipfs.add(data);
}


/**
 * Reads data from the ipfs
 * @alias module:"sesamed.ipfs".read
 * @memberof module:"sesamed.ipfs"
 * @param {String} fileHash - the ipfs fileHash
 * @returns {Promise}
 * @resolve {String} data - the data which has been read
 * @reject {Error}
 */
function read(fileHash) {
    return ipfs.cat(fileHash);
}

/**
 * @module "sesamed.ipfs"
 */

module.exports = {
    read: read,
    write: write,
    // for testing only
    _ipfs: ipfs
};
