const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const ClientSpoc = {
  create: (
    name,
    designation,
    phone,
    email,
    email1,
    email2,
    email3,
    email4,
    admin_id,
    callback
  ) => {
    // Step 1: Check if a escalation manager with the same name already exists
    const checkClientSpocSql = `
      SELECT * FROM \`client_spocs\` WHERE \`name\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        checkClientSpocSql,
        [name],
        (checkErr, clientSpocResults) => {
          if (checkErr) {
            console.error("Error checking escalation manager:", checkErr);
             // Release connection on error
            return callback(checkErr, null);
          }

          // Step 2: If a escalation manager with the same name exists, return an error
          if (clientSpocResults.length > 0) {
            const error = new Error(
              "Billing SPOC with the same name already exists"
            );
            console.error(error.message);
             // Release connection before returning error
            return callback(error, null);
          }

          // Step 3: Insert the new escalation manager
          const insertClientSpocSql = `
          INSERT INTO \`client_spocs\` (\`name\`, \`designation\`, \`phone\`, \`email\`, \`email1\`, \`email2\`, \`email3\`, \`email4\`, \`admin_id\`)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

          connection.query(
            insertClientSpocSql,
            [
              name,
              designation,
              phone,
              email,
              email1,
              email2,
              email3,
              email4,
              admin_id,
            ],
            (insertErr, results) => {
               // Release the connection

              if (insertErr) {
                console.error("Database query error: 52", insertErr);
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
    const sql = `SELECT 1 FROM \`client_spocs\` WHERE \`email\` = ? OR \`email1\` = ? OR \`email2\` = ? OR \`email3\` = ? OR \`email4\` = ? LIMIT 1`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        sql,
        [email, email, email, email, email],
        (queryErr, results) => {
           // Release the connection

          if (queryErr) {
            console.error("Database query error: 53", queryErr);
            return callback(queryErr, null);
          }

          // Return true if the email exists, else false
          const emailExists = results.length > 0;
          callback(null, emailExists);
        }
      );
    });
  },

  list: async (callback) => {
    const sql = `SELECT * FROM \`client_spocs\``;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
        callback(null, results);
   
  },

  getClientSpocById: (id, callback) => {
    const sql = `SELECT * FROM \`client_spocs\` WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 55", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results[0]);
      });
    });
  },

  update: (
    id,
    name,
    designation,
    phone,
    email,
    email1,
    email2,
    email3,
    email4,
    callback
  ) => {
    const sql = `
      UPDATE \`client_spocs\`
      SET \`name\` = ?, \`designation\` = ?, \`phone\` = ?, \`email\` = ?, \`email1\` = ?, \`email2\` = ?, \`email3\` = ?, \`email4\` = ?
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        sql,
        [name, designation, phone, email, email1, email2, email3, email4, id],
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
      DELETE FROM \`client_spocs\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 56", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },
};

module.exports = ClientSpoc;
