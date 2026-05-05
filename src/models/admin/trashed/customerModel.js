const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");
// Function to hash the password using MD5
const hashPassword = (password) =>
    crypto.createHash("md5").update(password).digest("hex");

const Customer = {
    list: async (callback) => {
        const sql = `
             SELECT 
                  c.*, 
                  c.id AS main_id, 
                  cm.*, 
                  cm.id AS meta_id, 
                  COALESCE(b.branch_count, 0) AS branch_count
              FROM customers c
              LEFT JOIN customer_metas cm ON c.id = cm.customer_id
              LEFT JOIN (
                  SELECT customer_id, COUNT(*) AS branch_count 
                  FROM branches 
                  GROUP BY customer_id
              ) b ON c.id = b.customer_id
              WHERE c.is_deleted = 1
              ORDER BY c.created_at DESC;
    `;


        const results = await sequelize.query(sql, {
            type: QueryTypes.SELECT,
        });



        const updatedCustomers = [];

        const updateAllServiceTitles = async () => {
            for (const customerData of results) {
                let servicesData;
                try {
                    servicesData = JSON.parse(customerData.services);
                } catch (parseError) {
                    console.error(
                        "Error parsing services data for customer ID:",
                        customerData.main_id,
                        parseError
                    );
                    return callback(parseError, null);
                }

                try {
                    for (const group of servicesData) {
                        if (Array.isArray(group.services)) {
                            // Ensure 'group.services' is an array
                            for (const service of group.services) {
                                const serviceSql = `SELECT title FROM services WHERE id = ?`;
                                const [rows] = await new Promise(async (resolve, reject) => {

                                    const results = await sequelize.query(serviceSql, {
                                        replacements: [service.serviceId], // Positional replacements using ?
                                        type: QueryTypes.SELECT,
                                    });
                                    resolve(results);

                                });

                                if (rows && rows.length > 0 && rows[0].title) {
                                    service.serviceTitle = rows[0].title;
                                }
                            }
                        } else {
                            console.warn(
                                "group.services is not an array:",
                                group.services
                            );
                        }
                    }
                } catch (err) {
                    console.error(
                        "Error updating service titles for customer ID:",
                        customerData.main_id,
                        err
                    );
                    return callback(err, null);
                }

                customerData.services = JSON.stringify(servicesData);
                // Add the updated customer data to the array
                updatedCustomers.push(customerData);
            }
            callback(null, updatedCustomers);
        };
        updateAllServiceTitles();


    },

    getCustomerById: async (id, callback) => {
        const sql = "SELECT C.*, CM.tat_days, CM.visible_fields, CM.custom_template, CM.custom_logo, CM.custom_address FROM `customers` C INNER JOIN `customer_metas` CM ON CM.customer_id = C.id WHERE C.`id` = ? AND C.is_deleted = 1";
        const results = await sequelize.query(sql, {
            replacements: [id], // Positional replacements using ?
            type: QueryTypes.SELECT,
        });
        if (results.length === 0) {
            return callback(null, { message: "No customer data found" });
        }
        const customerData = results[0];
        
        /**
         * Update service & package titles
         */
        const updateServiceTitles = async () => {
            let servicesData = [];

            if (!customerData.services) return;

            try {
                servicesData = JSON.parse(customerData.services);
            } catch (err) {
                throw new Error("Invalid services JSON");
            }

            const serviceIds = [];
            const packageIds = [];

            // Collect IDs
            servicesData.forEach(group => {
                if (!Array.isArray(group.services)) return;

                group.services.forEach(service => {
                    if (service.serviceId) {
                        serviceIds.push(service.serviceId);
                    }

                    if (service.packages && typeof service.packages === "object") {
                        Object.keys(service.packages).forEach(pkgId => {
                            if (!isNaN(pkgId)) packageIds.push(Number(pkgId));
                        });
                    }
                });
            });

            const uniqueServiceIds = [...new Set(serviceIds)];
            const uniquePackageIds = [...new Set(packageIds)];

            // Fetch service titles
            const serviceMap = {};
            if (uniqueServiceIds.length) {
                const rows = await sequelize.query(
                    `SELECT id, title FROM services WHERE id IN (:ids)`,
                    {
                        type: QueryTypes.SELECT,
                        replacements: { ids: uniqueServiceIds }
                    }
                );

                rows.forEach(r => (serviceMap[r.id] = r.title));
            }

            // Fetch package titles
            const packageMap = {};
            if (uniquePackageIds.length) {
                const rows = await sequelize.query(
                    `SELECT id, title FROM packages WHERE id IN (:ids)`,
                    {
                        type: QueryTypes.SELECT,
                        replacements: { ids: uniquePackageIds }
                    }
                );

                rows.forEach(r => (packageMap[r.id] = r.title));
            }

            // Update structure
            servicesData = servicesData
                .map(group => {
                    if (!Array.isArray(group.services)) return null;

                    group.services = group.services
                        .map(service => {
                            const title = serviceMap[service.serviceId];

                            if (!title) return null;

                            service.serviceTitle = title;

                            const updatedPackages = {};
                            if (service.packages && typeof service.packages === "object") {
                                Object.keys(service.packages).forEach(pkgId => {
                                    const pkgTitle = packageMap[Number(pkgId)];
                                    if (pkgTitle) updatedPackages[pkgId] = pkgTitle;
                                });
                            }

                            service.packages = updatedPackages;
                            return service;
                        })
                        .filter(Boolean);

                    return group.services.length ? group : null;
                })
                .filter(Boolean);

            customerData.services = JSON.stringify(servicesData);
        };

        await updateServiceTitles();

        callback(null, customerData);
    },

    restore: async (id, callback) => {

        const checkSql = `SELECT is_deleted FROM \`customers\` WHERE id = ?`;
        const results = await sequelize.query(checkSql, {
            replacements: [id], // Positional replacements using ?
            type: QueryTypes.SELECT,
        });
        if (results.length === 0) {
            return callback({ message: "Client not found" }, null);
        }

        if (results[0].is_deleted !== 1) {
            return callback({ message: "Client is not deleted" }, null);
        }

        const deleteSql = `
          UPDATE \`customers\`
          SET is_deleted = 0, deleted_at = NULL
          WHERE id = ?
        `;
        const resultss = await sequelize.query(deleteSql, {
            replacements: [id], // Positional replacements using ?
            type: QueryTypes.UPDATE,
        });
        callback(null, { message: "Client successfully deleted", resultss });



    },

    destroy: async (id, callback) => {
        const sql = `
        DELETE FROM \`customers\`
        WHERE \`id\` = ?
      `;
        const results = await sequelize.query(sql, {
            replacements: [id], // Positional replacements using ?
            type: QueryTypes.DELETE,
        });
        callback(null, results);


    },
};

module.exports = Customer;
