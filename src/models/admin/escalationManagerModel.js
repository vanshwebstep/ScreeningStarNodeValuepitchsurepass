const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const EscalationManager = {
  create: (name, designation, phone, email, admin_id, callback) => {
    // Step 1: Check if a escalation manager with the same name already exists
    const checkEscalationManagerSql = `
      SELECT * FROM \`escalation_managers\` WHERE \`name\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        checkEscalationManagerSql,
        [name],
        (checkErr, escalationManagerResults) => {
          if (checkErr) {
            console.error("Error checking escalation manager:", checkErr);
             // Release connection on error
            return callback(checkErr, null);
          }

          // Step 2: If a escalation manager with the same name exists, return an error
          if (escalationManagerResults.length > 0) {
            const error = new Error(
              "Billing SPOC with the same name already exists"
            );
            console.error(error.message);
             // Release connection before returning error
            return callback(error, null);
          }

          // Step 3: Insert the new escalation manager
          const insertEscalationManagerSql = `
          INSERT INTO \`escalation_managers\` (\`name\`, \`designation\`, \`phone\`, \`email\`, \`admin_id\`)
          VALUES (?, ?, ?, ?, ?)
        `;

          connection.query(
            insertEscalationManagerSql,
            [name, designation, phone, email, admin_id],
            (insertErr, results) => {
               // Release the connection

              if (insertErr) {
                console.error("Database query error: 46", insertErr);
                return callback(insertErr, null);
              }
              callback(null, results);
            }
          );
        }
      );
    });
  },

  checkEmailExists: (email, callback) => {
    const sql = `SELECT 1 FROM \`escalation_managers\` WHERE email = ? LIMIT 1`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [email], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 47", queryErr);
          return callback(queryErr, null);
        }

        // Return true if the email exists, else false
        const emailExists = results.length > 0;
        callback(null, emailExists);
      });
    });
  },

  list:async (callback) => {
    const sql = `SELECT * FROM \`escalation_managers\``;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
        callback(null, results);
  },

  getEscalationManagerById: (id, callback) => {
    const sql = `SELECT * FROM \`escalation_managers\` WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 49", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results[0]);
      });
    });
  },

  update: (id, name, designation, phone, email, callback) => {
    const sql = `
      UPDATE \`escalation_managers\`
      SET \`name\` = ?, \`designation\` = ?, \`phone\` = ?, \`email\` = ?
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        sql,
        [name, designation, phone, email, id],
        (queryErr, results) => {
           // Release the connection

          if (queryErr) {
            console.error(" 51", queryErr);
            return callback(queryErr, null);
          }
          callback(null, results);
        }
      );
    });
  },

  delete: (id, callback) => {
    const sql = `
      DELETE FROM \`escalation_managers\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 51", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },
};

module.exports = EscalationManager;
