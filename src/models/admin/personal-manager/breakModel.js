const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");
const Break = {
    create: async (data, callback) => {
        const tableName = "admin_breaks";
        const columns = Object.keys(data);
        const values = Object.values(data);

        try {
            // Step 1: Check if table exists
            const checkTableSql = `
            SELECT COUNT(*) AS tableCount
            FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = ?
        `;
            const tableResults = await sequelize.query(checkTableSql, {
                replacements: [tableName],
                type: QueryTypes.SELECT,
            });

            const tableExists = tableResults[0].tableCount > 0;

            // Step 2: Create table if it doesn't exist
            if (!tableExists) {
                const createTableSql = `
                CREATE TABLE \`${tableName}\` (
                    \`id\` INT NOT NULL AUTO_INCREMENT,
                    \`admin_id\` INT NOT NULL,
                    \`type\` LONGTEXT DEFAULT NULL,
                    \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    KEY \`${tableName}_fk_admin_id\` (\`admin_id\`),
                    CONSTRAINT \`${tableName}_fk_admin_id\`
                        FOREIGN KEY (\`admin_id\`) REFERENCES \`admins\` (\`id\`)
                        ON DELETE CASCADE ON UPDATE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
            `;
                await sequelize.query(createTableSql, { type: QueryTypes.RAW });
            }

            // Step 3: Check for missing columns and add them
            const existingColumnsResults = await sequelize.query(`SHOW COLUMNS FROM \`${tableName}\``, {
                type: QueryTypes.SELECT,
            });
            const existingColumns = existingColumnsResults.map((col) => col.Field);

            const missingColumns = columns.filter((col) => !existingColumns.includes(col));
            for (const column of missingColumns) {
                const alterSql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${column}\` TEXT`;
                await sequelize.query(alterSql, { type: QueryTypes.RAW });
            }

            // Step 4: Insert data
            const insertSql = `
            INSERT INTO \`${tableName}\` (${columns.map((col) => `\`${col}\``).join(", ")})
            VALUES (${columns.map(() => "?").join(", ")})
        `;
            const insertResults = await sequelize.query(insertSql, {
                replacements: values,
                type: QueryTypes.INSERT,
            });

            callback(null, { insertId: insertResults[0] });
        } catch (error) {
            console.error("Error in create function:", error);
            callback(error, null);
        }
    },

    view: async (admin_id, callback) => {
        const breakTableName = "admin_breaks";
        const adminLoginLogsTableName = "admin_login_logs";

        try {
            // 1. Fetch first login time (min id) for the current date using CURRENT_DATE()
            const firstLoginQuery = `
                SELECT created_at AS first_login_time
                FROM \`${adminLoginLogsTableName}\`
                WHERE admin_id = ? AND action = 'login' AND DATE(created_at) = CURRENT_DATE()
                ORDER BY id ASC
                LIMIT 1
            `;
            const [firstLoginResult] = await sequelize.query(firstLoginQuery, {
                replacements: [admin_id],
                type: QueryTypes.SELECT,
            });

            const first_login_time = firstLoginResult ? firstLoginResult.first_login_time : null;

            const lastLogoutQuery = `
                SELECT created_at AS last_logout_time
                FROM \`${adminLoginLogsTableName}\`
                WHERE admin_id = ? AND action = 'logout' AND DATE(created_at) = CURRENT_DATE()
                ORDER BY id DESC
                LIMIT 1
            `;
            const [lastLogoutResult] = await sequelize.query(lastLogoutQuery, {
                replacements: [admin_id],
                type: QueryTypes.SELECT,
            });

            const last_logout_time = lastLogoutResult ? lastLogoutResult.last_logout_time : null;

            // 2. Get all distinct break types
            const distinctTypesQuery = `
                SELECT DISTINCT type
                FROM \`${breakTableName}\`
            `;
            const distinctTypes = await sequelize.query(distinctTypesQuery, {
                type: QueryTypes.SELECT,
            });

            // 3. For each type, get the earliest break time for the current date
            const breakTimes = {};
            for (const { type } of distinctTypes) {
                const breakTimeQuery = `
                    SELECT created_at
                    FROM \`${breakTableName}\`
                    WHERE admin_id = ? AND type = ? AND DATE(created_at) = CURRENT_DATE()
                    ORDER BY id ASC
                    LIMIT 1
                `;
                const [breakResult] = await sequelize.query(breakTimeQuery, {
                    replacements: [admin_id, type],
                    type: QueryTypes.SELECT,
                });

                breakTimes[type] = breakResult ? breakResult.created_at : null;
            }

            const result = {
                admin_id,
                date: new Date().toISOString().slice(0, 10), // for consistency in response
                first_login_time,
                last_logout_time,
                break_times: breakTimes,
            };

            callback(null, result);
        } catch (error) {
            console.error("Error in view function:", error);
            callback(error, null);
        }
    },


};

module.exports = Break;
