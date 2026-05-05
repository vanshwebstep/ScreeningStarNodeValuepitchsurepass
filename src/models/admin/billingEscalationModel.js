const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const BillingEscalation = {
  create: (name, designation, phone, email, admin_id, callback) => {
    // Step 1: Check if a billing escalation with the same name already exists
    const checkBillingEscalationSql = `
      SELECT * FROM \`billing_escalations\` WHERE \`name\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        checkBillingEscalationSql,
        [name],
        (checkErr, billingEscalationResults) => {
          if (checkErr) {
            console.error("Error checking billing escalation:", checkErr);
             // Release connection on error
            return callback(checkErr, null);
          }

          // Step 2: If a billing escalation with the same name exists, return an error
          if (billingEscalationResults.length > 0) {
            const error = new Error(
              "Billing SPOC with the same name already exists"
            );
            console.error(error.message);
             // Release connection before returning error
            return callback(error, null);
          }

          // Step 3: Insert the new billing escalation
          const insertBillingEscalationSql = `
          INSERT INTO \`billing_escalations\` (\`name\`, \`designation\`, \`phone\`, \`email\`, \`admin_id\`)
          VALUES (?, ?, ?, ?, ?)
        `;

          connection.query(
            insertBillingEscalationSql,
            [name, designation, phone, email, admin_id],
            (insertErr, results) => {
               // Release the connection

              if (insertErr) {
                console.error("Database query error: 27", insertErr);
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
    const sql = `SELECT 1 FROM \`billing_escalations\` WHERE email = ? LIMIT 1`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [email], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 28", queryErr);
          return callback(queryErr, null);
        }

        // Return true if the email exists, else false
        const emailExists = results.length > 0;
        callback(null, emailExists);
      });
    });
  },

  list: async (callback) => {
    const sql = `SELECT * FROM \`billing_escalations\``;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    callback(null, results);


  },

  getBillingEscalationById: (id, callback) => {
    const sql = `SELECT * FROM \`billing_escalations\` WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 30", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results[0]);
      });
    });
  },

  update: (id, name, designation, phone, email, callback) => {
    const sql = `
      UPDATE \`billing_escalations\`
      SET \`name\` = ?, \`designation\` = ?, \`phone\` = ?, \`email\` = ?
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [name, designation, phone, email, id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error(" 51", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },

  delete: (id, callback) => {
    const sql = `
      DELETE FROM \`billing_escalations\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 31", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },
};

module.exports = BillingEscalation;
