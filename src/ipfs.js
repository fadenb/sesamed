/**
 * @namespace ipfs
 * @memberOf sesamed
 */
"use strict";

// npm packages
const IPFS = require("ipfs-mini");

// the ipfs provider
let ipfs;

/**
 * sets the ipfs gateway
 * @alias module:"sesamed.ipfs".setGateway
 * @param {String} ipfsGateway
 */
function setGateway(ipfsGateway) {
    if (!ipfsGateway || typeof ipfsGateway !== "object") {
        throw new Error("setGateway: ipfsGateway is missing");
    }

    if (!ipfsGateway.host || !ipfsGateway.port || !ipfsGateway.protocol) {
        throw new Error("setGateway: ipfsGateway incomplete");
    }

    ipfs = new IPFS(ipfsGateway);
}


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
    setGateway: setGateway,
    read: read,
    write: write,
};
