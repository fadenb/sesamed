pragma solidity 0.5.0;

contract ChannelContract {
    function existsChannel(bytes32 _channelId) public view returns (bool);
    function getChannelOwner(bytes32 _channelId) public view returns (address);
}

contract Document {
    ChannelContract channelContract;

    constructor (address _channelContractAddress) public {
        channelContract = ChannelContract(_channelContractAddress);
    }

    event newDocumentEvent (
        bytes32 indexed channelId,
        bytes32 fileHash
    );

    function send(bytes32 _channelId, bytes32 _fileHash) public returns (bool success) {
        require(channelContract.getChannelOwner(_channelId) == msg.sender, "notChannelOwner");

        emit newDocumentEvent (
            _channelId,
            _fileHash
        );

        return true;
    }
}

