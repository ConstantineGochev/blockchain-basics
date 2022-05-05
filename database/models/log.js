/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  const logModel =  sequelize.define('log', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true
    },
    logLevel: {
      type: DataTypes.STRING,
      field: 'log_level',
      allowNull: false
    },
    logMessage: {
      type: DataTypes.TEXT,
      field: 'log_message',
      allowNull: false
    },
    elementName: {
      type: DataTypes.STRING,
      field: 'element_name',
      allowNull: true
    },
    elementId: {
      type: DataTypes.STRING,
      field: 'element_id',
      allowNull: true
    },
    hostName: {
      type: DataTypes.STRING,
      field: 'host_name',
      allowNull: true      
    },
    user: {
      type: DataTypes.STRING,
      field: 'user',
      allowNull: true   
    },
    pid: {
      type: DataTypes.STRING,
      allowNull: true      
    }
  }, {
    tableName: 'log',
    classMethods: {
      associate: function(models) {
      },
    }
  });
  return logModel;
};