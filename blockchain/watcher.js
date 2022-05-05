const locreq   = require('locreq')(__dirname);
const Web3     = require('web3');
const logging  = locreq('logging/logging');
const db       = locreq('database/database');
const { Provider, ProviderType }  
               = locreq('blockchain/provider');
const config   = locreq('config');
const util     = locreq('util/util');

const processorsToLoad = [
  'transaction'
];

const eth = new Provider(ProviderType.HTTP);
const processors = [];

const liveWatch = async function() {
  const runs = 0;
  const liveBlock = await eth.getLatestBlock() - 10;
  const dbBlock = await db.block.findOne({where: {}, order: [ [ 'createdAt', 'DESC' ]]});
  if (dbBlock == null || isNaN(dbBlock)) {
    console.log('We don\'t have any blocks')
    dbBlock = liveBlock - 100;
  }
  if (runs < 10) {
    console.log('This is the first run')
    dbBlock +=  runs - 10;
    runs++;
  }
  dbBlock++;
  if (liveBlock > dbBlock) {
    var missedBlocks = liveBlock - dbBlock;
    console.log("Live mode has to catch up with: ", missedBlocks)
    doBlock(dbBlock, function() {
        liveWatch();
    });
  } else {
    setTimeout(liveWatch, 10000)
  }
}
  
for (let i = 0; i < processorsToLoad.length; i++) {
  const p = locreq('processors/' + processorsToLoad[i]);
  processors.push(new p(db));
}
  
const doBlock = async function(blocknumber, cb) {
  console.log('Getting infos for block', blocknumber)
  eth.getBlock(blocknumber, async function(block) {
    console.log('got block')
    for (let i = 0; i < processors.length; i++) {
      await processors[i].process(eth, block);
    }
    cb();
  });
}

class TransactionChecker {
  constructor(accounts) {
    this.web3ws = new Web3(new Web3.providers.WebsocketProvider('wss://rinkeby.infura.io/ws/v3/' +  config.INFURA_PROJECT_ID));
    this.web3 = new Web3(new Web3.providers.HttpProvider('https://rinkeby.infura.io/v3/' +  config.INFURA_PROJECT_ID));
    this.accounts = accounts || [];
    this.blocksToWait = 0;
    this.defaultInterval = 500;
  }

  subscribe(topic) {
    this.subscription = this.web3ws.eth.subscribe(topic, (err, res) => {
      if (err) console.error(err);
    });
  }

  listenForAccounts() {
    util.eventEmitter.on('walletCreated', address => {
      console.log(`new address ${address}`);
      this.accounts.push(address);
    });
  }

  getTransactionReceiptMined(txHash, interval) {
    const transactionReceiptAsync = (resolve, reject) => {
      this.web3.eth.getTransactionReceipt(txHash, (error, receipt) => {
          if (error) {
              reject(error);
          } else if (receipt == null) {
              setTimeout(() => transactionReceiptAsync(resolve, reject), interval ? interval : 500);
          } else {
              resolve(receipt);
          }
      });
    };

    if (Array.isArray(txHash)) {
      return Promise.all(txHash.map(oneTxHash => this.getTransactionReceiptMined(oneTxHash, interval)));
    } 
    else if (typeof txHash === "string") {
      return new Promise(transactionReceiptAsync);
    } 
    else {
      throw new Error("Invalid Type: " + txHash);
    }
  }

  watchTransactions() {
    console.log('Watching all pending transactions...');
    this.subscription.on('data', async (txHash) => {
      try {
        let tx = await this.web3.eth.getTransaction(txHash);
        // console.log(tx);
        if (tx != null) {
          if (this.accounts.indexOf(tx.to) > -1) {
            console.log({address: tx.from, value: this.web3.utils.fromWei(tx.value, 'ether'), timestamp: new Date()});
            const receipt = await this.getTransactionReceiptMined(txHash);
            console.log(receipt);
            /* get wallet from db */
            const wallet = await db.wallet.findOne({where: {address: tx.to}});
            /* write deposit to db */
            await db.deposit.create({blockchainTxId: txHash, amount: this.web3.utils.fromWei(tx.value, 'ether'), type: 'ether', blockNumber: receipt.blockNumber, userId: wallet.userId});
            
            /* decrypt private key */
            const prvKey = util.decrypt(wallet.privateKey);
            console.log(prvKey);
            const nonce = await this.web3.eth.getTransactionCount(tx.to, 'latest'); // nonce starts counting from 0
            const transaction = {
              to: '0x0000000000000000000000000000000000000000', // burn address to return eth
              value: tx.value,
              gas: 100000, //or web3.eth.getGasPrice
              nonce
             };

            const signedTx = await this.web3.eth.accounts.signTransaction(transaction, prvKey);
    
            const sentTxHash = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            console.log(sentTxHash);
          }
        }
      } catch (err) {
        console.error(err);
      }
    });
  }
}

module.exports = {
  TransactionChecker,
  liveWatch
}