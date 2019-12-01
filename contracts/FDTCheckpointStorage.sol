pragma solidity 0.5.8;

/**
 * @title Holds the storage variable for the DividendCheckpoint modules (i.e ERC20, Ether)
 * @dev abstract contract
 */
contract FDTCheckpointStorage {

  // Address to which reclaimed deposits
  address payable public wallet;

  struct Deposit {
    // Id of Security Token checkpoint
    uint256 checkpointId;
    // Time at which the deposit was created
    uint256 created;
    // Deposit amount in WEI 
    uint256 amount;
    // Amount of deposit claimed so far
    uint256 claimedAmount;
    // Total supply at the associated checkpoint (avoids recalculating this)
    uint256 totalSupply;
     // List of addresses which have claimed deposit
    mapping (address => bool) claimed;
  }

  // List of all deposits
  Deposit[] public deposits;
}
