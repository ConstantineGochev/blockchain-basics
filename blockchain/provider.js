const locreq = require('locreq')(__dirname);
const ethers = require('ethers');
const config = locreq('config');

const enumProviderType = {
    WS: 1,
    HTTP: 2,
};

class Provider {
  constructor(providerType) {
    this.providerType = providerType;
    this.stats = {
      errors: 0,
      blocks: 0,
      transactionsReceipts: 0,
    };
    if (this.providerType == enumProviderType.HTTP) {
      this.ethers = new ethers.providers.InfuraProvider("rinkeby" , config.INFURA_PROJECT_ID);
    }
  }

  async getBlock(blockNumber, cb) {
    const blockWithTransactions = await this.ethers.getBlockWithTransactions(blockNumber);
    cb(blockWithTransactions);
  }

  async getLatestBlock() {
    const latestBlock = await this.ethers.getBlockNumber();
    return latestBlock;
  }

  normalizeHash(hash) {
    if(hash != null && hash.startsWith("0x")) {
      const res = hash.slice(2).toLowerCase();
      if (res.length == 0) {
        return (null);
      }
      return (res);
    }
    if(hash != null && hash.length > 0) {
      return (hash);
    }
      return (null);
  }
}

module.exports.Provider = Provider;
module.exports.ProviderType = enumProviderType;