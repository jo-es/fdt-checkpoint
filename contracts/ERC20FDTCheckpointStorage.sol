pragma solidity 0.5.8;

/**
 * @title It holds the storage variables related to ERC20FDTCheckpoint module
 */
contract ERC20FDTCheckpointStorage {
  // Mapping to token address for each deposit
  mapping(uint256 => address) public depositedTokens;
}
