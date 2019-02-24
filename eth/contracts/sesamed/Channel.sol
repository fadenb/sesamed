pragma solidity >=0.4.22 <0.6.0;

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
        string ciphertext,
        string name
    );

    function register(bytes32 _channelId, string memory _ciphertext, string memory _name) public returns (bool) {
        bytes32 nameHash = keccak256(bytes(_name));

        require(accountContract.existsAccount(msg.sender, nameHash));
        require(!channel[_channelId].exists, "existsChannel");

        channelStruct memory newChannel;
        newChannel.owner = msg.sender;
        newChannel.exists = true;
        channel[_channelId] = newChannel;

        emit newChannelEvent(
            _channelId,
            _ciphertext,
            _name
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

