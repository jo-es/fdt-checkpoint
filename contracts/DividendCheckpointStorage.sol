pragma solidity 0.5.8;

/**
 * @title Holds the storage variable for the DividendCheckpoint modules (i.e ERC20, Ether)
 * @dev abstract contract
 */
contract DividendCheckpointStorage {

	// Address to which reclaimed dividends
	address payable public wallet;

	struct Dividend {
		// Id of Security Token checkpoint
		uint256 checkpointId;
		// Time at which the dividend was created
		uint256 created;
		// Dividend amount in WEI 
		uint256 amount;
		// Amount of dividend claimed so far
		uint256 claimedAmount;
		// Total supply at the associated checkpoint (avoids recalculating this)
		uint256 totalSupply;
		 // List of addresses which have claimed dividend
		mapping (address => bool) claimed;
		// Name/title - used for identification
		bytes32 name;
	}

	// List of all dividends
	Dividend[] public dividends;
}
