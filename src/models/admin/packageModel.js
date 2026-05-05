const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const Package = {
  create: async (title, description, admin_id, callback) => {
    const sql = `
      INSERT INTO \`packages\` (\`title\`, \`description\`, \`admin_id\`)
      VALUES (?, ?, ?)
    `;
    const results = await sequelize.query(sql, {
      replacements: [title, description, admin_id], // Positional replacements using ?
      type: QueryTypes.INSERT,
    });
    callback(null, results);
  },

  list: async (callback) => {
    const sql = `SELECT * FROM \`packages\``;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });

    callback(null, results);


  },

  getPackageById:async (id, callback) => {
    const sql = `SELECT * FROM \`packages\` WHERE \`id\` = ?`;
      const results = await sequelize.query(sql, {
        replacements: [id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
        callback(null, results[0]);
  },

  update:async (id, title, description, callback) => {
    const sql = `
      UPDATE \`packages\`
      SET \`title\` = ?, \`description\` = ?
      WHERE \`id\` = ?
    `;

      const results = await sequelize.query(sql, {
        replacements: [title, description, id], // Positional replacements using ?
        type: QueryTypes.UPDATE,
      });
        callback(null, results);
  },

  delete: async (id, callback) => {
    const sql = `
      DELETE FROM \`packages\`
      WHERE \`id\` = ?
    `;

      const results = await sequelize.query(sql, {
        replacements: [id], // Positional replacements using ?
        type: QueryTypes.DELETE,
      });
        callback(null, results);
  },
};

module.exports = Package;
