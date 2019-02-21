pragma solidity >=0.4.22 <0.6.0;

contract Account {
    mapping(address => bool) existsAddress;
    mapping(bytes32 => bool) existsName;

    event newAccountEvent (
        bytes32 indexed nameHash,
        string fileHash,
        uint8 repo
    );

    constructor () public {}

    function register(string memory _name, string memory _fileHash, uint8 _repo) public returns (bool success) {
        bytes32 nameHash = keccak256(bytes(_name));

        require(!existsAddress[msg.sender], "existsAddress");
        require(!existsName[nameHash], "existsName");

        existsAddress[msg.sender] = true;
        existsName[nameHash] = true;

        emit newAccountEvent(
            nameHash,
            _fileHash,
            _repo
        );

        return true;
    }

    function existsAccount(address _owner) public view returns (bool) {
        require(existsAddress[_owner], "notExistsAddress");

        return true;
    }
}

