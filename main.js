const locreq       = require('locreq')(__dirname);
const express      = require('express');
const http         = require('http');
const { inspect }  = require('util');
const stoppable    = require('stoppable');
const _            = require('lodash');
const config       = locreq('config');
// const { profile }  = locreq('util/util');

const moduleName = 'main';

let context = { moduleName };

let db, logging, wallet;

let webServer;

const isCli = require.main === module; // not loaded but started directly

function requireModules() {
  db       = locreq('database/database');
  logging  = locreq('logging/logging');
  webApi   = locreq('api/webApi');
  wallet   = locreq('wallet/wallet');
}

// when app.js is launched directly
if (isCli) {
  (async () => {
    try {
      requireModules();
      await db.init();
      let app = await init();
      webServer = createWebServer(app);
      await webServer.start();
      await wallet.trackExistingWallets();
    } 
    catch(err) {
      if(logging) {
        console.error(err);
        logging.error(err, {caller: 'app'});
      }
      else {
        console.error(err);
      }
    }
  })();
}
else {
  requireModules();
}


// check for program termination
process.stdin.resume();

for(let sig of ['SIGINT','SIGTERM']) {
  process.on(sig, gracefulShutdown.bind(this,sig));
}
process.on('unhandledRejection', function (reason, p) {
  //I just caught an unhandled promise rejection, since we already have fallback handler for unhandled errors (see below), let throw and let him handle that
  throw reason;
});
process.on('uncaughtException', function (error) {
  //I just received an error that was never handled, time to handle it and then decide whether a restart is needed
  logging.error(error, {message: 'UncaughtException. ', ... context});
});
process.on('warning', function(error) {
  logging.error(error, {message: 'UncaughtWarning. ', ... context});
});

async function init() {
  const app = express();
  
  // CORS - Cross Origin Resource Sharing
  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    if(req.method === 'OPTIONS') {
      res.send(200);
    } 
    else {
      next();
    }
  });
  
  app.use('/api', webApi);
  
  return app;
}

function createWebServer(app) {
  let server = http.createServer(app);
  const stoppableServer = stoppable(server, 1000);
  
  return {
    async start() {
      const port = process.env.PORT || config.port || 3000;
      await new Promise((resolve,reject) => {
        stoppableServer.on('error',reject);
        stoppableServer.listen({
          host: config.host,
          port,
        }, resolve);
      });
      if(isCli) {
        console.log('Express server listening on port ' + port);
      }
    },
    async stop() {
      const stoppedGraceful = await new Promise((resolve,reject) => {
        stoppableServer.stop((err,stoppedGraceful) => err ? reject(err) : resolve(stoppedGraceful)); 
      });
      if(isCli) {
        console.log(`Express server ${stoppedGraceful ? 'stopped' : 'didn\'t stop'} graceful.` );
      }
    }
  };
}
  
  async function gracefulShutdown(sig) {
    const caller = 'app.gracefulShutdown()';
    await logging.debug(`${sig} signal received.`);
    try {
      await Promise.all([
        profile(() => webServer.stop(),'closeServer',{log: console.log})
          .catch(err => console.error(err,{caller: caller+'.closeServer()'})),
        profile(()=> db.sequelize.connectionManager.close(),'db-close',{log: console.log})
          .catch(err => console.error(err,{caller: caller+'.db.sequelize.connectionManager.close()'}))
      ]);
      // don't use logging.* here because db already closed so logging would fail
      console.log('WebService stopped gracefully');
      process.exit(0);
    }
    catch(err) {
      // don't use logging.* here because db already closed so logging would fail
      console.log('Error in app.gracefulShutdown:', inspect(err));
      process.exit(1);
    }
  }