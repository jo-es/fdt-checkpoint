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
const ERC20DividendCheckpoint = artifacts.require('ERC20DividendCheckpoint');

let BN = web3.utils.BN;


contract('ERC20DividendCheckpoint', async (accounts) => {
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
  let dividendName = '0x546573744469766964656e640000000000000000000000000000000000000000';

  let SampleTokenInstance;
  let ERC20DividendCheckpointInstance;

  // SecurityToken Details
  // Module key
  const checkpointKey = 4;

  //Manager details
  const managerDetails = web3.utils.fromAscii('Hello');

  const one_address = '0x0000000000000000000000000000000000000001';
  const address_zero = '0x0000000000000000000000000000000000000000';

  let currentTime;

  const DividendParameters = ['address'];

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
    ERC20DividendCheckpointInstance = await ERC20DividendCheckpoint.new(wallet, { from: token_owner });

    await SampleTokenInstance.approve(
      ERC20DividendCheckpointInstance.address,
      new BN(web3.utils.toWei('1000', 'ether')),
      { from: token_owner }
    );

  });

  describe('Check Dividend payouts', async () => {
    it('Buy some tokens for account_investor1 (1 ETH)', async () => {
      // Mint some tokens
      await ERC20DividendCheckpointInstance.mint(account_investor1, new BN(web3.utils.toWei('1', 'ether')), { from: token_owner });

      assert.equal((await ERC20DividendCheckpointInstance.balanceOf(account_investor1)).toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
    });

    it('Buy some tokens for account_investor2 (2 ETH)', async () => {
      // Mint some tokens
      await ERC20DividendCheckpointInstance.mint(account_investor2, new BN(web3.utils.toWei('2', 'ether')), { from: token_owner });

      assert.equal((await ERC20DividendCheckpointInstance.balanceOf(account_investor2)).toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
    });

    it('Should fail in creating the dividend - bad token', async () => {
      await catchRevert(
        ERC20DividendCheckpointInstance.createDividend(address_zero, new BN(web3.utils.toWei('1.5', 'ether')), dividendName, {
          from: token_owner
        })
      );
    });

    it('Should fail in creating the dividend - amount is 0', async () => {
      await catchRevert(
        ERC20DividendCheckpointInstance.createDividend(SampleTokenInstance.address, new BN(0), dividendName, { from: token_owner })
      );
    });

    it('Create new dividend of SampleToken tokens', async () => {
      let tx = await ERC20DividendCheckpointInstance.createDividend(
        SampleTokenInstance.address,
        new BN(web3.utils.toWei('1.5', 'ether')),
        dividendName,
        { from: token_owner }
      );
      assert.equal(tx.logs[0].args._checkpointId.toNumber(), 1, 'Dividend should be created at checkpoint 1');
      // assert.equal(tx.logs[0].args._name.toString(), dividendName, 'Dividend name incorrect in event');
      let data = await ERC20DividendCheckpointInstance.getDividendsData();

      assert.equal(data['amounts'][0].toString(), new BN(web3.utils.toWei('1.5', 'ether')).toString(), 'amount match');
      assert.equal(data['claimedAmounts'][0].toNumber(), 0, 'claimed match');
      assert.equal(data['names'][0], dividendName, 'dividendName match');
    });

    it('Investor 1 transfers his token balance to investor 2', async () => {
      await ERC20DividendCheckpointInstance.transfer(account_investor2, new BN(web3.utils.toWei('1', 'ether')), { from: account_investor1 });
      assert.equal(await ERC20DividendCheckpointInstance.balanceOf(account_investor1), 0);
      assert.equal((await ERC20DividendCheckpointInstance.balanceOf(account_investor2)).toString(), new BN(web3.utils.toWei('3', 'ether')).toString());
    });

    it('Issuer pushes dividends iterating over account holders - dividends proportional to checkpoint - fails wrong index', async () => {
      await catchRevert(ERC20DividendCheckpointInstance.pushDividendPayment(2, new BN(0), 10, { from: token_owner }));
    });

    it('Issuer pushes dividends iterating over account holders - dividends proportional to checkpoint', async () => {
      let investor1Balance = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2Balance = new BN(await SampleTokenInstance.balanceOf(account_investor2));

      await ERC20DividendCheckpointInstance.pushDividendPayment(0, new BN(0), 10, { from: token_owner, gas: 5000000 });
    
      let investor1BalanceAfter = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter = new BN(await SampleTokenInstance.balanceOf(account_investor2));

      assert.equal(investor1BalanceAfter.sub(investor1Balance).toString(), new BN(web3.utils.toWei('0', 'ether')).toString());
      assert.equal(investor2BalanceAfter.sub(investor2Balance).toString(), new BN(web3.utils.toWei('1.5', 'ether')).toString());
      //Check fully claimed
      assert.equal((await ERC20DividendCheckpointInstance.dividends(0))['claimedAmount'].toString(), new BN(web3.utils.toWei('1.5', 'ether')).toString());
    });

    // it('Buy some tokens for account_temp (1 ETH)', async () => {
    //   // Mint some tokens
    //   await ERC20DividendCheckpointInstance.mint(account_temp, new BN(web3.utils.toWei('1', 'ether')), { from: token_owner });

    //   assert.equal((await ERC20DividendCheckpointInstance.balanceOf(account_temp)).toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
    // });

    it('Should not allow to create dividend without name', async () => {
      await catchRevert(
        ERC20DividendCheckpointInstance.createDividend(SampleTokenInstance.address, new BN(web3.utils.toWei('1.5', 'ether')), '0x0', {
          from: token_owner
        })
      );
    });

    it('Create new dividend', async () => {
      let tx = await ERC20DividendCheckpointInstance.createDividend(
        SampleTokenInstance.address,
        new BN(web3.utils.toWei('1.5', 'ether')),
        dividendName,
        { from: token_owner }
      );
      console.log('Gas used w/ no exclusions: ' + tx.receipt.gasUsed);
      assert.equal(tx.logs[0].args._checkpointId.toNumber(), 2, 'Dividend should be created at checkpoint 1');
    });

    it('Buy some tokens for account_investor3 (7 ETH)', async () => {
      // Mint some tokens
      await ERC20DividendCheckpointInstance.mint(account_investor3, new BN(web3.utils.toWei('7', 'ether')), { from: token_owner });

      assert.equal((await ERC20DividendCheckpointInstance.balanceOf(account_investor3)).toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
    });

    it('Create another new dividend', async () => {
      let tx = await ERC20DividendCheckpointInstance.createDividend(
        SampleTokenInstance.address,
        new BN(web3.utils.toWei('10', 'ether')),
        dividendName,
        { from: token_owner }
      );
      console.log('Gas used w/ max exclusions - default: ' + tx.receipt.gasUsed);
      assert.equal(tx.logs[0].args._checkpointId.toNumber(), 3, 'Dividend should be created at checkpoint 3');
    });

    it('should investor 3 claims dividend - fail bad index', async () => {
      await catchRevert(ERC20DividendCheckpointInstance.pullDividendPayment(5, { from: account_investor3, gasPrice: 0 }));
    });

    it('should investor 3 claims dividend', async () => {
      let investor1Balance = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2Balance = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3Balance = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      await ERC20DividendCheckpointInstance.pullDividendPayment(2, { from: account_investor3, gasPrice: 0 });
      let investor1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      assert.equal(investor1BalanceAfter1.sub(investor1Balance).toNumber(), 0);
      assert.equal(investor2BalanceAfter1.sub(investor2Balance).toNumber(), 0);
      assert.equal(investor3BalanceAfter1.sub(investor3Balance).toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
      let info = await ERC20DividendCheckpointInstance.getDividendProgress(2);

      assert.equal(info[0][1], account_investor3, 'account_investor3');
      assert.equal(info[1][1], true, 'account_investor3 is claimed');
      
      assert.equal(info[0][0], account_investor2, 'account_investor2');
      assert.equal(info[1][0], false, 'account_investor3 is not claimed');
    });

    it('should investor 3 claims dividend - fails already claimed', async () => {
      await catchRevert(ERC20DividendCheckpointInstance.pullDividendPayment(2, { from: account_investor3, gasPrice: 0 }));
    });

    it('should issuer pushes remain', async () => {
      let investor1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let investorTempBalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_temp));
      await ERC20DividendCheckpointInstance.pushDividendPayment(2, new BN(0), 10, { from: token_owner });
      let investor1BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let investorTempBalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_temp));
      assert.equal(investor1BalanceAfter2.sub(investor1BalanceAfter1).toNumber(), 0);
      assert.equal(investor2BalanceAfter2.sub(investor2BalanceAfter1).toString(), new BN(web3.utils.toWei('3', 'ether')).toString());
      assert.equal(investor3BalanceAfter2.sub(investor3BalanceAfter1).toNumber(), 0);
      assert.equal(investorTempBalanceAfter2.sub(investorTempBalanceAfter1).toNumber(), 0);
      //Check fully claimed
      assert.equal((await ERC20DividendCheckpointInstance.dividends(2))['claimedAmount'].toString(), new BN(web3.utils.toWei('10', 'ether')).toString());
    });

    it('Investor 2 transfers 1 ETH of his token balance to investor 1', async () => {
      await ERC20DividendCheckpointInstance.transfer(account_investor1, new BN(web3.utils.toWei('1', 'ether')), { from: account_investor2 });
      assert.equal((await ERC20DividendCheckpointInstance.balanceOf(account_investor1)).toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
      assert.equal((await ERC20DividendCheckpointInstance.balanceOf(account_investor2)).toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
      assert.equal((await ERC20DividendCheckpointInstance.balanceOf(account_investor3)).toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
      // assert.equal((await ERC20DividendCheckpointInstance.balanceOf(account_temp)).toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
    })

    it('Create another new dividend with explicit - fails bad checkpoint', async () => {
      await catchRevert(
        ERC20DividendCheckpointInstance.createDividendWithCheckpoint(
          SampleTokenInstance.address,
          new BN(web3.utils.toWei('20', 'ether')),
          5,
          dividendName,
          { from: token_owner }
        )
      );
    });

    it('Create another new dividend with explicit checkpoint', async () => {
      let tx = await ERC20DividendCheckpointInstance.createDividendWithCheckpoint(
        SampleTokenInstance.address,
        new BN(web3.utils.toWei('10', 'ether')),
        3,
        dividendName,
        { from: token_owner }
      );

      assert.equal(tx.logs[2].args._checkpointId.toNumber(), 3, 'Dividend should be created at checkpoint 3');
    });

    it('Investor 2 claims dividend, issuer pushes investor 1 - fails bad index', async () => {
      await catchRevert(
        ERC20DividendCheckpointInstance.pushDividendPaymentToAddresses(5, [account_investor2, account_investor1], {
          from: token_owner,
          gasPrice: 0
        })
      );
    });

    it('should not calculate dividend for invalid index', async () => {
      await catchRevert(ERC20DividendCheckpointInstance.calculateDividend.call(5, account_investor1));
    });

    it('should calculate dividend before the push dividend payment', async () => {
      let dividendAmount1 = await ERC20DividendCheckpointInstance.calculateDividend.call(3, account_investor1);
      let dividendAmount2 = await ERC20DividendCheckpointInstance.calculateDividend.call(3, account_investor2);
      let dividendAmount3 = await ERC20DividendCheckpointInstance.calculateDividend.call(3, account_investor3);
      // let dividendAmount_temp = await ERC20DividendCheckpointInstance.calculateDividend.call(3, account_temp);
      assert.equal(dividendAmount1.toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
      assert.equal(dividendAmount2.toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
      assert.equal(dividendAmount3.toString(), new BN(web3.utils.toWei('7', 'ether')).toString());
      // assert.equal(dividendAmount_temp.toString(), new BN(web3.utils.toWei('1', 'ether')).toString());
    });

    it('Investor 2 claims dividend', async () => {
      let investor1Balance = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2Balance = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3Balance = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let tempBalance = new BN(await web3.eth.getBalance(account_temp));
      let _blockNo = latestBlock();
      let tx = await ERC20DividendCheckpointInstance.pullDividendPayment(3, { from: account_investor2, gasPrice: 0 });
      let investor1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let tempBalanceAfter1 = new BN(await web3.eth.getBalance(account_temp));
      assert.equal(investor1BalanceAfter1.sub(investor1Balance).toNumber(), 0);
      assert.equal(investor2BalanceAfter1.sub(investor2Balance).toString(), new BN(web3.utils.toWei('2', 'ether')).toString());
      assert.equal(investor3BalanceAfter1.sub(investor3Balance).toNumber(), 0);
      assert.equal(tempBalanceAfter1.sub(tempBalance).toNumber(), 0);
      //Check tx contains event...
      const log = (await ERC20DividendCheckpointInstance.getPastEvents('ERC20DividendClaimed', {filter: {transactionHash: tx.transactionHash}}))[0];
      // Verify that GeneralTransferManager module get added successfully or not
      assert.equal(log.args._payee, account_investor2);
      assert.equal(web3.utils.fromWei(log.args._amount.toString()), 2);
    });

    it('Should issuer pushes temp investor - investor1 excluded', async () => {
      let investor1BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let tempBalanceAfter1 = new BN(await SampleTokenInstance.balanceOf(account_temp));
      await ERC20DividendCheckpointInstance.pushDividendPaymentToAddresses(3, [account_temp, account_investor1], { from: token_owner });
      let investor1BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor1));
      let investor2BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor2));
      let investor3BalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_investor3));
      let tempBalanceAfter2 = new BN(await SampleTokenInstance.balanceOf(account_temp));
      assert.equal(investor1BalanceAfter2.sub(investor1BalanceAfter1).toString(), new BN(web3.utils.toWei('1', 'ether')));
      assert.equal(investor2BalanceAfter2.sub(investor2BalanceAfter1).toString(), '0');
      assert.equal(investor3BalanceAfter2.sub(investor3BalanceAfter1).toString(), '0');
      // assert.equal(tempBalanceAfter2.sub(tempBalanceAfter1).toString(), new BN(web3.utils.toWei('0.8', 'ether')).toString());
      //Check fully claimed
      assert.equal((await ERC20DividendCheckpointInstance.dividends(3)).claimedAmount.toString(), new BN(web3.utils.toWei('3', 'ether')).toString());
    });

    it('should calculate dividend after the push dividend payment', async () => {
      let dividendAmount1 = await ERC20DividendCheckpointInstance.calculateDividend.call(3, account_investor1);
      let dividendAmount2 = await ERC20DividendCheckpointInstance.calculateDividend.call(3, account_investor2);
      assert.equal(dividendAmount1.toString(), 0);
      assert.equal(dividendAmount2.toString(), 0);
    });

    it('Should give the right dividend index', async () => {
      let index = await ERC20DividendCheckpointInstance.getDividendIndex.call(3);
      assert.equal(index[0], 2);
    });

    it('Should give the right dividend index', async () => {
      let index = await ERC20DividendCheckpointInstance.getDividendIndex.call(8);
      assert.equal(index.length, 0);
    });
  });
});