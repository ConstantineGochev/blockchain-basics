/*
  Generic functions to be used everywhere
*/
const locreq = require('locreq')(__dirname);
const config = locreq('config');
const R      = require('ramda');
const EventEmitter = require('events');
const CryptoJS  = require('crypto-js');
const ENCRYPTION_KEY = config.secret;
const eventEmitter = new EventEmitter();

function transformObjectDeep(flatObjectTransformation, objectOrArray, { maxDepth = 10 }) {
    const transformObjectDeep_ = depth => R.cond([
      [() => depth >= maxDepth, R.identity],
      [R.is(Array), (array) => R.map(transformObjectDeep_(depth+1), array)],
      [R.is(Function), R.identity],
      [R.is(Date), R.identity],
      [R.is(Object), (o) => R.pipe(flatObjectTransformation, R.map(transformObjectDeep_(depth+1)))(o)],
      [R.T, R.identity]
    ]);
    return transformObjectDeep_(0)(objectOrArray);
}

function replaceAll(searchString, replacementString, inputString) {
    const searchStringAsRegexp = searchString.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1');
    return inputString.replace(new RegExp(searchStringAsRegexp, 'g'), replacementString);
}

class AggregateError {
  constructor(errors) {
    this.errors = errors;
  }
}
  
function getDetails(error) {
  var details = {};
  if(error instanceof AggregateError) {
    for(const err of error.errors) {
      Object.assign(details, err.details);
    }
    return details;
  } else if (error instanceof Error) {
    return error.details;
  } else {
    return details;
  }
}

function encrypt(text) {
  const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  return encrypted;
}

function decrypt(text) {
  const bytes = CryptoJS.AES.decrypt(text, ENCRYPTION_KEY);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  return decrypted;
}

module.exports = {
  transformObjectDeep,
  replaceAll,
  AggregateError,
  getDetails,
  encrypt,
  decrypt,
  eventEmitter
};