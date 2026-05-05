const crypto = require("crypto");
const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const TeamManagement = {
  updateStatusOfAnnexureByDBTable: async (
    client_application_id,
    branch_id,
    customer_id,
    status,
    db_table,
    callback
  ) => {
    // SQL query to check if the table exists
    const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = ?`;
    const tableResults = await sequelize.query(checkTableSql, {
      replacements: [process.env.DB_NAME, db_table], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (tableResults[0].count === 0) {
      const createTableSql = `
            CREATE TABLE \`${db_table}\` (
              \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
              \`cmt_id\` bigint(20) DEFAULT NULL,
              \`client_application_id\` bigint(20) NOT NULL,
              \`branch_id\` int(11) NOT NULL,
              \`customer_id\` int(11) NOT NULL,
              \`status\` VARCHAR(100) DEFAULT NULL,
              \`team_management_docs\` LONGTEXT DEFAULT NULL,
              \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`client_application_id\` (\`client_application_id\`),
              KEY \`cmt_application_customer_id\` (\`customer_id\`),
              KEY \`cmt_application_cmt_id\` (\`cmt_id\`),
              CONSTRAINT \`fk_${db_table}_client_application_id\` FOREIGN KEY (\`client_application_id\`) REFERENCES \`client_applications\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_cmt_id\` FOREIGN KEY (\`cmt_id\`) REFERENCES \`cmt_applications\` (\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      await sequelize.query(createTableSql, {
        type: QueryTypes.CREATE,
      });
      proceedToCheckColumns();

    } else {
      // If table exists, proceed to check columns
      proceedToCheckColumns();
    }

    // Function to check if the entry exists and then insert or update
    async function proceedToCheckColumns() {
      const checkEntrySql = `
            SELECT COUNT(*) AS count
            FROM \`${db_table}\`
            WHERE \`client_application_id\` = ? 
              AND \`branch_id\` = ? 
              AND \`customer_id\` = ?`;
      const results = await sequelize.query(checkEntrySql, {
        replacements: [client_application_id, branch_id, customer_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      // If the entry exists, update it
      if (results[0].count > 0) {
        const updateSql = `
                UPDATE \`${db_table}\` 
                SET status = ? 
                WHERE \`client_application_id\` = ? 
                  AND \`branch_id\` = ? 
                  AND \`customer_id\` = ?`;
        const updateResults = await sequelize.query(updateSql, {
          replacements: [status, client_application_id, branch_id, customer_id], // Positional replacements using ?
          type: QueryTypes.UPDATE,
        });
        callback(null, updateResults); // Return update results

      } else {
        // If the entry does not exist, insert it
        const insertSql = `
                INSERT INTO \`${db_table}\` (\`client_application_id\`, \`branch_id\`, \`customer_id\`, \`status\`) 
                VALUES (?, ?, ?, ?)`;
        const insertResults = await sequelize.query(insertSql, {
          replacements: [client_application_id, branch_id, customer_id, status], // Positional replacements using ?
          type: QueryTypes.INSERT,
        });
        callback(null, insertResults); // Return insert results

      }
    }

  },

  upload: async (
    client_application_id,
    db_table,
    db_column,
    savedImagePaths,
    callback
  ) => {

    const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = ?`;

    const tableResults = await sequelize.query(checkTableSql, {
      replacements: [db_table], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });



    if (tableResults[0].count === 0) {
      const createTableSql = `
            CREATE TABLE \`${db_table}\` (
              \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
              \`cmt_id\` bigint(20) DEFAULT NULL,
              \`client_application_id\` bigint(20) NOT NULL,
              \`branch_id\` int(11) NOT NULL,
              \`customer_id\` int(11) NOT NULL,
              \`status\` VARCHAR(100) DEFAULT NULL,
              \`team_management_docs\` LONGTEXT DEFAULT NULL,
              \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`client_application_id\` (\`client_application_id\`),
              KEY \`cmt_application_customer_id\` (\`customer_id\`),
              KEY \`cmt_application_cmt_id\` (\`cmt_id\`),
              CONSTRAINT \`fk_${db_table}_client_application_id\` FOREIGN KEY (\`client_application_id\`) REFERENCES \`client_applications\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_cmt_id\` FOREIGN KEY (\`cmt_id\`) REFERENCES \`cmt_applications\` (\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      await sequelize.query(createTableSql, {
        type: QueryTypes.CREATE,
      });
      proceedToCheckColumns();
    } else {
      proceedToCheckColumns();
    }

    async function proceedToCheckColumns() {
      // 1. Check for existing columns in cmt_applications
      const currentColumnsSql = `SHOW COLUMNS FROM \`${db_table}\``;
      const [results] = await sequelize.query(currentColumnsSql, { type: QueryTypes.SHOW });

      const existingColumns = results.map((row) => row.Field);
      const expectedColumns = [db_column];

      // Filter out missing columns
      const missingColumns = expectedColumns.filter(
        (field) => !existingColumns.includes(field)
      );

      console.log('missingColumns--', missingColumns)

      const addColumnPromises = missingColumns.map((column) => {
        return new Promise(async (resolve, reject) => {
          const alterTableSql = `ALTER TABLE \`${db_table}\` ADD COLUMN \`${column}\` LONGTEXT`;
          await sequelize.query(alterTableSql, {
            type: QueryTypes.RAW,
          });
          resolve();
        });
      });

      Promise.all(addColumnPromises)
        .then(async () => {
          const insertSql = `UPDATE \`${db_table}\` SET \`${db_column}\` = ? WHERE \`client_application_id\` = ?`;
          console.log('insertSql--', insertSql)

          const joinedPaths = savedImagePaths.join(", ");
          console.log('joinedPaths--', joinedPaths)
          console.log('client_application_id-', client_application_id)
          console.log(insertSql, [joinedPaths, client_application_id]);
          const results = await sequelize.query(insertSql, {
            replacements: [joinedPaths, client_application_id], // Positional replacements using ?
            type: QueryTypes.UPDATE,
          });
          console.log('results', results)

          callback(true, results);

        })
        .catch((columnErr) => {
          console.error("Error adding columns:", columnErr);
          callback(false, {
            error: "Error adding columns.",
            details: columnErr,
          });
        });

    }


  },

  updateComponentStatus: async (
    client_application_id,
    component_status,
    callback
  ) => {
    const updateSql = `UPDATE \`cmt_applications\` SET \`component_status\` = ? WHERE \`client_application_id\` = ?`;
    const results = await sequelize.query(updateSql, {
      replacements: [component_status, client_application_id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results); // Return update results
  },
};

module.exports = TeamManagement;
