const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const AuthorizedDetail = {
  create: async (name, designation, phone, email, admin_id, callback) => {
    // Step 1: Check if a billing escalation with the same name already exists
    const checkAuthorizedDetailSql = `
      SELECT * FROM \`authorized_details\` WHERE \`name\` = ?
    `;

    const authorizedDetailResults = await sequelize.query(checkAuthorizedDetailSql, {
      replacements: [name], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    const insertAuthorizedDetailSql = `
          INSERT INTO \`authorized_details\` (\`name\`, \`designation\`, \`phone\`, \`email\`, \`admin_id\`)
          VALUES (?, ?, ?, ?, ?)
        `;
    const results = await sequelize.query(insertAuthorizedDetailSql, {
      replacements: [name, designation, phone, email, admin_id],
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  },

  checkEmailExists: (email, callback) => {
    const sql = `SELECT 1 FROM \`authorized_details\` WHERE email = ? LIMIT 1`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [email], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 23", queryErr);
          return callback(queryErr, null);
        }

        // Return true if the email exists, else false
        const emailExists = results.length > 0;
        callback(null, emailExists);
      });
    });
  },

  list: async (callback) => {
    const sql = `SELECT * FROM \`authorized_details\``;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    callback(null, results);

  },

  getAuthorizedDetailById: (id, callback) => {
    const sql = `SELECT * FROM \`authorized_details\` WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 25", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results[0]);
      });
    });
  },

  update:async (id, name, designation, phone, email, callback) => {
    const sql = `
      UPDATE \`authorized_details\`
      SET \`name\` = ?, \`designation\` = ?, \`phone\` = ?, \`email\` = ?
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [name, designation, phone, email, id],
      type: QueryTypes.SELECT,
    });
        callback(null, results);

  },
  delete: (id, callback) => {
    const sql = `
      DELETE FROM \`authorized_details\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 26", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },
};

module.exports = AuthorizedDetail;
