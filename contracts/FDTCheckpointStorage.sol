pragma solidity 0.5.8;

/**
 * @title Holds the storage variable for the FDTCheckpoint (i.e ERC20, Ether)
 * @dev abstract contract
 */
contract FDTCheckpointStorage {

  struct Deposit {
    // Id of CheckpointedToken checkpoint
    uint256 checkpointId;
    // Time at which the deposit was created
    uint256 created;
    // Deposit amount in WEI 
    uint256 amount;
    // Amount of funds claimed so far
    uint256 claimedAmount;
    // Total supply at the associated checkpoint (avoids recalculating this)
    uint256 totalSupply;
     // List of addresses which have withdrawn their share of funds of the deposit
    mapping (address => bool) claimed;
  }

  // List of all deposits
  Deposit[] public deposits;
}
