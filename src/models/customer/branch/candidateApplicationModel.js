const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../../config/db");

const candidateApplication = {
  // Method to check if an email has been used before
  isEmailUsedBefore: async (email, branch_id, callback) => {
    const emailCheckSql = `
        SELECT COUNT(*) as count
        FROM \`candidate_applications\`
        WHERE \`email\` = ? AND \`branch_id\` = ?
      `;
    const emailCheckResults = await sequelize.query(emailCheckSql, {
      replacements: [email, branch_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    const emailExists = emailCheckResults[0].count > 0;
    return callback(null, emailExists);
  },

  // Method to create a new candidate application
  create: async (data, callback) => {
    const {
      sub_user_id,
      branch_id,
      name,
      employee_id,
      mobile_number,
      email,
      services,
      package,
      customer_id,
    } = data;

    let sql = `
      INSERT INTO \`candidate_applications\` (
        \`branch_id\`,
        \`name\`,
        \`employee_id\`,
        \`mobile_number\`,
        \`email\`,
        \`services\`,
        \`package\`,
        \`customer_id\`
  `;

    let values = [
      branch_id,
      name || "",
      employee_id || "",
      mobile_number || "",
      email || "",
      services || "",
      package || "",
      customer_id,
    ];

    // Conditionally add sub_user_id to the SQL query and values array
    if (sub_user_id != null) {
      sql += `, \`sub_user_id\``;
      values.push(sub_user_id);
    }

    sql += `) VALUES (${new Array(values.length).fill("?").join(", ")})`;

    const results = await sequelize.query(sql, {
      replacements: values, // Positional replacements using ?
      type: QueryTypes.INSERT,
    });
    const insertId = results[0];
    callback(null, { insertId });
  },

  list: async (branch_id, callback) => {
    const sql =
      "SELECT * FROM `candidate_applications` WHERE `branch_id` = ? ORDER BY created_at DESC";

    const results = await sequelize.query(sql, {
      replacements: [branch_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    const finalResults = [];
    const servicePromises = results.map((application) => {
      return new Promise(async (resolve, reject) => {
        // Extract service IDs
        const servicesIds = application.services
          ? application.services.split(",")
          : [];

        if (servicesIds.length === 0) {
          finalResults.push({ ...application, serviceNames: [] }); // No services to fetch
          return resolve(); // Resolve for applications with no services
        }

        // Query for service titles
        const servicesQuery =
          "SELECT title FROM `services` WHERE id IN (?)";

        const servicesResults = await sequelize.query(servicesQuery, {
          replacements: [servicesIds], // Positional replacements using ?
          type: QueryTypes.SELECT,
        });

        const servicesTitles = servicesResults.map(
          (service) => service.title
        );

        // Push the application with the corresponding service titles
        finalResults.push({
          ...application,
          serviceNames: servicesTitles, // Add services titles to the result
        });
        resolve();

      });
    });

    Promise.all(servicePromises)
      .then(() => {
        callback(null, finalResults);
      })
      .catch((err) => {
        callback(err, null);
      });


  },

  checkUniqueEmpId: async (candidateUniqueEmpId, callback) => {
    if (!candidateUniqueEmpId) {
      return callback(null, false);
    }
    const sql = `
      SELECT COUNT(*) AS count
      FROM \`candidate_applications\`
      WHERE \`employee_id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [candidateUniqueEmpId], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    const count = results[0].count;
    callback(null, count > 0);
  },

  checkUniqueEmpIdByCandidateApplicationID: async (
    application_id,
    candidateUniqueEmpId,
    callback
  ) => {
    if (!candidateUniqueEmpId) {
      return callback(null, false);
    }
    const sql = `
      SELECT COUNT(*) AS count
      FROM \`candidate_applications\`
      WHERE \`employee_id\` = ? AND id = ?
    `;

    const results = await sequelize.query(sql, {
      replacements: [candidateUniqueEmpId, application_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    const count = results[0].count;
    callback(null, count > 0);
  },

  getCandidateApplicationById: async (id, callback) => {
    const sql = "SELECT * FROM `candidate_applications` WHERE id = ?";
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    callback(null, results[0]);
  },

  update: async (data, candidate_application_id, callback) => {
    const { name, employee_id, mobile_number, email, services, package } = data;

    const sql = `
      UPDATE \`candidate_applications\`
      SET
        \`name\` = ?,
        \`employee_id\` = ?,
        \`mobile_number\` = ?,
        \`email\` = ?,
        \`services\` = ?,
        \`package\` = ?
      WHERE
        \`id\` = ?
    `;

    const values = [
      name || "",
      employee_id || "",
      mobile_number || "",
      email || "",
      services,
      package,
      candidate_application_id,
    ];

    const results = await sequelize.query(sql, {
      replacements: values, // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });

    callback(null, results);


  },

  delete: async (id, callback) => {
    const sql = "DELETE FROM `candidate_applications` WHERE `id` = ?";

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.DELETE,
    });
    callback(null, results);
  },

  isApplicationExist: async (app_id, branch_id, customer_id, callback) => {
    const sql = `SELECT CA.*, C.name AS company_name, B.name AS branch_name
          FROM candidate_applications AS CA 
          INNER JOIN customers AS C ON C.id = CA.customer_id
          INNER JOIN branches AS B ON B.id = CA.branch_id
          WHERE CA.id = ? 
            AND CA.branch_id = ? 
            AND CA.customer_id = ?`;

    const results = await sequelize.query(sql, {
      replacements: [app_id, branch_id, customer_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    const entry = results.length > 0 ? results[0] : false;

    if (!entry) {
      return callback(null, { status: false, message: "Application not found" });
    }

    const application = entry;

    if (application.reminder_sent === 3) {
      const lastReminderDate = new Date(
        Math.max(
          new Date(application.cef_last_reminder_sent_at).getTime(),
          new Date(application.dav_last_reminder_sent_at).getTime()
        )
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expirationDate = new Date(today);
      expirationDate.setDate(today.getDate() - 1);

      if (lastReminderDate <= expirationDate) {
        const updateSQL = `UPDATE candidate_applications SET status = 2 WHERE id = ?`;
        await sequelize.query(updateSQL, {
          replacements: [app_id], // Positional replacements using ?
          type: QueryTypes.SELECT,
        });
        return;
      }
    }
    return callback(null, { status: true, message: "Application exists", data: application });


  }
};

module.exports = candidateApplication;
