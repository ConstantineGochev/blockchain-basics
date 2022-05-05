const locreq = require('locreq')(__dirname);
const db     = locreq('database/database');

class TransactionProcessor {
  constructor(db) {
    this.name = "Transaction processor";
    this.db = db;
    this.type = "transactions";
  }

  async process(provider, block) {
    /* We can cash the app configuration here and only update it if its changed */
    const appConfig = await db.appConfig.findOne({where: {}});
    for (let i = 0; i < block.transactions.length; i++) {
      const tx = block.transactions[i];
      const obj = {
        hash: provider.normalizeHash(tx.blockHash),
        blockNumber: tx.blockNumber,
        fromAddress: provider.normalizeHash(tx.from),
        toAddress: provider.normalizeHash(tx.to),
        gas: tx.gas,
        funcSig: provider.getFuncSig(tx.input),
        hash: provider.normalizeHash(tx.hash),
        nonce: tx.nonce,
        timestamp: (new Date(block.timestamp * 1000)).toUTCString(),
        contractAddress: tx.contractAddress,
        status: tx.status
      };
      await this.db.transaction.create(obj);
    }
  }
}

module.exports = TransactionProcessor;