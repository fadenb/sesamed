pragma solidity >=0.4.22 <0.6.0;

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
        string fileHash,
        uint8 repo
    );

    function sendDocument(bytes32 _channelId, string memory _fileHash, uint8 _repo) public returns (bool sucess) {
        require(channelContract.getChannelOwner(_channelId) == msg.sender, "notChannelOwner");

        emit newDocumentEvent (
            _channelId,
            _fileHash,
            _repo
        );

        return true;
    }
}

