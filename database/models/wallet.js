/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
    const walletModel = sequelize.define('wallet', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      address: {
        type: DataTypes.STRING,
        allowNull: false
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      privateKey: {
        type: DataTypes.STRING,
        allowNull: false
      }
    }, {
      tableName: 'wallet',
      classMethods: {
        associate: function(models) {
        },
      },
      instanceMethods: {
      },
    });
    return walletModel;
  };