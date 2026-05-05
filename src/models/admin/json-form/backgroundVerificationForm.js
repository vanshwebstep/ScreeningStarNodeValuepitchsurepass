const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");
const backgroundVerificationForm = {
    list:async (callback) => {
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
            JOIN \`cef_service_forms\` rp ON rp.service_id = s.id
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
            JOIN \`cef_service_forms\` rp ON rp.service_id = s.id
            WHERE s.id = ? 
            LIMIT 1
        `;

      
            const results = await sequelize.query(sql, {
                replacements: [service_id], // Positional replacements using ?
                type: QueryTypes.SELECT,
              });

                callback(null, results.length > 0 ? results[0] : null);
    },

    update:async (
        service_id,
        json,
        callback
    ) => {
        const sql = `
          UPDATE \`cef_service_forms\`
          SET \`json\` = ?
          WHERE \`service_id\` = ?
        `;

      
            const results = await sequelize.query(sql, {
                replacements: [json, service_id], // Positional replacements using ?
                type: QueryTypes.UPDATE,
              });        
                    callback(null, results);
 ;
    },
};

module.exports = backgroundVerificationForm;
