// local modules
var pgp = require("../src/pgp");

// test data
var testData = require("./testdata.js").testData;


describe("pgp", function () {

    describe("generateKeys", function () {

        let err = new Error("pgp.generateKeys: missing name or passphrase");

        it("should throw error if name is missing", async function () {
            return expect(() => pgp.generateKeys()).toThrow(err);
        });

        it("should throw error if passphrase is missing", async function () {
            return expect(() => pgp.generateKeys("alice")).toThrow(err);
        });

        it("should throw error if name is no string", async function () {
            return expect(() => pgp.generateKeys(1, "passphrase")).toThrow(err);
        });

        it("should throw error if passphrase is no string", async function () {
            return expect(() => pgp.generateKeys("alice", {})).toThrow(err);
        });

        it("should call openpgp.generateKeys with correct params", async function () {
            let keys = await pgp.generateKeys("alice", "passphrase");

            expect(keys.publicKey.substr(0,36)).toEqual("-----BEGIN PGP PUBLIC KEY BLOCK-----");
            expect(keys.privateKey.substr(0,37)).toEqual("-----BEGIN PGP PRIVATE KEY BLOCK-----");
        });

    });

    describe("getPublicKeyFromPrivateKey", function () {

        it("should get public key from private key", async function() {
            let publicKey = await pgp.getPublicKeyFromPrivateKey(testData[0].privateKey, testData[0].passphrase);

            expect(publicKey).toEqual(testData[0].publicKey);
        });

    });

    describe("encrypt", function () {

        it("should return an encrypted string if clearttext and publicKey are provided", async function () {
            let ciphertext = await pgp.encrypt({
                cleartext: testData[1].cleartext,
                publicKey: testData[0].publicKey
            });
            expect(ciphertext.substr(0,20)).toEqual("wV4Dbnp83JALN2ASAQdA");
        });

        it("should return an signed and encrypted string if privateKey is provided", async function () {
            let ciphertext = await pgp.encrypt({
                cleartext: testData[1].cleartext,
                publicKey: testData[0].publicKey,
                privateKey: testData[1].privateKey,
                passphrase: testData[1].passphrase
            });
            expect(ciphertext.substr(0,20)).toEqual("wV4Dbnp83JALN2ASAQdA");
        });

        it("should work with multiple publicKeys", async function () {
            let ciphertext = await pgp.encrypt({
                cleartext: testData[2].cleartext,
                publicKey: [testData[0].publicKey, testData[1].publicKey],
                privateKey: testData[2].privateKey,
                passphrase: testData[2].passphrase
            });
            expect(ciphertext.substr(0,20)).toEqual("wV4Dbnp83JALN2ASAQdA");
        });

    });

    describe("decrypt", function () {

        it("should return cleartext if privateKey, passphrase and ciphertext are provided", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey
            });
            expect(cleartext).toEqual(testData[0].cleartext);
        });

        it("should get rejected if wrong privateKey is provided", async function (done) {
            pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                passphrase: testData[1].passphrase,
                privateKey: testData[1].privateKey
            }).then(() => {
                done(new Error("Promise should not be resolved!"));
            }).catch((err) => {
                expect(err).toEqual(new Error("Error decrypting message: Session key decryption failed."));
                done();
            });
        });

        it("should get rejected if wrong passphrase is provided", async function (done) {
            pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                passphrase: "wrong passphrase",
                privateKey: testData[0].privateKey
            }).then(() => {
                done(new Error("Promise should not be resolved!"));
            }).catch((err) => {
                expect(err).toEqual(new Error("Incorrect key passphrase"));
                done();
            });

        });

        it("should get rejected if no passphrase is provided", async function (done) {
            pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                privateKey: testData[0].privateKey
            }).then(() => {
                done(new Error("Promise should not be resolved!"));
            }).catch((err) => {
                expect(err).toEqual(new Error("Incorrect key passphrase"));
                done();
            });
        });

        it("should return cleartext and check signature if correct publicKey is provided", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertextSignedWith1,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey,
                publicKey: testData[1].privateKey
            });
            expect(cleartext).toEqual(testData[0].cleartext);
        });

        it("should check signature and throw Error if wrong publicKey is provided", async function (done) {
            pgp.decrypt({
                ciphertext: testData[0].ciphertextSignedWith1,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey,
                publicKey: testData[0].privateKey
            }).then(() => {
                done(new Error("Promise should not be resolved!"));
            }).catch((err) => {
                expect(err).toEqual(new Error("Signature not verified"));
                done();
            });
        });

        it("should work with first of multiple receiver", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertextFor0and1signedWith2,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey,
                publicKey: testData[2].privateKey
            });
            expect(cleartext).toEqual(testData[2].cleartext);
        });

        it("should work with second of multiple receiver", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertextFor0and1signedWith2,
                passphrase: testData[1].passphrase,
                privateKey: testData[1].privateKey,
                publicKey: testData[2].privateKey
            });
            expect(cleartext).toEqual(testData[2].cleartext);
        });

        it("should not work with third of multiple receiver", async function (done) {
            pgp.decrypt({
                ciphertext: testData[0].ciphertextFor0and1signedWith2,
                passphrase: testData[2].passphrase,
                privateKey: testData[2].privateKey,
                publicKey: testData[2].privateKey
            }).then(() => {
                done(new Error("Promise should not be resolved!"));
            }).catch((err) => {
                expect(err).toEqual(new Error("Error decrypting message: Session key decryption failed."));
                done();
            });
        });

    });
});

