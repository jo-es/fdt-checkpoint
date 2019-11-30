pragma solidity 0.5.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./DividendCheckpoint.sol";
import "./ERC20DividendCheckpointStorage.sol";


/**
 * @title Checkpoint module for issuing ERC20 dividends
 */
contract ERC20DividendCheckpoint is ERC20DividendCheckpointStorage, DividendCheckpoint {
	using SafeMath for uint256;

	event ERC20DividendDeposited(
		address indexed _depositor,
		uint256 _checkpointId,
		address indexed _token,
		uint256 _amount,
		uint256 _totalSupply,
		uint256 _dividendIndex,
		bytes32 indexed _name
	);
	event ERC20DividendClaimed(address indexed _payee, uint256 indexed _dividendIndex, address indexed _token, uint256 _amount);


	constructor(address payable _wallet) DividendCheckpoint(_wallet) public {}

	/**
	 * @notice Creates a dividend and checkpoint for the dividend
	 * @param _token Address of ERC20 token in which dividend is to be denominated
	 * @param _amount Amount of specified token for dividend
	 * @param _name Name/Title for identification
	 */
	function createDividend(
		address _token,
		uint256 _amount,
		bytes32 _name
	)
		external
	{
		uint256 checkpointId = createSecurityTokenCheckpoint();
		createDividendWithCheckpoint(_token, _amount, checkpointId, _name);
	}

	/**
	 * @notice Creates a dividend with a provided checkpoint
	 * @param _token Address of ERC20 token in which dividend is to be denominated
	 * @param _amount Amount of specified token for dividend
	 * @param _checkpointId Checkpoint id from which to create dividends
	 * @param _name Name/Title for identification
	 */
	function createDividendWithCheckpoint(
		address _token,
		uint256 _amount,
		uint256 _checkpointId,
		bytes32 _name
	)
		public
	{
		/*solium-disable-next-line security/no-block-members*/
		require(_amount > 0, "No dividend sent");
		require(_token != address(0), "Invalid token");
		require(_checkpointId <= currentCheckpointId, "Invalid checkpoint");
		require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "insufficent allowance");
		require(_name != bytes32(0));
		uint256 dividendIndex = dividends.length;
		uint256 currentSupply = totalSupplyAt(_checkpointId);
		require(currentSupply > 0, "Invalid supply");
		dividends.push(
			Dividend(
				_checkpointId,
				now, /*solium-disable-line security/no-block-members*/
				_amount,
				0,
				0,
				_name
			)
		);

		dividends[dividendIndex].totalSupply = currentSupply;
		dividendTokens[dividendIndex] = _token;
		_emitERC20DividendDepositedEvent(_checkpointId, _token, _amount, currentSupply, dividendIndex, _name);
	}

	/**
	 * @notice Emits the ERC20DividendDeposited event.
	 * Seperated into a different function as a workaround for stack too deep error
	 */
	function _emitERC20DividendDepositedEvent(
		uint256 _checkpointId,
		address _token,
		uint256 _amount,
		uint256 currentSupply,
		uint256 dividendIndex,
		bytes32 _name
	)
		internal
	{
		/*solium-disable-next-line security/no-block-members*/
		emit ERC20DividendDeposited(
			msg.sender,
			_checkpointId,
			_token,
			_amount,
			currentSupply,
			dividendIndex,
			_name
		);
	}

	/**
	 * @notice Internal function for paying dividends
	 * @param _payee Address of investor
	 * @param _dividend Storage with previously issued dividends
	 * @param _dividendIndex Dividend to pay
	 */
	function _payDividend(address payable _payee, Dividend storage _dividend, uint256 _dividendIndex) internal {
		uint256 claim = calculateDividend(_dividendIndex, _payee);
		_dividend.claimed[_payee] = true;
		_dividend.claimedAmount = claim.add(_dividend.claimedAmount);
		if (claim > 0) {
			require(IERC20(dividendTokens[_dividendIndex]).transfer(_payee, claim), "transfer failed");
		}
		emit ERC20DividendClaimed(_payee, _dividendIndex, dividendTokens[_dividendIndex], claim);
	}
}
