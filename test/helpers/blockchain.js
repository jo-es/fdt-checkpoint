// Returns the time of the last mined block in seconds
async function latestTime() {
  let block = await web3.eth.getBlock("latest");
  return block.timestamp;
}

async function latestBlock() {
  let block = await web3.eth.getBlock("latest");
  return block.number;
}

const duration = {
  seconds: function(val) {
      return val;
  },
  minutes: function(val) {
      return val * this.seconds(60);
  },
  hours: function(val) {
      return val * this.minutes(60);
  },
  days: function(val) {
      return val * this.hours(24);
  },
  weeks: function(val) {
      return val * this.days(7);
  },
  years: function(val) {
      return val * this.days(365);
  }
};

async function createSnapshot () {
  return new Promise((resolve, reject) =>  {
    web3.currentProvider.send({ 
      jsonrpc: '2.0', 
      method: 'evm_snapshot', 
      params: [], 
      id: new Date().getSeconds()
    }, async (err, res) => {
      // console.log('res: ' + JSON.stringify(res), 'error: ' + JSON.stringify(err));
      if (err) { reject(err); }
      return resolve(res.result);
    });
  });
}

async function revertToSnapshot (snapshot) {
  return new Promise((resolve, reject) =>  {
    web3.currentProvider.send({ 
      jsonrpc: '2.0', 
      method: 'evm_revert', 
      params: [snapshot], 
      id: new Date().getSeconds()
    }, async (err, res) => {
      // console.log('res: ' + JSON.stringify(res), 'error: ' + JSON.stringify(err));
      if (err) { reject(err); }
      return resolve(res);
    });
  });
}

async function mineBlock (blockTimestamp) {
  return new Promise((resolve, reject) =>  {
    web3.currentProvider.send({ 
      jsonrpc: '2.0', 
      method: 'evm_mine', 
      params: [blockTimestamp], 
      id: new Date().getSeconds()
    }, async (err, res) => {
      // console.log('res: ' + JSON.stringify(res), 'error: ' + JSON.stringify(err));
      if (err) { reject(err); }
      return resolve(res);
    });
  });
}

async function increaseTime (duration) {
  return new Promise((resolve, reject) =>  {
    web3.currentProvider.send({ 
      jsonrpc: '2.0', 
      method: 'evm_increaseTime', 
      params: [duration], 
      id: new Date().getSeconds()
    }, async (err, res) => {
      // console.log('res: ' + JSON.stringify(res), 'error: ' + JSON.stringify(err));
      if (err) { reject(err); }
      return resolve(res);
    });
  });
}

async function getLatestBlockTimestamp () {
  return (await web3.eth.getBlock('latest')).timestamp.toString();
}

module.exports = { 
  latestTime,
  latestBlock,
  duration,
  createSnapshot,
  revertToSnapshot,
  mineBlock,
  increaseTime,
  getLatestBlockTimestamp 
};