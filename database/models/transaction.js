/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
    const transaction = sequelize.define('transaction', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        hash: {
          type: DataTypes.STRING,
          allowNull: false
        },
        data: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        from: {
          type: DataTypes.STRING,
          allowNull: false
        },
        to: {
          type: DataTypes.STRING,
          allowNull: true
        },
        tokenAddress: {
          type: DataTypes.STRING,
          allowNull: true
        },
        method: {
          type: DataTypes.STRING,
          allowNull: true  
        }
      }, {
        tableName: 'transaction',
        classMethods: {
          associate: function(models) {
            transaction.belongsTo(models.block, {
              foreignKey: 'blockId'
            });
            transaction.belongsTo(models.appConfig, { 
              foreignKey: 'appConfigId'
            });
          },
        },
        instanceMethods: {
        },
        timestamps: true
      });
      return transaction;
  };