const crypto = require("crypto");
const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const Customer = {
  applicationListByBranch: async (
    filter_status,
    branch_id,
    filter_month,
    callback
  ) => {

    let sql = `
      SELECT 
          ca.*, 
          ca.id AS main_id,
          ca.is_highlight,
          cmt.first_insufficiency_marks,
          cmt.first_insuff_date,
          cmt.first_insuff_reopened_date,
          cmt.second_insufficiency_marks,
          cmt.second_insuff_date,
          cmt.second_insuff_reopened_date,
          cmt.third_insufficiency_marks,
          cmt.third_insuff_date,
          cmt.third_insuff_reopened_date,
          cmt.final_verification_status,
          cmt.dob,
          cmt.is_verify,
          cmt.qc_done_by,
          cmt.report_date,
          cmt.case_upload,
          cmt.report_type,
          cmt.delay_reason,
          cmt.report_status,
          cmt.overall_status,
          cmt.initiation_date,
          cmt.report_generate_by,
          qc_admin.name AS qc_done_by_name,
          report_admin.name AS report_generated_by_name
        FROM 
          \`client_applications\` ca
        LEFT JOIN 
          \`cmt_applications\` cmt ON ca.id = cmt.client_application_id
        LEFT JOIN 
          \`admins\` AS qc_admin ON qc_admin.id = cmt.qc_done_by
        LEFT JOIN 
          \`admins\` AS report_admin ON report_admin.id = cmt.report_generate_by
        WHERE 
          ca.\`branch_id\` = ? AND ca.\`is_data_qc\` = 1 AND ca.is_deleted != 1`;

    const params = [branch_id]; // Start with branch_id

    // Add filter for status if provided
    if (filter_status?.trim()) {
      sql += ` AND ca.\`status\` = ?`;
      params.push(filter_status);
    }

    // Add filter for month if provided
    if (filter_month?.trim()) {
      sql += ` AND ca.\`created_at\` LIKE ?`;
      params.push(`${filter_month}%`);
    }

    sql += ` ORDER BY ca.\`created_at\` DESC, ca.\`is_highlight\` DESC;`;

    try {
      const results = await new Promise(async (resolve, reject) => {
        const rows = await sequelize.query(sql, {
          replacements: params, // Positional replacements using ?
          type: QueryTypes.SELECT,
        });
        resolve(rows);

      });
      const cmtPromises = results.map(async (clientApp) => {
        const servicesResult = { annexure_attachments: {} };
        const servicesIds = clientApp.services?.split(",") || [];

        if (servicesIds.length) {
          const servicesTitles = await new Promise(async (resolve, reject) => {
            const servicesQuery =
              "SELECT title FROM `services` WHERE id IN (?)";

            const rows = await sequelize.query(servicesQuery, {
              replacements: servicesIds, // Positional replacements using ?
              type: QueryTypes.SELECT,
            });
            resolve(rows.map((row) => row.title));
          });

          clientApp.serviceNames = servicesTitles;
        }

        const dbTableFileInputs = {};
        const dbTableColumnLabel = {};
        const dbTableWithHeadings = {};

        await Promise.all(
          servicesIds.map(async (service) => {
            const reportFormQuery =
              "SELECT `json` FROM `report_forms` WHERE `service_id` = ?";
            const result = await new Promise(async (resolve, reject) => {
              const rows = await sequelize.query(reportFormQuery, {
                replacements: [service], // Positional replacements using ?
                type: QueryTypes.SELECT,
              });

              resolve(rows);

            });

            if (result.length) {
              const jsonData = JSON.parse(result[0].json);
              const dbTable = jsonData.db_table;
              const heading = jsonData.heading;

              if (dbTable && heading) dbTableWithHeadings[dbTable] = heading;

              if (!dbTableFileInputs[dbTable])
                dbTableFileInputs[dbTable] = [];

              jsonData.rows.forEach((row) => {
                const inputLabel = row.label;
                row.inputs.forEach((input) => {
                  if (input.type === "file") {
                    const inputName = input.name.replace(/\s+/g, "");
                    dbTableFileInputs[dbTable].push(inputName);
                    dbTableColumnLabel[inputName] = inputLabel;
                  }
                });
              });
            }
          })
        );

        await Promise.all(
          Object.entries(dbTableFileInputs).map(
            async ([dbTable, fileInputNames]) => {
              if (!fileInputNames.length) return;

              // Check if table exists using raw query
              const tableCheckQuery = `
                                      SELECT COUNT(*) AS count 
                                      FROM information_schema.tables 
                                      WHERE table_schema = DATABASE() 
                                        AND table_name = :dbTable
                                    `;

              const [tableCheckResult] = await sequelize.query(tableCheckQuery, {
                replacements: { dbTable },
                type: QueryTypes.SELECT,
              });

              if (tableCheckResult.count === 0) {
                console.warn(`Table '${dbTable}' does not exist. Skipping.`);
                return;
              }

              const existingColumns = await new Promise(async (resolve, reject) => {
                const describeQuery = `DESCRIBE ${dbTable}`;
                const rows = await sequelize.query(describeQuery, {
                  type: QueryTypes.SELECT,
                });

                resolve(rows.map((col) => col.Field));

              });

              const validColumns = fileInputNames.filter((col) =>
                existingColumns.includes(col)
              );

              if (!validColumns.length) return;

              const selectQuery = `SELECT ${validColumns.join(
                ", "
              )} FROM ${dbTable} WHERE client_application_id = ?`;
              const rows = await new Promise(async (resolve, reject) => {
                const rows = await sequelize.query(selectQuery, {
                  replacements: [clientApp.main_id], // Positional replacements using ?
                  type: QueryTypes.SELECT,
                });
                resolve(rows);
              });

              const updatedRows = rows
                .map((row) => {
                  const updatedRow = {};

                  for (const [key, value] of Object.entries(row)) {
                    if (
                      value !== null &&
                      value !== undefined &&
                      value !== ""
                    ) {
                      updatedRow[dbTableColumnLabel[key] || key] = value;
                    }
                  }

                  // Return updatedRow only if something was added
                  if (Object.keys(updatedRow).length > 0) {
                    return updatedRow;
                  }
                  return null;
                })
                .filter((row) => row !== null);

              if (updatedRows.length > 0) {
                servicesResult.annexure_attachments[
                  dbTableWithHeadings[dbTable]
                ] = updatedRows;
              }
            }
          )
        );

        clientApp.service_data = servicesResult;
      });

      await Promise.all(cmtPromises);
      callback(null, results);
    } catch (error) {
      console.error("Error processing data:", error);
      callback(error, null);
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
      const currentColumnsSql = `SHOW COLUMNS FROM \`${db_table}\``;
      const results = await sequelize.query(currentColumnsSql, {
        type: QueryTypes.SHOW,
      });

      const existingColumns = results.map((row) => row.Field);
      const expectedColumns = [db_column];

      // Filter out missing columns
      const missingColumns = expectedColumns.filter(
        (field) => !existingColumns.includes(field)
      );

      const addColumnPromises = missingColumns.map((column) => {
        return new Promise(async (resolve, reject) => {
          const alterTableSql = `ALTER TABLE \`${db_table}\` ADD COLUMN \`${column}\` LONGTEXT`;
          await sequelize.query(alterTableSql, {
            type: QueryTypes.ALTER,
          });
          resolve();
        });
      });

      Promise.all(addColumnPromises)
        .then(async () => {
          const insertSql = `UPDATE \`${db_table}\` SET \`${db_column}\` = ? WHERE \`client_application_id\` = ?`;
          const joinedPaths = savedImagePaths.join(", ");
          const results = await sequelize.query(insertSql, {
            replacements: [joinedPaths, client_application_id], // Positional replacements using ?
            type: QueryTypes.UPDATE,
          });
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
};

module.exports = Customer;
