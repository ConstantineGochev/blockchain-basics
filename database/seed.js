// data to be seeded to the database
module.exports = {
  appConfigs: [
      {
        model: 'appConfig',
        data: {
          id: 1,
          type: 'delayed',
          inUse: true,
        }
      },
      {
        model: 'appConfig',
        data: {
          id: 2,
          type: 'live',
          inUse: true,
        }
      }
  ]
};