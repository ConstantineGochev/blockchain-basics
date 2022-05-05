module.exports = function(sequelize, DataTypes) {
    const depositModel = sequelize.define('deposit', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        blockchainTxId: {
          type: DataTypes.STRING,
          allowNull: false
        },
        amount: {
          type: DataTypes.STRING,
          allowNull: false
        },
        type: {
          type:  DataTypes.ENUM('ether', 'erc20'),
          allowNull: false
        },
        tokenAddress: {
          type: DataTypes.STRING,
          allowNull: true
        },
        blockNumber: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false
        }
      }, {
        tableName: 'deposit',
        classMethods: {
          associate: function(models) {
          },
        },
        instanceMethods: {
        },
        timestamps: true
      });
      return depositModel;
  };