pragma solidity 0.5.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./SecurityTokenStorage.sol";


contract SecurityToken is SecurityTokenStorage, ERC20Mintable, ReentrancyGuard {

  /**
   * @notice returns an array of investors with non zero balance at a given checkpoint
   * @param _checkpointId Checkpoint id at which investor list is to be populated
   * @return list of investors
   */
  function getInvestorsAt(uint256 _checkpointId) public view returns(address[] memory) {
    uint256 count;
    uint256 i;
    address[] memory activeInvestors = investors;
    for (i = 0; i < activeInvestors.length; i++) {
      if (balanceOfAt(activeInvestors[i], _checkpointId) > 0) {
        count++;
      } else {
        activeInvestors[i] = address(0);
      }
    }
    address[] memory holders = new address[](count);
    count = 0;
    for (i = 0; i < activeInvestors.length; i++) {
      if (activeInvestors[i] != address(0)) {
        holders[count] = activeInvestors[i];
        count++;
      }
    }
    return holders;
  }

  function getInvestorsSubsetAt(
    uint256 _checkpointId,
    uint256 _start,
    uint256 _end
  )
    public
    view
    returns(address[] memory)
  {
    uint256 size = investors.length;
    if (_end >= size) {
      size = size - _start;
    } else {
      size = _end - _start + 1;
    }
    address[] memory investorSubset = new address[](size);
    for(uint256 j; j < size; j++)
      investorSubset[j] = investors[j + _start];
    
    uint256 count;
    uint256 i;
    for (i = 0; i < investorSubset.length; i++) {
      if (balanceOfAt(investorSubset[i], _checkpointId) > 0) {
        count++;
      } else {
        investorSubset[i] = address(0);
      }
    }
    address[] memory holders = new address[](count);
    count = 0;
    for (i = 0; i < investorSubset.length; i++) {
      if (investorSubset[i] != address(0)) {
        holders[count] = investorSubset[i];
        count++;
      }
    }
    return holders;
  }

  function getNumberOfInvestors() public view returns(uint256) {
    return investors.length;
  }

  /**
   * @notice Queries balances as of a defined checkpoint
   * @param _investor Investor to query balance for
   * @param _checkpointId Checkpoint ID to query as of
   */
  function balanceOfAt(address _investor, uint256 _checkpointId) public view returns(uint256) {
    require(_checkpointId <= currentCheckpointId, "Invalid checkpoint");
    return getValueAt(checkpointBalances[_investor], _checkpointId, balanceOf(_investor));
  }

  /**
   * @notice Queries totalSupply as of a defined checkpoint
   * @param _checkpointId Checkpoint ID to query
   * @return uint256
   */
  function totalSupplyAt(uint256 _checkpointId) public view returns(uint256) {
    require(_checkpointId <= currentCheckpointId, "Invalid checkpoint");
    return checkpointTotalSupply[_checkpointId];
  }

  function createSecurityTokenCheckpoint() public returns(uint256) {
    createCheckpoint();

    checkpointTotalSupply[currentCheckpointId] = totalSupply();
    
    return currentCheckpointId;
  }

  // /**
	//  * @notice Retrieves list of investors, their balances
	//  * @param _checkpointId Checkpoint Id to query for
	//  * @return address[] list of investors
	//  * @return uint256[] investor balances
	//  */
	// function getSecurityTokenCheckpointData(
  //   uint256 _checkpointId
  // )
  //   external
  //   view 
  //   returns (address[] memory investors, uint256[] memory balances) 
  // {
	// 	require(_checkpointId <= currentCheckpointId, "Invalid checkpoint");
	// 	investors = getInvestorsAt(_checkpointId);
	// 	balances = new uint256[](investors.length);
	// 	for (uint256 i; i < investors.length; i++) {
	// 		balances[i] = balanceOfAt(investors[i], _checkpointId);
	// 	}
	// }

  function _isExistingInvestor(address _investor) internal view returns(bool) {
    return investorExists[_investor];
  }

  function _adjustInvestorCount(address _from, address _to, uint256 _value) internal {
    if ((_value == 0) || (_from == _to)) {
      return;
    }
    // Check whether receiver is a new token holder
    if ((balanceOf(_to) == 0) && (_to != address(0))) {
      holderCount = holderCount.add(1);
      if (!_isExistingInvestor(_to)) {
        investors.push(_to);
        investorExists[_to] = true;
      }
    }
    // Check whether sender is moving all of their tokens
    if (_value == balanceOf(_from)) {
      holderCount = holderCount.sub(1);
    }
  }

  /**
   * @notice Internal - adjusts token holder balance at checkpoint before a token transfer
   * @param _investor address of the token holder affected
   */
  function _adjustBalanceCheckpoints(address _investor) internal {
    //No checkpoints set yet
    if (currentCheckpointId == 0) {
      return;
    }
    //No new checkpoints since last update
    if (
      (checkpointBalances[_investor].length > 0) 
      && (checkpointBalances[_investor][checkpointBalances[_investor].length - 1].checkpointId == currentCheckpointId)
    ) {
      return;
    }
    //New checkpoint, so record balance
    checkpointBalances[_investor].push(Checkpoint({checkpointId: currentCheckpointId, value: balanceOf(_investor)}));
  }

  /**
   * @notice Updates internal variables when performing a transfer
   * @param _from sender of transfer
   * @param _to receiver of transfer
   * @param _value value of transfer
   * @return bool success
   */
  function _updateTransfer(address _from, address _to, uint256 _value) internal nonReentrant returns(bool verified) {
    // NB - the ordering in this function implies the following:
    //  - investor counts are updated before transfer managers are called - i.e. transfer managers will see
    //investor counts including the current transfer.
    //  - checkpoints are updated after the transfer managers are called. This allows TMs to create
    //checkpoints as though they have been created before the current transactions,
    //  - to avoid the situation where a transfer manager transfers tokens, and this function is called recursively,
    //the function is marked as nonReentrant. This means that no TM can transfer (or mint / burn) tokens in the execute transfer function.
    _adjustInvestorCount(_from, _to, _value);
    _adjustBalanceCheckpoints(_from);
    _adjustBalanceCheckpoints(_to);
  }

  function _mint(
    address _tokenHolder,
    uint256 _value
  )
    internal
  {
    _updateTransfer(address(0), _tokenHolder, _value);
    super._mint(_tokenHolder, _value);
  }

  function _transfer(
    address _to,
    uint256 _value
  ) 
    internal
  {
    _updateTransfer(msg.sender, _to, _value);
    super._transfer(msg.sender, _to, _value);
  }

  function _transferFrom(
    address _from,
    address _to,
    uint256 _value
  ) 
    internal
  { 
    _updateTransfer(_from, _to, _value);
    super._transfer(_from, _to, _value);
  }

}