const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const BillingSpoc = {
  create: (name, designation, phone, email, admin_id, callback) => {
    // Step 1: Check if a billing spoc with the same name already exists
    const checkBillingSpocSql = `
      SELECT * FROM \`billing_spocs\` WHERE \`name\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        checkBillingSpocSql,
        [name],
        (checkErr, billingSpocResults) => {
          if (checkErr) {
            console.error("Error checking billing spoc:", checkErr);
             // Release connection on error
            return callback(checkErr, null);
          }

          // Step 2: If a billing spoc with the same name exists, return an error
          if (billingSpocResults.length > 0) {
            const error = new Error(
              "Billing SPOC with the same name already exists"
            );
            console.error(error.message);
             // Release connection before returning error
            return callback(error, null);
          }

          // Step 3: Insert the new billing spoc
          const insertBillingSpocSql = `
          INSERT INTO \`billing_spocs\` (\`name\`, \`designation\`, \`phone\`, \`email\`, \`admin_id\`)
          VALUES (?, ?, ?, ?, ?)
        `;

          connection.query(
            insertBillingSpocSql,
            [name, designation, phone, email, admin_id],
            (insertErr, results) => {
               // Release the connection

              if (insertErr) {
                console.error("Database query error: 32", insertErr);
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
    const sql = `SELECT 1 FROM \`billing_spocs\` WHERE email = ? LIMIT 1`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [email], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 33", queryErr);
          return callback(queryErr, null);
        }

        // Return true if the email exists, else false
        const emailExists = results.length > 0;
        callback(null, emailExists);
      });
    });
  },

  list:async (callback) => {
    const sql = `SELECT * FROM \`billing_spocs\``;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
        callback(null, results);
  
  },

  getBillingSpocById: (id, callback) => {
    const sql = `SELECT * FROM \`billing_spocs\` WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 35", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results[0]);
      });
    });
  },

  update: (id, name, designation, phone, email, callback) => {
    const sql = `
      UPDATE \`billing_spocs\`
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
      DELETE FROM \`billing_spocs\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 36", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },
};

module.exports = BillingSpoc;
