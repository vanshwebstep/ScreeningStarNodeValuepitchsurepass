const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");
const generateReportForm = {
    list: async (callback) => {
        const sql = `
            SELECT 
                s.id,
                s.group_id, 
                s.title, 
                s.service_code,
                rp.json,
                sg.title AS group_name 
            FROM \`services\` s
            JOIN \`service_groups\` sg ON s.group_id = sg.id
            JOIN \`report_forms\` rp ON rp.service_id = s.id
        `;
       
            const results = await sequelize.query(sql, {
                type: QueryTypes.SELECT,
              });
               
                callback(null, results);

     
    },

    formByServiceId:async (service_id, callback) => {
        const sql = `
            SELECT 
                s.id,
                s.group_id, 
                s.title, 
                s.service_code,
                rp.json,
                sg.title AS group_name 
            FROM \`services\` s
            JOIN \`service_groups\` sg ON s.group_id = sg.id
            JOIN \`report_forms\` rp ON rp.service_id = s.id
            WHERE s.id = ? 
            LIMIT 1
        `;
            const results = await sequelize.query(sql, {
                replacements: [service_id], // Positional replacements using ?
                type: QueryTypes.SELECT,
              });
                callback(null, results.length > 0 ? results[0] : null);
       
    },

    updateOrInsert:async (serviceId, json, admin_id, callback) => {
        const checkExistenceQuery = `
          SELECT 1 FROM \`report_forms\` WHERE \`service_id\` = ? LIMIT 1;
        `;
        const updateQuery = `
          UPDATE \`report_forms\` 
          SET \`json\` = ? 
          WHERE \`service_id\` = ?;
        `;
        const insertQuery = `
          INSERT INTO \`report_forms\` (\`service_id\`, \`json\`, \`admin_id\`) 
          VALUES (?, ?, ?);
        `;

            const results = await sequelize.query(checkExistenceQuery, {
                replacements: [serviceId], // Positional replacements using ?
                type: QueryTypes.SELECT,
              });
                if (results.length > 0) {
                    const updateResults = await sequelize.query(updateQuery, {
                        replacements: [json, serviceId, admin_id], // Positional replacements using ?
                        type: QueryTypes.UPDATE,
                      });
                        callback(null, { action: "updated", ...updateResults });
                   
                } else {
                    const insertResults = await sequelize.query(insertQuery, {
                        replacements: [serviceId, json], // Positional replacements using ?
                        type: QueryTypes.INSERT,
                      });
                        callback(null, { action: "inserted", ...insertResults });
                }
          
       
    },
};

module.exports = generateReportForm;
