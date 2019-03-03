pragma solidity 0.5.0;

contract AccountContract {
    function existsAccount(address _owner, bytes32 _nameHash) public view returns (bool);
}

contract Channel {
    AccountContract accountContract;

    constructor (address _accountContractAddress) public {
        accountContract = AccountContract(_accountContractAddress);
    }

    struct channelStruct {
        address owner;
        bool exists;
    }

    mapping(bytes32 => channelStruct) channel;


    event newChannelEvent (
        bytes32 indexed channelId,
        bytes32 nameHash,
        string ciphertext
    );

    function register(bytes32 _channelId, bytes32 _nameHash, string memory _ciphertext) public returns (bool) {
        require(!channel[_channelId].exists, "existsChannel");
        require(accountContract.existsAccount(msg.sender, _nameHash));

        channelStruct memory newChannel;
        newChannel.owner = msg.sender;
        newChannel.exists = true;
        channel[_channelId] = newChannel;

        emit newChannelEvent(
            _channelId,
            _nameHash,
            _ciphertext
        );

        return true;
    }

    function existsChannel(bytes32 _channelId) public view returns (bool) {
        return channel[_channelId].exists;
    }

    function getChannelOwner(bytes32 _channelId) public view returns (address) {
        return channel[_channelId].owner;
    }
}

