const crypto = require("crypto");
const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");


const generateToken = () => crypto.randomBytes(32).toString("hex");

// Returns the expiry time for the token (1 hour from now)
const getTokenExpiry = () => new Date(Date.now() + 3600000);

const common = {
  /**
   * Validates the admin's token and refreshes it if expired.
   * @param {string} _token - Provided token
   * @param {number} admin_id - Admin ID
   * @param {function} callback - Callback function
   */
  isAdminTokenValid: async (_token, admin_id, callback) => {
    try {
      const sql = `
        SELECT \`login_token\`, \`token_expiry\`
        FROM \`admins\`
        WHERE \`id\` = ?
      `;
  
      const results = await sequelize.query(sql, {
        replacements: [admin_id],
        type: QueryTypes.SELECT,
      });
  
      if (results.length === 0) {
        return callback({ status: false, message: "Admin not found" }, null);
      }
  
      const currentToken = results[0].login_token;
      const tokenExpiry = new Date(results[0].token_expiry);
      const currentTime = new Date();
  
      if (_token !== currentToken) {
        return callback({ status: false, message: "Invalid token provided" }, null);
      }
  
      if (tokenExpiry > currentTime) {
        return callback(null, { status: true, message: "Token is valid" });
      }
  
      // Token is expired, generate a new one
      const newToken = generateToken();
      const newTokenExpiry = getTokenExpiry();
  
      const updateSql = `
        UPDATE \`admins\`
        SET \`login_token\` = ?, \`token_expiry\` = ?
        WHERE \`id\` = ?
      `;
  
      await sequelize.query(updateSql, {
        replacements: [newToken, newTokenExpiry, admin_id],
        type: QueryTypes.UPDATE,
      });
  
      return callback(null, {
        status: true,
        message: "Token was expired and has been refreshed",
        newToken,
      });
  
    } catch (error) {
      return callback({ status: false, message: "Database error", error }, null);
    }
  },
  

  /**
   * Logs admin login activities.
   * @param {number} admin_id - Admin ID
   * @param {string} action - Action performed
   * @param {string} result - Result of the action
   * @param {string} error - Error message if any
   * @param {function} callback - Callback function
   */
  adminLoginLog: async (
    ipAddress,
    ipType,
    admin_id,
    action,
    result,
    error,
    callback
  ) => {
    const insertSql = `
      INSERT INTO \`admin_login_logs\` (\`admin_id\`, \`action\`, \`result\`, \`error\`, \`client_ip\`, \`client_ip_type\`, \`created_at\`)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    await sequelize.query(insertSql, {
      replacements: [admin_id, action, result, error, ipAddress, ipType], // Positional replacements using ?
      type: QueryTypes.INSERT,
    });
    callback(null, {
      status: true,
      message: "Admin login log entry added successfully",
    });
  },

  /**
   * Logs other admin activities.
   * @param {number} admin_id - Admin ID
   * @param {string} module - Module name
   * @param {string} action - Action performed
   * @param {string} result - Result of the action
   * @param {string} update - Update description
   * @param {string} error - Error message if any
   * @param {function} callback - Callback function
   */
  adminActivityLog: async (
    ipAddress,
    ipType,
    admin_id,
    module,
    action,
    result,
    update,
    error,
    callback
  ) => {
    const insertSql = `
      INSERT INTO \`admin_activity_logs\` (\`admin_id\`, \`module\`, \`action\`, \`result\`, \`update\`, \`error\`, \`client_ip\`, \`client_ip_type\`, \`created_at\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await sequelize.query(insertSql, {
      replacements: [admin_id, module, action, result, update, error, ipAddress, ipType], // Positional replacements using ?
      type: QueryTypes.INSERT,
    });


    callback(null, {
      status: true,
      message: "Admin activity log entry added successfully",
    });


  },

  /**
   * Checks if the admin is authorized for a specific action.
   * @param {number} admin_id - Admin ID
   * @param {string} action - Action performed
   * @param {function} callback - Callback function
   */
  isAdminAuthorizedForAction: async (admin_id, action, callback) => {
    const adminSQL = `SELECT \`role\`, \`permissions\` FROM \`admins\` WHERE \`id\` = ?`;

    const results = await sequelize.query(adminSQL, {
      replacements: [admin_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length === 0) {
      return callback({ status: false, message: "Admin ID not found." }, null);
    }

    const role = results[0].role;
    let permissions = {};

    try {
      permissions = results[0].permissions ? JSON.parse(results[0].permissions) : {};
    } catch (jsonError) {
      console.error("Invalid JSON format for permissions:", jsonError);
      
      return callback({ status: false, message: "Invalid permissions data format.", error: jsonError }, null);
    }

    if (role === "admin_user") {
      return callback({ status: true, message: "Admin has full access." });
    }

    if (permissions && permissions[action] === true) {
      return callback({ status: true, message: `Access Granted.` });
    } else {
      return callback({ status: false, message: `Access Denied.` });
    }
  }
};

module.exports = common;
