pragma solidity 0.5.8;
pragma experimental ABIEncoderV2;


contract IFundsDistributionToken{

  /**
   * @dev Returns the total amount of funds a given address is able to withdraw currently for a given deposit.
   * @param owner Address of FundsDistributionToken holder
   * @param depositId id of the deposit
   * @return A uint256 representing the available funds for a given account
   */
  function withdrawableFundsOf(address owner, uint256 depositId) public view returns (uint256);

  /**
   * @dev Withdraws available funds of a deposit for a FundsDistributionToken holder.
   * @param depositId id of the deposit
   */
  function withdrawFunds(uint256 depositId) public;

  // /**
  //  * @dev This event emits when new funds are distributed
  //  * @param by the address of the sender who distributed funds
  //  * @param depositId id of the deposit
  //  * @param fundsDistributed the amount of funds received for distribution
  //  */
  // event FundsDistributed(address indexed by, uint256 depositId, uint256 fundsDistributed);

  /**
   * @dev This event emits when distributed funds are withdrawn by a token holder.
   * @param by the address of the receiver of funds
   * @param depositId id of the deposit that was withdrawn
   * @param fundsWithdrawn the amount of funds that were withdrawn
   */
  event FundsWithdrawn(address indexed by, uint256 depositId, uint256 fundsWithdrawn);
}