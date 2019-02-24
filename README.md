<h1 align="center">
    <a href="https://ipfs.io">
        <img src="https://ipfs.io/ipfs/QmcFCZqMQi8jP2TkdicBzWVoeDosmdsftAqTaLNY7kH5yV" alt="Sesamed logo" />
    </a>
</h1>

<h3 align="center">Sesamed - Blockchain for the  German Healthcare System</h3>

<p align="center">
    <a href="https://www.redmedical.de"><img src="https://img.shields.io/badge/made%20by-RED%20Medical-blue.svg" /></a>
</p>


[![view on npm](http://img.shields.io/npm/v/sesamed.svg)](https://www.npmjs.org/package/sesamed)
[![npm module downloads](http://img.shields.io/npm/dt/sesamed.svg)](https://www.npmjs.org/package/sesamed)
[![codecov](https://codecov.io/gh/redmedical/sesamed/branch/master/graph/badge.svg)](https://codecov.io/gh/redmedical/sesamed)
[![Build Status](https://travis-ci.org/redmedical/sesamed.svg?branch=master)](https://travis-ci.org/redmedical/sesamed)
[![Dependency Status](https://david-dm.org/redmedical/sesamed.svg)](https://david-dm.org/redmedical/sesamed)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/feross/standard)
[![Join the chat at https://gitter.im/redmedcical/sesamed](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/redmedical/sesamed?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# sesamed

Blockchain for the German Healthcare System

**Features:**

- private
- Large collection of **test cases** which are maintained and added to
- **GPL-3.0 License** (including ALL dependencies)

# Installing

Installation is simple, just install via npm.

```bash
npm install --save sesamed
```


# Using

## In the browser

```html
<script src="dist/sesamed.min.js" type="text/javascript"></script>
```

## With Node.js

```sh
let sesamed = require("sesamed");
```

# Contributing
If you want to contribute you are welcome. Please regard the points below.

## Committing

This project is based on [Karma Git Commit Convention](http://karma-runner.github.io/3.0/dev/git-commit-msg.html).
See their [commit history](https://github.com/karma-runner/karma/commits/master) for examples of properly-formatted
commit messages.

## Testing

**Write tests!** We enforce 100 % code coverage on this repo so any new code that gets written should have accompanying tests.

```bash
npm test
```

## Linting

**Follow the linter.** We use ESlint, and we run `npm run lint` in our Travis builds.

# API Reference

## Standard

    
* [sesamed](#module_sesamed)
    * _global_
        * [Multihash](#Multihash) : <code>Object</code>
        * [Account](#Account) : <code>Object</code>
        * [UserIds](#UserIds) : <code>Object</code>
        * [Wallet](#Wallet) : <code>Object</code>
        * [PgpKeys](#PgpKeys) : <code>Object</code>
        * [IpfsGateway](#IpfsGateway) : <code>Object</code>
        * [Channel](#Channel) : <code>Object</code>
        * [Document](#Document) : <code>Object</code>
    * _static_
        * [.init([options])](#module_sesamed.init)
        * [.getNewAccount(name)](#module_sesamed.getNewAccount) ⇒ [<code>Account</code>](#Account)
        * [.setAccount(account)](#module_sesamed.setAccount)
        * [.register([waitForReceipt])](#module_sesamed.register) ⇒ <code>Promise</code>
        * [.getPublicKey(name)](#module_sesamed.getPublicKey) ⇒ <code>Promise</code>
        * [.registerChannel(recipients, [waitForReceipt])](#module_sesamed.registerChannel) ⇒ <code>Promise</code>
        * [.getNewAccountChannels()](#module_sesamed.getNewAccountChannels) ⇒ <code>Promise</code>
        * [.sendDocument(channel, document, [waitForReceipt])](#module_sesamed.sendDocument) ⇒ <code>Promise</code>
        * [.convertChannelsToObject(channels)](#module_sesamed.convertChannelsToObject) ⇒ <code>Object</code>
        * [.convertChannelsToArray(channelsObj)](#module_sesamed.convertChannelsToArray) ⇒ [<code>Array.&lt;Channel&gt;</code>](#Channel)


## Utilities

    
* [sesamed.pgp](#module_sesamed.pgp)
    * [.generateKeys(name, passphrase)](#module_sesamed.pgp.generateKeys) ⇒ <code>Promise</code>
    * [.getPublicKeyFromPrivateKey(privateKey, passphrase)](#module_sesamed.pgp.getPublicKeyFromPrivateKey) ⇒ <code>Promise</code>
    * [.encrypt(options)](#module_sesamed.pgp.encrypt) ⇒ <code>Promise</code>
    * [.decrypt(options)](#module_sesamed.pgp.decrypt) ⇒ <code>Promise</code>

    
* [sesamed.aes](#module_sesamed.aes)
    * [.generateKey()](#module_sesamed.aes.generateKey) ⇒ <code>Promise</code>
    * [.importKey(key)](#module_sesamed.aes.importKey) ⇒ <code>Promise</code>
    * [.encrypt(key, cleartext)](#module_sesamed.aes.encrypt) ⇒ <code>Promise</code>
    * [.decrypt(key, ciphertext)](#module_sesamed.aes.decrypt) ⇒ <code>Promise</code>

    
* [sesamed.ipfs](#module_sesamed.ipfs)
    * [.setGateway(ipfsGateway)](#module_sesamed.ipfs.setGateway)
    * [.write(data)](#module_sesamed.ipfs.write) ⇒ <code>Promise</code>
    * [.read(fileHash)](#module_sesamed.ipfs.read) ⇒ <code>Promise</code>

    
* [sesamed.multihash](#module_sesamed.multihash)
    * [.getMultihashFromBase58(b58hash)](#module_sesamed.multihash.getMultihashFromBase58) ⇒ [<code>Multihash</code>](#Multihash)
    * [.getBase58FromMultihash(multihash)](#module_sesamed.multihash.getBase58FromMultihash) ⇒ <code>string</code>


## Standard

<a name="Multihash"></a>

### MultiHash : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properties**

- digest <code>string</code> - The digest output of hash function in hex with prepended "0x"  
- hashFunction <code>number</code> - The hash function code for the function used  
- size <code>number</code> - The length of digest  

<a name="Account"></a>

### Account : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properties**

- mnemonic <code>String</code> - the mnemonic of the account  
- address <code>String</code> - the address of the account  
- privateKey <code>String</code> - the privateKey of the account  

<a name="UserIds"></a>

### UserIds : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properties**

- name <code>String</code> - the account name  
- email <code>String</code> - the email of the account  

<a name="Wallet"></a>

### Wallet : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properties**

- mnemonic <code>String</code> - the mnemonic to restore the account  
- path <code>String</code> - the path of the mnemonic  
- privateKey <code>String</code> - the private key of the account  
- address <code>String</code> - the address of the account  

<a name="PgpKeys"></a>

### PgpKeys : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properties**

- privateKey <code>String</code> - the private pgp key  
- publicKey <code>String</code> - the public pgp key  

<a name="IpfsGateway"></a>

### IpfsGateway : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properry**: <code>Number</code> port - the gateway port (i.e. 5001)  
**Properties**

- host <code>String</code> - the host address (i.e. "ipfs.infura.io")  
- protocol <code>String</code> - "https" / "http"  

<a name="Channel"></a>

### Channel : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properties**

- channelId <code>String</code> - the id of the channel  
- aesKey <code>String</code> - the AES key of the channel  
- tx <code>Object</code> - the transaction if channel was written  
- receipt <code>Object</code> - the receipt if channel was written and waitForReceipt:true  

<a name="Document"></a>

### Document : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properties**

- channelId <code>String</code> - the id of the channel the document came from  
- fileHash <code>String</code> - the hash of the encrypted document  
- repo <code>Number</code> - the repo the document is stored (at the moment repo:1 (ipfs) is fixed  
- aesKey <code>String</code> - the AES key of the channel can be temporarily part of the document  
- data <code>String</code> - the data of the document in cleartext  

<a name="module_sesamed.init"></a>

### sesamed.init([options])
Initializes the configuration

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Params**

- [options] <code>Object</code>
    - [.accountContractAddress] <code>String</code> - the address of the account contract
    - [.channelContractAddress] <code>String</code> - the address of the channel contract
    - [.documentContractAddress] <code>String</code> - the address of the document contract
    - [.rpcUrl] <code>String</code> - the url of the rpc provider
    - [.ipfsGateway] [<code>IpfsGateway</code>](#IpfsGateway) - the ipfsGateway

<a name="module_sesamed.getNewAccount"></a>

### sesamed.getNewAccount(name) ⇒ [<code>Account</code>](#Account)
creates a new account and sets

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Returns**: [<code>Account</code>](#Account) - account  
**Params**

- name <code>String</code> - the name of the account

**Example**  
```js
> sesamed.getNewAccount()
{
    wallet: {},
    pgp: {}
}
```
<a name="module_sesamed.setAccount"></a>

### sesamed.setAccount(account)
sets an account to be used by sesamed

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Params**

- account [<code>Account</code>](#Account)

<a name="module_sesamed.register"></a>

### sesamed.register([waitForReceipt]) ⇒ <code>Promise</code>
Registers a new account

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Resolve**: <code>Object</code> returns the transaction or the receipt depending on waitForReceipt  
**Reject**: <code>Error</code>  
**Params**

- [waitForReceipt] <code>boolean</code> - if true the receipt is returned else the transaction

<a name="module_sesamed.getPublicKey"></a>

### sesamed.getPublicKey(name) ⇒ <code>Promise</code>
returns the public key of an Account

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Resolve**: <code>String</code> publicKey  
**Reject**: <code>Error</code>  
**Params**

- name <code>String</code> - the name of the account

<a name="module_sesamed.registerChannel"></a>

### sesamed.registerChannel(recipients, [waitForReceipt]) ⇒ <code>Promise</code>
registers a new channel on the blockchain and returns the new channel

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Resolve**: [<code>Channel</code>](#Channel)  
**Reject**: <code>Error</code>  
**Params**

- recipients <code>String</code> | <code>Array.&lt;String&gt;</code> - the names of the recipients
- [waitForReceipt] <code>Bool</code> - if true the returned channel contains a property "receipt"

<a name="module_sesamed.getNewAccountChannels"></a>

### sesamed.getNewAccountChannels() ⇒ <code>Promise</code>
gets all new channels for the current account since startup

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Resolve**: <code>Channel[]</code>  
**Reject**: <code>Error</code>  
<a name="module_sesamed.sendDocument"></a>

### sesamed.sendDocument(channel, document, [waitForReceipt]) ⇒ <code>Promise</code>
sends a document into a channel

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Resolve**: <code>Objcect</code> the transaction or the receipt depending on waitForReceipt  
**Params**

- channel [<code>Channel</code>](#Channel) - the channel to which the document should be sent
- document <code>String</code> - the document to be sent
- [waitForReceipt] <code>Bool</code> - if true the receipt os returned else the the transaction

<a name="module_sesamed.convertChannelsToObject"></a>

### sesamed.convertChannelsToObject(channels) ⇒ <code>Object</code>
converts an array of chanels into an object in which the channelID is the property and the value is the channel

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Returns**: <code>Object</code> - channelsObj - {channelId1: {...}, channelId2, {...}, ...}  
**Params**

- channels [<code>Array.&lt;Channel&gt;</code>](#Channel)

<a name="module_sesamed.convertChannelsToArray"></a>

### sesamed.convertChannelsToArray(channelsObj) ⇒ [<code>Array.&lt;Channel&gt;</code>](#Channel)
converts an object of chanels into an an array (see convertChannelsToObject())

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Returns**: [<code>Array.&lt;Channel&gt;</code>](#Channel) - channels  
**Params**

- channelsObj <code>Object</code> - {channelId1: {...}, channelId2, {...}, ...}


## Utilities

### sesamed.pgp

<a name="module_sesamed.pgp.generateKeys"></a>

### sesamed.pgp.generateKeys(name, passphrase) ⇒ <code>Promise</code>
Creates a new pgp key pair

**Kind**: static method of [<code>sesamed.pgp</code>](#module_sesamed.pgp)  
**Resolve**: [<code>PgpKeys</code>](#PgpKeys) pgpKeys  
**Reject**: <code>Error</code>  
**Params**

- name <code>String</code> - the name associated with the pgp keys
- passphrase <code>String</code> - the passphrase protecting the private key

<a name="module_sesamed.pgp.getPublicKeyFromPrivateKey"></a>

### sesamed.pgp.getPublicKeyFromPrivateKey(privateKey, passphrase) ⇒ <code>Promise</code>
returns a the publicKey from a privateKey and a passphrase

**Kind**: static method of [<code>sesamed.pgp</code>](#module_sesamed.pgp)  
**Resolve**: <code>String</code> publicKey  
**Reject**: <code>Error</code>  
**Params**

- privateKey <code>String</code>
- passphrase <code>String</code>

<a name="module_sesamed.pgp.encrypt"></a>

### sesamed.pgp.encrypt(options) ⇒ <code>Promise</code>
Encrypts data with public key/keys and signs if private key is provided

**Kind**: static method of [<code>sesamed.pgp</code>](#module_sesamed.pgp)  
**Resolve**: <code>String</code> ciphertext  
**Reject**: <code>Error</code>  
**Params**

- options <code>Object</code>
    - .publicKey <code>String</code> | <code>Array.&lt;String&gt;</code> - the public key/keys to encrypt with
    - [.privateKey] <code>String</code> - the private key to sign with
    - [.passphrase] <code>String</code> - the passphrase of the private key
    - .cleartext <code>String</code> - the cleartext to encrypt

<a name="module_sesamed.pgp.decrypt"></a>

### sesamed.pgp.decrypt(options) ⇒ <code>Promise</code>
Decrypts data with private key and checks signature if public key is provided

**Kind**: static method of [<code>sesamed.pgp</code>](#module_sesamed.pgp)  
**Resolve**: <code>string</code> cleartext  
**Reject**: <code>Error</code>  
**Params**

- options <code>Object</code>
    - .privateKey <code>String</code>
    - .passphrase <code>String</code>
    - [.publicKey] <code>String</code>
    - .ciphertext <code>String</code>


### sesamed.aes

<a name="module_sesamed.aes.generateKey"></a>

### sesamed.aes.generateKey() ⇒ <code>Promise</code>
Returns a base64 encoded AES key

**Kind**: static method of [<code>sesamed.aes</code>](#module_sesamed.aes)  
**Resolve**: <code>String</code> key - a base64 encoded AES key  
**Reject**: <code>Error</code> - this should not happen  
<a name="module_sesamed.aes.importKey"></a>

### sesamed.aes.importKey(key) ⇒ <code>Promise</code>
imports a base64 encoded key into a CryptoKey

**Kind**: static method of [<code>sesamed.aes</code>](#module_sesamed.aes)  
**Resolve**: <code>CryptoKey</code>  
**Reject**: <code>Error</code>  
**Params**

- key <code>string</code> - the base64 encoded AES key

<a name="module_sesamed.aes.encrypt"></a>

### sesamed.aes.encrypt(key, cleartext) ⇒ <code>Promise</code>
AES-encrypts cleartext to cyphertext with the given key

**Kind**: static method of [<code>sesamed.aes</code>](#module_sesamed.aes)  
**Resolve**: <code>string</code> ciphertext - the base64 encoded ciphertext  
**Reject**: <code>Error</code>  
**Params**

- key <code>String</code>
- cleartext <code>String</code>

<a name="module_sesamed.aes.decrypt"></a>

### sesamed.aes.decrypt(key, ciphertext) ⇒ <code>Promise</code>
AES-decryptfs cyphertext to cleartext with the given key

**Kind**: static method of [<code>sesamed.aes</code>](#module_sesamed.aes)  
**Resolve**: <code>String</code> ciphertext - the base64 encoded ciphertext  
**Reject**: <code>Error</code>  
**Params**

- key <code>String</code>
- ciphertext <code>String</code>


### sesamed.ipfs

<a name="module_sesamed.ipfs.setGateway"></a>

### sesamed.ipfs.setGateway(ipfsGateway)
sets the ipfs gateway

**Kind**: static method of [<code>sesamed.ipfs</code>](#module_sesamed.ipfs)  
**Params**

- ipfsGateway <code>String</code>

<a name="module_sesamed.ipfs.write"></a>

### sesamed.ipfs.write(data) ⇒ <code>Promise</code>
Writes data to the ipfs

**Kind**: static method of [<code>sesamed.ipfs</code>](#module_sesamed.ipfs)  
**Resolve**: <code>String</code> fileHash  
**Reject**: <code>Error</code>  
**Params**

- data <code>String</code> - the data to be written

<a name="module_sesamed.ipfs.read"></a>

### sesamed.ipfs.read(fileHash) ⇒ <code>Promise</code>
Reads data from the ipfs

**Kind**: static method of [<code>sesamed.ipfs</code>](#module_sesamed.ipfs)  
**Resolve**: <code>String</code> data - the data which has been read  
**Reject**: <code>Error</code>  
**Params**

- fileHash <code>String</code> - the ipfs fileHash


### sesamed.multihash

<a name="module_sesamed.multihash.getMultihashFromBase58"></a>

### sesamed.multihash.getMultihashFromBase58(b58hash) ⇒ [<code>Multihash</code>](#Multihash)
Partition multihash string into object representing multihash

**Kind**: static method of [<code>sesamed.multihash</code>](#module_sesamed.multihash)  
**Params**

- b58hash <code>string</code> - A base58 encoded multihash string

<a name="module_sesamed.multihash.getBase58FromMultihash"></a>

### sesamed.multihash.getBase58FromMultihash(multihash) ⇒ <code>string</code>
Encode a multihash structure into base58 encoded multihash string

**Kind**: static method of [<code>sesamed.multihash</code>](#module_sesamed.multihash)  
**Returns**: <code>string</code> - base58 encoded multihash string  
**Params**

- multihash [<code>Multihash</code>](#Multihash)


* * *

&copy; 2019 RED Medical Systems GmbH &lt;info@redmedical.de&gt;. Documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown).