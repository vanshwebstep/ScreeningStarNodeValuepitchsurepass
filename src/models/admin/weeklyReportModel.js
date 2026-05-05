const { sequelize } = require("../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");
const WeeklyReport = {
  list: async (startOfWeek, endOfWeek, callback) => {
    const sql = `
    SELECT * FROM \`client_applications\`
    WHERE \`created_at\` BETWEEN ? AND ? AND is_deleted != 1
  `;
      const results = await sequelize.query(sql, {
        replacements: [startOfWeek, endOfWeek], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });      

        callback(null, results);
   
  },
};

module.exports = WeeklyReport;
