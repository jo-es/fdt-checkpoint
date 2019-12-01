const {
  latestTime,
  latestBlock,
  duration,
  createSnapshot,
  revertToSnapshot,
  increaseTime
} = require('./helpers/blockchain');
const { catchRevert } = require('./helpers/exceptions');

const SampleToken = artifacts.require('SampleToken');
const ERC20FDTCheckpoint = artifacts.require('ERC20FDTCheckpoint');

let BN = web3.utils.BN;


contract('ERC20FDTCheckpoint', async (accounts) => {
  // Accounts Variable declaration
  let account_polymath;
  let account_issuer;
  let token_owner;
  let wallet;
  let account_investor1;
  let account_investor2;
  let account_investor3;
  let account_investor4;
  let account_manager;
  let account_temp;

  let message = 'Transaction Should Fail!';

  let SampleTokenInstance;
  let ERC20FDTCheckpointInstance;

  const address_zero = '0x0000000000000000000000000000000000000000';

  before(async () => {
    currentTime = new BN(await latestTime());
    defaultAccount = accounts[0];
    account_issuer = accounts[1];

    token_owner = account_issuer;

    account_investor1 = accounts[6];
    account_investor2 = accounts[7];
    account_investor3 = accounts[8];
    account_investor4 = accounts[9];
    account_temp = accounts[2];
    account_manager = accounts[5];
    wallet = accounts[3];

    // deploy sample ERC20 token for distribution and mint 1000 SampleToken tokens for the token owner
    SampleTokenInstance = await SampleToken.new({ from: defaultAccount });
    SampleTokenInstance.mint(token_owner, new BN(web3.utils.toWei('1000', 'ether')), { from: defaultAccount });

    // deploy distributor contract
    ERC20FDTCheckpointInstance = await ERC20FDTCheckpoint.new(wallet, { from: token_owner });

    await SampleTokenInstance.approve(
      ERC20FDTCheckpointInstance.address,
      new BN(web3.utils.toWei('1000', 'ether')),
      { from: token_owner }
    );

  });

  describe('Check Deposit payouts', async () => {
    it('Buy some tokens for account_investor1 (1 ETH)', async () => {
      // Mint some tokens
      await ERC20FDTCheckpointInstance.mint(account_investor1, new BN(web3.utils.toWei('1', 'ether')), { from: token_owner });

      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_investor1)).toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
    });

    it('Buy some tokens for account_investor2 (2 ETH)', async () => {
      // Mint some tokens
      await ERC20FDTCheckpointInstance.mint(account_investor2, new BN(web3.utils.toWei('2', 'ether')), { from: token_owner });

      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_investor2)).toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
    });

    it('Should fail in creating the deposit - bad token', async () => {
      await catchRevert(
        ERC20FDTCheckpointInstance.depositFunds(address_zero, new BN(web3.utils.toWei('1.5', 'ether')), {
          from: token_owner
        })
      );
    });

    it('Should fail in creating the deposit - amount is 0', async () => {
      await catchRevert(
        ERC20FDTCheckpointInstance.depositFunds(SampleTokenInstance.address, new BN(0), { from: token_owner })
      );
    });

    it('Create new deposit of SampleToken tokens', async () => {
      let tx = await ERC20FDTCheckpointInstance.depositFunds(
        SampleTokenInstance.address,
        new BN(web3.utils.toWei('1.5', 'ether')),
        { from: token_owner }
      );
      assert.equal(tx.logs[0].args._checkpointId.toNumber(), 1, 'Deposit should be created at checkpoint 1');
      // assert.equal(tx.logs[0].args._name.toString(), dividendName, 'Deposit name incorrect in event');
      let data = await ERC20FDTCheckpointInstance.getDepositsData();

      assert.equal(data['amounts'][0].toString(), new BN(web3.utils.toWei('1.5', 'ether')).toString(), 'amount match');
      assert.equal(data['claimedAmounts'][0].toNumber(), 0, 'claimed match');
    });

    it('Investor 1 transfers his token balance to investor 2', async () => {
      await ERC20FDTCheckpointInstance.transfer(account_investor2, new BN(web3.utils.toWei('1', 'ether')), { from: account_investor1 });
      assert.equal(await ERC20FDTCheckpointInstance.balanceOf(account_investor1), 0);
      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_investor2)).toString(), new BN(web3.utils.toWei('3', 'ether')).toString());
    });

    it('Issuer pushes deposits iterating over account holders - deposits proportional to checkpoint - fails wrong index', async () => {
      await catchRevert(ERC20FDTCheckpointInstance.distributeFunds(2, new BN(0), 10, { from: token_owner }));
    });

    it('Issuer pushes deposits iterating over account holders - deposits proportional to checkpoint', async () => {
      let investor1Balance = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2Balance = new BN(await SampleTokenInstance.balanceOf(account_investor2));

      await ERC20FDTCheckpointInstance.distributeFunds(0, new BN(0), 10, { from: token_owner, gas: 5000000 });
    
      let investor1BalanceAfter = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter = new BN(await SampleTokenInstance.balanceOf(account_investor2));

      assert.equal(investor1BalanceAfter.sub(investor1Balance).toString(), new BN(web3.utils.toWei('0', 'ether')).toString());
      assert.equal(investor2BalanceAfter.sub(investor2Balance).toString(), new BN(web3.utils.toWei('1.5', 'ether')).toString());
      //Check fully claimed
      assert.equal((await ERC20FDTCheckpointInstance.deposits(0))['claimedAmount'].toString(), new BN(web3.utils.toWei('1.5', 'ether')).toString());
    });

    // it('Buy some tokens for account_temp (1 ETH)', async () => {
    //   // Mint some tokens
    //   await ERC20FDTCheckpointInstance.mint(account_temp, new BN(web3.utils.toWei('1', 'ether')), { from: token_owner });

    //   assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_temp)).toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
    // });

    it('Create new deposit', async () => {
      let tx = await ERC20FDTCheckpointInstance.depositFunds(
        SampleTokenInstance.address,
        new BN(web3.utils.toWei('1.5', 'ether')),
        { from: token_owner }
      );
      console.log('Gas used w/ no exclusions: ' + tx.receipt.gasUsed);
      assert.equal(tx.logs[0].args._checkpointId.toNumber(), 2, 'Deposit should be created at checkpoint 1');
    });

    it('Buy some tokens for account_investor3 (7 ETH)', async () => {
      // Mint some tokens
      await ERC20FDTCheckpointInstance.mint(account_investor3, new BN(web3.utils.toWei('7', 'ether')), { from: token_owner });

      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_investor3)).toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
    });

    it('Create another new deposit', async () => {
      let tx = await ERC20FDTCheckpointInstance.depositFunds(
        SampleTokenInstance.address,
        new BN(web3.utils.toWei('10', 'ether')),
        { from: token_owner }
      );
      console.log('Gas used w/ max exclusions - default: ' + tx.receipt.gasUsed);
      assert.equal(tx.logs[0].args._checkpointId.toNumber(), 3, 'Deposit should be created at checkpoint 3');
    });

    it('should investor 3 claims deposit - fail bad index', async () => {
      await catchRevert(ERC20FDTCheckpointInstance.withdrawFunds(5, { from: account_investor3, gasPrice: 0 }));
    });

    it('should investor 3 claims deposit', async () => {
      let investor1Balance = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2Balance = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3Balance = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      await ERC20FDTCheckpointInstance.withdrawFunds(2, { from: account_investor3, gasPrice: 0 });
      let investor1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      assert.equal(investor1BalanceAfter1.sub(investor1Balance).toNumber(), 0);
      assert.equal(investor2BalanceAfter1.sub(investor2Balance).toNumber(), 0);
      assert.equal(investor3BalanceAfter1.sub(investor3Balance).toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
      assert.equal(await ERC20FDTCheckpointInstance.isClaimed(account_investor3, 2), true);
      assert.equal(await ERC20FDTCheckpointInstance.isClaimed(account_investor2, 2), false);
    });

    it('should investor 3 claims deposit - fails already claimed', async () => {
      await catchRevert(ERC20FDTCheckpointInstance.withdrawFunds(2, { from: account_investor3, gasPrice: 0 }));
    });

    it('should issuer pushes remain', async () => {
      let investor1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let investorTempBalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_temp));
      await ERC20FDTCheckpointInstance.distributeFunds(2, new BN(0), 10, { from: token_owner });
      let investor1BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let investorTempBalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_temp));
      assert.equal(investor1BalanceAfter2.sub(investor1BalanceAfter1).toNumber(), 0);
      assert.equal(investor2BalanceAfter2.sub(investor2BalanceAfter1).toString(), new BN(web3.utils.toWei('3', 'ether')).toString());
      assert.equal(investor3BalanceAfter2.sub(investor3BalanceAfter1).toNumber(), 0);
      assert.equal(investorTempBalanceAfter2.sub(investorTempBalanceAfter1).toNumber(), 0);
      //Check fully claimed
      assert.equal((await ERC20FDTCheckpointInstance.deposits(2))['claimedAmount'].toString(), new BN(web3.utils.toWei('10', 'ether')).toString());
    });

    it('Investor 2 transfers 1 ETH of his token balance to investor 1', async () => {
      await ERC20FDTCheckpointInstance.transfer(account_investor1, new BN(web3.utils.toWei('1', 'ether')), { from: account_investor2 });
      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_investor1)).toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_investor2)).toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_investor3)).toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
      // assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_temp)).toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
    })

    it('Create another new deposit with explicit checkpoint', async () => {
      let tx = await ERC20FDTCheckpointInstance.depositFunds(
        SampleTokenInstance.address,
        new BN(web3.utils.toWei('10', 'ether')),
        { from: token_owner }
      );
      assert.equal(tx.logs[3].args._depositId.toNumber(), 3, 'Deposit should be created at checkpoint 3');
    });

    it('Investor 2 claims deposit, issuer pushes investor 1 - fails bad index', async () => {
      await catchRevert(
        ERC20FDTCheckpointInstance.distributeFundsToAddresses(5, [account_investor2, account_investor1], {
          from: token_owner,
          gasPrice: 0
        })
      );
    });

    it('should not calculate deposit for invalid index', async () => {
      await catchRevert(ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_investor1, 5));
    });

    it('should calculate deposit before the push deposit payment', async () => {
      let dividendAmount1 = await ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_investor1, 3);
      let dividendAmount2 = await ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_investor2, 3);
      let dividendAmount3 = await ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_investor3, 3);
      // let dividendAmount_temp = await ERC20FDTCheckpointInstance.withdrawableFundsOf.call(3, account_temp);
      assert.equal(dividendAmount1.toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
      assert.equal(dividendAmount2.toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
      assert.equal(dividendAmount3.toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
      // assert.equal(dividendAmount_temp.toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
    });

    it('Investor 2 claims deposit', async () => {
      let investor1Balance = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2Balance = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3Balance = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let tempBalance = new BN(await web3.eth.getBalance(account_temp));
      let _blockNo = latestBlock();
      let tx = await ERC20FDTCheckpointInstance.withdrawFunds(3, { from: account_investor2, gasPrice: 0 });
      let investor1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let tempBalanceAfter1 = new BN(await web3.eth.getBalance(account_temp));
      assert.equal(investor1BalanceAfter1.sub(investor1Balance).toNumber(), 0);
      assert.equal(investor2BalanceAfter1.sub(investor2Balance).toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
      assert.equal(investor3BalanceAfter1.sub(investor3Balance).toNumber(), 0);
      assert.equal(tempBalanceAfter1.sub(tempBalance).toNumber(), 0);
      //Check tx contains event...
      const log = (await ERC20FDTCheckpointInstance.getPastEvents('FundsWithdrawn', {filter: {transactionHash: tx.transactionHash}}))[0];
      // Verify that GeneralTransferManager module get added successfully or not
      assert.equal(log.args._by, account_investor2);
      assert.equal(web3.utils.fromWei(log.args._amount.toString()), 2);
    });

    it('Should issuer pushes temp investor - investor1 excluded', async () => {
      let investor1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let tempBalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_temp));
      await ERC20FDTCheckpointInstance.distributeFundsToAddresses(3, [account_temp, account_investor1], { from: token_owner });
      let investor1BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let tempBalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_temp));
      assert.equal(investor1BalanceAfter2.sub(investor1BalanceAfter1).toString(), new BN(web3.utils.toWei('1', 'ether')));
      assert.equal(investor2BalanceAfter2.sub(investor2BalanceAfter1).toString(), '0');
      assert.equal(investor3BalanceAfter2.sub(investor3BalanceAfter1).toString(), '0');
      // assert.equal(tempBalanceAfter2.sub(tempBalanceAfter1).toString(), new BN(web3.utils.toWei('0.8', 'ether')).toString());
      //Check fully claimed
      assert.equal((await ERC20FDTCheckpointInstance.deposits(3)).claimedAmount.toString(), new BN(web3.utils.toWei('3', 'ether')).toString());
    });

    it('should calculate deposit after the push deposit payment', async () => {
      let dividendAmount1 = await ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_investor1, 3);
      let dividendAmount2 = await ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_investor2, 3);
      assert.equal(dividendAmount1.toString(), 0);
      assert.equal(dividendAmount2.toString(), 0);
    });

    // it('Should give the right deposit index', async () => {
    //   let index = await ERC20FDTCheckpointInstance.getDepositIndex.call(3);
    //   assert.equal(index[0], 2);
    // });

    // it('Should give the right deposit index', async () => {
    //   let index = await ERC20FDTCheckpointInstance.getDepositIndex.call(8);
    //   assert.equal(index.length, 0);
    // });
  });
});