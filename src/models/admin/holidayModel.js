const { pool, startConnection, connectionRelease } = require("../../config/db");

const Holiday = {
  create: (title, date, callback) => {
    // Step 1: Check if a holiday with the same title already exists
    const checkHolidaySql = `
      SELECT * FROM \`holidays\` WHERE \`title\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(checkHolidaySql, [title], (checkErr, holidayResults) => {
        if (checkErr) {
          console.error("Error checking holiday:", checkErr);
           // Release connection on error
          return callback(checkErr, null);
        }

        // Step 2: If a holiday with the same title exists, return an error
        if (holidayResults.length > 0) {
          const error = new Error("Holiday with the same name already exists");
          console.error(error.message);
           // Release connection before returning error
          return callback(error, null);
        }

        // Step 3: Insert the new holiday
        const insertHolidaySql = `
          INSERT INTO \`holidays\` (\`title\`, \`date\`)
          VALUES (?, ?)
        `;

        connection.query(
          insertHolidaySql,
          [title, date],
          (insertErr, results) => {
             // Release the connection

            if (insertErr) {
              console.error("Database query error: 46", insertErr);
              return callback(insertErr, null);
            }
            callback(null, results);
          }
        );
      });
    });
  },

  list: (callback) => {
    const sql = `SELECT * FROM \`holidays\``;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 47", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },

  digitlAddressHoliday: (callback) => {
    const sql = `
      SELECT * FROM \`holidays\`
      WHERE LOWER(\`title\`) LIKE '%digital%'
      AND (LOWER(\`title\`) LIKE '%verification%' OR LOWER(\`title\`) LIKE '%address%')
      LIMIT 1
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 48", queryErr);
          return callback(queryErr, null);
        }

        // Check if results are found and return the first entry or null if not found
        const singleEntry = results.length > 0 ? results[0] : null;
        callback(null, singleEntry); // Return single entry or null if not found
      });
    });
  },

  getHolidayById: (id, callback) => {
    const sql = `SELECT * FROM \`holidays\` WHERE \`id\` = ?`;

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

  getHolidayRequiredDocumentsByHolidayId: (holiday_id, callback) => {
    const sql = `SELECT * FROM \`holiday_required_documents\` WHERE \`holiday_id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [holiday_id], (queryErr, results) => {
         // Release the connection

        if (queryErr) {
          console.error("Database query error: 50", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results[0]);
      });
    });
  },

  update: (id, title, date, callback) => {
    const sql = `
      UPDATE \`holidays\`
      SET \`title\` = ?, \`date\` = ?
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [title, date, id], (queryErr, results) => {
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
      DELETE FROM \`holidays\`
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

module.exports = Holiday;
