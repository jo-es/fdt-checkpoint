/**
 * DISCLAIMER: Under certain conditions, the function pushDividendPayment
 * may fail due to block gas limits.
 * If the total number of investors that ever held tokens is greater than ~15,000 then
 * the function may fail. If this happens investors can pull their dividends, or the Issuer
 * can use pushDividendPaymentToAddresses to provide an explict address list in batches
 */
pragma solidity 0.5.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "./DividendCheckpointStorage.sol";
import "./SecurityToken/SecurityToken.sol";


/**
 * @title Checkpoint module for issuing ether dividends
 * @dev abstract contract
 */
contract DividendCheckpoint is DividendCheckpointStorage, SecurityToken, Ownable {
	using SafeMath for uint256;


	function _validDividendIndex(uint256 _dividendIndex) internal view {
		require(_dividendIndex < dividends.length, "Invalid dividend");
	}

	/**
	 * @notice Function used to intialize the contract variables
	 * @param _wallet Ethereum account address to receive reclaimed dividends
	 */
	constructor (address payable _wallet) public {
		wallet = _wallet;
	}

	/**
	 * @notice Issuer can push dividends to provided addresses
	 * @param _dividendIndex Dividend to push
	 * @param _payees Addresses to which to push the dividend
	 */
	function pushDividendPaymentToAddresses(
		uint256 _dividendIndex,
		address payable[] memory _payees
	)
		public
	{
		_validDividendIndex(_dividendIndex);
		Dividend storage dividend = dividends[_dividendIndex];
		for (uint256 i = 0; i < _payees.length; i++) {
			if ((!dividend.claimed[_payees[i]])) {
				_payDividend(_payees[i], dividend, _dividendIndex);
			}
		}
	}

	/**
	 * @notice Issuer can push dividends using the investor list from the security token
	 * @param _dividendIndex Dividend to push
	 * @param _start Index in investor list at which to start pushing dividends
	 * @param _end Index in investor list at which to stop pushing dividends
	 */
	function pushDividendPayment(
		uint256 _dividendIndex,
		uint256 _start,
		uint256 _end
	)
		public
	{
		//NB If possible, please use pushDividendPaymentToAddresses as it is cheaper than this function
		_validDividendIndex(_dividendIndex);
		Dividend storage dividend = dividends[_dividendIndex];
		uint256 checkpointId = dividend.checkpointId;
		address[] memory investors = getInvestorsSubsetAt(checkpointId, _start, _end);
		// The investors list maybe smaller than _end - _start becuase it only contains addresses that had a positive balance
		// the _start and _end used here are for the address list stored in the dataStore
		for (uint256 i = 0; i < investors.length; i++) {
			address payable payee = address(uint160(investors[i]));
			if (!dividend.claimed[payee]) {
				_payDividend(payee, dividend, _dividendIndex);
			}
		}
	}

	/**
	 * @notice Investors can pull their own dividends
	 * @param _dividendIndex Dividend to pull
	 */
	function pullDividendPayment(uint256 _dividendIndex) public {
		_validDividendIndex(_dividendIndex);
		Dividend storage dividend = dividends[_dividendIndex];
		require(!dividend.claimed[msg.sender], "Dividend already claimed");
		_payDividend(msg.sender, dividend, _dividendIndex);
	}

	/**
	 * @notice Internal function for paying dividends
	 * @param _payee Address of investor
	 * @param _dividend Storage with previously issued dividends
	 * @param _dividendIndex Dividend to pay
	 */
	function _payDividend(address payable _payee, Dividend storage _dividend, uint256 _dividendIndex) internal;

	/**
	 * @notice Calculate amount of dividends claimable
	 * @param _dividendIndex Dividend to calculate
	 * @param _payee Affected investor address
	 * @return claim
	 */
	function calculateDividend(uint256 _dividendIndex, address _payee) public view returns(uint256) {
		require(_dividendIndex < dividends.length, "Invalid dividend");
		Dividend storage dividend = dividends[_dividendIndex];
		if (dividend.claimed[_payee]) {
			return (0);
		}
		uint256 balance = balanceOfAt(_payee, dividend.checkpointId);
		uint256 claim = balance.mul(dividend.amount).div(dividend.totalSupply);
		return (claim);
	}

	/**
	 * @notice Get the index according to the checkpoint id
	 * @param _checkpointId Checkpoint id to query
	 * @return uint256[]
	 */
	function getDividendIndex(uint256 _checkpointId) public view returns(uint256[] memory) {
		uint256 counter = 0;
		for (uint256 i = 0; i < dividends.length; i++) {
			if (dividends[i].checkpointId == _checkpointId) {
				counter++;
			}
		}

		uint256[] memory index = new uint256[](counter);
		counter = 0;
		for (uint256 j = 0; j < dividends.length; j++) {
			if (dividends[j].checkpointId == _checkpointId) {
				index[counter] = j;
				counter++;
			}
		}
		return index;
	}

	/**
	 * @notice Get static dividend data
	 * @return uint256[] timestamp of dividends creation
	 * @return uint256[] amount of dividends
	 * @return uint256[] claimed amount of dividends
	 * @return bytes32[] name of dividends
	 */
	function getDividendsData() external view returns (
		uint256[] memory createds,
		uint256[] memory amounts,
		uint256[] memory claimedAmounts,
		bytes32[] memory names)
	{
		createds = new uint256[](dividends.length);
		amounts = new uint256[](dividends.length);
		claimedAmounts = new uint256[](dividends.length);
		names = new bytes32[](dividends.length);
		for (uint256 i = 0; i < dividends.length; i++) {
			(createds[i], amounts[i], claimedAmounts[i], names[i]) = getDividendData(i);
		}
	}

	/**
	 * @notice Get static dividend data
	 * @return uint256 timestamp of dividend creation
	 * @return uint256 amount of dividend
	 * @return uint256 claimed amount of dividend
	 * @return bytes32 name of dividend
	 */
	function getDividendData(uint256 _dividendIndex) public view returns (
		uint256 created,
		uint256 amount,
		uint256 claimedAmount,
		bytes32 name)
	{
		created = dividends[_dividendIndex].created;
		amount = dividends[_dividendIndex].amount;
		claimedAmount = dividends[_dividendIndex].claimedAmount;
		name = dividends[_dividendIndex].name;
	}

	/**
	 * @notice Retrieves list of investors, their claim status and whether they are excluded
	 * @param _dividendIndex Dividend to withdraw from
	 * @return address[] list of investors
	 * @return bool[] whether investor has claimed
	 * @return uint256[] amount of claim (estimate if not claimeed)
	 * @return uint256[] investor balance
	 */
	function getDividendProgress(uint256 _dividendIndex) external view returns (
		address[] memory investors,
		bool[] memory resultClaimed,
		uint256[] memory resultAmount,
		uint256[] memory resultBalance)
	{
		require(_dividendIndex < dividends.length, "Invalid dividend");
		//Get list of Investors
		Dividend storage dividend = dividends[_dividendIndex];
		uint256 checkpointId = dividend.checkpointId;
		investors = getInvestorsAt(checkpointId);
		resultClaimed = new bool[](investors.length);
		resultAmount = new uint256[](investors.length);
		resultBalance = new uint256[](investors.length);
		for (uint256 i; i < investors.length; i++) {
			resultClaimed[i] = dividend.claimed[investors[i]];
			resultBalance[i] = balanceOfAt(investors[i], dividend.checkpointId);
			if (resultClaimed[i]) {
				resultAmount[i] = resultBalance[i].mul(dividend.amount).div(dividend.totalSupply);
			} else {
				resultAmount[i] = calculateDividend(_dividendIndex, investors[i]);
			}
		}
	}

	/**
	 * @notice Checks whether an address has claimed a dividend
	 * @param _dividendIndex Dividend to withdraw from
	 * @return bool whether the address has claimed
	 */
	function isClaimed(address _investor, uint256 _dividendIndex) external view returns (bool) {
		require(_dividendIndex < dividends.length, "Invalid dividend");
		return dividends[_dividendIndex].claimed[_investor];
	}
}
