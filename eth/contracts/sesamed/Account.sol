pragma solidity >=0.4.22 <0.6.0;

contract Account {

    struct AdressStruct {
        address owner;
        bool    exists;
    }

    mapping(address => bool) existsAddress;
    mapping(bytes32 => AdressStruct) existsName;

    event newAccountEvent (
        bytes32 indexed nameHash,
        string fileHash,
        uint8 repo
    );


    constructor () public {}

    function register(string memory _name, string memory _fileHash, uint8 _repo) public returns (bool success) {
        bytes32 nameHash = keccak256(bytes(_name));
        AdressStruct memory addressStruct;

        require(!existsAddress[msg.sender], "existsAddress");
        require(!existsName[nameHash].exists, "existsName");

        existsAddress[msg.sender] = true;

        addressStruct.owner = msg.sender;
        addressStruct.exists = true;

        existsName[nameHash] = addressStruct;

        emit newAccountEvent(
            nameHash,
            _fileHash,
            _repo
        );

        return true;
    }

    function existsAccount(address _owner, bytes32 _nameHash) public view returns (bool) {
        require(existsName[_nameHash].owner == _owner, "notExistsAccount");

        return true;
    }
}

