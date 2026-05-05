const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");
const clientApplication = {
  generateApplicationID: async (branch_id, callback) => {
    const getCustomerIdSql = `
        SELECT \`customer_id\`
        FROM \`branches\`
        WHERE \`id\` = ?
      `;

    const branchResults = await sequelize.query(getCustomerIdSql, {
      replacements: [branch_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (branchResults.length === 0) {
      console.warn("Branch not found for branch_id:", branch_id);
      return callback(new Error("Branch not found"), null);
    }

    const customer_id = branchResults[0].customer_id;

    const getClientUniqueIdSql = `
          SELECT \`client_unique_id\`
          FROM \`customers\`
          WHERE \`id\` = ?
        `;
    const customerResults = await sequelize.query(getClientUniqueIdSql, {
      replacements: [customer_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (customerResults.length === 0) {
      console.warn("Customer not found for customer_id:", customer_id);
      return callback(new Error("Customer not found"), null);
    }

    const client_unique_id = customerResults[0].client_unique_id;

    const getApplicationIdSql = `
              SELECT \`application_id\`
              FROM \`client_applications\`
              WHERE \`application_id\` LIKE ?
              ORDER BY \`id\` DESC
              LIMIT 1
            `;  
    const applicationIdParam = `${client_unique_id}-%`;

    const applicationResults = await sequelize.query(getApplicationIdSql, {
      replacements: [applicationIdParam], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });


    let new_application_id;

    if (applicationResults.length === 0) {
      new_application_id = `${client_unique_id}-1`;
    } else {
      const latest_application_id =
        applicationResults[0].application_id;

      const parts = latest_application_id.split("-");
      const lastIndex = parts.length - 1; // Get the last index of the parts array

      if (!isNaN(parts[lastIndex])) {
        const numberPart = parseInt(parts[lastIndex], 10);
        parts[lastIndex] = (numberPart + 1).toString(); // Increment the number part at the last index
        new_application_id = parts.join("-"); // Reassemble the application_id
      } else {
        new_application_id = `${client_unique_id}-1`;
      }
    }

    callback(null, new_application_id);

  },

  create: async (data, callback) => {
    try {
      const {
        name,
        generate_report_type,
        employee_id,
        client_spoc_name,
        location,
        branch_id,
        services,
        packages,
        customer_id,
        is_priority = 0,  // Defaulting `is_priority` to 0 safely
        case_id,
        check_id,
        batch_no,
        sub_client,
        ticket_id,
        photo,
        attach_documents,
        gender
      } = data;

      // Normalize `services` and `packages` to comma-separated strings
      const normalizeIds = (input) => {
        if (Array.isArray(input)) {
          return input.map((id) => id.trim()).join(",");
        }
        if (typeof input === "string" && input.trim() !== "") {
          return input.split(",").map((id) => id.trim()).join(",");
        }
        return null; // Ensure null instead of empty string
      };

      const serviceIds = normalizeIds(services);
      const packageIds = normalizeIds(packages);

      // Generate a new application ID
      clientApplication.generateApplicationID(branch_id, async (err, new_application_id) => {
        if (err) {
          console.error("Error generating application ID:", err);
          return callback(err);
        }

        try {
          const sql = `
  INSERT INTO \`client_applications\` (
    \`application_id\`,
    \`name\`,
    \`generate_report_type\`,
    \`employee_id\`,
    \`client_spoc_name\`,
    \`location\`,
    \`branch_id\`,
    \`services\`,
    \`package\`,
    \`customer_id\`,
    \`is_priority\`,
    \`case_id\`,
    \`check_id\`,
    \`batch_no\`,
    \`sub_client\`,
    \`ticket_id\`,
    \`gender\`,
    \`photo\`,
    \`attach_documents\`
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

          const values = [
            new_application_id || null,
            name || null,
            generate_report_type || null,
            employee_id || null,
            client_spoc_name || null,
            location || null,
            branch_id || null,
            serviceIds || null,
            packageIds || null,
            customer_id || null,
            is_priority || 0,
            case_id || null,
            check_id || null,
            batch_no || null,
            sub_client || null,
            ticket_id || null,
            gender || null,
            photo || null,
            attach_documents || null,
          ];

          console.log(`values - `, values);

          const results = await sequelize.query(sql, {
            replacements: values, // Positional replacements using ?
            type: QueryTypes.INSERT,
          });
          const insertId = results[0];
          callback(null, { results: { insertId }, new_application_id });
        } catch (error) {
          console.error("Database Insert Error:", error);
          callback(error);
        }
      });
    } catch (error) {
      console.error("Unexpected Error in create function:", error);
      callback(error);
    }
  },

  list: async (branch_id, callback) => {

    const sqlClient = `
      SELECT 
        *
      FROM 
        \`client_applications\`
      WHERE 
        status != 'completed'
        AND is_deleted != 1
        AND branch_id = ?
      ORDER BY 
        created_at DESC`;
    const clientResults = await sequelize.query(sqlClient, {
      replacements: [branch_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    const finalResults = [];
    const cmtPromises = clientResults.map((clientApp) => {
      return new Promise(async (resolve, reject) => {
        // Query for CMT applications
        const sqlCmt =
          "SELECT * FROM cmt_applications WHERE client_application_id = ?";

        const cmtResults = await sequelize.query(sqlCmt, {
          replacements: [clientApp.id], // Positional replacements using ?
          type: QueryTypes.SELECT,
        });

        const cmtData = cmtResults.map((cmtApp) => {
          return Object.fromEntries(
            Object.entries(cmtApp).map(([key, value]) => [
              `cmt_${key}`,
              value,
            ])
          );
        });

        // Handle services splitting and querying, only if servicesIds > 0
        const servicesIds = clientApp.services
          ? clientApp.services.split(",")
          : [];

        if (servicesIds.length > 0) {
          const servicesQuery =
            "SELECT title FROM services WHERE id IN (?)";
          const servicesResults = await sequelize.query(servicesQuery, {
            replacements: [servicesIds], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });

          const servicesTitles = servicesResults.map(
            (service) => service.title
          );
          finalResults.push({
            ...clientApp,
            cmtApplications: cmtData.length > 0 ? cmtData : [],
            serviceNames: servicesTitles, // Add services titles to the result
          });
          resolve();


        } else {
          // If no servicesIds are available, still push the data with empty serviceNames
          finalResults.push({
            ...clientApp,
            cmtApplications: cmtData.length > 0 ? cmtData : [],
            serviceNames: [],
          });
          resolve();
        }

      });
    });

    Promise.all(cmtPromises)
      .then(() => {
        // Sort finalResults by created_at DESC to ensure correct order
        finalResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        callback(null, finalResults);
      })
      .catch((err) => {
        callback(err, null);
      });
  },

  checkUniqueEmpId: async (clientUniqueEmpId, callback) => {
    if (!clientUniqueEmpId) {
      return callback(null, false);
    }
    const sql = `
      SELECT COUNT(*) AS count
      FROM \`client_applications\`
      WHERE \`employee_id\` = ?
    `;

    const results = await sequelize.query(sql, {
      replacements: [clientUniqueEmpId], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    const count = results[0].count;
    callback(null, count > 0);


  },

  checkUniqueEmpIdByClientApplicationID: async (
    application_id,
    clientUniqueEmpId,
    callback
  ) => {
    if (!clientUniqueEmpId) {
      return callback(null, false);
    }
    const sql = `
      SELECT COUNT(*) AS count
      FROM \`client_applications\`
      WHERE \`employee_id\` = ? AND id != ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [clientUniqueEmpId, application_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    const count = results[0].count;
    callback(null, count > 0);
  },

  checkIfApplicationExist: async (applicationReffIds, callback) => {
    // Validate input: Check if array is valid and non-empty
    if (!Array.isArray(applicationReffIds) || applicationReffIds.length === 0) {
      return callback({ status: false, message: "No Application reff id provided." }, null);
    }

    // Clean input: Remove duplicates, trim whitespace, and ensure valid string values
    const cleanedReffIds = [
      ...new Set(
        applicationReffIds
          .map(refId => (typeof refId === 'string' ? refId.trim() : '')) // Ensure valid string values
          .filter(refId => refId !== '') // Filter out empty or invalid values
      ),
    ];

    // If no valid reference IDs after cleanup, return error
    if (cleanedReffIds.length === 0) {
      return callback({ status: false, message: "No valid Organization Names after cleanup." }, null);
    }

    // Step 1: Execute query to find applications with matching reference IDs
    const query = `
      SELECT \`application_id\`
      FROM \`client_applications\`
      WHERE \`application_id\` IN (?)
    `;
    const queryResults = await sequelize.query(query, {
      replacements: [cleanedReffIds],
      type: QueryTypes.SELECT
    });

    console.log("queryResults - ", queryResults);

    // Step 2: Extract existing applications and their corresponding reference IDs
    const existingApplications = queryResults.map(result => result.application_id);

    console.log("existingApplications - ", existingApplications);

    console.log("cleanedReffIds - ", cleanedReffIds);
    // Filter the reference IDs that exist in the database
    const foundReffIds = cleanedReffIds.filter(refId => existingApplications.includes(refId));

    // If no valid reference IDs exist (all were "waste"), return an error
    if (foundReffIds.length === 0) {
      return callback({ status: false, message: "All provided reference IDs are invalid or do not exist." }, null);
    }

    // Return only the valid reference IDs that exist
    return callback(null, {
      status: true,
      message: "Existing Application reff id found.",
      validReffIds: foundReffIds // Return only the reference IDs that exist
    });
  },

  getClientApplicationById: async (id, callback) => {

    const sql = "SELECT * FROM `client_applications` WHERE id = ?";

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);
  },

  upload: async (client_application_id, db_column, savedImagePaths, callback) => {

    const sqlUpdateCustomer = `
      UPDATE client_applications 
      SET ${db_column} = ?
      WHERE id = ?
    `;
    console.log(`sqlUpdateCustomer - `, sqlUpdateCustomer);
    const joinedPaths = savedImagePaths.join(", ");
    // Prepare the parameters for the query
    const queryParams = [joinedPaths, client_application_id];

    const results = await sequelize.query(sqlUpdateCustomer, {
      replacements: queryParams, // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    const affectedRows = results[1];
    console.log(`affectedRows - `, affectedRows);
    if (affectedRows > 0) {
      return callback(true, { affectedRows }); // Success with results
    } else {
      return callback(false, {
        message: "No rows updated. Please check the client application ID.",
        details: { affectedRows },
        query: sqlUpdateCustomer,
        params: queryParams, // Return the parameters used in the query
      });
    }

  },

  update: async (data, client_application_id, callback) => {
    const {
      name,
      generate_report_type,
      employee_id,
      client_spoc_name,
      location,
      services,
      packages,
      case_id,
      check_id,
      batch_no,
      sub_client,
      ticket_id,
      is_priority,
      gender
    } = data;

    const sql = `
      UPDATE \`client_applications\`
      SET
        \`name\` = ?,
        \`generate_report_type\` = ?,
        \`employee_id\` = ?,
        \`client_spoc_name\` = ?,
        \`location\` = ?,
        \`services\` = ?,
        \`package\` = ?,
        \`case_id\` = ?,
        \`check_id\` = ?,
        \`batch_no\` = ?,
        \`sub_client\` = ?,
        \`ticket_id\` = ?,
        \`is_priority\` = ?,
        \`gender\` = ?
      WHERE
        \`id\` = ?
    `;
    const serviceIds =
      typeof services === "string" && services.trim() !== ""
        ? services
          .split(",")
          .map((id) => id.trim())
          .join(",")
        : Array.isArray(services) && services.length > 0
          ? services.map((id) => id.trim()).join(",")
          : "";

    const packageIds =
      typeof packages === "string" && packages.trim() !== ""
        ? packages
          .split(",")
          .map((id) => id.trim())
          .join(",")
        : Array.isArray(packages) && packages.length > 0
          ? packages.map((id) => id.trim()).join(",")
          : "";

    const values = [
      name,
      generate_report_type,
      employee_id,
      client_spoc_name,
      location,
      serviceIds,
      packageIds,
      case_id,
      check_id,
      batch_no,
      sub_client,
      ticket_id,
      is_priority,
      gender,
      client_application_id,
    ];
    const results = await sequelize.query(sql, {
      replacements: values, // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });

    callback(null, results);
  },

  updateByData: async (data, client_application_id, callback) => {
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
      const sql = `UPDATE \`client_applications\` SET ${setClause} WHERE \`id\` = ?`;

      // Push client_application_id as the last parameter for WHERE clause
      values.push(client_application_id);

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

  updateStatus: async (status, client_application_id, callback) => {

    const sql = `
      UPDATE \`client_applications\`
      SET
        \`status\` = ?
      WHERE
        \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [status, client_application_id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);
  },

  delete: async (id, callback) => {

    const checkSql = `SELECT is_deleted FROM \`client_applications\` WHERE id = ?`;
    const results = await sequelize.query(checkSql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length === 0) {
      return callback({ message: "Application not found" }, null);
    }

    if (results[0].is_deleted === 1) {
      return callback({ message: "Application already deleted" }, null);
    }

    const deleteSql = `
          UPDATE \`client_applications\`
          SET is_deleted = 1, deleted_at = NOW()
          WHERE id = ?
        `;
    const resultss = await sequelize.query(deleteSql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, { message: "Application successfully deleted", resultss });



  },

  destroy: async (id, callback) => {
    const sqlGetServices =
      "SELECT services FROM `client_applications` WHERE `id` = ? AND is_deleted = 1";

    const results = await sequelize.query(sqlGetServices, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length === 0) {
      return callback(
        { message: "No client application found or not deleted with the given ID" },
        null
      );
    }
    const services = results[0].services;
    const servicesArray = services
      .split(",")
      .map((service) => parseInt(service.trim())); // Parse to integers

    const jsonResults = []; // Array to hold JSON results
    let completedQueries = 0; // Counter to track completed queries

    servicesArray.forEach(async (serviceId) => {
      const sqlGetJson =
        "SELECT json FROM report_forms WHERE service_id = ?";

      const jsonQueryResults = await sequelize.query(sqlGetJson, {
        replacements: [serviceId], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      if (jsonQueryResults.length > 0) {
        try {
          const jsonData = JSON.parse(jsonQueryResults[0].json);
          const dbTable = jsonData.db_table;

          // Check if dbTable exists and if there is an entry with client_application_id = id
          const sqlCheckEntry = `SELECT * FROM \`${dbTable}\` WHERE client_application_id = ?`;
          const entryResults = await sequelize.query(sqlCheckEntry, {
            replacements: [id], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });

          if (entryResults.length > 0) {
            // Entry found, proceed to delete it
            const sqlDeleteEntry = `DELETE FROM \`${dbTable}\` WHERE client_application_id = ?`;
            await sequelize.query(sqlDeleteEntry, {
              replacements: [id], // Positional replacements using ?
              type: QueryTypes.DELETE,
            });
          }
          jsonResults.push(jsonQueryResults[0].json);
        } catch (parseError) {
          console.error("Error parsing JSON:", parseError);
        }
      }

      // Increment the counter and check if all queries are done
      completedQueries++;
      if (completedQueries === servicesArray.length) {
        // Step 3: Now delete the client_application entry
        const sqlDelete =
          "DELETE FROM `client_applications` WHERE `id` = ?";
        const deleteResults = await sequelize.query(sqlDelete, {
          replacements: [id],
          type: QueryTypes.DELETE,
        });
        callback(null, {
          deletedServices: servicesArray,
          jsonResults,
          deleteResults,
        });

      }

    });


  },

  restore: async (id, callback) => {
    const checkSql = `SELECT is_deleted FROM \`client_applications\` WHERE id = ?`;
    const results = await sequelize.query(checkSql, {
      replacements: [id],
      type: QueryTypes.SELECT,
    });

    if (results.length === 0) {
      return callback({ message: "Application not found" }, null);
    }

    if (results[0].is_deleted !== 1) {
      return callback({ message: "Application is not deleted" }, null);
    }

    const deleteSql = `
          UPDATE \`client_applications\`
          SET is_deleted = 0, deleted_at = NULL
          WHERE id = ?
        `;
    const resultss = await sequelize.query(deleteSql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, { message: "Application successfully restored", resultss });



  },
  highlight: async (id, highlight, callback) => {
    const sql = `
        UPDATE \`client_applications\`
        SET \`is_highlight\` = ?
        WHERE \`id\` = ?
      `;
    const results = await sequelize.query(sql, {
      replacements: [highlight, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);


  },

listAllApplications: async (branch_id, callback) => {

    const sqlClient = `
      SELECT 
        *
      FROM 
        \`client_applications\`
      WHERE is_deleted != 1
        AND branch_id = ?
      ORDER BY 
        created_at DESC`;
    const clientResults = await sequelize.query(sqlClient, {
      replacements: [branch_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    const finalResults = [];
    const cmtPromises = clientResults.map((clientApp) => {
      return new Promise(async (resolve, reject) => {
        // Query for CMT applications
        const sqlCmt =
          "SELECT * FROM cmt_applications WHERE client_application_id = ?";

        const cmtResults = await sequelize.query(sqlCmt, {
          replacements: [clientApp.id], // Positional replacements using ?
          type: QueryTypes.SELECT,
        });

        const cmtData = cmtResults.map((cmtApp) => {
          return Object.fromEntries(
            Object.entries(cmtApp).map(([key, value]) => [
              `cmt_${key}`,
              value,
            ])
          );
        });

        // Handle services splitting and querying, only if servicesIds > 0
        const servicesIds = clientApp.services
          ? clientApp.services.split(",")
          : [];

        if (servicesIds.length > 0) {
          const servicesQuery =
            "SELECT title FROM services WHERE id IN (?)";
          const servicesResults = await sequelize.query(servicesQuery, {
            replacements: [servicesIds], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });

          const servicesTitles = servicesResults.map(
            (service) => service.title
          );
          finalResults.push({
            ...clientApp,
            cmtApplications: cmtData.length > 0 ? cmtData : [],
            serviceNames: servicesTitles, // Add services titles to the result
          });
          resolve();


        } else {
          // If no servicesIds are available, still push the data with empty serviceNames
          finalResults.push({
            ...clientApp,
            cmtApplications: cmtData.length > 0 ? cmtData : [],
            serviceNames: [],
          });
          resolve();
        }

      });
    });

    Promise.all(cmtPromises)
      .then(() => {
        // Sort finalResults by created_at DESC to ensure correct order
        finalResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        callback(null, finalResults);
      })
      .catch((err) => {
        callback(err, null);
      });
  },

};

module.exports = clientApplication;
