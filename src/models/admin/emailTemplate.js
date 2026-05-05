const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const EmailTemplate = {
    list:async (callback) => {
        const sql = `SELECT DISTINCT \`module\` FROM \`emails\``;
            const results = await sequelize.query(sql, {
                type: QueryTypes.SELECT,
              });

                callback(null, results);
    },

    getTemplatesByModule:async (module, callback) => {
        const trimmedModule = module.trim(); // Trim any whitespace

        const sql = `SELECT * FROM \`emails\` WHERE LOWER(\`module\`) = LOWER(?)`;

            const results = await sequelize.query(sql, {
                replacements: [trimmedModule], // Positional replacements using ?
                type: QueryTypes.SELECT,
              });
                callback(null, results);
    },

    getTemplateById:async (id, callback) => {
        const sql = `SELECT * FROM \`emails\` WHERE \`id\` = ?`;
            const results = await sequelize.query(sql, {
                replacements: [id], // Positional replacements using ?
                type: QueryTypes.SELECT,
              });
                callback(null, results[0]);
    },

    update:async (
        id,
        title,
        template,
        callback
    ) => {
        const sql = `
          UPDATE \`emails\`
          SET \`title\` = ?, \`template\` = ?
          WHERE \`id\` = ?
        `;
            const results = await sequelize.query(sql, {
                replacements: [title, template, id], // Positional replacements using ?
                type: QueryTypes.UPDATE,
              });
                    callback(null, results);
    },
};

module.exports = EmailTemplate;
