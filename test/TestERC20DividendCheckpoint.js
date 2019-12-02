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
  let account_issuer;
  let token_owner;
  let account_holder1;
  let account_holder2;
  let account_holder3;
  let account_temp;

  let SampleTokenInstance;
  let ERC20FDTCheckpointInstance;

  const address_zero = '0x0000000000000000000000000000000000000000';

  before(async () => {
    currentTime = new BN(await latestTime());
    defaultAccount = accounts[0];
    account_issuer = accounts[1];

    token_owner = account_issuer;

    account_holder1 = accounts[6];
    account_holder2 = accounts[7];
    account_holder3 = accounts[8];
    account_holder4 = accounts[9];
    account_temp = accounts[2];
    account_manager = accounts[5];

    // deploy sample ERC20 token for distribution and mint 1000 SampleToken tokens for the token owner
    SampleTokenInstance = await SampleToken.new({ from: defaultAccount });
    SampleTokenInstance.mint(token_owner, new BN(web3.utils.toWei('1000', 'ether')), { from: defaultAccount });

    // deploy distributor contract
    ERC20FDTCheckpointInstance = await ERC20FDTCheckpoint.new({ from: token_owner });

    await SampleTokenInstance.approve(
      ERC20FDTCheckpointInstance.address,
      new BN(web3.utils.toWei('1000', 'ether')),
      { from: token_owner }
    );

  });

  describe('Check distribution of funds', async () => {
    it('Buy some tokens for account_holder1 (1 ETH)', async () => {
      // Mint some tokens
      await ERC20FDTCheckpointInstance.mint(account_holder1, new BN(web3.utils.toWei('1', 'ether')), { from: token_owner });

      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_holder1)).toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
    });

    it('Buy some tokens for account_holder2 (2 ETH)', async () => {
      // Mint some tokens
      await ERC20FDTCheckpointInstance.mint(account_holder2, new BN(web3.utils.toWei('2', 'ether')), { from: token_owner });

      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_holder2)).toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
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
      let data = await ERC20FDTCheckpointInstance.getDepositsData();

      assert.equal(data['amounts'][0].toString(), new BN(web3.utils.toWei('1.5', 'ether')).toString(), 'amount match');
      assert.equal(data['claimedAmounts'][0].toNumber(), 0, 'claimed match');
    });

    it('holder 1 transfers his token balance to holder 2', async () => {
      await ERC20FDTCheckpointInstance.transfer(account_holder2, new BN(web3.utils.toWei('1', 'ether')), { from: account_holder1 });
      assert.equal(await ERC20FDTCheckpointInstance.balanceOf(account_holder1), 0);
      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_holder2)).toString(), new BN(web3.utils.toWei('3', 'ether')).toString());
    });

    it('Issuer pushes funds iterating over account holders - funds proportional to checkpoint - fails wrong index', async () => {
      await catchRevert(ERC20FDTCheckpointInstance.pushFunds(2, new BN(0), 10, { from: token_owner }));
    });

    it('Issuer pushes funds iterating over account holders - funds proportional to checkpoint', async () => {
      let holder1Balance = new BN(await SampleTokenInstance.balanceOf(account_holder1));
      let holder2Balance = new BN(await SampleTokenInstance.balanceOf(account_holder2));

      await ERC20FDTCheckpointInstance.pushFunds(0, new BN(0), 10, { from: token_owner, gas: 5000000 });
    
      let holder1BalanceAfter = new BN(await SampleTokenInstance.balanceOf(account_holder1));
      let holder2BalanceAfter = new BN(await SampleTokenInstance.balanceOf(account_holder2));

      assert.equal(holder1BalanceAfter.sub(holder1Balance).toString(), new BN(web3.utils.toWei('0', 'ether')).toString());
      assert.equal(holder2BalanceAfter.sub(holder2Balance).toString(), new BN(web3.utils.toWei('1.5', 'ether')).toString());
      //Check fully claimed
      assert.equal((await ERC20FDTCheckpointInstance.deposits(0))['claimedAmount'].toString(), new BN(web3.utils.toWei('1.5', 'ether')).toString());
    });

    it('Create new deposit', async () => {
      let tx = await ERC20FDTCheckpointInstance.depositFunds(
        SampleTokenInstance.address,
        new BN(web3.utils.toWei('1.5', 'ether')),
        { from: token_owner }
      );
      console.log('Gas used w/ no exclusions: ' + tx.receipt.gasUsed);
      assert.equal(tx.logs[0].args._checkpointId.toNumber(), 2, 'Deposit should be created at checkpoint 1');
    });

    it('Buy some tokens for account_holder3 (7 ETH)', async () => {
      // Mint some tokens
      await ERC20FDTCheckpointInstance.mint(account_holder3, new BN(web3.utils.toWei('7', 'ether')), { from: token_owner });

      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_holder3)).toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
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

    it('should holder 3 claims funds - fail bad index', async () => {
      await catchRevert(ERC20FDTCheckpointInstance.withdrawFunds(5, { from: account_holder3, gasPrice: 0 }));
    });

    it('should holder 3 claims funds', async () => {
      let holder1Balance = new BN(await SampleTokenInstance.balanceOf(account_holder1));
      let holder2Balance = new BN(await SampleTokenInstance.balanceOf(account_holder2));
      let holder3Balance = new BN(await SampleTokenInstance.balanceOf(account_holder3));
      await ERC20FDTCheckpointInstance.withdrawFunds(2, { from: account_holder3, gasPrice: 0 });
      let holder1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder1));
      let holder2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder2));
      let holder3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder3));
      assert.equal(holder1BalanceAfter1.sub(holder1Balance).toNumber(), 0);
      assert.equal(holder2BalanceAfter1.sub(holder2Balance).toNumber(), 0);
      assert.equal(holder3BalanceAfter1.sub(holder3Balance).toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
      assert.equal(await ERC20FDTCheckpointInstance.isClaimed(account_holder3, 2), true);
      assert.equal(await ERC20FDTCheckpointInstance.isClaimed(account_holder2, 2), false);
    });

    it('should holder 3 claims funds - fails already claimed', async () => {
      await catchRevert(ERC20FDTCheckpointInstance.withdrawFunds(2, { from: account_holder3, gasPrice: 0 }));
    });

    it('should issuer pushes remain', async () => {
      let holder1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder1));
      let holder2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder2));
      let holder3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder3));
      let holderTempBalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_temp));
      await ERC20FDTCheckpointInstance.pushFunds(2, new BN(0), 10, { from: token_owner });
      let holder1BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_holder1));
      let holder2BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_holder2));
      let holder3BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_holder3));
      let holderTempBalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_temp));
      assert.equal(holder1BalanceAfter2.sub(holder1BalanceAfter1).toNumber(), 0);
      assert.equal(holder2BalanceAfter2.sub(holder2BalanceAfter1).toString(), new BN(web3.utils.toWei('3', 'ether')).toString());
      assert.equal(holder3BalanceAfter2.sub(holder3BalanceAfter1).toNumber(), 0);
      assert.equal(holderTempBalanceAfter2.sub(holderTempBalanceAfter1).toNumber(), 0);
      //Check fully claimed
      assert.equal((await ERC20FDTCheckpointInstance.deposits(2))['claimedAmount'].toString(), new BN(web3.utils.toWei('10', 'ether')).toString());
    });

    it('holder 2 transfers 1 ETH of his token balance to holder 1', async () => {
      await ERC20FDTCheckpointInstance.transfer(account_holder1, new BN(web3.utils.toWei('1', 'ether')), { from: account_holder2 });
      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_holder1)).toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_holder2)).toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
      assert.equal((await ERC20FDTCheckpointInstance.balanceOf(account_holder3)).toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
    })

    it('Create another new deposit', async () => {
      let tx = await ERC20FDTCheckpointInstance.depositFunds(
        SampleTokenInstance.address,
        new BN(web3.utils.toWei('10', 'ether')),
        { from: token_owner }
      );
      assert.equal(tx.logs[3].args.depositId.toNumber(), 3, 'Deposit should be created at checkpoint 3');
    });

    it('holder 2 claims funds, issuer pushes holder 1 - fails bad index', async () => {
      await catchRevert(
        ERC20FDTCheckpointInstance.pushFundsToAddresses(5, [account_holder2, account_holder1], {
          from: token_owner,
          gasPrice: 0
        })
      );
    });

    it('should not calculate withdrawable amount for invalid index', async () => {
      await catchRevert(ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_holder1, 5));
    });

    it('should calculate withdrawable amount before funds distribution', async () => {
      let withdrawableAmount1 = await ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_holder1, 3);
      let withdrawableAmount2 = await ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_holder2, 3);
      let withdrawableAmount3 = await ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_holder3, 3);
      assert.equal(withdrawableAmount1.toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
      assert.equal(withdrawableAmount2.toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
      assert.equal(withdrawableAmount3.toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
    });

    it('holder 2 claims funds', async () => {
      let holder1Balance = new BN(await SampleTokenInstance.balanceOf(account_holder1));
      let holder2Balance = new BN(await SampleTokenInstance.balanceOf(account_holder2));
      let holder3Balance = new BN(await SampleTokenInstance.balanceOf(account_holder3));
      let tempBalance = new BN(await web3.eth.getBalance(account_temp));
      let _blockNo = latestBlock();
      let tx = await ERC20FDTCheckpointInstance.withdrawFunds(3, { from: account_holder2, gasPrice: 0 });
      let holder1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder1));
      let holder2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder2));
      let holder3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder3));
      let tempBalanceAfter1 = new BN(await web3.eth.getBalance(account_temp));
      assert.equal(holder1BalanceAfter1.sub(holder1Balance).toNumber(), 0);
      assert.equal(holder2BalanceAfter1.sub(holder2Balance).toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
      assert.equal(holder3BalanceAfter1.sub(holder3Balance).toNumber(), 0);
      assert.equal(tempBalanceAfter1.sub(tempBalance).toNumber(), 0);
      //Check tx contains event...
      const log = (await ERC20FDTCheckpointInstance.getPastEvents('FundsWithdrawn', {filter: {transactionHash: tx.transactionHash}}))[0];
      assert.equal(log.args.by, account_holder2);
      assert.equal(web3.utils.fromWei(log.args.fundsWithdrawn.toString()), 2);
    });

    it('Should issuer pushes temp holder', async () => {
      let holder1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder1));
      let holder2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder2));
      let holder3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_holder3));
      await ERC20FDTCheckpointInstance.pushFundsToAddresses(3, [account_temp, account_holder1], { from: token_owner });
      let holder1BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_holder1));
      let holder2BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_holder2));
      let holder3BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_holder3));
      assert.equal(holder1BalanceAfter2.sub(holder1BalanceAfter1).toString(), new BN(web3.utils.toWei('1', 'ether')));
      assert.equal(holder2BalanceAfter2.sub(holder2BalanceAfter1).toString(), '0');
      assert.equal(holder3BalanceAfter2.sub(holder3BalanceAfter1).toString(), '0');
      //Check fully claimed
      assert.equal((await ERC20FDTCheckpointInstance.deposits(3)).claimedAmount.toString(), new BN(web3.utils.toWei('3', 'ether')).toString());
    });

    it('should calculate withdrawable amount after funds distribution', async () => {
      let dividendAmount1 = await ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_holder1, 3);
      let dividendAmount2 = await ERC20FDTCheckpointInstance.withdrawableFundsOf.call(account_holder2, 3);
      assert.equal(dividendAmount1.toString(), 0);
      assert.equal(dividendAmount2.toString(), 0);
    });
  });
});