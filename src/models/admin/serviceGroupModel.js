const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const ServiceGroup = {
  create: async (title, symbol, admin_id, callback) => {
    // Step 1: Check if a service Group with the same title already exists
    const checkServiceGroupSql = `
      SELECT * FROM \`service_groups\` WHERE \`title\` = ? OR \`symbol\` = ?
    `;
    const serviceResults = await sequelize.query(checkServiceGroupSql, {
      replacements: [title, symbol],
      type: QueryTypes.SELECT,
    });
    if (serviceResults.length > 0) {
      const error = new Error(
        "Service Group with the same name already exists"
      );
      console.error(error.message);
      return callback(error, null);
    }

    // Step 3: Insert the new service Group
    const insertServiceGroupSql = `
          INSERT INTO \`service_groups\` (\`title\`, \`symbol\`, \`admin_id\`)
          VALUES (?, ?, ?)
        `;
    const results = await sequelize.query(insertServiceGroupSql, {
      replacements: [title, symbol, admin_id], // Positional replacements using ?
      type: QueryTypes.INSERT,
    });
    callback(null, results);
  },

  list: async (callback) => {
    const sql = `SELECT * FROM \`service_groups\``;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    callback(null, results);


  },

  getServiceGroupById: async (id, callback) => {
    const sql = `SELECT * FROM \`service_groups\` WHERE \`id\` = ?`;

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    callback(null, results[0]);

  },

  update: async (id, title, symbol, callback) => {
    const sql = `
      UPDATE \`service_groups\`
      SET \`title\` = ?, \`symbol\` = ?
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [title, symbol, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);


  },

  delete: async (id, callback) => {
    const sql = `
      DELETE FROM \`service_groups\`
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.DELETE,
    });

    callback(null, results);


  },
};

module.exports = ServiceGroup;
