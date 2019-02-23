let provider,
    privateKey,
    publicKey,
    name,
    accountContract,
    standard;

standard = {
    rpcUrl: "https://rpc.sesamed.de",
    ipfsGateway: {host: "116.203.60.88", port: 5001, protocol: "http"},
    network: "219",
    repo: 1 // 1 = ipfs
};

module.exports = {
    provider: provider,
    privateKey: privateKey,
    publicKey: publicKey,
    name: name,
    accountContract: accountContract,
    default: standard
};
