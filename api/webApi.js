'use strict';
/*
 Express middleware of a Wallet API and Transaction Watcher
 - CRUD operations for Transaction Watcher dynamic configuration
*/ 
const locreq     = require('locreq')(__dirname);
const router     = require('express-promise-router')();
const bodyParser = require('body-parser');
const Joi        = require('joi');
const _          = require('lodash');
const wallet     = locreq('wallet/wallet');
const logging    = locreq('logging/logging');
const util       = locreq('util/util');


const moduleName = 'webApi';

// define property/parameter validations
const joiValidationsByRoute = {
  // create personal wallet
  'POST /wallet': {
    body: Joi.object({
      userId: Joi.number().positive().required(),
    }),
  },
  // create dynamic app configuration
  'POST /appConfig': {
    body: Joi.object({ 
      type: Joi.string().valid('live', 'delayed').required(),
    })
  },
  // update an app config
  'PUT /appConfig/:id': {
    body: Joi.object({

    }),
    params: Joi.object({
        // app config id
        id: Joi.number().positive()
    })
  },
  //delete and app config by id
  'DELETE /appConfig/:id': {
    params: Joi.object({
        // app config id
        id: Joi.number().positive()
    })
  },
  // get currently utilized app config per config type
  'GET /appConfig/:type/utilized': {
    params: Joi.object({
        // app config id
        type: Joi.string().required()
    })
  },
  // set currently utilized app config per config type
  'PUT /appConfig/:id/set/': {
      params: Joi.object({
          // app config id
          id: Joi.number().positive()
      }),
      body: Joi.object({
        type: Joi.string().valid('live', 'delayed').required()
      })
    },
};

// get/init validation middleware
const validation = createValidationMiddleware(joiValidationsByRoute);

router.use(bodyParser.json({limit: '50mb'}));
router.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

module.exports = router;

router.route('/wallet')
.post(validation, async (req, res) => {
  const context = {moduleName, caller: 'POST /wallet'};
  const userId = req.body.userId;
  const walletInfo = await wallet.create(userId);
  await logging.audit(`Created wallet ${walletInfo.address} for user with id (${walletInfo.userId})`, {
    ...context
  });
  util.eventEmitter.emit('walletCreated', walletInfo.address);
  res.status(200);
  res.json(walletInfo);

});

router.route('/appConfig')
.post(validation, async (req, res) => {

});


function createValidationMiddleware(joiValidationsByRoute) {
  return function(req, res, next) {
    const route = `${req.method} ${req.route.path}`;
    const joiValidations = joiValidationsByRoute[route];
    if(joiValidations) {
      for(const reqKey of Object.keys(joiValidations)) {
        if(_.has(req, reqKey)) {
          const schema = joiValidations[reqKey];
          const { error, value } = schema.validate(req[reqKey], { allowUnknown: true });
          if(error) {
            throw(error);
          }
          else {
            // adopt mutations (coerced)
            req[reqKey] = value;
          }
        }
      }
      next();
    } else {
      throw new Error(`Missing validation for route '${route}'`);
    }
  };
}