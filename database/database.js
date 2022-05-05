const locreq          = require('locreq')(__dirname);
const path            = require('path');
const _               = require('lodash');
const fs              = require('fs-extra');
const Sequelize       = require('sequelize');
const sf              = require('sequelize-fixtures');
const assert          = require('assert');
const dbConfig        = locreq('config').db;
const logging         = locreq('logging/logging');

// module object
let db;
let allModels = {};

let sequelize = new Sequelize({
  dialect: 'postgres',
  define: {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  },
  logging: (logging.logLevelAtLeast('trace') ? logging.trace : false),
  ...dbConfig
});

/**
 * add transaction if not available
 * @param {sequelize.Transaction} transaction optional transaction
 * @param {transaction => {...}} callback code to wrap with transaction
 */
sequelize.withTransaction = async (transaction,callback) => {
  return transaction ? callback(transaction) : sequelize.transaction(callback);
};

let stopObservables = false;

module.exports = db = {
  Op: Sequelize.Op,

  sequelize,
  
  Sequelize,

  initialized: false,

  async init({initDb}={}) {
  
    if(this.initialized) return;
    
    const checkAppConfigExistsAndNonEmpty = async () => {
      try {
        return (await db.appConfig.count() > 0);
      }
      catch(error) {
        if(error.message == 'relation "app_config" does not exist')
          return undefined;
        else 
          throw error;
      }
    };
    
    // create database if not exists or force = true
    initDb = initDb == true || (initDb == undefined && ! await checkAppConfigExistsAndNonEmpty());
    if(initDb) {

      const data = locreq('database/seed.js');

      db.hooksEnabled = false;
      // create tables
      await db.sequelize.sync({force: true});

      //load fixtures
      for(let key of Object.keys(data)) {
        await sf.loadFixtures(data[key], db);
      }
      //fix sequences
      await db.fixSequences();
      db.hooksEnabled = true; 
      
    }
    
    this.initialized = true;
    
  },

  modelMapper(mapping) {
    return {
      createInstance,
      readInstance,
      updateInstance,
      deleteInstance,
      mapFromInstance
    };
    function mapFromInstance(instance) {
      let result = {};
      mapping.attributes.forEach(attr => {
        const [ modelProp, resultProp = modelProp ] = _.isString(attr) ? [attr] : attr;
        _.set(result, resultProp, instance.get2(modelProp));
      });
      return result;
    }
    function mapToInstance(data,{dbDataBefore}={}){
      let dbData = Object.assign({}, dbDataBefore);
      mapping.attributes.forEach(attr => {
        const [ modelProp, dataProp = modelProp ] = _.isString(attr) ? [attr] : attr;
        if(_.has(data, dataProp)) {
          _.set(dbData, modelProp, _.get(data, dataProp));
        }
      });
      return dbData;
    }
    async function createInstance(data, {transaction}={}) {
      let dbData = {};
      mapping.attributes.forEach(attr => {
        const [ modelProp, dataProp = modelProp ] = _.isString(attr) ? [attr] : attr;
        _.set(dbData, modelProp, _.get(data,dataProp));
      });
      delete dbData.id;
      const instance = await mapping.model.create(dbData,{transaction});
      return mapFromInstance(instance,mapping);
    }
    async function readInstance(id, {transaction}={}) {
      const instance = await mapping.model.findByPk(id,{transaction});
      return mapFromInstance(instance);
    }
    async function updateInstance(id, data, {transaction}={}) {
      let instance = await mapping.model.findByPk(id,{transaction});
      const dbData = mapToInstance(data, { dbDataBefore: instance.get({plain:true}) });
      instance.changed('data', true); // without this changes in data are not saved to db
      instance = await instance.update(dbData, {transaction});
      return mapFromInstance(instance);
    }
    function deleteInstance(id, {transaction}={}) {
      return mapping.model.destroy({where: {id: id}},{transaction});
    }
  },

  async createOrUpdateForeignKeyConstraint(
    sourceTableName, 
    fkColumnName, 
    targetTable, 
    { targetTableColumName='id', onDelete='SET NULL', onUpdate='CASCADE', transaction }={}
  ) {
    const constraintName = `${sourceTableName}_${fkColumnName}_fkey`;
    await db.sequelize.query(`
      ALTER TABLE ${sourceTableName} 
      DROP CONSTRAINT IF EXISTS ${constraintName};
    `, {transaction} );
    await db.sequelize.query(`
      ALTER TABLE ${sourceTableName} 
      ADD CONSTRAINT ${constraintName} 
      FOREIGN KEY (${fkColumnName}) 
      REFERENCES ${targetTable}(${targetTableColumName}) 
      ON DELETE ${onDelete} ON UPDATE ${onUpdate};
    `, {transaction} );
  },

  async createForeignKey(sourceTableName, fkColumnName, targetTable, { 
    type,
    allowNull,
    targetTableColumName='id',
    onDelete='SET NULL',
    onUpdate='CASCADE',
    transaction
  }={}) {
    await sequelize.queryInterface.addColumn(sourceTableName, fkColumnName, { type, allowNull }, { transaction });
    const constraintName = `${sourceTableName}_${fkColumnName}_fkey`;
    await db.sequelize.query(`ALTER TABLE ${sourceTableName} DROP CONSTRAINT IF EXISTS ${constraintName};`, {transaction} );
    await db.sequelize.query(
      `ALTER TABLE ${sourceTableName} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${fkColumnName}) REFERENCES ${targetTable}(${targetTableColumName}) ON DELETE ${onDelete} ON UPDATE ${onUpdate};`,
      {transaction} 
    );
  },
  async deleteForeignKey(sourceTableName, fkColumnName, { 
    transaction
  }={}) {
    const constraintName = `${sourceTableName}_${fkColumnName}_fkey`;
    await db.sequelize.query(`ALTER TABLE ${sourceTableName} DROP CONSTRAINT IF EXISTS ${constraintName};`, {transaction} );
    await sequelize.queryInterface.removeColumn(sourceTableName, fkColumnName, { transaction });
  },

  async createIndexIfNotExists(tableName, columnName, {transaction}={}) {
    await db.sequelize.query(
      `CREATE INDEX IF NOT EXISTS ${tableName}_${columnName} ON ${tableName} (${columnName});`,
      {transaction} 
    );
  },

  async deleteConstraintIfExists(tableName, constraintName, {transaction}) {
    await db.sequelize.query(
      `ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName};`,
      {transaction}
    );
  },

  async changeEnumType(table, column, enumValues, defaultEnumValue, transaction) {
    let enumValuesSQL = enumValues.map(v=>`'${v}'`).join(',');
    const enumType = `enum_${table}_type`;
    await sequelize.query(
      `-- rename the old enum 
      alter type ${enumType} rename to ${enumType}__;
      -- create the new enum
      create type ${enumType} as enum (${enumValuesSQL});
      -- drop default
      ALTER TABLE ${table} ALTER ${column} DROP DEFAULT;
      -- alter all your enum columns
      alter table ${table}
        alter column ${column} type ${enumType} using ${column}::text::${enumType};
      -- create default
      ALTER TABLE ${table} ALTER ${column} SET DEFAULT '${defaultEnumValue}'::${enumType};
      -- drop the old enum  
      drop type ${enumType}__;`,{transaction}
    );
  },

  // because Symbols (used for Sequelize Operators) are not being converted to JSON
  // works both ways String-Op <-> Symbol-Op
  convertSequelizeOperatorsForSerialization(oldObject) {
    const operatorsMap = {
      '$in': db.Op.in,
      [db.Op.in]: '$in'
    };
    if(_.isObject(oldObject)) {
      let newObject = {};
      for (let key of Reflect.ownKeys(oldObject)) {
        assert(!_.isSymbol(key) || operatorsMap[key], `Sequelize Operator '${key.toString()}' not supported.`);
        let value = oldObject[key];
        newObject[operatorsMap[key] || key] = _.isArray(value)
          ? _.map(value, item => db.convertSequelizeOperatorsForSerialization(item))
          : _.isObject(value)
            ? db.convertSequelizeOperatorsForSerialization(value)
            : value;
      }
      return newObject;
    }
    else {
      return oldObject;
    }
  },
  // fix autoincrement sequences
  // those can get outdated if someone inserts the id 
  // values instead of using autoincrement
  async fixSequences(options) {
    options = options || {};
    // create stored procedure if not exists
    await db.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.reset_sequence(tablename text, columnname text)
        RETURNS void
        LANGUAGE plpgsql
      AS $function$
        DECLARE
        BEGIN
          EXECUTE 'SELECT setval( pg_get_serial_sequence(''' || tablename || ''', ''' || columnname || '''),
          (SELECT COALESCE(MAX(id)+1,1) FROM ' || tablename || '), false)';
        END;
      $function$
    `,options);
    // call stored procedure for each sequence
    await db.sequelize.query(`
      SELECT table_name || '_' || column_name || '_seq', 
        reset_sequence(table_name, column_name) 
      FROM information_schema.columns 
      WHERE column_default like 'nextval%' AND table_schema = 'public'
    `,options);
  },
  
};

// load models from files
function loadModelsFromFiles() {
  let models = {};
  fs
    .readdirSync(path.join(__dirname,'models'))
    .filter(function(file) {
      return (file.indexOf('.') !== 0);
    })
    .forEach(function(file) {
      let model = require(path.join(__dirname, 'models', file))(sequelize, Sequelize.DataTypes);
      models[model.name] = model;
      allModels[model.name] = model;
      db[model.name] = model;
    });
  setModelRelations(models);
}

function setModelRelations(models) {
  for(const [modelName, model] of Object.entries(models)) {
    // classMethods
    if(model.options.classMethods) {
      Object.keys(model.options.classMethods).forEach(methodName => {
        model[methodName] = model.options.classMethods[methodName];
        delete model.options.classMethods[methodName];
      });
    }  
    // instanceMethods
    if(model.options.instanceMethods) {
      Object.keys(model.options.instanceMethods).forEach(methodName => {
        model.prototype[methodName] = model.options.instanceMethods[methodName];
        delete model.options.instanceMethods[methodName];
      });
    }
    // create relations
    if ('associate' in model) {
      model.associate(allModels);
    }
  }
}

loadModelsFromFiles();