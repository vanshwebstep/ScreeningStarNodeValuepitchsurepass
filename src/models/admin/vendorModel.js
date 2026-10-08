const { pool, startConnection, connectionRelease } = require("../../config/db");

const Vendor = {
    create: (
        data,
        callback
    ) => {
        const tableName = "vendors";
        const columns = Object.keys(data);
        const values = Object.values(data);

        startConnection((err, connection) => {
            if (err) {
                console.error("Connection error:", err);
                return callback(err, null);
            }
            // Step 1: Check if the table exists
            const checkTableSql = `
                SELECT COUNT(*) AS tableCount
                FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = ?
            `;
            connection.query(checkTableSql, [tableName], (tableErr, tableResults) => {
                if (tableErr) {
                    
                    console.error("Database query error: 1", tableErr);
                    return callback(tableErr, null);
                }

                const tableExists = tableResults[0].tableCount > 0;

                const createTableSql = `CREATE TABLE \`${tableName}\` (
                    \`id\` int NOT NULL AUTO_INCREMENT,
                    \`admin_id\` int NOT NULL,
                    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    KEY \`${tableName}_fk_admin_id\` (\`admin_id\`),
                    CONSTRAINT \`${tableName}_fk_admin_id\` FOREIGN KEY (\`admin_id\`) REFERENCES \`admins\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
                  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;`;

                const ensureTable = tableExists
                    ? Promise.resolve()
                    : new Promise((resolve, reject) => {
                        connection.query(createTableSql, (createErr) => {
                            if (createErr) {
                                console.error("Error creating table:", createErr);
                                reject(createErr);
                            } else {
                                resolve();
                            }
                        });
                    });

                ensureTable
                    .then(() => {
                        // Step 3: Check and add missing columns
                        const checkColumnsSql = `SHOW COLUMNS FROM \`${tableName}\``;

                        return new Promise((resolve, reject) => {
                            connection.query(checkColumnsSql, (columnErr, columnResults) => {
                                if (columnErr) {
                                    console.error("Error checking columns:", columnErr);
                                    return reject(columnErr);
                                }

                                const existingColumns = columnResults.map((column) => column.Field);
                                const missingColumns = columns.filter((column) => !existingColumns.includes(column));
                                const alterTablePromises = missingColumns.map((column) => {
                                    const alterTableSql = `
                                        ALTER TABLE \`${tableName}\`
                                        ADD COLUMN \`${column}\` TEXT
                                    `;
                                    return new Promise((resolve, reject) => {
                                        connection.query(alterTableSql, (alterErr) => {
                                            if (alterErr) {
                                                console.error(`Error adding column ${column}:`, alterErr);
                                                return reject(alterErr);
                                            }
                                            resolve();
                                        });
                                    });
                                });

                                Promise.all(alterTablePromises)
                                    .then(() => resolve())
                                    .catch((err) => reject(err));
                            });
                        });
                    })
                    .then(() => {
                        const insertServiceSql = `
                            INSERT INTO \`${tableName}\` (${columns.map((col) => `\`${col}\``).join(", ")})
                            VALUES (${columns.map(() => "?").join(", ")})
                        `;

                        connection.query(insertServiceSql, values, (insertErr, results) => {
                             // Release the connection
                            if (insertErr) {
                                console.error("Database query error: Insert", insertErr);
                                return callback(insertErr, null);
                            }
                            callback(null, results);
                        });
                    })
                    .catch((err) => {
                        
                        console.error("Database query error: Ensure table/columns", err);
                        callback(err, null);
                    });
            });
        });
    },

    update: (
        vendor_id,
        data,
        callback
    ) => {
        const tableName = "vendors";
        const columns = Object.keys(data);
        const values = Object.values(data);

        startConnection((err, connection) => {
            if (err) {
                console.error("Connection error:", err);
                return callback(err, null);
            }

            // Step 1: Check if the table exists
            const checkTableSql = `
                SELECT COUNT(*) AS tableCount
                FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = ?
            `;

            connection.query(checkTableSql, [tableName], (tableErr, tableResults) => {
                if (tableErr) {
                    
                    console.error("Database query error (check table):", tableErr);
                    return callback(tableErr, null);
                }

                const tableExists = tableResults[0].tableCount > 0;
                const createTableSql = `CREATE TABLE \`${tableName}\` (
                    \`id\` int NOT NULL AUTO_INCREMENT,
                    \`admin_id\` int NOT NULL,
                    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (\`id\`),
                    KEY \`${tableName}_fk_admin_id\` (\`admin_id\`),
                    CONSTRAINT \`${tableName}_fk_admin_id\` FOREIGN KEY (\`admin_id\`) REFERENCES \`admins\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;`;

                const ensureTable = tableExists
                    ? Promise.resolve()
                    : new Promise((resolve, reject) => {
                        connection.query(createTableSql, (createErr) => {
                            if (createErr) {
                                console.error("Error creating table:", createErr);
                                reject(createErr);
                            } else {
                                resolve();
                            }
                        });
                    });

                ensureTable
                    .then(() => {
                        // Step 2: Check and add missing columns
                        const checkColumnsSql = `SHOW COLUMNS FROM \`${tableName}\``;

                        return new Promise((resolve, reject) => {
                            connection.query(checkColumnsSql, (columnErr, columnResults) => {
                                if (columnErr) {
                                    console.error("Error checking columns:", columnErr);
                                    return reject(columnErr);
                                }

                                const existingColumns = columnResults.map((column) => column.Field);
                                const missingColumns = columns.filter((column) => !existingColumns.includes(column));

                                const alterTablePromises = missingColumns.map((column) => {
                                    const alterTableSql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${column}\` TEXT`;

                                    return new Promise((resolve, reject) => {
                                        connection.query(alterTableSql, (alterErr) => {
                                            if (alterErr) {
                                                console.error(`Error adding column ${column}:`, alterErr);
                                                return reject(alterErr);
                                            }
                                            resolve();
                                        });
                                    });
                                });

                                Promise.all(alterTablePromises)
                                    .then(() => resolve())
                                    .catch((err) => reject(err));
                            });
                        });
                    })
                    .then(() => {
                        // Step 3: Update data
                        const updateServiceSql = `
                            UPDATE \`${tableName}\`
                            SET ${columns.map((col) => `\`${col}\` = ?`).join(", ")}
                            WHERE id = ?
                        `;

                        connection.query(updateServiceSql, [...values, vendor_id], (updateErr, results) => {
                            
                            if (updateErr) {
                                console.error("Database query error (update):", updateErr);
                                return callback(updateErr, null);
                            }
                            callback(null, results);
                        });
                    })
                    .catch((err) => {
                        
                        console.error("Database query error (ensure table/columns):", err);
                        callback(err, null);
                    });
            });
        });
    },

    findById: (id, callback) => {
        const sql = `SELECT * FROM \`vendors\` WHERE \`id\` = ?`;

        startConnection((err, connection) => {
            if (err) {
                return callback(err, null);
            }

            connection.query(sql, [id], (queryErr, results) => {
                 // Release the connection

                if (queryErr) {
                    console.error("Database query error: 47", queryErr);
                    return callback(queryErr, null);
                }

                // If no record is found, return `null`
                if (!results || results.length === 0) {
                    return callback(null, null);
                }

                callback(null, results[0]);
            });
        });
    },

    list: (callback) => {
        const sql = `SELECT v.*, av.name FROM \`vendors\` v INNER JOIN \`admins\` av ON v.admin_id = av.id`;

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

    delete: (id, callback) => {
        const sql = `
          DELETE FROM \`vendors\`
          WHERE \`id\` = ?
        `;

        startConnection((err, connection) => {
            if (err) {
                return callback(err, null);
            }

            connection.query(sql, [id], (queryErr, results) => {
                 // Release the connection

                if (queryErr) {
                    console.error("Database query error: 8", queryErr);
                    return callback(queryErr, null);
                }
                callback(null, results);
            });
        });
    },
};

module.exports = Vendor;
