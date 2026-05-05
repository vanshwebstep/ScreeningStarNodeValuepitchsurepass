require("dotenv").config();
const { Sequelize } = require("sequelize");

const dbConnectionCredentials = {
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME
};
console.log("dbConnectionCredentials:", dbConnectionCredentials);

const sequelize = new Sequelize(dbConnectionCredentials.DB_NAME, dbConnectionCredentials.DB_USER, dbConnectionCredentials.DB_PASSWORD, {
  host: dbConnectionCredentials.DB_HOST,   // Change this if using a remote DB
  dialect: "mysql",    // Set the dialect (mysql, postgres, sqlite, mssql)
  logging: false,      // Optional: Disable console logs
});

// Retry logic for initial DB connection
async function connectWithRetry(retries = 5, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      await sequelize.authenticate();
      console.log("Database connected successfully.");
      return;
    } catch (err) {
      console.error(`DB connection failed [${i + 1}/${retries}]:`, err.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        console.error("All DB connection attempts failed.");
        process.exit(1);
      }
    }
  }
}

// Handle unhandled promise rejections globally
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
  // Optionally notify or log to a monitoring service here
});

connectWithRetry();

sequelize
  .authenticate()
  .then(() => console.log("Database connected successfully."))
  .catch((err) => console.error("Database connection error:", err));

module.exports = { sequelize };
