const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const Permission = {
  rolesList:async (callback) => {
    const sql = `
      SELECT 
        role
      FROM \`permissions\`
    `;
 
      const results = await sequelize.query(sql, {
        type: QueryTypes.SELECT,
      });
        callback(null, results);
  },

  list:async (callback) => {
    const sql = `
      SELECT 
        id,
        role,
        json,
        service_ids
      FROM \`permissions\`
    `;

  
      const results = await sequelize.query(sql, {
        type: QueryTypes.SELECT,
      });
        callback(null, results);
  },

  getPermissionById:async (id, callback) => {
    const sql = `SELECT * FROM \`permissions\` WHERE \`id\` = ?`;

 
      const results = await sequelize.query(sql, {
        replacements: [id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
        callback(null, results[0]);
  },

  getPermissionByRole:async (role, callback) => {
    const sql = `SELECT * FROM \`permissions\` WHERE \`role\` = ?`;
      if (err) {
        return callback(err, null);
      }
      const results = await sequelize.query(sql, {
        replacements: [role], 
        type: QueryTypes.SELECT,
      });

        callback(null, results[0]);
  },

  update:async (id, permission_json, service_ids, callback) => {
    const sql = `
      UPDATE \`permissions\`
      SET \`json\` = ?, \`service_ids\` = ?
      WHERE \`id\` = ?
    `;

      const results = await sequelize.query(sql, {
        replacements: [permission_json, service_ids, id], // Positional replacements using ?
        type: QueryTypes.UPDATE,
      });
    
          callback(null, results);

  },
};

module.exports = Permission;
