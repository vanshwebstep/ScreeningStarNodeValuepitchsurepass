const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../../config/db");

const subUser = {
  create:async  (data, callback) => {
    const { branch_id, customer_id, email, password } = data;

      const checkBranchesEmailSql = `
            SELECT * FROM \`branches\`
            WHERE \`email\` = ?
        `;
        const results = await sequelize.query(checkBranchesEmailSql, {
          replacements: [email], // Positional replacements using ?
          type: QueryTypes.SELECT,
        });
       
        if (results.length > 0) {
          return callback(
            { message: "Email is already associated with another branch." },
            null
          );
        }
        // If email does not exist in the branches table, check in branch_sub_users for the specific email
        const checkBranchSubUsersEmailSql = `
                SELECT * FROM \`branch_sub_users\`
                WHERE \`email\` = ?
            `;
            const resultss = await sequelize.query(checkBranchSubUsersEmailSql, {
              replacements: [email], // Positional replacements using ?
              type: QueryTypes.SELECT,
            });
       
          
          if (resultss.length > 0) {
            const existingBranchId = resultss[0].branch_id;

            if (existingBranchId === branch_id) {
              return callback(
                { message: "Email is already associated with this branch." },
                null
              );
            } else {
              return callback(
                { message: "Email is already associated with another branch." },
                null
              );
            }
          }

          const insertSql = `
                    INSERT INTO \`branch_sub_users\` (
                        \`branch_id\`,
                        \`customer_id\`,
                        \`email\`,
                        \`password\`
                    ) VALUES (?, ?, ?, md5(?))
                `;

          const values = [branch_id, customer_id, email, password];

          const resultsss = await sequelize.query(insertSql, {
            replacements: values, // Positional replacements using ?
            type: QueryTypes.INSERT,
          });
              const new_application_id = resultsss.insertId;

            return callback(null, { resultsss, new_application_id });  
 
  },


  getSubUserById: async (id, callback) => {
    
      const sql = `SELECT * FROM \`branch_sub_users\` WHERE \`id\` = ?`;

      const results = await sequelize.query(sql, {

        replacements: [id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
        if (results.length === 0) {
          return callback(null, null);
        }
        callback(null, results[0]);
    
   
  },
  list: async (branch_id, callback) => {


      const sqlClient = `
        SELECT id, email
        FROM branch_sub_users
        WHERE branch_id = ?
      `;
      const subUserResults = await sequelize.query(sqlClient, {
        replacements: [branch_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
    
      if (subUserResults.length === 0) {
          return callback(null, {
            message: "No sub-users found for this branch.",
            data: [],
          });
        }

        return callback(null, subUserResults);
    },

  updateEmail: async  (data, callback) => {
    const { id, branch_id, customer_id, email } = data;

      const checkEmailSql = `
        SELECT * FROM \`branch_sub_users\` WHERE \`email\` = ? AND \`branch_id\` = ? AND \`id\` != ?
      `;
      const results = await sequelize.query(checkEmailSql, {
        replacements: [email, branch_id, id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
     
          if (results.length > 0) {
            
            return callback(
              { message: "Email is already associated with this branch." },
              null
            );
          }

          // SQL query for updating the record in branch_sub_users
          const updateSql = `
          UPDATE \`branch_sub_users\` 
          SET 
            \`branch_id\` = ?, 
            \`customer_id\` = ?, 
            \`email\` = ?
          WHERE \`id\` = ?
        `;

          const values = [branch_id, customer_id, email, id];

          const resultss = await sequelize.query(updateSql, {
            replacements: values, // Positional replacements using ?
            type: QueryTypes.UPDATE,
          });
           
            return callback(null, {
              resultss,
              message: "Record updated successfully.",
            });  
  
  },

  updatePassword:async  (data, callback) => {
    const { id, branch_id, customer_id, password } = data;


      try {
        // SQL query for updating the record in branch_sub_users
        const updateSql = `
                UPDATE \`branch_sub_users\` 
                SET 
                    \`branch_id\` = ?, 
                    \`customer_id\` = ?, 
                    \`password\` = md5(?)
                WHERE \`id\` = ?
            `;

        const values = [branch_id, customer_id, password, id];

        const results = await sequelize.query(updateSql, {
          replacements: values, // Positional replacements using ?
          type: QueryTypes.UPDATE,
        });       
   
          if (results.affectedRows === 0) {
            return callback(
              { message: "No record found with the given ID." },
              null
            );
          }

          // Success
          return callback(null, {
            results,
            message: "Record updated successfully.",
          });
       
      } catch (error) {
        // Release connection and handle unexpected errors
        
        console.error("Unexpected error:", error);
        return callback({ message: "Unexpected error occurred", error }, null);
      }
 
  },

  updateStatus:async  (status, client_application_id, callback) => {

      const sql = `
      UPDATE \`client_applications\`
      SET
        \`status\` = ?
      WHERE
        \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [status, client_application_id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
        callback(null, results);
 
  },

  delete: async (id, callback) => {
    try {
      const deleteSql = `DELETE FROM branch_sub_users WHERE id = ?`;
      const results = await sequelize.query(deleteSql, {
        replacements: [id],
        type: QueryTypes.DELETE,
      });
  
      callback(null, {
        message: "Record deleted successfully.",
        affectedRows: results || 0,
      });
    } catch (error) {
      callback(error, null);
    }
  }
  
  
};

module.exports = subUser;
