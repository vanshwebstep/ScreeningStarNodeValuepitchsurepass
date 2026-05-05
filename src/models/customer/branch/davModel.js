const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");

const dav = {

  isApplicationExist: async (app_id, branch_id, customer_id, callback) => {
    try {
      // Step 1: Check if application exists in candidate_applications
      const appSql = `
                  SELECT 
                    ca.*, 
                    c.name AS company_name
                  FROM candidate_applications ca
                  INNER JOIN customers c ON ca.customer_id = c.id
                  WHERE ca.id = ? AND ca.branch_id = ? AND ca.customer_id = ?;
                `;

      const appResults = await sequelize.query(appSql, {
        replacements: [app_id, branch_id, customer_id],
        type: QueryTypes.SELECT,
      });

      if (appResults.length === 0) {
        return callback(null, { status: false, message: "Application not found in candidate_applications" });
      }

      const application = appResults[0];

      // Step 2: Check for corresponding dav_applications
      const davSql = `
        SELECT is_submitted
        FROM dav_applications
        WHERE candidate_application_id = ?
      `;

      const davResults = await sequelize.query(davSql, {
        replacements: [application.id],
        type: QueryTypes.SELECT,
      });

      if (davResults.length === 0 || davResults[0].is_submitted === 0) {
        // Valid case
        return callback(null, { status: true, message: "Valid application", data: application });
      }

      // Else, submitted in DAV
      return callback(null, { status: false, message: "DAV application already submitted" });

    } catch (error) {
      console.error("Error checking application existence:", error);
      return callback(error, null);
    }
  },

  getDAVApplicationById: async (candidate_application_id, callback) => {
    try {
      const sql = "SELECT * FROM `dav_applications` WHERE `candidate_application_id` = ?";

      const results = await sequelize.query(sql, {
        replacements: [candidate_application_id],
        type: QueryTypes.SELECT,
      });

      callback(null, results.length > 0 ? results[0] : null);
    } catch (error) {
      console.error("Error fetching DAV application:", error);
      callback({ status: false, message: "Internal server error" }, null);
    }
  },

  create: async (
    personal_information,
    candidate_application_id,
    branch_id,
    customer_id,
    callback
  ) => {
    const fields = Object.keys(personal_information);

    // 1. Check for existing columns in dav_applications
    const checkColumnsSql = `SHOW COLUMNS FROM \`dav_applications\``;

    const results = await sequelize.query(checkColumnsSql, {
      type: QueryTypes.SELECT,
    });

    const existingColumns = results.map((row) => row.Field);
    const missingColumns = fields.filter(
      (field) => !existingColumns.includes(field)
    );

    // 2. If there are missing columns, alter the table to add them
    if (missingColumns.length > 0) {
      const alterQueries = missingColumns.map((column) => {
        return `ALTER TABLE dav_applications ADD COLUMN \`${column}\` LONGTEXT`; // Adjust data type as necessary
      });

      // Run all ALTER statements
      const alterPromises = alterQueries.map(
        async (query) =>
          await sequelize.query(query, {
            type: QueryTypes.SELECT,
          })
      );

      // After altering the table, proceed to insert or update the data
      Promise.all(alterPromises)
        .then(() => {
          // Insert or update entry after table alteration
          dav.insertOrUpdateEntry(
            personal_information,
            candidate_application_id,
            branch_id,
            customer_id,
            callback
          );
        })
        .catch((alterErr) => {
          console.error("Error executing ALTER statements:", alterErr);
          callback(alterErr, null);
        });
    } else {
      // If no columns are missing, proceed to check and insert or update the entry
      dav.insertOrUpdateEntry(
        personal_information,
        candidate_application_id,
        branch_id,
        customer_id,
        callback
      );
    }
  },

  insertOrUpdateEntry: async (
    personal_information,
    candidate_application_id,
    branch_id,
    customer_id,
    callback
  ) => {
    try {
      const checkEntrySql = "SELECT * FROM dav_applications WHERE candidate_application_id = ?";

      const entryResults = await sequelize.query(checkEntrySql, {
        replacements: [candidate_application_id],
        type: QueryTypes.SELECT,
      });

      if (entryResults.length > 0) {
        // Entry exists, update it
        personal_information.branch_id = branch_id;
        personal_information.customer_id = customer_id;
        personal_information.is_submitted = 1; // ✅ Always set is_submitted=1 on update

        const updateFields = Object.keys(personal_information)
          .map(key => `${key} = ?`)
          .join(", ");

        const updateValues = Object.values(personal_information);

        const updateSql = `UPDATE dav_applications SET ${updateFields} WHERE candidate_application_id = ?`;

        await sequelize.query(updateSql, {
          replacements: [...updateValues, candidate_application_id],
          type: QueryTypes.UPDATE,
        });

        callback(null, { message: "Updated successfully" });
      } else {
        // Entry does not exist, insert a new one
        const replacements = {
          ...personal_information,
          candidate_application_id,
          branch_id,
          customer_id,
          is_submitted: 1, // ✅ Always set is_submitted=1 on insert too
        };

        const indexes = Object.keys(replacements);
        const values = Object.values(replacements);

        const insertSql = `INSERT INTO dav_applications (${indexes.join(', ')}) VALUES (${indexes.map(() => '?').join(', ')})`;

        const insertResult = await sequelize.query(insertSql, {
          replacements: values,
          type: QueryTypes.INSERT,
        });

        const insertId = insertResult[0];

        callback(null, { insertId });
      }
    } catch (error) {
      console.error("Error in insertOrUpdateEntry:", error);
      callback(error);
    }
  },

  updateImages: async (dav_id, candidate_application_id, imagesArr, dbColumn, callback) => {
    try {
      let images = Array.isArray(imagesArr) ? imagesArr.join(",") : imagesArr;

      if (!images) {
        console.error("Images array is empty.");
        return callback(new Error("Images array cannot be empty."), null);
      }

      // Define SQL query for updating images
      const sql = `
        UPDATE \`dav_applications\`
        SET \`${dbColumn}\` = ?, \`is_submitted\` = 1
        WHERE \`id\` = ? AND \`candidate_application_id\` = ?
      `;

      // First, check if the column exists
      const checkColumnSql = `SHOW COLUMNS FROM \`dav_applications\` LIKE ?`;
      const checkResults = await sequelize.query(checkColumnSql, {
        replacements: [dbColumn],
        type: QueryTypes.SELECT,
      });

      // If column doesn't exist, add it
      if (checkResults.length === 0) {
        const alterTableSql = `ALTER TABLE \`dav_applications\` ADD COLUMN \`${dbColumn}\` LONGTEXT`;
        await sequelize.query(alterTableSql, { type: QueryTypes.RAW });
      }

      // Execute the update query
      const results = await sequelize.query(sql, {
        replacements: [images, dav_id, candidate_application_id],
        type: QueryTypes.UPDATE,
      });

      callback(null, {
        status: true,
        message: "Images updated successfully",
        affectedRows: results[1],
      });
    } catch (error) {
      console.error("Error updating images:", error);
      callback(error, null);
    }
  },

  getAttachmentsByCandidateAppID: async (candidateApplicationId, callback) => {
    try {
      // Define SQL query to fetch attachment fields from dav_applications
      const query = `
      SELECT identity_proof, home_photo, locality
      FROM dav_applications
      WHERE candidate_application_id = ?
    `;

      // Execute the query
      const results = await sequelize.query(query, {
        replacements: [candidateApplicationId],
        type: QueryTypes.SELECT,
      });

      const attachments = [];

      // Process and collect non-null attachment values
      if (results.length > 0) {
        const record = results[0];
        for (const key in record) {
          if (record[key]) {
            attachments.push(record[key]);
          }
        }
      }

      // Return the result as a comma-separated string
      callback(null, attachments.join(", "));
    } catch (error) {
      console.error("Failed to fetch attachments:", error);
      callback(error, null);
    }
  },


};

module.exports = dav;
