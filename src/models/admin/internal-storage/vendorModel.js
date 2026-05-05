const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");
const Vendor = {

  checkIfVendorsExist: async (
    vendorNames,
    callback
  ) => {
    return callback(null, {
      status: true,
      message: "All vendors are unique."
    });

    if (!Array.isArray(vendorNames) || vendorNames.length === 0) {
      return callback({ status: false, message: "No Vendor Names provided." }, null)
    }

    // Step 1: Remove duplicates, trim whitespace, and ensure valid string values
    const uniqueNames = [
      ...new Set(
        vendorNames
          .map(name => (typeof name === 'string' ? name.trim() : '')) // Check if the value is a string before calling trim
          .filter(name => name !== '') // Filter out any invalid or empty strings
      ),
    ];

    // Check if the uniqueNames array is still empty after cleanup
    if (uniqueNames.length === 0) {
      return callback({ status: false, message: "No Vendor Names after cleanup." }, null);
    }

    // Step 2: Build and execute query
    const checkSql = `
 SELECT \`vendor_name\` 
 FROM \`vendors\` 
 WHERE \`vendor_name\` IN (?)
`;
    const existingResults = await sequelize.query(checkSql, {
      replacements: [uniqueNames],
      type: QueryTypes.SELECT
    });


    // Step 3: Extract existing names
    const existingNames = existingResults.map(u => u.vendor_name);

    if (existingNames.length > 0) {
      return callback({
        status: false,
        alreadyExists: existingNames,
        message: `vendors already exist: ${existingNames.join(", ")}`
      }, null);
    }

    return callback(null, {
      status: true,
      message: "All vendors are unique."
    });
  },

  create: async (
    vendor_name,
    registered_address,
    authorized_person_name,
    authorized_person_designation,
    mobile_number,
    email_id,
    spoc_name,
    spoc_designation,
    service_presence,
    scope_of_services,
    pricing,
    turnaround_time,
    standard_process,
    vendor_status,
    remarks,
    callback
  ) => {
    /*
    // Step 1: Check if a vendor with the same name already exists
    const checkVendorSql = `
          SELECT * FROM \`vendors\` WHERE \`vendor_name\` = ?
        `;
    const universityResults = await sequelize.query(checkVendorSql, {
      replacements: [vendor_name], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    // Step 2: If a vendor with the same name exists, return an error
    if (universityResults.length > 0) {
      const error = new Error("Vendor  with the same name already exists");
      console.error(error.message);
      return callback(error, null);
    }
    */

    // Step 3: Insert the new vendor record
    const insertVendorSql = `
                      INSERT INTO \`vendors\` (
                          \`vendor_name\`, \`registered_address\`, \`authorized_person_name\`, \`authorized_person_designation\`, \`mobile_number\`, \`email_id\`, \`spoc_name\`, \`spoc_designation\`, \`service_presence\`, \`scope_of_services\`, \`pricing\`, \`turnaround_time\`, \`standard_process\`, \`vendor_status\`, \`remarks\`
                      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    `;
    const results = await sequelize.query(insertVendorSql, {
      replacements: [vendor_name,
        registered_address,
        authorized_person_name,
        authorized_person_designation,
        mobile_number,
        email_id,
        spoc_name,
        spoc_designation,
        service_presence,
        scope_of_services,
        pricing,
        turnaround_time,
        standard_process,
        vendor_status,
        remarks,], // Positional replacements using ?
      type: QueryTypes.INSERT,
    });

    callback(null, results);
  },

  list: async (callback) => {
    const sql = `
          SELECT * FROM \`vendors\``;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    callback(null, results);


  },

  getById: async (id, callback) => {
    const sql = `SELECT * FROM \`vendors\` WHERE \`id\` = ?`;


    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);

  },

  update: async (
    id,
    vendor_name,
    registered_address,
    authorized_person_name,
    authorized_person_designation,
    mobile_number,
    email_id,
    spoc_name,
    spoc_designation,
    service_presence,
    scope_of_services,
    pricing,
    turnaround_time,
    standard_process,
    vendor_status,
    remarks,
    callback
  ) => {
    const sql = `
          UPDATE \`vendors\`
          SET
            \`vendor_name\` = ?,
            \`registered_address\` = ?,
            \`authorized_person_name\` = ?,
            \`authorized_person_designation\` = ?,
            \`mobile_number\` = ?,
            \`email_id\` = ?,
            \`spoc_name\` = ?,
            \`spoc_designation\` = ?,
            \`service_presence\` = ?,
            \`scope_of_services\` = ?,
            \`pricing\` = ?,
            \`turnaround_time\` = ?,
            \`standard_process\` = ?,
            \`vendor_status\` = ?,
            \`remarks\` = ?
          WHERE \`id\` = ?
        `;
    const results = await sequelize.query(sql, {
      replacements: [vendor_name,
        registered_address,
        authorized_person_name,
        authorized_person_designation,
        mobile_number,
        email_id,
        spoc_name,
        spoc_designation,
        service_presence,
        scope_of_services,
        pricing,
        turnaround_time,
        standard_process,
        vendor_status,
        remarks, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);

  },

  delete: async (id, callback) => {
    const sql = `
          DELETE FROM \`vendors\`
          WHERE \`id\` = ?
        `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.DELETE,
    });

    callback(null, results);
  },
};

module.exports = Vendor;
