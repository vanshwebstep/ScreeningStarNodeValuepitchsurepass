const crypto = require("crypto");
const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const Customer = {

  checkUniqueId: async (clientUniqueId, callback) => {
    try {
      console.log("Function checkUniqueId called with:", clientUniqueId);

      // Ensure clientUniqueId is not empty
      if (!clientUniqueId) {
        console.log("Validation failed: clientUniqueId is required");
        return callback({ message: "clientUniqueId is required" }, null);
      }

      const sql = `
        SELECT COUNT(*) AS count
        FROM \`customers\`
        WHERE \`client_unique_id\` = ? AND is_deleted != 1
      `;

      console.log("Executing SQL query:", sql);
      console.log("With replacements:", [clientUniqueId]);

      // Execute query
      const results = await sequelize.query(sql, {
        replacements: [clientUniqueId], // Ensure value is correctly passed
        type: QueryTypes.SELECT,
      });

      console.log("Query results:", results);

      // Ensure we handle the response correctly
      const count = results.length > 0 ? results[0].count : 0;

      console.log("Extracted count:", count);

      // Pass result to callback
      callback(null, count > 0);
    } catch (error) {
      console.error("Database query error in checkUniqueId:", error);
      callback({ message: "Database query error", error }, null);
    }
  },




  checkUniqueIdForUpdate: async (customer_id, clientUniqueId, callback) => {

    const sql = `
      SELECT COUNT(*) AS count
      FROM \`customers\`
      WHERE \`client_unique_id\` = ? AND \`id\` != ? AND is_deleted != 1
    `; const results = await sequelize.query(sql, {
      replacements: [clientUniqueId, customer_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    const count = results[0].count;
    callback(null, count > 0);


  },

  checkUsername: async (username, callback) => {


    const sql = `
        SELECT COUNT(*) AS count
        FROM \`customers\`
        WHERE \`username\` = ? AND is_deleted != 1
      `;

    const results = await sequelize.query(sql, {
      replacements: [username], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    const count = results[0].count;
    callback(null, count > 0);

  },

  getDedicatedPointOfContact: async (customer_id, callback) => {
    const sql = "SELECT `dedicated_point_of_contact` FROM `customer_metas` WHERE `customer_id` = ?";

    const results = await sequelize.query(sql, {
      replacements: [customer_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length > 0 && results[0].dedicated_point_of_contact) {
      const emailsString = results[0].dedicated_point_of_contact;
      const emailsArray = emailsString.split(',').map(email => email.trim());

      // Regular expression to validate email format
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      // Filter only valid emails
      const validEmails = emailsArray.filter(email => emailRegex.test(email));


      return callback(null, validEmails);
    } else {
      return callback(null, []);
    }
  },

  checkUsernameForUpdate: async (customer_id, username, callback) => {

    const sql = `
    SELECT COUNT(*) AS count
    FROM \`customers\`
    WHERE \`username\` = ? AND \`id\` != ? AND is_deleted != 1
  `;
    const results = await sequelize.query(sql, {
      replacements: [username, customer_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    const count = results[0].count;
    callback(null, count > 0);


  },

  servicesPackagesData: async (callback) => {
    const sql = `
      SELECT 
        sg.id AS group_id, 
        sg.symbol, 
        sg.title AS group_title, 
        s.id AS service_id, 
        s.title AS service_title
      FROM 
        service_groups sg
      LEFT JOIN 
        services s ON s.group_id = sg.id
      ORDER BY 
        sg.id, s.id
    `;


    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    const groupedData = [];
    const groupMap = new Map();

    results.forEach((row) => {
      const { group_id, symbol, group_title, service_id, service_title } =
        row;

      let group = groupMap.get(group_id);
      if (!group) {
        group = {
          group_id,
          symbol,
          group_title,
          services: [],
        };
        groupMap.set(group_id, group);
        groupedData.push(group);
      }

      // Add service details if the service exists
      if (service_id) {
        group.services.push({
          service_id,
          service_title,
        });
      }
    });

    callback(null, groupedData);


  },

  create: async (customerData, callback) => {

    const sqlCustomers = `
        INSERT INTO \`customers\` (\`client_unique_id\`, \`name\`, \`additional_login\`, \`username\`, \`profile_picture\`, \`emails\`, \`mobile\`, \`services\`, \`admin_id\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const valuesCustomers = [
      customerData?.client_unique_id || null,
      customerData?.name || null,
      customerData?.additional_login || 0,
      customerData?.username || null,
      customerData?.profile_picture || null,
      customerData?.emails_json || null,
      customerData?.mobile_number || null,
      customerData?.services || null,
      customerData?.admin_id || null
    ];
    const results = await sequelize.query(sqlCustomers, {
      replacements: valuesCustomers, // Positional replacements using ?
      type: QueryTypes.INSERT,
    });

    const customerId = results[0];
    callback(null, { insertId: customerId });
  },

  documentUpload: async (customer_id, db_column, savedImagePaths, callback) => {

    const savedImagePathsString = Array.isArray(savedImagePaths) ? savedImagePaths.join(",") : savedImagePaths;

    const sqlUpdateCustomer = `
        UPDATE customer_metas 
        SET ${db_column} = ?
        WHERE customer_id = ?
      `;
    const results = await sequelize.query(sqlUpdateCustomer, {
      replacements: [savedImagePathsString, customer_id],
      type: QueryTypes.UPDATE,
    });
    callback(null, results);

  },

  update: async (customerId, customerData, callback) => {

    const sqlUpdateCustomer = `
        UPDATE \`customers\` 
        SET 
          \`name\` = ?, 
          \`additional_login\` = ?, 
          \`username\` = ?, 
          \`profile_picture\` = ?, 
          \`emails\` = ?, 
          \`mobile\` = ?, 
          \`services\` = ?, 
          \`admin_id\` = ?
        WHERE \`id\` = ?
      `;

    const valuesUpdateCustomer = [
      customerData.name,
      customerData.additional_login,
      customerData.username,
      customerData.profile_picture,
      customerData.emails_json,
      customerData.mobile,
      JSON.stringify(customerData.services),
      customerData.admin_id,
      customerId,
    ];
    const results = await sequelize.query(sqlUpdateCustomer, {
      replacements: valuesUpdateCustomer,
      type: QueryTypes.UPDATE,
    });
    callback(null, results);


  },

  updateByData: async (data, customerId, callback) => {
    try {
      // Extract keys and values from the data object
      const keys = Object.keys(data);
      const values = Object.values(data);

      if (keys.length === 0) {
        return callback(new Error("No data provided to update."));
      }

      // Build SET clause dynamically like: "column1 = ?, column2 = ?"
      const setClause = keys.map((key) => `\`${key}\` = ?`).join(", ");

      // Final SQL query
      const sql = `UPDATE \`customers\` SET ${setClause} WHERE \`id\` = ?`;

      // Push customerId as the last parameter for WHERE clause
      values.push(customerId);

      // Execute the query
      const results = await sequelize.query(sql, {
        replacements: values,
        type: QueryTypes.UPDATE,
      });

      callback(null, results);
    } catch (error) {
      callback(error);
    }
  },

  createCustomerMeta: async (metaData, callback) => {
    const sqlCustomerMetas = `
      INSERT INTO \`customer_metas\` (
        \`customer_id\`, \`address\`,
        \`gst_number\`, \`tat_days\`, 
        \`agreement_date\`, \`agreement_duration\`,
        \`state\`, \`state_code\`, 
        \`client_standard\`,
        \`dedicated_point_of_contact\`,\`first_level_matrix_name\`,\`first_level_matrix_designation\`,\`first_level_matrix_mobile\`,\`first_level_matrix_email\`, \`visible_fields\`, \`custom_template\`, \`custom_address\`, \`disclaimer_emails\`, \`esc_manager_name\`, \`esc_manager_email\`, \`esc_manager_mobile\`, \`esc_manager_desgn\`, \`client_spoc_name\`, \`client_spoc_email\`, \`client_spoc_mobile\`, \`client_spoc_desgn\`, \`billing_spoc_name\`, \`billing_spoc_email\`, \`billing_spoc_mobile\`, \`billing_spoc_desgn\`, \`billing_escalation_name\`, \`billing_escalation_email\`, \`billing_escalation_mobile\`, \`billing_escalation_desgn\`, \`authorized_detail_name\`, \`authorized_detail_email\`, \`authorized_detail_mobile\`, \`authorized_detail_desgn\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valuesCustomerMetas = [
      metaData.customer_id || null,
      metaData.address || null,
      metaData.gst_number || null,
      metaData.tat_days || null,
      metaData.agreement_date || null,
      metaData.agreement_duration || null,
      metaData.state || null,
      metaData.state_code || null,
      metaData.client_standard || null,
      metaData.dedicated_point_of_contact || null,
      metaData.first_level_matrix_name || null,
      metaData.first_level_matrix_designation || null,
      metaData.first_level_matrix_mobile || null,
      metaData.first_level_matrix_email || null,
      metaData.visible_fields || null,
      metaData.custom_template || null,
      metaData.custom_address || null,
      metaData.disclaimer_emails || null,
      metaData.esc_manager_name || '',
      metaData.esc_manager_email || '',
      metaData.esc_manager_mobile || '',
      metaData.esc_manager_desgn || '',
      metaData.client_spoc_name || '',
      metaData.client_spoc_email || '',
      metaData.client_spoc_mobile || '',
      metaData.client_spoc_desgn || '',
      metaData.billing_spoc_name || '',
      metaData.billing_spoc_email || '',
      metaData.billing_spoc_mobile || '',
      metaData.billing_spoc_desgn || '',
      metaData.billing_escalation_name || '',
      metaData.billing_escalation_email || '',
      metaData.billing_escalation_mobile || '',
      metaData.billing_escalation_desgn || '',
      metaData.authorized_detail_name || '',
      metaData.authorized_detail_email || '',
      metaData.authorized_detail_mobile || '',
      metaData.authorized_detail_desgn || '',
    ];


    const results = await sequelize.query(sqlCustomerMetas, {
      replacements: valuesCustomerMetas, // Positional replacements using ?
      type: QueryTypes.INSERT,
    });
    callback(null, results);

  },

  updateCustomerMetaByCustomerId: async (customerId, metaData, callback) => {
    const sqlUpdateCustomerMetas = `
      UPDATE \`customer_metas\` 
      SET 
        \`address\` = ?, 
        \`gst_number\` = ?, 
        \`tat_days\` = ?, 
        \`agreement_date\` = ?, 
        \`agreement_duration\` = ?,
        \`state\` = ?, 
        \`state_code\` = ?, 
        \`client_standard\` = ?,
        \`dedicated_point_of_contact\` = ?,
        \`first_level_matrix_name\` = ?,
        \`first_level_matrix_designation\` = ?,
        \`first_level_matrix_mobile\` = ?,
        \`first_level_matrix_email\` = ?,
        \`visible_fields\` = ?,
        \`custom_template\` = ?,
        \`custom_address\` = ?,
        \`disclaimer_emails\` = ?,
        \`esc_manager_name\` = ?,
        \`esc_manager_email\` = ?,
        \`esc_manager_mobile\` = ?,
        \`esc_manager_desgn\` = ?,
        \`client_spoc_name\` = ?,
        \`client_spoc_email\` = ?,
        \`client_spoc_mobile\` = ?,
        \`client_spoc_desgn\` = ?,
        \`billing_spoc_name\` = ?,
        \`billing_spoc_email\` = ?,
        \`billing_spoc_mobile\` = ?,
        \`billing_spoc_desgn\` = ?,
        \`billing_escalation_name\` = ?,
        \`billing_escalation_email\` = ?,
        \`billing_escalation_mobile\` = ?,
        \`billing_escalation_desgn\` = ?,
        \`authorized_detail_name\` = ?,
        \`authorized_detail_email\` = ?,
        \`authorized_detail_mobile\` = ?,
        \`authorized_detail_desgn\` = ?
      WHERE \`customer_id\` = ?
    `;
    const valuesUpdateCustomerMetas = [
      metaData.address,
      metaData.gst_number,
      metaData.tat_days,
      metaData.agreement_date,
      metaData.agreement_duration,
      metaData.state,
      metaData.state_code,
      metaData.client_standard,
      metaData.dedicated_point_of_contact,
      metaData.first_level_matrix_name,
      metaData.first_level_matrix_designation,
      metaData.first_level_matrix_mobile,
      metaData.first_level_matrix_email,
      metaData.visible_fields,
      metaData.custom_template,
      metaData.custom_address,
      metaData.disclaimer_emails,
      metaData.esc_manager_name || "",
      metaData.esc_manager_email || "",
      metaData.esc_manager_mobile || "",
      metaData.esc_manager_desgn || "",
      metaData.client_spoc_name || "",
      metaData.client_spoc_email || "",
      metaData.client_spoc_mobile || "",
      metaData.client_spoc_desgn || "",
      metaData.billing_spoc_name || "",
      metaData.billing_spoc_email || "",
      metaData.billing_spoc_mobile || "",
      metaData.billing_spoc_desgn || "",
      metaData.billing_escalation_name || "",
      metaData.billing_escalation_email || "",
      metaData.billing_escalation_mobile || "",
      metaData.billing_escalation_desgn || "",
      metaData.authorized_detail_name || "",
      metaData.authorized_detail_email || "",
      metaData.authorized_detail_mobile || "",
      metaData.authorized_detail_desgn || "",
      customerId,
    ];



    const results = await sequelize.query(sqlUpdateCustomerMetas, {
      replacements: valuesUpdateCustomerMetas, // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });

    callback(null, results);

  },

  list: async (callback) => {
    try {
      const sql = `
      SELECT 
        customers.*, 
        customers.id AS main_id, 
        customer_metas.*, 
        customer_metas.id AS meta_id,
        COALESCE(branch_counts.branch_count, 0) AS branch_count
      FROM 
        customers
      LEFT JOIN 
        customer_metas 
      ON 
        customers.id = customer_metas.customer_id
      LEFT JOIN 
        (
          SELECT 
            customer_id, 
            COUNT(*) AS branch_count
          FROM 
            branches
          GROUP BY 
            customer_id
        ) AS branch_counts
      ON 
        customers.id = branch_counts.customer_id
      WHERE 
        customers.status != '0' AND customers.is_deleted != 1
      ORDER BY 
        customers.created_at DESC;
    `;

      const results = await sequelize.query(sql, { type: QueryTypes.SELECT });

      // Process service titles asynchronously
      const updateServiceTitles = async (customerData) => {
        try {
          let servicesData = [];

          if (customerData.services) {
            try {
              servicesData = JSON.parse(customerData.services);
            } catch (err) {
              console.error("Invalid services JSON", err);
              return;
            }
          }

          // Collect all serviceIds & packageIds
          const serviceIds = [];
          const packageIds = [];

          servicesData.forEach(group => {
            if (Array.isArray(group.services)) {
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
            }
          });

          const uniqueServiceIds = [...new Set(serviceIds)];
          const uniquePackageIds = [...new Set(packageIds)];

          // Fetch services
          const serviceMap = {};
          if (uniqueServiceIds.length) {
            const serviceRows = await sequelize.query(
              `SELECT id, title FROM services WHERE id IN (:ids)`,
              {
                type: QueryTypes.SELECT,
                replacements: { ids: uniqueServiceIds }
              }
            );

            serviceRows.forEach(row => {
              serviceMap[row.id] = row.title;
            });
          }

          // Fetch packages
          const packageMap = {};
          if (uniquePackageIds.length) {
            const pkgRows = await sequelize.query(
              `SELECT id, title FROM packages WHERE id IN (:ids)`,
              {
                type: QueryTypes.SELECT,
                replacements: { ids: uniquePackageIds }
              }
            );

            pkgRows.forEach(row => {
              packageMap[row.id] = row.title;
            });
          }

          // Update structure
          servicesData = servicesData
            .map(group => {
              if (!Array.isArray(group.services)) return null;

              group.services = group.services
                .map(service => {
                  const title = serviceMap[service.serviceId];

                  if (!title) {
                    console.log(`⚠️ Service ID ${service.serviceId} not found — removing`);
                    return null;
                  }

                  service.serviceTitle = title;
                  console.log(`Mapped service ID ${service} to title:`,);
                  // Update packages
                  const updatedPackages = {};
                  if (service.packages && typeof service.packages === "object") {
                    Object.keys(service.packages).forEach(pkgId => {
                      const pkgTitle = packageMap[Number(pkgId)];
                      if (pkgTitle) {
                        updatedPackages[pkgId] = pkgTitle;
                      }
                    });
                  }

                  service.packages = updatedPackages;
                  return service;
                })
                .filter(Boolean);

              // Remove group if no services left
              return group.services.length ? group : null;
            })
            .filter(Boolean);

          customerData.services = JSON.stringify(servicesData);
        } catch (err) {
          console.error(
            "Error processing services for customer ID:",
            customerData.main_id,
            err
          );
        }
      };


      // Execute service title updates for all customers in parallel
      await Promise.all(results.map(updateServiceTitles));

      callback(null, results);
    } catch (err) {
      console.error("Database query error:", err);
      callback(err, null);
    }
  },

  listWithBasicInfo: async (callback) => {
    const sql = `
    SELECT
      id, 
      name,
      client_unique_id
    FROM 
      customers
    WHERE 
      customers.status != '0'
      AND customers.is_deleted != 1
  `;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  },

  inactiveList: async (callback) => {
    const sql = `
    SELECT 
      customers.*, 
      customers.id AS main_id, 
      customer_metas.*, 
      customer_metas.id AS meta_id,
      COALESCE(branch_counts.branch_count, 0) AS branch_count
    FROM 
      customers
    LEFT JOIN 
      customer_metas 
    ON 
      customers.id = customer_metas.customer_id
    LEFT JOIN 
      (
        SELECT 
          customer_id, 
          COUNT(*) AS branch_count
        FROM 
          branches
        GROUP BY 
          customer_id
      ) AS branch_counts
    ON 
      customers.id = branch_counts.customer_id
    WHERE 
      customers.status != '1'
      AND customers.is_deleted != 1
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


        // Update service titles for each group of services
        for (const group of servicesData) {
          for (const service of group.services) {
            const serviceSql = `SELECT title FROM services WHERE id = ?`;

            const results = await sequelize.query(serviceSql, {
              replacements: [service.serviceId], // Positional replacements using ?
              type: QueryTypes.SELECT,
            });

            const [rows] = await new Promise((resolve) => {
              resolve(results);

            });

            if (rows && rows.length > 0 && rows[0].title) {
              service.serviceTitle = rows[0].title;
            }
          }
        }
        customerData.services = JSON.stringify(servicesData);
        // Add the updated customer data to the array
        updatedCustomers.push(customerData);
      }
      callback(null, updatedCustomers);
    };
    updateAllServiceTitles();


  },

  basicInfoByID: async (customer_id, callback) => {
    try {
      // Fetch basic customer info and metadata
      const sql = `
        SELECT 
          customers.client_unique_id,
          customers.name, 
          customers.profile_picture, 
          customers.emails, 
          customers.mobile, 
          customers.services,
          customers.id, 
          customer_metas.address,
          customer_metas.gst_number,
          customer_metas.id AS meta_id,
          customer_metas.visible_fields
        FROM 
          customers
        LEFT JOIN 
          customer_metas 
        ON 
          customers.id = customer_metas.customer_id
        WHERE 
          customers.id = ?
          AND customers.is_deleted != 1
      `;

      const results = await sequelize.query(sql, {
        type: QueryTypes.SELECT,
        replacements: [customer_id],
      });

      if (!results.length) {
        return callback(null, { message: "No customer data found" });
      }

      const customerData = results[0];

      // Parse services JSON if present
      let servicesData = [];
      if (customerData.services) {
        try {
          servicesData = JSON.parse(customerData.services);
        } catch (parseError) {
          console.error("Error parsing services JSON:", parseError);
          return callback(parseError, null);
        }
      }

      // Fetch all service titles in parallel (if there are any services)
      if (Array.isArray(servicesData) && servicesData.length > 0) {
        for (const group of servicesData) {
          if (group.serviceId) {
            const serviceSql = `SELECT title FROM services WHERE id = ? LIMIT 1`;
            const [serviceResult] = await sequelize.query(serviceSql, {
              type: QueryTypes.SELECT,
              replacements: [group.serviceId],
            });

            if (serviceResult && serviceResult.title) {
              group.serviceTitle = serviceResult.title;
            }
          }
        }
      }

      // Attach updated service titles to customer data
      customerData.services = JSON.stringify(servicesData);

      return callback(null, customerData);

    } catch (err) {
      console.error("Database query error:", err);
      return callback(err, null);
    }
  },

  infoByID: async (customer_id, callback) => {
    const sql = `
    SELECT 
      customers.*, 
      customers.id AS main_id, 
      customer_metas.*, 
      customer_metas.id AS meta_id
    FROM 
      customers
    LEFT JOIN 
      customer_metas 
    ON 
      customers.id = customer_metas.customer_id
    WHERE 
      customers.id = ?
      AND customers.is_deleted != 1
  `;

    try {


      const results = await sequelize.query(sql, {
        replacements: [customer_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });


      if (results.length === 0) {
        return callback(null, { message: "No customer data found" });
      }

      const customerData = results[0];
      customerData.client_spoc_details = null;
      console.log(`Fetched customer data for ID ${customer_id}:`, customerData);
      /**
       * Update service & package titles
       */
      const updateServiceTitles = async () => {
        let servicesData = [];

        if (!customerData.services) return;

        try {
          console.log(`Parsing services JSON for customer ID ${customerData.services}`);
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
                console.log(`Mapping service ID ${service.service_type} to title:`, title);
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
    } catch (err) {
      console.error("Error:", err);
      callback(err, null);
    }
  },

  getCustomerById: async (id, callback) => {
    try {
      // Fetch basic customer details
      const sql = "SELECT C.*, CM.tat_days, CM.visible_fields, CM.custom_template, CM.custom_logo, CM.custom_address, CM.disclaimer_emails FROM `customers` C INNER JOIN `customer_metas` CM ON CM.customer_id = C.id WHERE C.`id` = ? AND C.is_deleted != 1";

      const results = await sequelize.query(sql, {
        type: QueryTypes.SELECT,
        replacements: [id],
      });

      if (!results.length) {
        return callback(null, { message: "No customer data found" });
      }

      let customerData = results[0];

      // console.log(`customerData - `, customerData);
      // Parse services JSON safely
      let servicesData;
      try {
        servicesData = JSON.parse(customerData.services);
      } catch (parseError) {
        return callback(parseError, null);
      }

      // console.log(`servicesData - `, servicesData);

      // Update service titles
      for (const group of servicesData) {
        for (const service of group.services) {
          const serviceSql = `SELECT title FROM services WHERE id = ?`;
          const serviceResult = await sequelize.query(serviceSql, {
            type: QueryTypes.SELECT,
            replacements: [service.serviceId],
          });

          if (serviceResult.length && serviceResult[0].title) {
            service.serviceTitle = serviceResult[0].title;
          }
        }
      }

      // Attach updated service titles
      customerData.services = JSON.stringify(servicesData);
      callback(null, customerData);
    } catch (err) {
      console.error("Database query error:", err);
      callback(err, null);
    }
  },

  getActiveCustomerById: async (id, callback) => {
    const sql = "SELECT * FROM `customers` WHERE `id` = ? AND `status` = ? AND is_deleted != 1";

    const results = await sequelize.query(sql, {
      replacements: [id, "1"], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);
  },

  getAllBranchesByCustomerId: async (customerId, callback) => {
    const sql = "SELECT * FROM `branches` WHERE `customer_id` = ?";
    const results = await sequelize.query(sql, {
      replacements: [customerId], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  },

  getClientUniqueIDByCustomerId: async (id, callback) => {
    const sql = "SELECT `client_unique_id` FROM `customers` WHERE `id` = ? AND is_deleted != 1";

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (results.length > 0 && results[0].client_unique_id) {
      return callback(null, results[0].client_unique_id);
    } else {
      return callback(null, false); // Return false if not found or invalid
    }


  },

  getCustomerMetaById: async (id, callback) => {
    const sql = "SELECT * FROM `customer_metas` WHERE `customer_id` = ?";
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    callback(null, results[0]);

  },

  active: async function (id, callback) {
    const sql = `
      UPDATE \`customers\`
      SET \`status\` = ?
      WHERE \`id\` = ?
    `;
    await sequelize.query(sql, {
      replacements: ["1", id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    }).then(([results, metadata]) => {
      callback(null, metadata); // metadata contains affectedRows count
    })
      .catch((error) => {
        callback(error, null);
      });
  }
  ,

  inactive: async (id, callback) => {
    const sql = `
      UPDATE \`customers\`
      SET \`status\` = ?
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: ["0", id],
      type: QueryTypes.UPDATE,
    });
    callback(null, results);
  },
  delete: async (id, callback) => {


    const checkSql = `SELECT is_deleted FROM \`customers\` WHERE id = ?`;
    const results = await sequelize.query(checkSql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (results.length === 0) {
      return callback({ message: "Client not found" }, null);
    }

    if (results[0].is_deleted === 1) {
      return callback({ message: "Client already deleted" }, null);
    }

    const deleteSql = `
          UPDATE \`customers\`
          SET is_deleted = 1, deleted_at = NOW()
          WHERE id = ?
        `;
    const resultss = await sequelize.query(deleteSql, {
      replacements: [id],
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

  findByEmailOrMobile: async (username, callback) => {
    const sql = `
    SELECT \`id\`, \`email\`, \`mobile\`, \`password\`
    FROM \`customers\`
    WHERE \`email\` = ? OR \`mobile\` = ? AND is_deleted != 1
  `;
    const results = await sequelize.query(sql, {
      replacements: [username, username], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results);

  },

  validatePassword: async (username, password, callback) => {
    const sql = `
      SELECT \`id\`, \`password\` FROM \`customers\`
      WHERE \`email\` = ? OR \`mobile\` = ? AND is_deleted != 1
    `;
    const results = await sequelize.query(sql, {
      replacements: [username, username],
      type: QueryTypes.SELECT,
    });
    if (results.length === 0) {
      return callback(
        { message: "No customer found with the provided email or mobile" },
        null
      );
    }
    const customer = results[0];
    if (hashPassword(password) !== customer.password) {
      return callback({ message: "Incorrect password" }, null);
    }

    callback(null, results);


  },

  updateToken: async (id, token, tokenExpiry, callback) => {
    const sql = `
      UPDATE \`customers\`
      SET \`login_token\` = ?, \`token_expiry\` = ?
      WHERE \`id\` = ?
    `;

    const results = await sequelize.query(sql, {
      replacements: [token, tokenExpiry, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });

    if (results.affectedRows === 0) {
      return callback(
        {
          message:
            "Token update failed. Customer not found or no changes made.",
        },
        null
      );
    }
    callback(null, results);
  },

  validateLogin: async (id, callback) => {
    const sql = `
    SELECT \`login_token\`
    FROM \`customers\` 
    WHERE \`id\` = ? AND is_deleted != 1
  `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (results.length === 0) {
      return callback({ message: "Customer not found" }, null);
    }

    callback(null, results);


  },

  fetchBranchPasswordByEmail: async (email, callback) => {
    const sql = `
      SELECT \`password\` FROM \`branches\` WHERE \`email\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [email], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (results.length > 0 && results[0].password) {
      return callback(null, results[0].password); // Return the password
    } else {
      return callback(null, false); // Return false if no result found or empty
    }
  },

  logout: async (id, callback) => {
    const sql = `
      UPDATE \`customers\`
      SET \`login_token\` = NULL, \`token_expiry\` = NULL
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    if (results.affectedRows === 0) {
      return callback(
        {
          message:
            "Token clear failed. Customer not found or no changes made.",
        },
        null
      );
    }

    callback(null, results);


  },
};

module.exports = Customer;
