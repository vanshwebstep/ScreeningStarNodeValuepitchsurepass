const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");
const DailyActivity = {

  checkIfBuisnessDevelopmentExist: async (
    BuisnessDevelopmentNames,
    callback
  ) => {
    return callback(null, {
      status: true,
      message: "All Buisness Developments are unique."
    });
    
    if (!Array.isArray(BuisnessDevelopmentNames) || BuisnessDevelopmentNames.length === 0) {
      return callback({ status: false, message: "No Buisness Development Names provided." }, null)
    }

    // Step 1: Remove duplicates, trim whitespace, and ensure valid string values
    const uniqueNames = [
      ...new Set(
        BuisnessDevelopmentNames
          .map(name => (typeof name === 'string' ? name.trim() : '')) // Check if the value is a string before calling trim
          .filter(name => name !== '') // Filter out any invalid or empty strings
      ),
    ];

    // Check if the uniqueNames array is still empty after cleanup
    if (uniqueNames.length === 0) {
      return callback({ status: false, message: "No Buisness Development Names after cleanup." }, null);
    }

    // Step 2: Build and execute query
    const checkSql = `
 SELECT \`bd_expert_name\` 
 FROM \`daily_activities\` 
 WHERE \`bd_expert_name\` IN (?)
`;
    const existingResults = await sequelize.query(checkSql, {
      replacements: [uniqueNames],
      type: QueryTypes.SELECT
    });


    // Step 3: Extract existing names
    const existingNames = existingResults.map(u => u.bd_expert_name);

    if (existingNames.length > 0) {
      return callback({
        status: false,
        alreadyExists: existingNames,
        message: `Buisness Developments already exist: ${existingNames.join(", ")}`
      }, null);
    }

    return callback(null, {
      status: true,
      message: "All Buisness Developments are unique."
    });
  },
  create: async (
    bd_expert_name,
    date,
    client_organization_name,
    company_size,
    spoc_name,
    spoc_designation,
    contact_number,
    email,
    is_using_any_bgv_vendor,
    vendor_name,
    is_interested_in_using_our_services,
    reason_for_not_using_our_services,
    reason_for_using_our_services,
    callback_asked_at,
    is_prospect,
    comments,
    followup_date,
    followup_comments,
    remarks,
    callback
  ) => {

    /*
    // Step 1: Check if a Daily Activity with the same name already exists
    const checkDailyActivitySql = `
          SELECT * FROM \`daily_activities\` WHERE \`bd_expert_name\` = ?
        `;
    const universityResults = await sequelize.query(checkDailyActivitySql, {
      replacements: [bd_expert_name], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    // Step 2: If a Daily Activity with the same name exists, return an error
    if (universityResults.length > 0) {
      const error = new Error("DailyActivity  with the same name already exists");
      console.error(error.message);
      return callback(error, null);
    }
    */

    // Step 3: Insert the new Daily Activity record
    const insertDailyActivitySql = `
                      INSERT INTO \`daily_activities\` (\`bd_expert_name\`, \`date\`, \`client_organization_name\`, \`company_size\`, \`spoc_name\`, \`spoc_designation\`, \`contact_number\`, \`email\`, \`is_using_any_bgv_vendor\`, \`vendor_name\`, \`is_interested_in_using_our_services\`, \`reason_for_not_using_our_services\`, \`reason_for_using_our_services\`, \`callback_asked_at\`, \`is_prospect\`, \`comments\`, \`followup_date\`, \`followup_comments\`, \`remarks\`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    `;
    const results = await sequelize.query(insertDailyActivitySql, {
      replacements: [
        bd_expert_name,
        date,
        client_organization_name,
        company_size,
        spoc_name,
        spoc_designation,
        contact_number,
        email,
        is_using_any_bgv_vendor,
        vendor_name,
        is_interested_in_using_our_services,
        reason_for_not_using_our_services,
        reason_for_using_our_services,
        callback_asked_at,
        is_prospect,
        comments,
        followup_date,
        followup_comments,
        remarks,
      ], // Positional replacements using ?
      type: QueryTypes.INSERT,
    });

    callback(null, results);
  },

  list: async (callback) => {
    const sql = `
          SELECT * FROM \`daily_activities\``;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  },

  getById: async (id, callback) => {
    const sql = `SELECT * FROM \`daily_activities\` WHERE \`id\` = ?`;

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);
  },

  update: async (
    id,
    bd_expert_name,
    date,
    client_organization_name,
    company_size,
    spoc_name,
    spoc_designation,
    contact_number,
    email,
    is_using_any_bgv_vendor,
    vendor_name,
    is_interested_in_using_our_services,
    reason_for_not_using_our_services,
    reason_for_using_our_services,
    callback_asked_at,
    is_prospect,
    comments,
    followup_date,
    followup_comments,
    remarks,
    callback
  ) => {
    const sql = `
          UPDATE \`daily_activities\`
          SET
            \`bd_expert_name\` = ?,
            \`date\` = ?,
            \`client_organization_name\` = ?,
            \`company_size\` = ?,
            \`spoc_name\` = ?,
            \`spoc_designation\` = ?,
            \`contact_number\` = ?,
            \`email\` = ?,
            \`is_using_any_bgv_vendor\` = ?,
            \`vendor_name\` = ?,
            \`is_interested_in_using_our_services\` = ?,
            \`reason_for_not_using_our_services\` = ?,
            \`reason_for_using_our_services\` = ?,
            \`callback_asked_at\` = ?,
            \`is_prospect\` = ?,
            \`comments\` = ?,
            \`followup_date\` = ?,
            \`followup_comments\` = ?,
            \`remarks\` = ?
          WHERE \`id\` = ?
        `;
    const results = await sequelize.query(sql, {
      replacements: [
        bd_expert_name,
        date,
        client_organization_name,
        company_size,
        spoc_name,
        spoc_designation,
        contact_number,
        email,
        is_using_any_bgv_vendor,
        vendor_name,
        is_interested_in_using_our_services,
        reason_for_not_using_our_services,
        reason_for_using_our_services,
        callback_asked_at,
        is_prospect,
        comments,
        followup_date,
        followup_comments,
        remarks,
        id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);

  },

  delete: async (id, callback) => {
    const sql = `
          DELETE FROM \`daily_activities\`
          WHERE \`id\` = ?
        `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.DELETE,
    });

    callback(null, results);
  },
};

module.exports = DailyActivity;
