const locreq  = require('locreq')(__dirname);
const _ = require('lodash');

const getCaller = ({caller, moduleName, method, pof, req}) => {
    let methodParts = [moduleName, method, pof];
    let reqPart = req ? `${req.method} ${req.url}` : ''; 
    return caller 
      || (`${_.compact(methodParts).join('.')}`)
      || (req && reqPart)
      || '';
};


module.exports = {
  getCaller
};