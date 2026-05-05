const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const Service = {
  create: async (type, data, export_format, admin_id, callback) => {
    try {
      const insertServiceSql = `
      INSERT INTO \`integration_services\` (\`type\`, \`data\`, \`export_format\`)
      VALUES (?, ?, ?)
    `;

      const results = await sequelize.query(insertServiceSql, {
        replacements: [type, data, export_format], // Positional replacements
        type: QueryTypes.INSERT,
      });

      callback(null, results);
    } catch (err) {
      callback(err, null);
    }
  },

  list: async (callback) => {
    const sql = `
    SELECT 
      *
    FROM \`integration_services\`
    ORDER BY created_at DESC
  `;

    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });

    callback(null, results);
  },

  getIntegratedServiceById: async (id, callback) => {
    const sql = `SELECT * FROM \`integration_services\` WHERE \`id\` = ?`;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);
  },

  update: async (
    id,
    type,
    data,
    export_format,
    callback
  ) => {
    const sql = `
      UPDATE \`integration_services\`
      SET \`type\` = ?, \`data\` = ?, \`export_format\` = ?
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [type, data, export_format, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);
  },

  delete: async (id, callback) => {
    const sql = `
      DELETE FROM \`integration_services\`
      WHERE \`id\` = ?
    `;

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.DELETE,
    });
    callback(null, results);
  },
};

module.exports = Service;
