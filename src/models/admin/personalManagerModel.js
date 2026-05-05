const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const PersonalManager = {
    create: async (data, callback) => {
        const tableName = "personal_managers";
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
                        \`photo\` LONGTEXT DEFAULT NULL,
                        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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

    update: async (
        personal_manager_id,
        data,
        callback
    ) => {
        const tableName = "personal_managers";
        const columns = Object.keys(data);
        const values = Object.values(data);

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
        const createTableSql = `CREATE TABLE \`${tableName}\` (
                    \`id\` int NOT NULL AUTO_INCREMENT,
                    \`admin_id\` int NOT NULL,
                    \`photo\` LONGTEXT DEFAULT NULL,
                    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    KEY \`${tableName}_fk_admin_id\` (\`admin_id\`),
                    CONSTRAINT \`${tableName}_fk_admin_id\` FOREIGN KEY (\`admin_id\`) REFERENCES \`admins\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;`;

        const ensureTable = tableExists
            ? Promise.resolve()
            : sequelize.query(createTableSql, {
                type: QueryTypes.CREATE,
            }).then(() => Promise.resolve()); // Ensures a resolved promise


        ensureTable
            .then(() => {
                // Step 2: Check and add missing columns
                const checkColumnsSql = `SHOW COLUMNS FROM \`${tableName}\``;

                return new Promise(async (resolve, reject) => {
                    const columnResults = await sequelize.query(checkColumnsSql, {
                        type: QueryTypes.SELECT,
                    });
                    const existingColumns = columnResults.map((column) => column.Field);
                    const missingColumns = columns.filter((column) => !existingColumns.includes(column));

                    const alterTablePromises = missingColumns.map((column) => {
                        const alterTableSql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${column}\` TEXT`;

                        return new Promise(async (resolve, reject) => {
                            const results = await sequelize.query(alterTableSql, {
                                replacements: [username, username], // Positional replacements using ?
                                type: QueryTypes.SELECT,
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
                const updateServiceSql = `
                            UPDATE \`${tableName}\`
                            SET ${columns.map((col) => `\`${col}\` = ?`).join(", ")}
                            WHERE id = ?
                        `;
                const results = await sequelize.query(updateServiceSql, {
                    replacements: [...values, personal_manager_id], // Positional replacements using ?
                    type: QueryTypes.UPDATE,
                });
                callback(null, results);

            })
            .catch((err) => {
                console.error("Database query error (ensure table/columns):", err);
                callback(err, null);
            });


    },

    response: async (
        id,
        status,
        callback
    ) => {
        const sql = `
          UPDATE \`personal_managers\`
          SET \`status\` = ?
          WHERE \`id\` = ?
        `;


        const results = await sequelize.query(sql, {
            replacements: [status, id], // Positional replacements using ?
            type: QueryTypes.UPDATE,
        });
        callback(null, results);
    },

    upload: async (id, savedImagePaths, callback) => {
        const sqlUpdateCustomer = `
          UPDATE personal_managers 
          SET photo = ?
          WHERE id = ?
        `;
        const joinedPaths = savedImagePaths.join(", ");
        const queryParams = [joinedPaths, id];

        try {
            const [results, metadata] = await sequelize.query(sqlUpdateCustomer, {
                replacements: queryParams,
                type: QueryTypes.UPDATE,
            });

            // metadata is the number of affected rows in UPDATE
            if (metadata > 0) {
                callback(true, { affectedRows: metadata });
            } else {
                callback(false, {
                    error: "No rows updated. Please check the Admin ID.",
                    query: sqlUpdateCustomer,
                    params: queryParams,
                });
            }
        } catch (error) {
            callback(false, {
                error: "Query failed",
                details: error.message,
                query: sqlUpdateCustomer,
                params: queryParams,
            });
        }
    },


    findById: async (id, callback) => {
        const sql = `SELECT * FROM \`personal_managers\` WHERE \`id\` = ?`;

        const results = await sequelize.query(sql, {
            replacements: [id], // Positional replacements using ?
            type: QueryTypes.SELECT,
        });
        if (!results || results.length === 0) {
            return callback(null, null);
        }
        callback(null, results[0]);
    },

    list: async (callback) => {
        const sql = `SELECT PM.*, PMA.name AS admin_name FROM \`personal_managers\` PM INNER JOIN \`admins\` PMA ON PM.admin_id = PMA.id ORDER BY PM.\`id\` DESC`;
        const results = await sequelize.query(sql, {
            type: QueryTypes.SELECT,
        });
        callback(null, results);
    },

    myList: async (admin_id, callback) => {
        const sql = `SELECT PM.*, PMA.name AS admin_name FROM \`personal_managers\` PM INNER JOIN \`admins\` PMA ON PM.admin_id = PMA.id WHERE PM.admin_id = ? ORDER BY PM.\`id\` DESC`;
        const results = await sequelize.query(sql, {
            replacements: [admin_id], // Positional replacements using ?
            type: QueryTypes.SELECT,
        });
        callback(null, results);
    },


    delete: async (id, callback) => {
        const sql = `
          DELETE FROM \`personal_managers\`
          WHERE \`id\` = ?
        `;
        const results = await sequelize.query(sql, {
            replacements: [id], // Positional replacements using ?
            type: QueryTypes.DELETE,
        });
        callback(null, results);
    },
};

module.exports = PersonalManager;
