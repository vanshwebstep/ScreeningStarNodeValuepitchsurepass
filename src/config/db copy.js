require("dotenv").config();
const mysql = require("mysql2");

/*
// Validate critical environment variables
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
  console.error(
    "Missing critical environment variables. Please check your .env file."
  );
  process.exit(1);
}
*/

// Assign environment variables with fallbacks
const dbHost = process.env.DB_HOST || "localhost";
const dbUser = process.env.DB_USER || "screeningstar";
const dbName = process.env.DB_NAME || "screeningstar";

let dbPassword = process.env.DB_PASSWORD || "ScreeningStar@135";
// let dbPassword = process.env.DB_PASSWORD || "";
if (process.env.DB_HOST == "local") {
  dbPassword = process.env.DB_PASSWORD || "";
}

// Log environment variables for debugging (optional, avoid in production)
console.log("DB_HOST:", dbHost);
console.log("DB_USER:", dbUser);
console.log("DB_NAME:", dbName);

// Create a connection pool
const pool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 120000, // 2 minutes for individual connection attempts
});

// Function to start a connection with retry mechanism
const startConnection = (callback, retries = 20) => {
  if (typeof callback !== "function") {
    throw new Error("Callback must be a function");
  }

  const attemptConnection = (retriesLeft) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error(`Error getting connection from pool: ${err.message}`);
        if (retriesLeft > 0) {
          console.log(
            `Connection attempt failed. Retrying... (${retriesLeft} attempts left)`
          );
          setTimeout(() => attemptConnection(retriesLeft - 1), 500);
        } else {
          callback(err, null);
        }
      } else if (connection.state === "disconnected") {
        console.warn("Connection is disconnected. Retrying...");
        connection.release();
        attemptConnection(retriesLeft - 1);
      } else {
        console.log("Connection established");
        callback(null, connection);
      }
    });
  };

  attemptConnection(retries);
};

// Function to release a connection
const connectionRelease = (connection) => {
  // console.log("connectionRelease called"); // Log function entry

  if (connection) {
    // console.log("Valid connection found, attempting to release...");

    try {
      connection.release(); // Release the connection back to the pool
      console.log("Connection successfully released back to the pool");
    } catch (err) {
      console.error("Error releasing connection:", err.message);
      console.debug("Error details:", err); // Log full error details for debugging
    }
  } else {
    console.warn("No valid connection to release");
  }

  // console.log("connectionRelease function execution completed");
};

module.exports = { pool, startConnection, connectionRelease };