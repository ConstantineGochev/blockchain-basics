module.exports = {
    INFURA_PROJECT_ID: '',
    db: {
      host: '',
      database: '',
      username: '',
      password: '',
      pool: {
        max: 5,
        min: 0,
        acquire: 10000,
        idle: 10000
      },
      // initialize/seed database on startup (without deleting any existing tables, etc.)
      initOnStartup: false,
    },
    secret: 'asdasgre333dszDssawe'
};