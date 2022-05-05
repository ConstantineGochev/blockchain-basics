/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  const blockModel = sequelize.define('block', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      hash: {
        type: DataTypes.STRING,
        allowNull: false
      },
      blockNumber: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      transactionCount: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      tableName: 'block',
      classMethods: {
        associate: function(models) {
        },
      },
      instanceMethods: {
      },
      timestamps: true
    });
    return blockModel;
};