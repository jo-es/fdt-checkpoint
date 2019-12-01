pragma solidity 0.5.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./FDTCheckpoint.sol";
import "./ERC20FDTCheckpointStorage.sol";


/**
 * @title Checkpoint module for issuing ERC20 deposits
 */
contract ERC20FDTCheckpoint is ERC20FDTCheckpointStorage, FDTCheckpoint {
  using SafeMath for uint256;

  event FundsDeposited(address indexed _depositor, uint256 _depositId, uint256 _amount);
  event FundsWithdrawn(address indexed _by, uint256 indexed _depositId, uint256 _amount);


  constructor(address payable _wallet) FDTCheckpoint(_wallet) public {}

  /**
   * @notice Creates a deposit and checkpoint
   * @param _token Address of ERC20 token in which deposit is to be denominated
   * @param _amount Amount of specified token for deposit
   */
  function depositFunds(
    address _token,
    uint256 _amount
  )
    public
  {
    uint256 checkpointId = createTokenCheckpoint();
    /*solium-disable-next-line security/no-block-members*/
    require(_amount > 0, "No deposit sent");
    require(_token != address(0), "Invalid token");
    require(checkpointId <= currentCheckpointId, "Invalid checkpoint");
    require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "insufficent allowance");
    uint256 depositIndex = deposits.length;
    uint256 currentSupply = totalSupplyAt(checkpointId);
    require(currentSupply > 0, "Invalid supply");
    deposits.push(
      Deposit(
        checkpointId,
        now, /*solium-disable-line security/no-block-members*/
        _amount,
        0,
        0
      )
    );

    deposits[depositIndex].totalSupply = currentSupply;
    depositedTokens[depositIndex] = _token;

    emit FundsDeposited(msg.sender, depositIndex, _amount);
  }

  /**
   * @notice Internal function for paying deposits
   * @param _payee Address of investor
   * @param _dividend Storage with previously issued deposits
   * @param _depositId Deposit to pay
   */
  function _transferFunds(address payable _payee, Deposit storage _dividend, uint256 _depositId) internal {
    uint256 claim = withdrawableFundsOf(_payee, _depositId);
    _dividend.claimed[_payee] = true;
    _dividend.claimedAmount = claim.add(_dividend.claimedAmount);
    if (claim > 0) {
      require(IERC20(depositedTokens[_depositId]).transfer(_payee, claim), "transfer failed");
    }
    emit FundsWithdrawn(_payee, _depositId, claim);
  }
}
