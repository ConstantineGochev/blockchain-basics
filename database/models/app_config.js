/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
    const appConfigModel =  sequelize.define('appConfig', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
      },
      type: {
        type: DataTypes.ENUM('live', 'delayed'),
        allowNull: false
      },
      inUse: {
        type: DataTypes.BOOLEAN,
        allowNull: false
      }
    }, {
      tableName: 'app_config',
      classMethods: {
        associate: function(models) {
        },
      }
    });
    return appConfigModel;
  };