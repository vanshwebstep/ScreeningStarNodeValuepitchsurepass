const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/db");
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const Customer = {
  list: async (filter_status, callback) => {
    let customers_id = [];

    if (filter_status && filter_status !== null && filter_status !== "") {
      // Query when `filter_status` exists
      const sql = `
        SELECT b.customer_id, 
               b.id AS branch_id, 
               b.name AS branch_name, 
               COUNT(ca.id) AS application_count,
               MAX(ca.created_at) AS latest_application_date
        FROM client_applications ca
        INNER JOIN branches b ON ca.branch_id = b.id
        INNER JOIN customers c ON ca.customer_id = c.id
        WHERE ca.status = ? 
          AND c.status = 1
          AND ca.is_deleted != 1
        GROUP BY b.customer_id, b.id, b.name
        ORDER BY latest_application_date DESC;
      `;
      const results = await sequelize.query(sql, {
        replacements: [filter_status],
        type: QueryTypes.SELECT,
      });

      results.forEach((row) => {
        customers_id.push(row.customer_id);
      });

      let customersIDConditionString = "";
      if (customers_id.length > 0) {
        customersIDConditionString = ` AND customers.id IN (${customers_id.join(
          ","
        )})`;
      }

      // If filter_status is provided, proceed with the final SQL query without filters
      const finalSql = `
      WITH BranchesCTE AS (
          SELECT 
              b.id AS branch_id,
              b.customer_id
          FROM 
              branches b
      )
      SELECT 
          customers.client_unique_id,
          customers.name,
          customer_metas.tat_days,
          customer_metas.single_point_of_contact,
          customer_metas.client_spoc_name,
          customers.id AS main_id,
          COALESCE(branch_counts.branch_count, 0) AS branch_count,
          COALESCE(application_counts.application_count, 0) AS application_count
      FROM 
          customers
      LEFT JOIN 
          customer_metas ON customers.id = customer_metas.customer_id
      LEFT JOIN (
          SELECT 
              customer_id, 
              COUNT(*) AS branch_count
          FROM 
              branches
          GROUP BY 
              customer_id
      ) AS branch_counts ON customers.id = branch_counts.customer_id
      LEFT JOIN (
          SELECT 
              b.customer_id, 
              COUNT(ca.id) AS application_count,
              MAX(ca.created_at) AS latest_application_date
          FROM 
              BranchesCTE b
          INNER JOIN 
              client_applications ca ON b.branch_id = ca.branch_id
          WHERE ca.is_data_qc = 0 AND ca.is_deleted != 1
          GROUP BY 
              b.customer_id
      ) AS application_counts ON customers.id = application_counts.customer_id
      WHERE 
          customers.status = 1
          AND customers.is_deleted != 1
          AND COALESCE(application_counts.application_count, 0) > 0
          ${customersIDConditionString}
      ORDER BY 
          application_counts.latest_application_date DESC;
    `;

      connection.query(finalSql, async (err, results) => {
        // Always release the connection
        if (err) {
          console.error("Database query error: 38", err);
          return callback(err, null);
        }
        // Process each result to fetch client_spoc names
        for (const result of results) {
          const headBranchApplicationsCountQuery = `SELECT COUNT(*) FROM \`client_applications\` ca INNER JOIN \`branches\` b ON ca.branch_id = b.id WHERE ca.customer_id = ? AND b.customer_id = ? AND b.is_head = ? AND ca.is_deleted != 1`;
          const headBranchApplicationsCount = await new Promise(
            (resolve, reject) => {
              connection.query(
                headBranchApplicationsCountQuery,
                [result.main_id, result.main_id, 1], // Parameters passed correctly
                (headBranchErr, headBranchResults) => {
                  if (headBranchErr) {
                    return reject(headBranchErr);
                  }
                  resolve(headBranchResults[0]["COUNT(*)"]); // Get the count result
                }
              );
            }
          );
          console.log(`rawResult - `, result);
          result.head_branch_applications_count =
            headBranchApplicationsCount;
          // if (result.branch_count === 1) {
          // Query client_spoc table to fetch names for these IDs
          const headBranchQuery = `SELECT id, is_head FROM \`branches\` WHERE \`customer_id\` = ? AND \`is_head\` = ?`;

          try {
            const headBranchID = await new Promise((resolve, reject) => {
              connection.query(
                headBranchQuery,
                [result.main_id, 1], // Properly pass query parameters as an array
                (headBranchErr, headBranchResults) => {
                  if (headBranchErr) {
                    return reject(headBranchErr);
                  }
                  resolve(
                    headBranchResults.length > 0
                      ? headBranchResults[0].id
                      : null
                  );
                }
              );
            });

            // Attach head branch id and application count to the current result
            result.head_branch_id = headBranchID;
          } catch (headBranchErr) {
            console.error(
              "Error fetching head branch id or applications count:",
              headBranchErr
            );
            result.head_branch_id = null;
            result.head_branch_applications_count = 0;
          }
          // }
        }
        console.log(`results - `, results);
        callback(null, results);
      });

    } else {
      // If no filter_status is provided, proceed with the final SQL query without filters
      const finalSql = `
     WITH BranchesCTE AS (
         SELECT 
             b.id AS branch_id,
             b.customer_id
         FROM 
             branches b
     )
     SELECT 
         customers.client_unique_id,
         customers.name,
         customer_metas.tat_days,
         customer_metas.single_point_of_contact,
         customer_metas.client_spoc_name,
         customers.id AS main_id,
         COALESCE(branch_counts.branch_count, 0) AS branch_count,
         COALESCE(application_counts.application_count, 0) AS application_count
     FROM 
         customers
     LEFT JOIN 
         customer_metas ON customers.id = customer_metas.customer_id
     LEFT JOIN (
         SELECT 
             customer_id, 
             COUNT(*) AS branch_count
         FROM 
             branches
         GROUP BY 
             customer_id
     ) AS branch_counts ON customers.id = branch_counts.customer_id
     LEFT JOIN (
         SELECT 
             b.customer_id, 
             COUNT(ca.id) AS application_count,
             MAX(ca.created_at) AS latest_application_date
         FROM 
             BranchesCTE b
         INNER JOIN 
             client_applications ca ON b.branch_id = ca.branch_id
         WHERE ca.is_data_qc = 0 AND ca.is_deleted != 1
         GROUP BY 
             b.customer_id
     ) AS application_counts ON customers.id = application_counts.customer_id
     WHERE 
         customers.status = 1
         AND customers.is_deleted != 1
         AND COALESCE(application_counts.application_count, 0) > 0
     ORDER BY 
         application_counts.latest_application_date DESC;
   `;

      const results = await sequelize.query(finalSql, {
        type: QueryTypes.SELECT,
      });
      for (const result of results) {

        const headBranchApplicationsCountQuery = `SELECT COUNT(*) FROM \`client_applications\` ca INNER JOIN \`branches\` b ON ca.branch_id = b.id WHERE ca.customer_id = ? AND b.customer_id = ? AND b.is_head = ? AND ca.is_data_qc = ? AND ca.is_deleted != 1`;
        const headBranchApplicationsCount = await new Promise(async (resolve) => {
          const headBranchResults = await sequelize.query(headBranchApplicationsCountQuery, {
            replacements: [result.main_id, result.main_id, 1, 0], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });

          resolve(headBranchResults[0]["COUNT(*)"]); // Get the count result

        }
        );
        result.head_branch_applications_count = headBranchApplicationsCount;
        // if (result.branch_count === 1) {
        // Query client_spoc table to fetch names for these IDs
        const headBranchQuery = `SELECT id, is_head FROM \`branches\` WHERE \`customer_id\` = ? AND \`is_head\` = ?`;

        try {
          const headBranchID = await new Promise(async (resolve) => {
            const headBranchResults = await sequelize.query(headBranchQuery, {
              replacements: [result.main_id, 1], // Positional replacements using ?
              type: QueryTypes.SELECT,
            });
            resolve(
              headBranchResults.length > 0
                ? headBranchResults[0].id
                : null
            );

          });

          // Attach head branch id and application count to the current result
          result.head_branch_id = headBranchID;
        } catch (headBranchErr) {
          console.error(
            "Error fetching head branch id or applications count:",
            headBranchErr
          );
          result.head_branch_id = null;
          result.head_branch_applications_count = 0;
        }
        // }
      }
      callback(null, results);

    }

  },

  listByCustomerID: async (customer_id, filter_status, callback) => {
    try {
      // Base SQL query with mandatory condition for status
      let sql = `
         SELECT b.id AS branch_id, 
                b.name AS branch_name, 
                COUNT(ca.id) AS application_count,
                MAX(ca.created_at) AS latest_application_date
         FROM client_applications ca
         INNER JOIN branches b ON ca.branch_id = b.id
         WHERE b.is_head != 1 
           AND b.customer_id = ? 
           AND ca.is_data_qc = 0 
           AND ca.is_deleted != 1`;

      // Array to hold query parameters
      const queryParams = [customer_id];

      // Check if filter_status is provided
      if (filter_status) {
        sql += ` AND ca.status = ?`;
        queryParams.push(filter_status);
      }

      sql += ` GROUP BY b.id, b.name 
               ORDER BY latest_application_date DESC;`;

      // Execute query correctly
      const results = await sequelize.query(sql, {
        replacements: queryParams,
        type: QueryTypes.SELECT,
      });

      callback(null, results);
    } catch (error) {
      callback(error, null);
    }
  },


  applicationListByBranch: async (filter_status, branch_id, status, callback) => {

  // ─── Safe JSON parse helper ───────────────────────────────────────────────
  const safeJsonParse = (str, fallback = null) => {
    if (!str || typeof str !== "string") return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      console.warn("safeJsonParse: invalid JSON, skipping →", e.message);
      return fallback;
    }
  };

  // ─── Base SQL ─────────────────────────────────────────────────────────────
  let sql = `
    SELECT 
      ca.*, 
      ca.id AS main_id,
      cmt.first_insufficiency_marks,
      cmt.first_insuff_date,
      cmt.first_insuff_reopened_date,
      cmt.second_insufficiency_marks,
      cmt.second_insuff_date,
      cmt.second_insuff_reopened_date,
      cmt.third_insufficiency_marks,
      cmt.third_insuff_date,
      cmt.third_insuff_reopened_date,
      cmt.overall_status,
      cmt.initiation_date,
      cmt.is_verify,
      cmt.report_date,
      cmt.report_status,
      cmt.report_type,
      cmt.qc_done_by,
      qc_admin.name  AS qc_done_by_name,
      cmt.delay_reason,
      cmt.report_generate_by,
      report_admin.name AS report_generated_by_name,
      cmt.case_upload
    FROM  \`client_applications\` ca
    LEFT JOIN \`cmt_applications\`  cmt       ON ca.id = cmt.client_application_id
    LEFT JOIN \`admins\` AS qc_admin           ON qc_admin.id  = cmt.qc_done_by
    LEFT JOIN \`admins\` AS report_admin       ON report_admin.id = cmt.report_generate_by
    WHERE ca.\`branch_id\` = ?
      AND ca.\`is_data_qc\` = 0
      AND ca.is_deleted != 1`;

  const params = [branch_id];

  if (filter_status && filter_status.trim() !== "") {
    sql += ` AND ca.\`status\` = ?`;
    params.push(filter_status);
  }

  if (typeof status === "string" && status.trim() !== "") {
    sql += ` AND ca.\`status\` = ?`;
    params.push(status);
  }

  sql += ` ORDER BY ca.\`created_at\` DESC;`;

  try {
    // ─── Main query ───────────────────────────────────────────────────────
    const results = await sequelize.query(sql, {
      replacements: params,
      type: QueryTypes.SELECT,
    });

    // ─── Per-application enrichment ───────────────────────────────────────
    await Promise.all(
      results.map(async (clientApp) => {
        const servicesResult = { annexure_attachments: {} };
        const servicesIds = clientApp.services
          ? clientApp.services.split(",").map((s) => s.trim()).filter(Boolean)
          : [];

        // ── Service titles ─────────────────────────────────────────────
        if (servicesIds.length) {
          const rows = await sequelize.query(
            "SELECT title FROM `services` WHERE id IN (?)",
            { replacements: [servicesIds], type: QueryTypes.SELECT }
          );
          clientApp.serviceNames = rows.map((r) => r.title);
        } else {
          clientApp.serviceNames = [];
        }

        // ── Collect file-input columns per db_table ────────────────────
        const dbTableFileInputs  = {};
        const dbTableColumnLabel = {};
        const dbTableWithHeadings = {};

        await Promise.all(
          servicesIds.map(async (serviceId) => {
            // Guard: serviceId must be a usable value
            if (!serviceId) return;

            const rows = await sequelize.query(
              "SELECT `json` FROM `report_forms` WHERE `service_id` = ?",
              { replacements: [serviceId], type: QueryTypes.SELECT }
            );

            // Guard: no report_form row for this service
            if (!rows.length || !rows[0].json) return;

            // Guard: invalid JSON → skip this service gracefully
            const jsonData = safeJsonParse(rows[0].json);
            if (!jsonData) return;

            const dbTable = jsonData.db_table;
            const heading = jsonData.heading;

            // Guard: db_table must exist in JSON
            if (!dbTable) return;

            if (heading) dbTableWithHeadings[dbTable] = heading;
            if (!dbTableFileInputs[dbTable]) dbTableFileInputs[dbTable] = [];

            // Guard: rows array must exist
            if (!Array.isArray(jsonData.rows)) return;

            jsonData.rows.forEach((row) => {
              // Guard: row must have a label and inputs array
              if (!row || !row.label || !Array.isArray(row.inputs)) return;

              const inputLabel = row.label;
              row.inputs.forEach((input) => {
                // Guard: input must be a file type with a name
                if (!input || input.type !== "file" || !input.name) return;

                const inputName = input.name.replace(/\s+/g, "");
                dbTableFileInputs[dbTable].push(inputName);
                dbTableColumnLabel[inputName] = inputLabel;
              });
            });
          })
        );

        // ── Fetch file attachment values from each db_table ────────────
        await Promise.all(
          Object.entries(dbTableFileInputs).map(
            async ([dbTable, fileInputNames]) => {
              // Guard: nothing to query
              if (!fileInputNames.length) return;

              // Guard: table must actually exist in DB
              const [tableCheck] = await sequelize.query(
                `SELECT COUNT(*) AS count
                 FROM information_schema.tables
                 WHERE table_schema = DATABASE() AND table_name = :dbTable`,
                { replacements: { dbTable }, type: QueryTypes.SELECT }
              );
              if (!tableCheck || tableCheck.count === 0) {
                console.warn(`Table '${dbTable}' does not exist. Skipping.`);
                return;
              }

              // Guard: only query columns that actually exist in the table
              const describedCols = await sequelize.query(
                `DESCRIBE ${dbTable}`,
                { type: QueryTypes.SELECT }
              );
              const existingColumns = describedCols.map((c) => c.Field);
              const validColumns = fileInputNames.filter((col) =>
                existingColumns.includes(col)
              );

              // Guard: none of our target columns exist
              if (!validColumns.length) return;

              const rows = await sequelize.query(
                `SELECT ${validColumns.join(", ")} FROM ${dbTable} WHERE client_application_id = ?`,
                { replacements: [clientApp.main_id], type: QueryTypes.SELECT }
              );

              // Guard: no rows returned
              if (!rows.length) return;

              const updatedRows = rows
                .map((row) => {
                  const updatedRow = {};
                  for (const [key, value] of Object.entries(row)) {
                    if (value !== null && value !== undefined && value !== "") {
                      updatedRow[dbTableColumnLabel[key] || key] = value;
                    }
                  }
                  return Object.keys(updatedRow).length > 0 ? updatedRow : null;
                })
                .filter(Boolean);

              if (updatedRows.length > 0) {
                const headingKey = dbTableWithHeadings[dbTable] || dbTable;
                servicesResult.annexure_attachments[headingKey] = updatedRows;
              }
            }
          )
        );

        clientApp.service_data = servicesResult;
      })
    );

    callback(null, results);
  } catch (error) {
    console.error("Error processing applicationListByBranch:", error);
    callback(error, null);
  }
},

  applicationByID: async (application_id, branch_id, callback) => {
    // Start a connection

    // Use a parameterized query to prevent SQL injection
    const sql =
      "SELECT * FROM `client_applications` WHERE `id` = ? AND `branch_id` = ? AND `is_data_qc` = 0 AND is_deleted != 1 ORDER BY `created_at` DESC";
    const results = await sequelize.query(sql, {
      replacements: [application_id, branch_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    callback(null, results[0] || null); // Return single application or null if not found


  },

  getCMTApplicationById: async (client_application_id, callback) => {

    const sql =
      "SELECT `month_year`,`initiation_date`,`organization_name`,`verification_purpose`,`employee_id`,`client_code`,`applicant_name`,`contact_number`,`contact_number2`,`father_name`,`dob`,`gender`,`marital_status`,`address`,`landmark`,`residence_mobile_number`,`state`,`permanent_address`,`permanent_sender_name`,`permanent_receiver_name`,`permanent_landmark`,`permanent_pin_code`,`permanent_state`,`spouse_name`,`Nationality`,`QC_Date`,`QC_Analyst_Name`,`Data_Entry_Analyst_Name`,`Date_of_Data`,`insuff`,`address_house_no`,`address_floor`,`address_cross`,`address_street`,`address_main`,`address_area`,`address_locality`,`address_city`,`address_landmark`,`address_taluk`,`address_district`,`address_state`,`address_pin_code`,`permanent_address_house_no`,`permanent_address_floor`,`permanent_address_cross`,`permanent_address_street`,`permanent_address_main`,`permanent_address_area`,`permanent_address_locality`,`permanent_address_city`,`permanent_address_landmark`,`permanent_address_taluk`,`permanent_address_district`,`permanent_address_state`,`permanent_address_pin_code` FROM `cmt_applications` WHERE `client_application_id` = ?";
    const results = await sequelize.query(sql, {
      replacements: [`${client_application_id}`], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    callback(null, results[0] || null); // Return the first result or null if not found


  },

  getCustomerById: async (id, callback) => {
    const sql = "SELECT * FROM `customers` WHERE `id` = ? AND is_deleted != 1";
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

  getCMTAnnexureByApplicationId: async (
    client_application_id,
    db_table,
    callback
  ) => {

    // 1. Check if the table exists
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

      fetchData();

    } else {
      fetchData();
    }

    async function fetchData() {
      const sql = `SELECT * FROM \`${db_table}\` WHERE \`client_application_id\` = ?`;
      const results = await sequelize.query(sql, {
        replacements: [client_application_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      const response = results.length > 0 ? results[0] : null;
      callback(null, response);
    }



  },

  updateBasicEntry: async (data, callback) => {
    const { application_id, basic_entry } = data;

    try {
      // Step 1: Check if 'is_basic_entry' column exists
      const checkColumnSQL = `
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'client_applications' 
          AND COLUMN_NAME = 'is_basic_entry'
          AND TABLE_SCHEMA = DATABASE()
      `;

      const [columnCheckResult] = await sequelize.query(checkColumnSQL, {
        type: QueryTypes.SELECT,
      });

      // Step 2: Add column if it does not exist
      if (columnCheckResult.count === 0) {
        const addColumnSQL = `
          ALTER TABLE \`client_applications\`
          ADD COLUMN \`is_basic_entry\` VARCHAR(255) DEFAULT NULL
        `;
        await sequelize.query(addColumnSQL);
      }

      // Step 3: Proceed with update
      const updateSQL = `
        UPDATE \`client_applications\` 
        SET \`is_basic_entry\` = ?
        WHERE \`id\` = ?
      `;
      const results = await sequelize.query(updateSQL, {
        replacements: [basic_entry, application_id],
        type: QueryTypes.UPDATE,
      });

      callback(null, results);
    } catch (error) {
      callback(error, null);
    }
  },

  updateDataQC: async (data, callback) => {
    const { application_id, data_qc } = data;

    // If no duplicates are found, proceed with updating the admin record
    const sql = `
        UPDATE \`client_applications\` 
        SET 
          \`is_data_qc\` = ?
        WHERE \`id\` = ?
      `;

    const results = await sequelize.query(sql, {
      replacements: [data_qc, application_id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);


  },

  submit: async (
    mainJson,
    client_application_id,
    branch_id,
    customer_id,
    callback
  ) => {
    try {
      const fields = Object.keys(mainJson);

      // 1. Check for existing columns in cmt_applications
      const checkColumnsSql = "SHOW COLUMNS FROM `cmt_applications`";
      const [results] = await sequelize.query(checkColumnsSql, { type: QueryTypes.SHOW });

      const existingColumns = results.map((row) => row.Field);
      const existingColumnsLower = existingColumns.map(col => col.toLowerCase());
      const missingColumns = fields.filter((field) => !existingColumnsLower.includes(field.toLowerCase()));

      // 2. Add missing columns if any
      const addMissingColumns = async () => {
        if (missingColumns.length > 0) {
          try {
            for (const column of missingColumns) {
              const alterQuery = `ALTER TABLE cmt_applications ADD COLUMN ${column} LONGTEXT`; // Adjust data type as needed
              await sequelize.query(alterQuery, { type: QueryTypes.RAW });
            }
          } catch (error) {
            console.error("Error adding missing columns:", error);
            throw error;
          }
        }
      };

      // 3. Check if entry exists by client_application_id and insert/update accordingly
      const checkAndUpsertEntry = async () => {
        try {
          const checkEntrySql = "SELECT * FROM cmt_applications WHERE client_application_id = ?";
          const entryResults = await sequelize.query(checkEntrySql, {
            replacements: [client_application_id],
            type: QueryTypes.SELECT,
          });

          // Add branch_id and customer_id to mainJson
          mainJson.branch_id = branch_id;
          mainJson.customer_id = customer_id;

          if (entryResults.length > 0) {
            // console.log(`mainJson - `, mainJson);

            // Get keys (indexes) and values (although you're not really using them in this case)
            const indexes = Object.keys(mainJson);
            const values = Object.values(mainJson);

            // Prepare the update query
            const updateSql = `UPDATE cmt_applications SET ${indexes.map(key => `${key} = ?`).join(', ')} WHERE client_application_id = ?`;

            // Insert the values into the query and include the client_application_id at the end
            await sequelize.query(updateSql, {
              replacements: [...Object.values(mainJson), client_application_id],
              type: QueryTypes.UPDATE,
            });

            // Fetch the updated record (you can return any column, such as 'client_application_id')
            const updatedRow = await sequelize.query(
              "SELECT id FROM cmt_applications WHERE client_application_id = ?",
              {
                replacements: [client_application_id],
                type: QueryTypes.SELECT,
              }
            );

            if (updatedRow.length > 0) {
              const insertId = updatedRow[0].id;// Or use other columns if needed
              // console.log('Updated row ID:', insertId);
              callback(null, { insertId });
            } else {
              // console.log('No row found after update');
              callback(null, { message: 'Update failed or no rows affected' });
            }
          } else {

            const replacements = {
              ...mainJson,  // Spread the mainJson object properties into the replacements
              client_application_id,
              branch_id,
              customer_id
            };

            // console.log(`replacements - `, replacements);

            // Get keys (indexes) and values
            const indexes = Object.keys(replacements);
            const values = Object.values(replacements);

            // Build the SQL query dynamically
            const insertSql = `INSERT INTO cmt_applications (${indexes.join(', ')}) VALUES (${indexes.map(() => '?').join(', ')})`;

            const insertResult = await sequelize.query(insertSql, {
              replacements: values,
              type: QueryTypes.INSERT,
            });
            // console.log(`insertResult - `, insertResult);
            const insertId = insertResult[0];

            callback(null, { insertId });
          }
        } catch (error) {
          console.error("Error inserting/updating entry:", error);
          callback(error, null);
        }
      };

      // Execute the operations in sequence
      await addMissingColumns();
      await checkAndUpsertEntry();
    } catch (error) {
      console.error("Unexpected error in generateReport:", error);
      callback(error, null);
    }
  },


  createOrUpdateAnnexure: async (
    cmt_id,
    client_application_id,
    branch_id,
    customer_id,
    db_table,
    mainJson,
    callback
  ) => {
    const fields = Object.keys(mainJson).map((field) => field.toLowerCase());

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
      proceedToCheckColumns();
    }

    async function proceedToCheckColumns() {
      const checkColumnsSql = `SHOW COLUMNS FROM \`${db_table}\``;
      const results = await sequelize.query(checkColumnsSql, {
        type: QueryTypes.SHOW,
      });
      const existingColumns = results.map((row) => row.Field);
      const missingColumns = fields.filter(
        (field) => !existingColumns.includes(field)
      );

      if (missingColumns.length > 0) {
        const alterQueries = missingColumns.map((column) => {
          return `ALTER TABLE \`${db_table}\` ADD COLUMN \`${column}\` LONGTEXT`; // Adjust data type as necessary
        });

        const alterPromises = alterQueries.map(
          (query) =>
            new Promise(async (resolve, reject) => {
              await sequelize.query(query, {
                type: QueryTypes.SELECT,
              });
              resolve();

            })
        );

        Promise.all(alterPromises)
          .then(() => checkAndUpdateEntry())
          .catch((err) => {
            console.error("Error executing ALTER statements:", err);
            callback(err, null);
          });
      } else {
        checkAndUpdateEntry();
      }

    }

    async function checkAndUpdateEntry() {
      const checkEntrySql = `SELECT * FROM \`${db_table}\` WHERE client_application_id = ?`;
      const entryResults = await sequelize.query(checkEntrySql, {
        replacements: [client_application_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });


      if (entryResults.length > 0) {
        const updateSql = `UPDATE \`${db_table}\` SET ? WHERE client_application_id = ?`;
        const updateResult = await sequelize.query(updateSql, {
          replacements: [mainJson, client_application_id], // Positional replacements using ?
          type: QueryTypes.UPDATE,
        });
        callback(null, updateResult);

      } else {
        const insertSql = `INSERT INTO \`${db_table}\` SET ?`;
        const insertResult = await sequelize.query(insertSql, {
          replacements: {
            ...mainJson,
            client_application_id,
            branch_id,
            customer_id,
            cmt_id,
          },
          type: QueryTypes.INSERT,
        });
        callback(null, insertResult);

      }

    }


  },

  getAttachmentsByClientAppID: async (client_application_id, callback) => {


    const sql = "SELECT `services` FROM `client_applications` WHERE `id` = ? AND is_deleted != 1";
    const results = await sequelize.query(sql, {
      replacements: [client_application_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length > 0) {
      const services = results[0].services.split(","); // Split services by comma
      const dbTableFileInputs = {}; // Object to store db_table and its file inputs
      let completedQueries = 0; // To track completed queries

      // Step 1: Loop through each service and perform actions
      services.forEach(async (service) => {

        const query = "SELECT `json` FROM `report_forms` WHERE `id` = ?";
        const result = await sequelize.query(query, {
          replacements: [service], // Positional replacements using ?
          type: QueryTypes.SELECT,
        });

        completedQueries++;

        if (result.length > 0) {
          try {
            // Parse the JSON data
            const jsonData = JSON.parse(result[0].json);
            const dbTable = jsonData.db_table;

            // Initialize an array for the dbTable if not already present
            if (!dbTableFileInputs[dbTable]) {
              dbTableFileInputs[dbTable] = [];
            }

            // Extract inputs with type 'file' and add to the db_table array
            jsonData.rows.forEach((row) => {
              row.inputs.forEach((input) => {
                if (input.type === "file") {
                  dbTableFileInputs[dbTable].push(input.name);
                }
              });
            });
          } catch (parseErr) {
            console.error(
              "Error parsing JSON for service:",
              service,
              parseErr
            );
          }
        }

        // When all services have been processed
        if (completedQueries === services.length) {
          // Fetch the host from the database
          const hostSql = `SELECT \`host\` FROM \`app_info\` WHERE \`status\` = 1 AND \`interface_type\` = ? ORDER BY \`updated_at\` DESC LIMIT 1`;

          const hostResults = await sequelize.query(hostSql, {
            replacements: ["backend"], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });

          const host =
            hostResults.length > 0
              ? hostResults[0].host
              : "www.example.com"; // Fallback host

          let finalAttachments = [];
          let tableQueries = 0;
          const totalTables = Object.keys(dbTableFileInputs).length;

          // Loop through each db_table and perform a query
          for (const [dbTable, fileInputNames] of Object.entries(
            dbTableFileInputs
          )) {
            const selectQuery = `SELECT ${fileInputNames && fileInputNames.length > 0
              ? fileInputNames.join(", ")
              : "*"
              } FROM ${dbTable} WHERE client_application_id = ?`;

            const rows = await sequelize.query(selectQuery, {
              replacements: [client_application_id], // Positional replacements using ?
              type: QueryTypes.SELECT,
            });

            tableQueries++;


            rows.forEach((row) => {
              const attachments = Object.values(row)
                .filter((value) => value) // Remove any falsy values
                .join(","); // Join values by comma

              // Split and concatenate the URL with each attachment
              attachments.split(",").forEach((attachment) => {
                finalAttachments.push(`${host}/${attachment}`);
              });
            });


            // Step 3: When all db_table queries are completed, return finalAttachments
            if (tableQueries === totalTables) {
              // Release connection before callback
              callback(null, finalAttachments.join(", "));
            }

          }

        }

      });
    } else {
      callback(null, []); // Return an empty array if no results found
    }


  },
};

module.exports = Customer;
