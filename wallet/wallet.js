const locreq = require('locreq')(__dirname);
const ethers = require('ethers');
const db     = locreq('database/database');
const { TransactionChecker }
             = locreq('blockchain/watcher');
const util   = locreq('util/util');

async function create(userId) {
  const wallet = ethers.Wallet.createRandom();
  const {address, privateKey} = wallet;
  const encryptedPrvkey = util.encrypt(privateKey);
  await db.wallet.create({address, privateKey: encryptedPrvkey, userId});

  return { address, privateKey, mnemonic: wallet.mnemonic.phrase, userId };
}

async function trackExistingWallets() {
  const wallets = await db.wallet.findAll({});
  const addresses = [];
  for(let wallet of wallets) {
    addresses.push(wallet.address);
  }
  const txChecker = new TransactionChecker(addresses);

  txChecker.subscribe('pendingTransactions');
  txChecker.watchTransactions();
  txChecker.listenForAccounts();
}

module.exports = {
    create,
    trackExistingWallets
};