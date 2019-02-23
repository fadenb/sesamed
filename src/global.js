let provider,
    privateKey,
    publicKey,
    name,
    accountContract,
    standard;

standard = {
    rpcUrl: "https://rpc.sesamed.de",
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
