pragma solidity 0.5.0;

contract Account {

    struct AccountStruct {
        address owner;
        bytes32 fileHash;
        bool    exists;
    }

    mapping(address => bool) existsAddress;
    mapping(bytes32 => AccountStruct) accounts;

    event newAccountEvent (
        bytes32 indexed nameHash,
        bytes32 fileHash
    );

    constructor () public {}

    function register(bytes32 _nameHash, bytes32 _fileHash) public returns (bool success) {
        AccountStruct memory accountStruct;

        // check if this address has already an account
        require(!existsAddress[msg.sender], "existsAddress");

        // check if the given name (=nameHash) is already taken
        require(!accounts[_nameHash].exists, "existsName");

        // set the address as taken
        existsAddress[msg.sender] = true;

        // set the account
        accountStruct.owner = msg.sender;
        accountStruct.fileHash = _fileHash;
        accountStruct.exists = true;
        accounts[_nameHash] = accountStruct;

        // emit the new account
        emit newAccountEvent(
            _nameHash,
            _fileHash
        );

        return true;
    }

    function existsAccount(address _owner, bytes32 _nameHash) public view returns (bool) {
        require(accounts[_nameHash].owner == _owner, "notExistsAccount");

        return true;
    }

    function getFileHash(bytes32 _nameHash) public view returns (bytes32) {
        require(accounts[_nameHash].exists, "notExistsAccount");

        return accounts[_nameHash].fileHash;
    }
}

