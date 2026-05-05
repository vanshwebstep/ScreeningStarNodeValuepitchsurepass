const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

const clientApplication = {
    applicationForCaseAllocation: async (callback) => {
        const applicationsSql = "SELECT ca.id AS client_application_id, cmt.id AS admin_id, ca.employee_id, ca.application_id, ca.name, cmt.month_year, cmt.created_at, cmt.dob, cmt.gender, cmt.contact_number, cmt.contact_number2, cmt.father_name, cmt.spouse_name, cmt.permanent_address_house_no, cmt.permanent_address_floor, cmt.permanent_address_cross, cmt.permanent_address_street, cmt.permanent_address_main, cmt.permanent_address_area, cmt.permanent_address_locality, cmt.permanent_address_city, cmt.permanent_address_landmark, cmt.permanent_address_taluk, cmt.permanent_address_district, cmt.permanent_address_state, cmt.permanent_address_pin_code, cmt.deadline_date, cmt.report_date, cmt.delay_reason FROM `client_applications` ca INNER JOIN `cmt_applications` cmt ON ca.id = cmt.client_application_id WHERE ca.`is_deleted` != 1";
        const servicesSql = `
        SELECT 
          s.*, 
          sg.title AS group_name 
        FROM \`services\` s
        JOIN \`service_groups\` sg ON s.group_id = sg.id
      `;

        const applications = await sequelize.query(applicationsSql, {
            type: QueryTypes.SELECT,
        });
        const services = await sequelize.query(servicesSql, {
            type: QueryTypes.SELECT,
        });
        callback(null, { applications, services });
    },

    getById: async (id, callback) => {
        const sql = `SELECT * FROM \`case_allocations\` WHERE \`id\` = ?`;
        const results = await sequelize.query(sql, {
            replacements: [id], // Positional replacements using ?
            type: QueryTypes.SELECT,
        });
        callback(null, results[0]);
    },

    create: async (data, callback) => {

        const tableName = "case_allocations";
        // Function to filter out undefined, null, or empty values
        const filteredInformation = Object.fromEntries(
            Object.entries(data).filter(
                ([key, value]) => value !== undefined && value !== null && value !== ''
            )
        );

        console.log(`filteredInformation - `, filteredInformation);
        const columns = Object.keys(filteredInformation);
        const values = Object.values(filteredInformation);

        const checkTableSql = `
                SELECT COUNT(*) AS tableCount
                FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = ?
            `;

        const tableResults = await sequelize.query(checkTableSql, {
            replacements: [tableName], // Positional replacements using ?
            type: QueryTypes.SELECT,
        });

        const tableExists = tableResults[0].tableCount > 0;

        const createTableSql = `CREATE TABLE \`case_allocations\` (
                    \`id\` int NOT NULL AUTO_INCREMENT,
                    \`admin_id\` int NOT NULL,
                    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    KEY \`case_allocation_fk_admin_id\` (\`admin_id\`),
                    CONSTRAINT \`case_allocation_fk_admin_id\` FOREIGN KEY (\`admin_id\`) REFERENCES \`admins\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
                  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;`;

        const ensureTable = tableExists
            ? Promise.resolve()
            : new Promise((resolve, reject) => {
                sequelize
                    .query(createTableSql, {
                        type: QueryTypes.SELECT,
                    })
                    .then(() => resolve())
                    .catch(reject); // Proper error handling
            });


        ensureTable
            .then(() => {
                // Step 3: Check and add missing columns
                const checkColumnsSql = `SHOW COLUMNS FROM \`${tableName}\``;

                return new Promise(async (resolve, reject) => {
                    const columnResults = await sequelize.query(checkColumnsSql, {
                        type: QueryTypes.SELECT,
                    });
                    const existingColumns = columnResults.map((column) => column.Field);
                    const missingColumns = columns.filter((column) => !existingColumns.includes(column));
                    const alterTablePromises = missingColumns.map((column) => {
                        const alterTableSql = `
                                        ALTER TABLE \`${tableName}\`
                                        ADD COLUMN \`${column}\` TEXT
                                    `;
                        return new Promise(async (resolve, reject) => {
                            await sequelize.query(alterTableSql, {
                                type: QueryTypes.RAW,
                            });
                            resolve();

                        });
                    });

                    Promise.all(alterTablePromises)
                        .then(() => resolve())
                        .catch((err) => reject(err));

                });
            })
            .then(async () => {
                const insertServiceSql = `
                            INSERT INTO \`${tableName}\` (${columns.map((col) => `\`${col}\``).join(", ")})
                            VALUES (${columns.map(() => "?").join(", ")})
                        `;
                console.log('values---', values)
                const results = await sequelize.query(insertServiceSql, {
                    replacements: values, // Positional replacements using ?
                    type: QueryTypes.INSERT,
                });

                callback(null, results);

            })
            .catch((err) => {
                console.error("Database query error: Ensure table/columns", err);
                callback(err, null);
            });


    },

    update: async (id, data, callback) => {
        const tableName = "case_allocations";

        // Filter out undefined, null, or empty values
        const filteredInformation = Object.fromEntries(
            Object.entries(data).filter(
                ([key, value]) => value !== undefined && value !== null && value !== ''
            )
        );

        console.log(`filteredInformation - `, filteredInformation);

        const columns = Object.keys(filteredInformation);
        const values = Object.values(filteredInformation);

        const checkTableSql = `
            SELECT COUNT(*) AS tableCount
            FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = ?
        `;

        try {
            const tableResults = await sequelize.query(checkTableSql, {
                replacements: [tableName],
                type: QueryTypes.SELECT,
            });

            const tableExists = tableResults[0].tableCount > 0;

            if (!tableExists) {
                const createTableSql = `
                    CREATE TABLE \`case_allocations\` (
                        \`id\` int NOT NULL AUTO_INCREMENT,
                        \`admin_id\` int NOT NULL,
                        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (\`id\`),
                        KEY \`case_allocation_fk_admin_id\` (\`admin_id\`),
                        CONSTRAINT \`case_allocation_fk_admin_id\` FOREIGN KEY (\`admin_id\`) REFERENCES \`admins\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
                `;
                await sequelize.query(createTableSql, { type: QueryTypes.RAW });
            }

            const columnResults = await sequelize.query(`SHOW COLUMNS FROM \`${tableName}\``, {
                type: QueryTypes.SELECT,
            });

            const existingColumns = columnResults.map((column) => column.Field);
            const missingColumns = columns.filter((column) => !existingColumns.includes(column));

            for (const column of missingColumns) {
                const alterTableSql = `
                    ALTER TABLE \`${tableName}\`
                    ADD COLUMN \`${column}\` TEXT
                `;
                await sequelize.query(alterTableSql, { type: QueryTypes.RAW });
            }

            // Now build the update statement
            const updateSql = `
                UPDATE \`${tableName}\`
                SET ${columns.map((col) => `\`${col}\` = ?`).join(", ")}
                WHERE id = ?
            `;

            const results = await sequelize.query(updateSql, {
                replacements: [...values, id], // Add `id` at the end for WHERE clause
                type: QueryTypes.UPDATE,
            });

            callback(null, results);
        } catch (err) {
            console.error("Database query error: Ensure table/columns", err);
            callback(err, null);
        }
    },

    list: async (callback) => {
        const sql = `SELECT CA.*, CAA.name AS admin_name FROM \`case_allocations\` CA INNER JOIN \`admins\` CAA ON CA.admin_id = CAA.id`;
        const servicesSql = `
        SELECT 
          s.*, 
          sg.title AS group_name 
        FROM \`services\` s
        JOIN \`service_groups\` sg ON s.group_id = sg.id
      `;
        const caseAllocations = await sequelize.query(sql, {
            type: QueryTypes.SELECT,
        });
        const services = await sequelize.query(servicesSql, {
            type: QueryTypes.SELECT,
        });
        callback(null, { caseAllocations, services });

    },

    delete: async (id, callback) => {
        const sql = `
          DELETE FROM \`case_allocations\`
          WHERE \`id\` = ?
        `;


        const results = await sequelize.query(sql, {
            replacements: [id], // Positional replacements using ?
            type: QueryTypes.DELETE,
        });
        callback(null, results);

    },

};

module.exports = clientApplication;
