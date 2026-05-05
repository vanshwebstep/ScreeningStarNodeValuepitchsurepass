const crypto = require("crypto");
const { sequelize } = require("../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");
// Generates a new random token
const generateToken = () => crypto.randomBytes(32).toString("hex");

// Returns the expiry time for the token (1 hour from now)
const getTokenExpiry = () => new Date(Date.now() + 3600000);

const common = {
  /**
   * Validates the customer's token and refreshes it if expired.
   * @param {string} _token - Provided token
   * @param {number} customer_id - Customer ID
   * @param {function} callback - Callback function
   */
  isCustomerTokenValid:async  (_token, customer_id, callback) => {
    if (typeof callback !== "function") {
      console.error("Callback is not a function 1");
      return;
    }

   
      const sql = `
        SELECT \`login_token\`, \`token_expiry\`
        FROM \`customers\`
        WHERE \`id\` = ? AND is_deleted != 1
      `;
      const results = await sequelize.query(sql, {
        replacements: [customer_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
       
        if (results.length === 0) {
          
          return callback(
            { status: false, message: "Customer not found" },
            null
          );
        }

        const currentToken = results[0].login_token;
        const tokenExpiry = new Date(results[0].token_expiry);
        const currentTime = new Date();

        if (_token !== currentToken) {
          
          return callback(
            { status: false, message: "Invalid token provided" },
            null
          );
        }

        if (tokenExpiry > currentTime) {
          
          callback(null, { status: true, message: "Token is valid" });
        } else {
          const newToken = generateToken();
          const newTokenExpiry = getTokenExpiry();

          const updateSql = `
            UPDATE \`customers\`
            SET \`login_token\` = ?, \`token_expiry\` = ?
            WHERE \`id\` = ?
          `;
       await sequelize.query(updateSql, {
            replacements: [newToken, newTokenExpiry, customer_id], // Positional replacements using ?
            type: QueryTypes.UPDATE,
          });
              callback(null, {
                status: true,
                message: "Token was expired and has been refreshed",
                newToken,
              });
           
        }

  },

  /**
   * Logs customer login activities.
   * @param {number} customer_id - Customer ID
   * @param {string} action - Action performed
   * @param {string} result - Result of the action
   * @param {string} error - Error message if any
   * @param {function} callback - Callback function
   */
  customerLoginLog: async (customer_id, action, result, error, callback) => {
    if (typeof callback !== "function") {
      console.error("Callback is not a function 2");
      return;
    }

      const insertSql = `
        INSERT INTO \`customer_login_logs\` (\`customer_id\`, \`action\`, \`result\`, \`error\`, \`created_at\`)
        VALUES (?, ?, ?, ?, NOW())
      `;
      await sequelize.query(insertSql, {
        replacements: [customer_id, action, result, error], // Positional replacements using ?
        type: QueryTypes.INSERT,
      });
          callback(null, {
            status: true,
            message: "Customer login log entry added successfully",
          });
       
   
  },

  /**
   * Logs other customer activities.
   * @param {number} customer_id - Customer ID
   * @param {string} module - Module name
   * @param {string} action - Action performed
   * @param {string} result - Result of the action
   * @param {string} update - Update description
   * @param {string} error - Error message if any
   * @param {function} callback - Callback function
   */
  customerActivityLog: async(
    customer_id,
    module,
    action,
    result,
    update,
    error,
    callback
  ) => {
    if (typeof callback !== "function") {
      console.error("Callback is not a function 3");
      return;
    }

      const insertSql = `
        INSERT INTO \`customer_activity_logs\` (\`customer_id\`, \`module\`, \`action\`, \`result\`, \`update\`, \`error\`, \`created_at\`)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;
    await sequelize.query(insertSql, {
        replacements: [customer_id, module, action, result, update, error], // Positional replacements using ?
        type: QueryTypes.INSERT,
      });

          callback(null, {
            status: true,
            message: "Customer activity log entry added successfully",
          });
      
  
  },
};

module.exports = common;
