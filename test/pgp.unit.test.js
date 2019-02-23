// test framework
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var expect = chai.expect;

// local modules
var pgp = require("../src/pgp");

// test data
var testData = require("./testdata.js").testData;


describe("pgp", function () {

    describe("generateKeys", function () {

        let err = "pgp.generateKeys: missing name or passphrase";

        it("should throw error if name is missing", async function () {
            return expect(() => pgp.generateKeys()).to.throw(err);
        });

        it("should throw error if passphrase is missing", async function () {
            return expect(() => pgp.generateKeys("alice")).to.throw(err);
        });

        it("should throw error if name is no string", async function () {
            return expect(() => pgp.generateKeys(1, "passphrase")).to.throw(err);
        });

        it("should throw error if passphrase is no string", async function () {
            return expect(() => pgp.generateKeys("alice", {})).to.throw(err);
        });

        it("should call openpgp.generateKeys with correct params", async function () {
            let keys = await pgp.generateKeys("alice", "passphrase");

            expect(keys.publicKey.substr(0,36)).to.equal("-----BEGIN PGP PUBLIC KEY BLOCK-----");
            expect(keys.privateKey.substr(0,37)).to.equal("-----BEGIN PGP PRIVATE KEY BLOCK-----");
        });

    });

    describe("getPublicKeyFromPrivateKey", function () {

        it("should get public key from private key", async function() {
            let publicKey = await pgp.getPublicKeyFromPrivateKey(testData[0].privateKey, testData[0].passphrase);

            expect(publicKey).to.equal(testData[0].publicKey);
        });

    });

    describe("encrypt", function () {

        it("should return an encrypted string if clearttext and publicKey are provided", async function () {
            let ciphertext = await pgp.encrypt({
                cleartext: testData[1].cleartext,
                publicKey: testData[0].publicKey
            });
            expect(ciphertext.substr(0,27)).to.equal("-----BEGIN PGP MESSAGE-----");
        });

        it("should return an signed and encrypted string if privateKey is provided", async function () {
            let ciphertext = await pgp.encrypt({
                cleartext: testData[1].cleartext,
                publicKey: testData[0].publicKey,
                privateKey: testData[1].privateKey,
                passphrase: testData[1].passphrase
            });
            expect(ciphertext.substr(0,27)).to.equal("-----BEGIN PGP MESSAGE-----");
        });

        it("should work with multiple publicKeys", async function () {
            let ciphertext = await pgp.encrypt({
                cleartext: testData[2].cleartext,
                publicKey: [testData[0].publicKey, testData[1].publicKey],
                privateKey: testData[2].privateKey,
                passphrase: testData[2].passphrase
            });
            expect(ciphertext.substr(0,27)).to.equal("-----BEGIN PGP MESSAGE-----");
        });

    });

    describe("decrypt", function () {

        it("should return cleartext if privateKey, passphrase and ciphertext are provided", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey
            });
            expect(cleartext).to.equal(testData[0].cleartext);
        });

        it("should get rejected if wrong privateKey is provided", async function () {
            let promise = pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                passphrase: testData[1].passphrase,
                privateKey: testData[1].privateKey
            });
            return expect(promise).to.be.rejectedWith("Error decrypting message: Session key decryption failed.");
        });

        it("should get rejected if wrong passphrase is provided", async function () {
            let promise = pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                passphrase: "wrong passphrase",
                privateKey: testData[0].privateKey
            });
            return expect(promise).to.be.rejectedWith("Incorrect key passphrase");

        });

        it("should get rejected if no passphrase is provided", async function () {
            let promise = pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                privateKey: testData[0].privateKey
            });
            return expect(promise).to.be.rejectedWith("Incorrect key passphrase");
        });

        it("should return cleartext and check signature if correct publicKey is provided", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertextSignedWith1,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey,
                publicKey: testData[1].privateKey
            });
            expect(cleartext).to.equal(testData[0].cleartext);
        });

        it("should check signature and throw Error if wrong publicKey is provided", async function () {
            let promise = pgp.decrypt({
                ciphertext: testData[0].ciphertextSignedWith1,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey,
                publicKey: testData[0].privateKey
            });
            return expect(promise).to.be.rejectedWith("Signature not verified");
        });

        it("should work with first of multiple receiver", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertextFor0and1signedWith2,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey,
                publicKey: testData[2].privateKey
            });
            expect(cleartext).to.equal(testData[2].cleartext);
        });

        it("should work with second of multiple receiver", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertextFor0and1signedWith2,
                passphrase: testData[1].passphrase,
                privateKey: testData[1].privateKey,
                publicKey: testData[2].privateKey
            });
            expect(cleartext).to.equal(testData[2].cleartext);
        });

        it("should not work with third of multiple receiver", async function () {
            let promise = pgp.decrypt({
                ciphertext: testData[0].ciphertextFor0and1signedWith2,
                passphrase: testData[2].passphrase,
                privateKey: testData[2].privateKey,
                publicKey: testData[2].privateKey
            });
            return expect(promise).to.be.rejectedWith("Error decrypting message: Session key decryption failed.");
        });

    });
});

