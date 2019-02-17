var chaiAsPromised = require("chai-as-promised");
var sinon = require("sinon");
var sinonChai = require("sinon-chai");
var ethers = require("ethers");
if (typeof window !== "undefined") {
    window.chaiAsPromised = chaiAsPromised;
    window.sinon = sinon;
    window.sinonChai = sinonChai;
    window.ethers = ethers;
}
