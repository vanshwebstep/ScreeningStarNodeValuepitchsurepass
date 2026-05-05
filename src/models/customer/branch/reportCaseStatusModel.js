const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../../config/db");
const reportCaseStatus = {
  reportFormJsonByServiceID: async (service_id, callback) => {


    // Use a parameterized query to prevent SQL injection
    const sql = "SELECT `json` FROM `report_forms` WHERE `id` = ?";
    const results = await sequelize.query(sql, {
      replacements: [service_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    callback(null, results[0] || null); // Return single application or null if not found


  },

  annexureData: async (client_application_id, db_table, callback) => {


    // Check if the table exists in the information schema
    const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = ?`;
    const results = await sequelize.query(checkTableSql, {
      replacements: [db_table], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    // If the table does not exist, return an error
    if (results[0].count === 0) {
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
      fetchData();
    } else {
      fetchData();
    }

    async function fetchData() {
      // Now that we know the table exists, run the original query
      const sql = `SELECT * FROM \`${db_table}\` WHERE \`client_application_id\` = ?`;
      const results = await sequelize.query(sql, {
        replacements: [client_application_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });

      // Return the first result or null if not found
      callback(null, results[0] || null);

    }


  },
};

module.exports = reportCaseStatus;
