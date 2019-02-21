[![view on npm](http://img.shields.io/npm/v/sesamed.svg)](https://www.npmjs.org/package/sesamed)
[![npm module downloads](http://img.shields.io/npm/dt/sesamed.svg)](https://www.npmjs.org/package/sesamed)
[![codecov](https://codecov.io/gh/redmedical/sesamed/branch/develop/graph/badge.svg)](https://codecov.io/gh/redmedical/sesamed)
[![Build Status](https://travis-ci.org/redmedical/sesamed.svg?branch=develop)](https://travis-ci.org/redmedical/sesamed)
[![Dependency Status](https://david-dm.org/redmedical/sesamed.svg)](https://david-dm.org/redmedical/sesamed/develop)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/feross/standard)
[![Join the chat at https://gitter.im/redmedcical/sesamed](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/redmedical/sesamed?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# sesamed

Blockchain for the German Healthcare System

**Features:**

- private
- Large collection of **test cases** which are maintained and added to
- **GPL-3.0 License** (including ALL dependencies)

Installing
----------

To use in a browser:

```html
<script src="dist/sesamed.min.js" type="text/javascript"></script>
```

To use in [node.js](https://nodejs.org/):

```sh
npm install --save sesamed
```

# API Reference
    Blockchain for the Healthcare System

**Example**  
```js
const sesamed = require("sesamed")
```

* [sesamed](#module_sesamed)
    * _global_
        * [Multihash](#Multihash) : <code>Object</code>
        * [Account](#Account) : <code>Object</code>
        * [Wallet](#Wallet) : <code>Object</code>
        * [PgpKeys](#PgpKeys) : <code>Object</code>
    * _static_
        * [.init(options)](#module_sesamed.init)
        * [.createAccount(options)](#module_sesamed.createAccount) ⇒ [<code>Account</code>](#Account)
        * [.register(name, publicPgpKey)](#module_sesamed.register) ⇒ <code>Promise</code>

    
* [sesamed.pgp](#module_sesamed.pgp)
    * [.generateKeys(options)](#module_sesamed.pgp.generateKeys) ⇒ <code>Promise</code>
    * [.encrypt(options)](#module_sesamed.pgp.encrypt) ⇒ <code>Promise</code>
    * [.decrypt(options)](#module_sesamed.pgp.decrypt) ⇒ <code>Promise</code>

    
* [sesamed.aes](#module_sesamed.aes)
    * [.generateKey()](#module_sesamed.aes.generateKey) ⇒ <code>Promise</code>
    * [.importKey(keydata)](#module_sesamed.aes.importKey) ⇒ <code>Promise</code>
    * [.encrypt(key, cleartext)](#module_sesamed.aes.encrypt) ⇒ <code>Promise</code>
    * [.decrypt(key, cleartext)](#module_sesamed.aes.decrypt) ⇒ <code>Promise</code>

    
* [sesamed.multihash](#module_sesamed.multihash)
    * [.getMultihashFromBase58(b58hash)](#module_sesamed.multihash.getMultihashFromBase58) ⇒ [<code>Multihash</code>](#Multihash)
    * [.getBase58FromMultihash(multihash)](#module_sesamed.multihash.getBase58FromMultihash) ⇒ <code>string</code>

    <a name="Multihash"></a>

### sesamedMultihash : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properties**

- digest <code>string</code> - The digest output of hash function in hex with prepended "0x"  
- hashFunction <code>number</code> - The hash function code for the function used  
- size <code>number</code> - The length of digest  

<a name="Account"></a>

### sesamedAccount : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properties**

-  [<code>Wallet</code>](#Wallet)  
-  [<code>PgpKeys</code>](#PgpKeys)  

<a name="Wallet"></a>

### sesamedWallet : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properties**

- mnemonic <code>String</code> - The digest output of hash function in hex with prepended "0x"  
- path <code>String</code> - The hash function code for the function used  
- privateKey <code>String</code> - The length of digest  
- address <code>String</code> - The length of digest  

<a name="PgpKeys"></a>

### sesamedPgpKeys : <code>Object</code>
**Kind**: global typedef of [<code>sesamed</code>](#module_sesamed)  
**Properties**

- privateKey <code>String</code>  
- publicKey <code>String</code>  

<a name="module_sesamed.init"></a>

### sesamed.init(options)
Initializes the configuration

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Params**

- options <code>Object</code>
    - .accountContractAddress <code>String</code>
    - .rpc <code>String</code>
    - .privateKey <code>String</code>

<a name="module_sesamed.createAccount"></a>

### sesamed.createAccount(options) ⇒ [<code>Account</code>](#Account)
creates a new account and sets

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Returns**: [<code>Account</code>](#Account) - account  
**Params**

- options <code>Object</code>
    - .userIds <code>Object</code>
        - .name <code>String</code> - name connected with pgp keys
        - .email <code>String</code> - email address connected with pgp keys
    - .passphrase <code>String</code> - passphrase to encrypt private pgp key

**Example**  
```js
sesamed.createAccount()
```
<a name="module_sesamed.register"></a>

### sesamed.register(name, publicPgpKey) ⇒ <code>Promise</code>
Registers a new account

**Kind**: static method of [<code>sesamed</code>](#module_sesamed)  
**Params**

- name <code>String</code>
- publicPgpKey <code>String</code>

    <a name="module_sesamed.pgp.generateKeys"></a>

### sesamed.pgp.generateKeys(options) ⇒ <code>Promise</code>
Creates a new pgp key pair

**Kind**: static method of [<code>sesamed.pgp</code>](#module_sesamed.pgp)  
**Fulfil**: [<code>PgpKeys</code>](#PgpKeys) pgpKeys  
**Reject**: <code>Error</code>  
**Params**

- options <code>Object</code>
    - .userIds <code>Object</code>
        - .name <code>String</code>
        - .email <code>String</code>
    - .passphrase <code>String</code>

<a name="module_sesamed.pgp.encrypt"></a>

### sesamed.pgp.encrypt(options) ⇒ <code>Promise</code>
Encrypts data with public key and signs if private key is provided

**Kind**: static method of [<code>sesamed.pgp</code>](#module_sesamed.pgp)  
**Fulfil**: <code>string</code> ciphertext  
**Reject**: <code>Error</code>  
**Params**

- options <code>Object</code>
    - .publicKey <code>String</code>
    - .privateKey <code>String</code>
    - .passphrase <code>String</code>
    - .cleartext <code>String</code>

<a name="module_sesamed.pgp.decrypt"></a>

### sesamed.pgp.decrypt(options) ⇒ <code>Promise</code>
Decrypts data with private key and checks signature if public key is provided

**Kind**: static method of [<code>sesamed.pgp</code>](#module_sesamed.pgp)  
**Fulfil**: <code>string</code> cleartext  
**Reject**: <code>Error</code>  
**Params**

- options <code>Object</code>
    - .privateKey <code>String</code>
    - .passphrase <code>String</code>
    - [.publicKey] <code>String</code>
    - .ciphertext <code>String</code>

    <a name="module_sesamed.aes.generateKey"></a>

### sesamed.aes.generateKey() ⇒ <code>Promise</code>
Returns a base64 encoded AES key

**Kind**: static method of [<code>sesamed.aes</code>](#module_sesamed.aes)  
**Fulfil**: <code>string</code> key - a base64 encoded AES key  
**Reject**: <code>Error</code> - this should not happen  
<a name="module_sesamed.aes.importKey"></a>

### sesamed.aes.importKey(keydata) ⇒ <code>Promise</code>
imports a base64 encoded key into a CryptoKey

**Kind**: static method of [<code>sesamed.aes</code>](#module_sesamed.aes)  
**Fulfil**: <code>CryptoKey</code>  
**Reject**: <code>Error</code>  
**Params**

- keydata <code>string</code> - the base64 encoded AES key

<a name="module_sesamed.aes.encrypt"></a>

### sesamed.aes.encrypt(key, cleartext) ⇒ <code>Promise</code>
AES-encrypts cleartext to cyphertext with the given key

**Kind**: static method of [<code>sesamed.aes</code>](#module_sesamed.aes)  
**Fulfil**: <code>string</code> ciphertext - the base64 encoded ciphertext  
**Reject**: <code>Error</code>  
**Params**

- key <code>String</code>
- cleartext <code>String</code>

<a name="module_sesamed.aes.decrypt"></a>

### sesamed.aes.decrypt(key, cleartext) ⇒ <code>Promise</code>
AES-decryptfs cyphertext to cleartext with the given key

**Kind**: static method of [<code>sesamed.aes</code>](#module_sesamed.aes)  
**Fulfil**: <code>String</code> ciphertext - the base64 encoded ciphertext  
**Reject**: <code>Error</code>  
**Params**

- key <code>String</code>
- cleartext <code>String</code>

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