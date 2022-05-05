'use strict';
const locreq  = require('locreq')(__dirname);
const assert  = require('assert');
const _       = require('lodash');
const R       = require('ramda');
const chalk   = require('chalk');
const { inspect } = require('util');
const util    = locreq('util/util');
const { getCaller } = locreq('util/application-errors');

const moduleName = 'logging';

let timestamps = {};

const logLevelLookup = {
  'Trace':'silly',
  'Debug':'debug',
  'Info' :'info', 
  'Warn' :'warn',
  'Exception':'exception',
  'Error':'error',
  'Audit':'audit' 
};

const logLevels = {
  levels: {
    error:      0,
    exception:  1,
    warn:       2, 
    audit:      3, // custom level
    info:       4, 
    debug:      5, 
    silly:      6,
    trace:      7,
  },

  colors: {
    error: 'red',
    exception: 'redBright',
    warn:  'yellow',
    audit: 'blue', // custom level
    info:  'green',
    debug: 'magenta',
    silly: 'gray',
    trace: 'gray',
  }
};

let logLevel;
let withConsoleLog = true;
let instanceId;

function log(level, message, {
  caller, moduleName, method, pof, 
  req, // if called from web service
  user, // for audit logging - see req.user as well
  elementId, 
  elementName,
  hostName=instanceId,
  pid=process.pid.toString(),
  ...moreContext
}) {
  try {
      caller = getCaller({caller, moduleName, method, pof, req});
      // remove null and undefined properties
      moreContext = util.transformObjectDeep( R.reject(R.isNil), moreContext, { maxDepth: 4 } );

      message = util.replaceAll(locreq.resolve(''), '.', message);
      let moreContextMessage = Object.keys(moreContext).length > 0 ? `\n\nAdditional Context: ${inspect(moreContext, {depth: 4})}` : ''; 
      message = `${message}${moreContextMessage}`;
      
      const maxMessageLength = 5000;
      if(message.length > maxMessageLength) {
        message = message.substring(0,maxMessageLength-1) + ` #### TRUNCATED to ${maxMessageLength} characters ####`;
      }

      user = user || (req && req.user);
      const userName = _.get(user, 'data.userName') || _.get(user, 'email') || '';

      const jsonLogMsg = JSON.stringify({level, message, hostName, pid, user: userName, elementId, elementName, caller},null,2);
      const color = logLevels.colors[level];
      const consLog = level == 'error' ? console.error : console.log; 
      withConsoleLog && consLog(chalk[color](jsonLogMsg));
      if(logLevels.levels[level] <= logLevels.levels['info']) {
        const db = locreq('database/database'); // do not on top to prevent cyclic module reference
        if(db.initialized) {
          db.log.create({
            logLevel: level,
            logMessage: (caller ? caller + ': ' : '') + message,
            elementName,
            elementId,
            hostName,
            user: userName,
            pid
          })
          .catch(err => {
            withConsoleLog && console.dir(err,{depth: 5});
          });
        }
      }
  }
  catch(error) {
    console.error('Error in error logging.', inspect(error), inspect({
      caller, moduleName, method, pof, req, user, 
      elementId, elementName, hostName, pid, 
      ...moreContext
    }));
  }
}

const logMethods = Object.keys(logLevels.levels)
  .reduce((logMethods,level)=> { 
    logMethods[level] = async (message, details={}) => log(level,message,details);
    return logMethods;
  },{});

let logging = {
  ...logMethods,
  LevelEnum: logLevelLookup,
  logLevelAtLeast(level) {
    return logLevels.levels[level] <= logLevels.levels[logLevel];
  },
  async setLogLevel(level) {
    level = logLevelLookup[level] || level;
    logLevel = level;
  },
  async error(error, details={}) {
    let context = { moduleName, method: 'error' };
    try {
      let message;
      if (error) {
        message = _.isString(error) ? error : inspect(error);
        if(details && details.message) {
          message = details.message + '\n' + message;
        }
        if(error.context) {
          message = error.context + '\n' + message;
        }
        if(_.isError(error) || error instanceof util.AggregateError) {
          details = {...util.getDetails(error), ...details};
        }
      }
      else {
        message = 'Error property is undefined.';
      }

      log('error', message, details);
    }
    catch(err) {
      console.error('Error in error logging.', inspect(err), inspect(context));
    }
  },
  async time(key,{level='debug', message='', ...details}={}) {
    try {
      assert(key !== undefined,'missing key');
      if(timestamps[key]) {
        message = `${key} took ${new Date() - timestamps[key]}ms.${message}`;
        log(level, message, details);
        delete timestamps[key];
      } 
      else {
        timestamps[key] = new Date();
      }
    }
    catch(err) {
      log('error', `Error '${err.message}' in logging.time.`);
    }
  }
};
  


module.exports = logging;