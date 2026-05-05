const { sequelize } = require("../../../../config/db");
const { QueryTypes } = require("sequelize");
const clientApplication = {
  list: async (branch_id, callback) => {
    try {
      // Define the client query
      const sqlClient = `
        SELECT * FROM client_applications 
        WHERE status != 'completed' 
        AND branch_id = ? 
        AND is_deleted = 1 
        ORDER BY created_at DESC
      `;
  
      const clientResults = await sequelize.query(sqlClient, {
        replacements: [branch_id], 
        type: QueryTypes.SELECT,
      });
  
      const finalResults = [];
  
      // Process each client application in parallel
      const cmtPromises = clientResults.map(async (clientApp) => {
        // Query for CMT applications
        const sqlCmt = `SELECT * FROM cmt_applications WHERE client_application_id = ?`;
        const cmtResults = await sequelize.query(sqlCmt, {
          replacements: [clientApp.id], 
          type: QueryTypes.SELECT,
        });
  
        // Prefix "cmt_" to CMT application fields
        const cmtData = cmtResults.map((cmtApp) => 
          Object.fromEntries(Object.entries(cmtApp).map(([key, value]) => [`cmt_${key}`, value]))
        );
  
        // Handle services retrieval
        const servicesIds = clientApp.services ? clientApp.services.split(",") : [];
        let servicesTitles = [];
  
        if (servicesIds.length > 0) {
          const servicesQuery = `SELECT title FROM services WHERE id IN (?)`;
          const servicesResults = await sequelize.query(servicesQuery, {
            replacements: [servicesIds], 
            type: QueryTypes.SELECT,
          });
          servicesTitles = servicesResults.map(service => service.title);
        }
  
        // Push the final result
        finalResults.push({
          ...clientApp,
          cmtApplications: cmtData.length > 0 ? cmtData : [],
          serviceNames: servicesTitles,
        });
      });
  
      // Wait for all async operations
      await Promise.all(cmtPromises);
  
      // Return results via callback
      callback(null, finalResults);
  
    } catch (err) {
      callback(err, null);
    }
  },
  

  getClientApplicationById:async  (id, callback) => {
    
      const sql = "SELECT * FROM `client_applications` WHERE id = ? AND is_deleted = 1";
      const results = await sequelize.query(sql, {
        replacements: [id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
        callback(null, results[0]);
      
   
  },

  destroy:async  (id, callback) => {
      const sqlGetServices =
        "SELECT services FROM `client_applications` WHERE `id` = ? AND is_deleted = 1";
        const results = await sequelize.query(sqlGetServices, {
          replacements: [id], // Positional replacements using ?
          type: QueryTypes.SELECT,
        });

        if (results.length === 0) {
          return callback(
            { message: "No client application found or not deleted with the given ID" },
            null
          );
        }

        const services = results[0].services;
        const servicesArray = services
          .split(",")
          .map((service) => parseInt(service.trim())); // Parse to integers

        const jsonResults = []; // Array to hold JSON results
        let completedQueries = 0; // Counter to track completed queries

        // Step 2: Loop through each service ID and query the report_forms table
        servicesArray.forEach(async (serviceId) => {
          const sqlGetJson =
            "SELECT json FROM report_forms WHERE service_id = ?";
            const jsonQueryResults = await sequelize.query(sqlGetJson, {
              replacements: [serviceId], // Positional replacements using ?
              type: QueryTypes.SELECT,
            });
            if (jsonQueryResults.length > 0) {
              try {
                const jsonData = JSON.parse(jsonQueryResults[0].json);
                const dbTable = jsonData.db_table;

                // Check if dbTable exists and if there is an entry with client_application_id = id
                const sqlCheckEntry = `SELECT * FROM \`${dbTable}\` WHERE client_application_id = ?`;
                const entryResults = await sequelize.query(sqlCheckEntry, {
                  replacements: [id], // Positional replacements using ?
                  type: QueryTypes.SELECT,
                });
                 if (entryResults.length > 0) {
                    // Entry found, proceed to delete it
                    const sqlDeleteEntry = `DELETE FROM \`${dbTable}\` WHERE client_application_id = ?`;
                   await sequelize.query(sqlDeleteEntry, {
                      replacements: [id], // Positional replacements using ?
                      type: QueryTypes.DELETE,
                    });
                    
                  }
                jsonResults.push(jsonQueryResults[0].json);
              } catch (parseError) {
                console.error("Error parsing JSON:", parseError);
              }
            }

            // Increment the counter and check if all queries are done
            completedQueries++;
            if (completedQueries === servicesArray.length) {
              // Step 3: Now delete the client_application entry
              const sqlDelete =
                "DELETE FROM `client_applications` WHERE `id` = ?";
                const deleteResults = await sequelize.query(sqlDelete, {
                  replacements: [id], // Positional replacements using ?
                  type: QueryTypes.DELETE,
                });

                callback(null, {
                  deletedServices: servicesArray,
                  jsonResults,
                  deleteResults,
                });
             
            }
        
        });
     
  
  },

  restore: async (id, callback) => {
      
      const checkSql = `SELECT is_deleted FROM \`client_applications\` WHERE id = ?`;
      const results = await sequelize.query(checkSql, {
        replacements: [id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });

        if (results.length === 0) {
          
          return callback({ message: "Application not found" }, null);
        }

        if (results[0].is_deleted !== 1) {
          
          return callback({ message: "Application is not deleted" }, null);
        }

        const deleteSql = `
          UPDATE \`client_applications\`
          SET is_deleted = 0, deleted_at = NULL
          WHERE id = ?
        `;
        const deleteresult = await sequelize.query(deleteSql, {
          replacements: [id], // Positional replacements using ?
          type: QueryTypes.UPDATE,
        });
         
          callback(null, { message: "Application successfully restored", deleteresult });
     
  },
};

module.exports = clientApplication;
