/**
 * DISCLAIMER: Under certain conditions, the function distributeFunds
 * may fail due to block gas limits.
 * If the total number of investors that ever held tokens is greater than ~15,000 then
 * the function may fail. If this happens investors can pull their deposits, or the Issuer
 * can use distributeFundsToAddresses to provide an explict address list in batches
 */
pragma solidity 0.5.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "./FDTCheckpointStorage.sol";
import "./CheckpointedToken/CheckpointedToken.sol";
import "./IFundsDistributionToken.sol";


/**
 * @title Checkpoint module for issuing ether deposits
 * @dev abstract contract
 */
contract FDTCheckpoint is FDTCheckpointStorage, CheckpointedToken, Ownable, IFundsDistributionToken {
	using SafeMath for uint256;


	function _validDepositIndex(uint256 _depositId) internal view {
		require(_depositId < deposits.length, "Invalid deposit");
	}

	/**
	 * @notice Function used to intialize the contract variables
	 * @param _wallet Ethereum account address to receive reclaimed deposits
	 */
	constructor (address payable _wallet) public {
		wallet = _wallet;
	}

	/**
	 * @notice Issuer can push deposits to provided addresses
	 * @param _depositId Deposit to push
	 * @param _payees Addresses to which to push the deposit
	 */
	function distributeFundsToAddresses(
		uint256 _depositId,
		address payable[] memory _payees
	)
		public
	{
		_validDepositIndex(_depositId);
		Deposit storage deposit = deposits[_depositId];
		for (uint256 i = 0; i < _payees.length; i++) {
			if ((!deposit.claimed[_payees[i]])) {
				_transferFunds(_payees[i], deposit, _depositId);
			}
		}
	}

	/**
	 * @notice Issuer can push deposits using the investor list from the security token
	 * @param _depositId Deposit to push
	 * @param _start Index in investor list at which to start pushing deposits
	 * @param _end Index in investor list at which to stop pushing deposits
	 */
	function distributeFunds(
		uint256 _depositId,
		uint256 _start,
		uint256 _end
	)
		public
	{
		//NB If possible, please use distributeFundsToAddresses as it is cheaper than this function
		_validDepositIndex(_depositId);
		Deposit storage deposit = deposits[_depositId];
		uint256 checkpointId = deposit.checkpointId;
		address[] memory investors = getInvestorsSubsetAt(checkpointId, _start, _end);
		// The investors list maybe smaller than _end - _start becuase it only contains addresses that had a positive balance
		// the _start and _end used here are for the address list stored in the dataStore
		for (uint256 i = 0; i < investors.length; i++) {
			address payable payee = address(uint160(investors[i]));
			if (!deposit.claimed[payee]) {
				_transferFunds(payee, deposit, _depositId);
			}
		}
	}

	/**
	 * @notice Investors can pull their own deposits
	 * @param _depositId Deposit to pull
	 */
	function withdrawFunds(uint256 _depositId) public {
		_validDepositIndex(_depositId);
		Deposit storage deposit = deposits[_depositId];
		require(!deposit.claimed[msg.sender], "Deposit already claimed");
		_transferFunds(msg.sender, deposit, _depositId);
	}

	/**
	 * @notice Internal function for paying deposits
	 * @param _payee Address of investor
	 * @param _dividend Storage with previously issued deposits
	 * @param _depositId Deposit to pay
	 */
	function _transferFunds(address payable _payee, Deposit storage _dividend, uint256 _depositId) internal;

	/**
	 * @notice Calculate amount of deposits claimable
	 * @param _payee Affected investor address
	 * @param _depositId Deposit to calculate
	 * @return claim
	 */
	function withdrawableFundsOf(address _payee, uint256 _depositId) public view returns(uint256) {
		require(_depositId < deposits.length, "Invalid deposit");
		Deposit storage deposit = deposits[_depositId];
		if (deposit.claimed[_payee]) {
			return (0);
		}
		uint256 balance = balanceOfAt(_payee, deposit.checkpointId);
		uint256 claim = balance.mul(deposit.amount).div(deposit.totalSupply);
		return (claim);
	}

	/**
	 * @notice Get static deposit data
	 * @return uint256[] timestamp of deposits creation
	 * @return uint256[] amount of deposits
	 * @return uint256[] claimed amount of deposits
	 */
	function getDepositsData() 
		external
		view
		returns (uint256[] memory createds, uint256[] memory amounts, uint256[] memory claimedAmounts)
	{
		createds = new uint256[](deposits.length);
		amounts = new uint256[](deposits.length);
		claimedAmounts = new uint256[](deposits.length);
		for (uint256 i = 0; i < deposits.length; i++) {
			(createds[i], amounts[i], claimedAmounts[i]) = getDepositData(i);
		}
	}

	/**
	 * @notice Get static deposit data
	 * @return uint256 timestamp of deposit creation
	 * @return uint256 amount of deposit
	 * @return uint256 claimed amount of deposit
	 */
	function getDepositData(uint256 _depositId) 
		public
		view 
		returns (uint256 created, uint256 amount, uint256 claimedAmount)
	{
		created = deposits[_depositId].created;
		amount = deposits[_depositId].amount;
		claimedAmount = deposits[_depositId].claimedAmount;
	}

	/**
	 * @notice Checks whether an address has claimed a deposit
	 * @param _depositId Deposit to withdraw from
	 * @return bool whether the address has claimed
	 */
	function isClaimed(address _investor, uint256 _depositId) external view returns (bool) {
		require(_depositId < deposits.length, "Invalid deposit");
		return deposits[_depositId].claimed[_investor];
	}
}
