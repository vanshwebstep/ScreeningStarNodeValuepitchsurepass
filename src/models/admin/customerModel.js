const { sequelize } = require("../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");
const Admin = {
  findByEmailOrMobile: async (username, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`status\`, \`login_token\`, \`token_expiry\`
      FROM \`admins\`
      WHERE \`email\` = ? OR \`mobile\` = ?
    `;


    const results = await sequelize.query(sql, {
      replacements: [username, username], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length === 0) {
      return callback(
        { message: "No admin found with the provided email or mobile" },
        null
      );
    }

    callback(null, results);


  },

  validatePassword: async (username, password, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`status\`
      FROM \`admins\`
      WHERE (\`email\` = ? OR \`mobile\` = ?)
      AND \`password\` = MD5(?)
    `;

    const results = await sequelize.query(sql, {
      replacements: [username, username, password], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });


    if (results.length === 0) {
      return callback(
        { message: "Incorrect password or username" },
        null
      );
    }

    callback(null, results);


  },

  updateToken:async  (id, token, tokenExpiry, callback) => {
    const sql = `
      UPDATE \`admins\`
      SET \`login_token\` = ?, \`token_expiry\` = ?
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
                "Token update failed. Admin not found or no changes made.",
            },
            null
          );
        }

        callback(null, results);
  },

  validateLogin:async  (id, callback) => {
    const sql = `
      SELECT \`login_token\`
      FROM \`admins\`
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

        if (results.length === 0) {
          return callback({ message: "Admin not found" }, null);
        }

        callback(null, results);
    
   
  },

  // Clear login token and token expiry
  logout:async  (id, callback) => {
    const sql = `
      UPDATE \`admins\`
      SET \`login_token\` = NULL, \`token_expiry\` = NULL
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token clear failed. Admin not found or no changes made.",
            },
            null
          );
        }

        callback(null, results);
  },
};

module.exports = Admin;
