const { sequelize } = require("../config/db");
const { QueryTypes } = require("sequelize");

const AppCommon = {
  appInfo: async (interfaceType, callback) => {
    try {
      const sql = `
        SELECT * FROM \`app_info\`
        WHERE \`status\` = 1 AND \`interface_type\` = ?
        ORDER BY \`updated_at\` DESC
        LIMIT 1
      `;
      
      const results = await sequelize.query(sql, {
        replacements: [interfaceType],
        type: QueryTypes.SELECT,
      });

      callback(null, results.length > 0 ? results[0] : false);
    } catch (error) {
      callback(error, null);
    }
  },

  companyInfo: async (callback) => {
    try {
      const sql = `
        SELECT * FROM \`company_info\`
        WHERE \`status\` = 1
        ORDER BY \`updated_at\` DESC
        LIMIT 1
      `;
      
      const results = await sequelize.query(sql, {
        type: QueryTypes.SELECT,
      });

      callback(null, results.length > 0 ? results[0] : false);
    } catch (error) {
      callback(error, null);
    }
  },
};


module.exports = AppCommon;
