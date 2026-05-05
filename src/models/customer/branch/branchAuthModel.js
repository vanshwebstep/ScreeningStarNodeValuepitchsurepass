const crypto = require("crypto");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../../config/db");


const Branch = {
  findByEmailOrMobile: async (username, callback) => {

    // Query the branches table and join with customer_metas
    const sqlBranches = `
        SELECT 
          'branch' AS type, 
          b.\`id\`, 
          b.\`id\` AS branch_id, 
          b.\`customer_id\`, 
          b.\`name\`, 
          b.\`email\`, 
          b.\`status\`, 
          b.\`login_token\`, 
          b.\`token_expiry\`, 
          b.\`otp\`, 
          b.\`two_factor_enabled\`, 
          b.\`otp_expiry\`, 
          cm.\`custom_logo\`,
          cm.\`custom_template\`,
          cm.\`logo\`
        FROM \`branches\` b
        LEFT JOIN \`customer_metas\` cm ON b.\`customer_id\` = cm.\`customer_id\`
        WHERE b.\`email\` = ?
      `;
    const branchResults = await sequelize.query(sqlBranches, {
      replacements: [username], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (branchResults.length > 0) {
      // If found in branches, return the result with custom_logo
      return callback(null, branchResults);
    }

    // If not found in branches, query the branch_sub_users table and join with customer_metas
    const sqlSubUsers = `
          SELECT 
            'sub_user' AS type, 
            su.\`id\`, 
            su.\`branch_id\`, 
            su.\`customer_id\`, 
            su.\`email\`, 
            su.\`status\`, 
            su.\`login_token\`, 
            su.\`token_expiry\`, 
            su.\`otp\`, 
            su.\`two_factor_enabled\`, 
            su.\`otp_expiry\`, 
            cm.\`custom_logo\`,
            cm.\`custom_template\`
          FROM \`branch_sub_users\` su
          LEFT JOIN \`customer_metas\` cm ON su.\`customer_id\` = cm.\`customer_id\`
          WHERE su.\`email\` = ?
        `;
    const subUserResults = await sequelize.query(sqlSubUsers, {
      replacements: [username], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (subUserResults.length === 0) {
      // No record found in either table
      return callback(
        { message: "No branch or sub-user found with the provided email" },
        null
      );
    }
    callback(null, subUserResults);
  },

  findByEmailOrMobileAllInfo: async (username, callback) => {
    try {
      // 1. Query the branches table and join with customer_metas
      const sqlBranches = `
      SELECT 
        'branch' AS type, 
        b.*, 
        cm.\`custom_logo\`,
        cm.\`custom_template\`,
        cm.\`logo\`
      FROM \`branches\` b
      LEFT JOIN \`customer_metas\` cm ON b.\`customer_id\` = cm.\`customer_id\`
      WHERE b.\`email\` = ?
      -- OR b.\`mobile\` = ? -- Uncomment if you want to check mobile too
    `;

      const branchResults = await sequelize.query(sqlBranches, {
        replacements: [username], // Add username again if you include mobile
        type: QueryTypes.SELECT,
      });

      if (branchResults.length > 0) {
        return callback(null, branchResults);
      }

      // 2. Query the branch_sub_users table and join with customer_metas
      const sqlSubUsers = `
      SELECT 
        'sub_user' AS type, 
        su.*, 
        cm.\`custom_logo\`,
        cm.\`custom_template\`
      FROM \`branch_sub_users\` su
      LEFT JOIN \`customer_metas\` cm ON su.\`customer_id\` = cm.\`customer_id\`
      WHERE su.\`email\` = ?
      -- OR su.\`mobile\` = ? -- Uncomment if you want to check mobile too
    `;

      const subUserResults = await sequelize.query(sqlSubUsers, {
        replacements: [username], // Add username again if you include mobile
        type: QueryTypes.SELECT,
      });

      if (subUserResults.length === 0) {
        return callback(
          { message: "No branch or sub-user found with the provided email" },
          null
        );
      }

      return callback(null, subUserResults);
    } catch (error) {
      console.error("Error in findByEmailOrMobileAllInfo:", error);
      return callback({ message: "An error occurred while fetching user info", error }, null);
    }
  },

  setResetPasswordToken: async (id, type, token, tokenExpiry, callback) => {
    const table = type === "branch" ? "branches" : "branch_sub_users";
    let sql = `
        UPDATE \`${table}\`
        SET \`reset_password_token\` = ?, \`password_token_expiry\` = ?
        WHERE \`id\` = ?
      `;

    const results = await sequelize.query(sql, {
      replacements: [token, tokenExpiry, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });

    if (results.affectedRows === 0) {
      return callback(
        {
          message:
            "Token update failed. Branch not found or no changes made.",
        },
        null
      );
    }

    callback(null, results);
  },

  validatePassword: async (email, password, type, callback) => {
    const table = type === "branch" ? "branches" : "branch_sub_users";
    let sql = `
        SELECT \`id\`
        FROM \`${table}\`
        WHERE \`email\` = ?
        AND (\`password\` = MD5(?) OR \`password\` = ?)
      `;

    const results = await sequelize.query(sql, {
      replacements: [email, password, password], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (results.length > 0) {
      return callback(null, true);
    } else {
      return callback(null, false);
    }

  },

  updatePassword: async (new_password, branch_id, type, callback) => {
    try {


      const normalizedType = type.toLowerCase();
      const table = normalizedType === "branch" || normalizedType === "branches" ? "branches" : "branch_sub_users";


      // Check if id exists first
      const checkSql = `SELECT id FROM \`${table}\` WHERE id = ?`;
      const checkResult = await sequelize.query(checkSql, {
        replacements: [branch_id],
        type: QueryTypes.SELECT,
      });
      console.log(`🔍 Checking if id ${branch_id} exists in ${table}:`, checkResult);

      if (checkResult.length === 0) {
        return callback({ message: `No record found with id ${branch_id} in table ${table}` }, null);
      }

      // Now run update query
      const sql = `UPDATE \`${table}\` 
                 SET \`password\` = MD5(?), 
                     \`reset_password_token\` = null, 
                     \`login_token\` = null, 
                     \`token_expiry\` = null, 
                     \`password_token_expiry\` = null 
                 WHERE \`id\` = ?`;


      const results = await sequelize.query(sql, {
        replacements: [new_password, branch_id],
        type: QueryTypes.UPDATE,
      });

      const affectedRows = results?.affectedRows || results?.[1] || 0;

      if (affectedRows === 0) {
        console.warn("⚠️ No rows affected - possibly invalid branch_id.");
        return callback(
          {
            message: "Branch not found or password not updated. Please check the provided details.",
          },
          null
        );
      }

      return callback(null, {
        message: "Password updated successfully.",
        affectedRows,
      });
    } catch (error) {
      console.error("❌ Error occurred during password update:", error);
      return callback({ message: "Internal server error.", error }, null);
    }
  },

  updateOTP: async (branch_id, type, otp, otp_expiry, callback) => {
    // Determine which table to update based on the type
    const table = type === "branch" ? "branches" : "branch_sub_users";

    // The SQL query for updating OTP and clearing tokens
    const sql = `
        UPDATE \`${table}\`
        SET \`otp\` = ?, \`otp_expiry\` = ?, \`reset_password_token\` = NULL, \`login_token\` = NULL, \`token_expiry\` = NULL, \`password_token_expiry\` = NULL
        WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [otp, otp_expiry, branch_id],
      type: QueryTypes.UPDATE,
    });

    if (results.affectedRows === 0) {
      return callback(
        {
          message:
            "Branch or sub-user not found or OTP not updated. Please check the provided details.",
        },
        null
      );
    }

    callback(null, {
      message: "OTP updated successfully.",
      affectedRows: results.affectedRows,
    });
  },

  updateToken: async (id, token, tokenExpiry, type, callback) => {

    let sql;
    if (type === "branch") {
      sql = `
        UPDATE \`branches\`
        SET \`login_token\` = ?, \`token_expiry\` = ?
        WHERE \`id\` = ?
      `;
    } else if (type === "sub_user") {
      sql = `
        UPDATE \`branch_sub_users\`
        SET \`login_token\` = ?, \`token_expiry\` = ?
        WHERE \`id\` = ?
      `;
    } else {
      return callback(
        { message: "Undefined user trying to login", error: err },
        null
      );
    }
    const results = await sequelize.query(sql, {
      replacements: [token, tokenExpiry, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });

    if (results.affectedRows === 0) {
      return callback(
        {
          message:
            "Token update failed. Branch not found or no changes made.",
        },
        null
      );
    }

    callback(null, results);


  },

  validateLogin: async (id, callback) => {

    const sql = `
        SELECT \`login_token\`, \`token_expiry\`
        FROM \`branches\`
        WHERE \`id\` = ?
      `;

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (results.length === 0) {
      return callback({ message: "Branch not found" }, null);
    }

    callback(null, results);


  },

  // Clear login token and token expiry
  logout: async (sub_user_id, branch_id, callback) => {
    if (sub_user_id && sub_user_id.trim() !== "") {
      const sql = `
                UPDATE \`branch_sub_users\`
                SET \`login_token\` = NULL, \`token_expiry\` = NULL
                WHERE \`id\` = ? AND \`branch_id\` = ?
            `;
      const results = await sequelize.query(sql, {
        replacements: [sub_user_id, branch_id], // Positional replacements using ?
        type: QueryTypes.UPDATE,
      });

      if (results.affectedRows === 0) {
        return callback(
          {
            message:
              "Token clear failed. Sub-user not found or no changes made.",
          },
          null
        );
      }

      return callback(null, results);

    } else {
      // If sub_user_id is null or empty, update the branches table
      const sql = `
                UPDATE \`branches\`
                SET \`login_token\` = NULL, \`token_expiry\` = NULL
                WHERE \`id\` = ?
            `;
      const results = await sequelize.query(sql, {
        replacements: [branch_id], // Positional replacements using ?
        type: QueryTypes.UPDATE,
      });
      if (results.affectedRows === 0) {
        return callback(
          {
            message:
              "Token clear failed. Branch not found or no changes made.",
          },
          null
        );
      }

      return callback(null, results);

    }

  },

  findById: async (sub_user_id, branch_id, callback) => {

    let sql = "";
    let queryParams = [];

    // Build SQL query based on the presence of sub_user_id
    if (sub_user_id && sub_user_id.trim() !== "") {
      sql = `
          SELECT \`id\`, \`customer_id\`, \`email\`, \`status\`, \`login_token\`, \`token_expiry\`
          FROM \`branch_sub_users\`
          WHERE \`branch_id\` = ? AND \`id\` = ?
        `;
      queryParams = [branch_id, sub_user_id];
    } else {
      sql = `
          SELECT \`id\`, \`customer_id\`, \`name\`, \`email\`, \`status\`, \`login_token\`, \`token_expiry\`
          FROM \`branches\`
          WHERE \`id\` = ?
        `;
      queryParams = [branch_id];
    }

    const results = await sequelize.query(sql, {
      replacements: queryParams, // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (results.length === 0) {
      return callback({ message: "Branch or sub_user not found" }, null);
    }

    // Return the first result (should be one result if ID is unique)
    callback(null, results[0]);


  },

  isBranchActive: async (id, callback) => {

    const sql = `
        SELECT \`status\`
        FROM \`branches\`
        WHERE \`id\` = ?
      `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (results.length === 0) {
      return callback({ message: "Branch not found" }, null);
    }

    const isActive = results[0].status == 1;
    callback(null, { isActive });
  },

  isBranchSubUserActive: async (id, callback) => {

    const sql = `
        SELECT \`status\`
        FROM \`branch_sub_users\`
        WHERE \`id\` = ?
      `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (results.length === 0) {
      return callback({ message: "Branch not found" }, null);
    }

    const isActive = results[0].status == 1;
    callback(null, { isActive });


  },

  isCustomerActive: async (customerID, callback) => {
    const sql = `
    SELECT \`status\`
    FROM \`customers\`
    WHERE \`id\` = ? AND is_deleted != 1
  `;
    const results = await sequelize.query(sql, {
      replacements: [customerID], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (results.length === 0) {
      return callback({ message: "Customer not found" }, null);
    }
    const isActive = results[0].status == 1;
    callback(null, { isActive });


  },
};

module.exports = Branch;
