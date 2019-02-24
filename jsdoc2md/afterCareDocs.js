//Load the library and specify options
const replace = require("replace-in-file");
const options = {
    files: "README.md",
    from: [/sesamedDocument/g, /sesamedChannel/g, /sesamedPgpKeys/g, /sesamedWallet/g, /sesamedUserIds/g,
        /sesamedAccount/g, /sesamedMultihash/g, /sesamedIpfsGateway/g, /    <a name=/g],
    to: ["Document", "Channel", "PgpKeys", "Wallet", "UserIds", "Account", "MultiHash", "IpfsGateway", "<a name="]
};

(async () => {
    try {
        const changes = await replace(options);
        console.log("Modified files:", changes.join(", "));
    }
    catch (error) {
        console.error("Error occurred:", error);
    }    
})();
