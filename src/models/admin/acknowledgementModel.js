const crypto = require("crypto");
const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const Acknowledgement = {
  list: async (callback) => {
    try {
      /*
      const sql = `
        SELECT 
          MAX(ca.\`id\`) AS \`id\`, 
          ca.\`ack_sent\`, 
          ca.\`branch_id\`, 
          ca.\`customer_id\`, 
          COUNT(*) AS application_count
        FROM 
          \`client_applications\` AS ca
        LEFT JOIN 
          \`cmt_applications\` AS cmt 
          ON ca.\`id\` = cmt.\`client_application_id\`
        WHERE 
          ca.\`ack_sent\` = 0
          AND (
            cmt.\`client_application_id\` IS NULL 
            OR cmt.\`overall_status\` != "completed"
          )
        GROUP BY 
          ca.\`branch_id\`, 
          ca.\`customer_id\`;
      `;
      */

      const sql = `
                SELECT 
                    MAX(\`id\`) AS \`id\`,
                    \`branch_id\`,
                    \`customer_id\`,
                    COUNT(*) AS application_count
                FROM 
                    \`client_applications\`
                WHERE 
                    \`ack_sent\` = 0
                    AND \`is_deleted\` != 1
                GROUP BY 
                    \`branch_id\`, 
                    \`customer_id\`;
            `;

      const results = await sequelize.query(sql, { type: QueryTypes.SELECT });

      // If no results, return early
      if (results.length === 0) {
        return callback(null, { data: [], totalResults: 0 });
      }

      const customerMap = new Map();
      let totalResults = 0;

      // Fetch customer and branch data in parallel
      const processedResults = await Promise.all(
        results.map(async (result) => {
          const { branch_id, customer_id, application_count } = result;

          const [customerResult, branchResult] = await Promise.all([
            sequelize.query(
              `SELECT \`id\`, \`admin_id\`, \`client_unique_id\`, \`name\` 
               FROM \`customers\` 
               WHERE \`id\` = ? AND \`status\` = ?`,
              { replacements: [customer_id, "1"], type: QueryTypes.SELECT }
            ),
            sequelize.query(
              `SELECT \`id\`, \`customer_id\`, \`name\`, \`is_head\`, \`head_id\` 
               FROM \`branches\` 
               WHERE \`id\` = ? AND \`status\` = ?`,
              { replacements: [branch_id, "1"], type: QueryTypes.SELECT }
            ),
          ]);

          if (!customerResult.length || !branchResult.length) return;

          const branchData = {
            id: branchResult[0].id,
            customer_id: branchResult[0].customer_id,
            name: branchResult[0].name,
            is_head: branchResult[0].is_head,
            head_id: branchResult[0].head_id,
            applicationCount: application_count,
          };

          if (!customerMap.has(customer_id)) {
            const customerData = customerResult[0];
            customerData.applicationCount = 0;
            customerData.branches = [];
            customerMap.set(customer_id, customerData);
          }

          const customerData = customerMap.get(customer_id);
          customerData.branches.push(branchData);
          customerData.applicationCount += application_count;
          totalResults += application_count;
        })
      );

      callback(null, { data: Array.from(customerMap.values()), totalResults });
    } catch (error) {
      console.error("Database query error:", error);
      callback(error, null);
    }
  },


  listByCustomerID: async (customer_id, callback) => {
    const sql = `
      SELECT id, application_id, name, services, ack_sent, branch_id, customer_id
      FROM client_applications
      WHERE ack_sent = 0 AND customer_id = ? AND \`is_deleted\` != 1
      ORDER BY created_at DESC
      LIMIT 250
    `;

    const results = await sequelize.query(sql, {
      replacements: [customer_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    const customerMap = new Map();
    let totalResults = 0;

    if (results.length === 0) {
      return callback(null, { data: [], totalResults: 0 });
    }

    let remainingQueries = results.length; // Track number of remaining results to process

    const processResults = async (result) => {
      const { id, branch_id, application_id, name, services } = result;


      const customerSql = `SELECT id, admin_id, client_unique_id, name FROM customers WHERE id = ? AND status = ? AND is_deleted != 1`;
      const branchSql = `SELECT id, customer_id, name, email, is_head, head_id FROM branches WHERE id = ? AND status = ?`;



      const customerResult = await sequelize.query(customerSql, {
        replacements: [customer_id, "1"], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      if (!customerResult.length) {
        console.error(
          "Error fetching customer:",
          "Customer not found"
        );
        remainingQueries--;
        checkRemainingQueries();
        return;
      }
      const branchResult = await sequelize.query(branchSql, {
        replacements: [branch_id, "1"], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      if (!branchResult.length) {
        console.error(
          "Error fetching branch:",
          "Branch not found"
        );
        remainingQueries--;
        checkRemainingQueries();
        return;
      }

      const branchData = {
        id: branchResult[0].id,
        customer_id: branchResult[0].customer_id,
        name: branchResult[0].name,
        is_head: branchResult[0].is_head,
        email: branchResult[0].email,
        head_id: branchResult[0].head_id,
        applications: [],
        applicationCount: 0,
      };

      // Add application details to the branch
      const applicationDetails = {
        id: id,
        application_id: application_id,
        name: name,
        services: services,
      };
      branchData.applications.push(applicationDetails);
      branchData.applicationCount += 1; // Increment count for this application

      // Group data under the customer ID
      if (!customerMap.has(customer_id)) {
        const customerData = customerResult[0];
        customerData.applicationCount = 0;
        customerData.branches = [];
        customerMap.set(customer_id, customerData);
      }

      // Add branch data and update counts
      const customerData = customerMap.get(customer_id);
      const existingBranch = customerData.branches.find(
        (branch) => branch.id === branchData.id
      );
      if (existingBranch) {
        existingBranch.applications.push(applicationDetails);
        existingBranch.applicationCount += 1; // Update count for this branch
      } else {
        customerData.branches.push(branchData);
      }
      customerData.applicationCount += 1; // Update total for customer
      totalResults += 1; // Update overall total

      // Resolve when all queries are done
      remainingQueries--;
      checkRemainingQueries();




    };

    const checkRemainingQueries = () => {
      if (remainingQueries === 0) {
        const finalResult = Array.from(customerMap.values());
        callback(null, { data: finalResult, totalResults });
      }
    };

    // Process each result
    results.forEach(processResults);


  },

  updateAckByCustomerID: async (applicationIdsString, customer_id, callback) => {
    // Convert the comma-separated string into an array of integers
    const applicationIdsArray = applicationIdsString.split(",").map(Number);

    const sqlUpdate = `
      UPDATE client_applications
      SET ack_sent = 1
      WHERE customer_id = ? AND ack_sent = 0 AND id IN (?)
    `;

    const results = await sequelize.query(sqlUpdate, {
      replacements: [customer_id, applicationIdsArray], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results.affectedRows);

  },
};

module.exports = Acknowledgement;
