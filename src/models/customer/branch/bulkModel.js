const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");

const subUser = {
  create:async  (
    branchId,
    customerId,
    subUserId,
    client_spoc_name,
    remarks,
    savedZipPaths,
    callback
  ) => {

    const insertData = async ()  => {
      const insertSql = `
            INSERT INTO \`branch_bulk_uploads\` (
              \`branch_id\`,
              \`sub_user_id\`,
              \`customer_id\`,
              \`client_spoc_name\`,
              \`zip\`,
              \`remarks\`
            ) VALUES (?, ?, ?, ?, ?, ?)
          `;

      const values = [
        branchId,
        subUserId || null,
        customerId,
        client_spoc_name,
        correctedPath,
        remarks,
      ];
      const results = await sequelize.query(insertSql, {
        replacements: values, // Positional replacements using ?
        type: QueryTypes.INSERT,
      });
        const bulk_inserted_id = results.insertId;
        const affectedRows = results[1];
        return callback(null, {affectedRows});
    };

    const joinedPaths =
      Array.isArray(savedZipPaths) && savedZipPaths.length > 0
        ? savedZipPaths.join(", ")
        : "";
    const correctedPath = joinedPaths.replace(/\\\\/g, "/");
    

      // SQL query to check if the table exists
      const checkTableExistSql = `SHOW TABLES LIKE 'branch_bulk_uploads'`;
      const results = await sequelize.query(checkTableExistSql, {
        type: QueryTypes.SHOW,
      });
      
        if (results.length === 0) {
          const createTableSql = `
            CREATE TABLE \`branch_bulk_uploads\` (
              \`id\` INT AUTO_INCREMENT PRIMARY KEY,
              \`branch_id\` INT NOT NULL,
              \`sub_user_id\` INT DEFAULT NULL,
              \`customer_id\` INT NOT NULL,
              \`client_spoc_name\` INT NOT NULL,
              \`zip\` VARCHAR(255) NOT NULL,
              \`remarks\` TEXT DEFAULT NULL,
              \`is_notification_read\` TINYINT(1) DEFAULT 0,
              \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              KEY \`branch_id\` (\`branch_id\`),
              KEY \`sub_user_id\` (\`sub_user_id\`),
              KEY \`customer_id\` (\`customer_id\`),
              CONSTRAINT \`fk_branch_bulk_uploads_branch_id\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_branch_bulk_uploads_sub_user_id\` FOREIGN KEY (\`sub_user_id\`) REFERENCES \`branch_sub_users\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_branch_bulk_uploads_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `;
          const results = await sequelize.query(createTableSql, {
            type: QueryTypes.CREATE,
          });
            console.log(
              "Table created successfully, proceeding with the insert."
            );
            insertData();
          
        } else {
          // Table exists, proceed with insert
          insertData();
        }
  },

  getBulkById: async(id, callback) => {
      const sql = "SELECT * FROM `branch_bulk_uploads` WHERE id = ?";
      const results = await sequelize.query(sql, {
        replacements: [id], 
        type: QueryTypes.SELECT,
      });

        callback(null, results[0]);
  },

  list: async (branch_id, callback) => {
      const sqlClient = `
          SELECT id, client_spoc_name, zip, remarks, created_at
          FROM branch_bulk_uploads
          WHERE branch_id = ?
        `;
        const bulkResults = await sequelize.query(sqlClient, {
          replacements: [branch_id], // Positional replacements using ?
          type: QueryTypes.SELECT,
        });
        return callback(null, bulkResults);
  },

  delete:async (id, callback) => {
 
      // SQL query to delete the record
      const deleteSql = `DELETE FROM branch_bulk_uploads WHERE id = ?`;

      const results = await sequelize.query(deleteSql, {
        replacements: [id], // Positional replacements using ?
        type: QueryTypes.DELETE,
      });
       
        if (results === 0) {
          return callback(
            { message: "No record found with the provided ID." },
            null
          );
        }

        // Successfully deleted
        callback(null, {
          message: "Record deleted successfully.",
          affectedRows: results,
        });
     
  
  },
};

module.exports = subUser;
