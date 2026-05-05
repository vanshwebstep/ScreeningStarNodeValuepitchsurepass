const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");
const Organization = {
  checkIfExEmploymentsExist: async (
    organizationNames,
    callback
  ) => {
    return callback(null, {
      status: true,
      message: "All Organization Names are unique."
    });

    if (!Array.isArray(organizationNames) || organizationNames.length === 0) {
      return callback({ status: false, message: "No Organization Names provided." }, null)
    }

    // Step 1: Remove duplicates, trim whitespace, and ensure valid string values
    const uniqueNames = [
      ...new Set(
        organizationNames
          .map(name => (typeof name === 'string' ? name.trim() : '')) // Check if the value is a string before calling trim
          .filter(name => name !== '') // Filter out any invalid or empty strings
      ),
    ];

    // Check if the uniqueNames array is still empty after cleanup
    if (uniqueNames.length === 0) {
      return callback({ status: false, message: "No Organization Names after cleanup." }, null);
    }

    // Step 2: Build and execute query
    const checkSql = `
 SELECT \`organization_name\` 
 FROM \`organizations\` 
 WHERE \`organization_name\` IN (?)
`;
    const existingResults = await sequelize.query(checkSql, {
      replacements: [uniqueNames],
      type: QueryTypes.SELECT
    });


    // Step 3: Extract existing names
    const existingNames = existingResults.map(u => u.organization_name);

    if (existingNames.length > 0) {
      return callback({
        status: false,
        alreadyExists: existingNames,
        message: `Organization Names already exist: ${existingNames.join(", ")}`
      }, null);
    }

    return callback(null, {
      status: true,
      message: "All Organization Names are unique."
    });
  },

  create: async (
    organization_name,
    location,
    verifier_name,
    designation,
    mobile_number,
    email_id,
    centralized_email_id,
    scope_of_services,
    verification_name,
    pricing,
    turnaround_time,
    organization_status,
    industry,
    standard_process,
    remark,
    callback
  ) => {
    /*
    // Step 1: Check if a organization with the same name already exists
    const checkUniversitySql = `
          SELECT * FROM \`organizations\` WHERE \`organization_name\` = ?
        `;
    const universityResults = await sequelize.query(checkUniversitySql, {
      replacements: [organization_name], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });


    if (universityResults.length > 0) {
      const error = new Error("Organization with the same name already exists");
      console.error(error.message);
      return callback(error, null);
    }
    */

    // Step 3: Insert the new organization record
    const insertUniversitySql = `
                      INSERT INTO \`organizations\` (
                       \`organization_name\`, \`location\`, \`verifier_name\`, \`designation\`, \`mobile_number\`, \`email_id\`, \`centralized_email_id\`, \`scope_of_services\`, \`verification_name\`, \`pricing\`, \`turnaround_time\`, \`organization_status\`, \`industry\`, \`standard_process\`, \`remark\`
                      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    `;
    const results = await sequelize.query(insertUniversitySql, {
      replacements: [organization_name,
        location,
        verifier_name,
        designation,
        mobile_number,
        email_id,
        centralized_email_id,
        scope_of_services,
        verification_name,
        pricing,
        turnaround_time,
        organization_status,
        industry,
        standard_process,
        remark,], // Positional replacements using ?
      type: QueryTypes.INSERT,
    });
    callback(null, results);
  },

  list: async (callback) => {
    const sql = `
          SELECT * FROM \`organizations\``;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  },

  getById: async (id, callback) => {
    const sql = `SELECT * FROM \`organizations\` WHERE \`id\` = ?`;


    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);
  },

  update: async (
    id,
    organization_name,
    location,
    verifier_name,
    designation,
    mobile_number,
    email_id,
    centralized_email_id,
    scope_of_services,
    verification_name,
    pricing,
    turnaround_time,
    organization_status,
    industry,
    standard_process,
    remark,
    callback
  ) => {
    const sql = `
          UPDATE \`organizations\`
          SET
            \`organization_name\` =?,
            \`location\` =?,
            \`verifier_name\` =?,
            \`designation\` =?,
            \`mobile_number\` =?,
            \`email_id\` =?,
            \`centralized_email_id\` =?,
            \`scope_of_services\` =?,
            \`verification_name\` =?,
            \`pricing\` =?,
            \`turnaround_time\` =?,
            \`organization_status\` =?,
            \`industry\` =?,
            \`standard_process\` =?,
            \`remark\` =?
          WHERE \`id\` = ?
        `;
    const results = await sequelize.query(sql, {
      replacements: [organization_name,
        location,
        verifier_name,
        designation,
        mobile_number,
        email_id,
        centralized_email_id,
        scope_of_services,
        verification_name,
        pricing,
        turnaround_time,
        organization_status,
        industry,
        standard_process,
        remark,
        id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);


  },

  delete: async (id, callback) => {
    const sql = `
          DELETE FROM \`organizations\`
          WHERE \`id\` = ?
        `;

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.DELETE,
    });

    callback(null, results);


  },
};

module.exports = Organization;
