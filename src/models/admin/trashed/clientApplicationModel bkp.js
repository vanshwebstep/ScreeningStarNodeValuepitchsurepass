const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const Customer = {
  list: async (filter_status, callback) => {
    let client_application_ids = [];
    if (filter_status && filter_status !== null && filter_status !== "") {

      // Get the current date
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      let sql = `SELECT customer_id FROM customers WHERE status = 1`;
      switch (filter_status) {
        case 'overallCount':
          sql = `
                    SELECT DISTINCT
                      a.id,
                      a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      (
                        b.overall_status = 'wip'
                        OR b.overall_status = 'insuff'
                        OR (b.overall_status = 'completed' 
                          AND b.final_verification_status IN ('GREEN', 'RED', 'YELLOW', 'PINK', 'ORANGE')
                          AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                        )
                      )
                      AND (c.status = 1)
                      AND a.is_deleted = 1
              `;
          break;
        case 'qcStatusPendingCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                  FROM 
                    client_applications a 
                    JOIN customers c ON a.customer_id = c.id
                    JOIN cmt_applications b ON a.id = b.client_application_id
                  WHERE
                    a.is_report_downloaded = '1'
                    AND LOWER(b.is_verify) = 'no'
                    AND a.status = 'completed'
                    AND a.is_deleted = 1
                  ORDER BY 
                    b.id DESC;
              `;
          break;
        case 'wipCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE 
                      c.status = 1
                      AND b.overall_status = 'wip'
                      AND a.is_deleted = 1;
              `;
          break;
        case 'insuffCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE 
                      c.status = 1
                      AND b.overall_status = 'insuff'
                      AND a.is_deleted = 1;
              `;
          break;
        case 'previousCompletedCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'completed'
                      AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
                      AND c.status = 1
                      AND a.is_deleted = 1;
              `;
          break;
        case 'stopcheckCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'stopcheck'
                      AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
                      AND c.status = 1
                      AND a.is_deleted = 1;
              `;
          break;
        case 'activeEmploymentCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'active employment'
                      AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
                      AND c.status = 1
                      AND a.is_deleted = 1;
              `;
          break;
        case 'nilCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'nil'
                      AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
                      AND c.status = 1
                      AND a.is_deleted = 1;
              `;
          break;
        case 'notDoableCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'not doable'
                      AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
                      AND c.status = 1
                      AND a.is_deleted = 1;
              `;
          break;
        case 'candidateDeniedCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'candidate denied'
                      AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
                      AND c.status = 1
                      AND a.is_deleted = 1;
              `;
          break;
        case 'completedGreenCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND b.final_verification_status = 'GREEN'
                      AND c.status=1
                      AND a.is_deleted = 1;
              `;
          break;
        case 'completedRedCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND b.final_verification_status = 'RED'
                      AND c.status=1
                      AND a.is_deleted = 1;
              `;
          break;
        case 'completedYellowCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND b.final_verification_status  = 'YELLOW'
                      AND c.status=1
                      AND a.is_deleted = 1;
              `;
          break;
        case 'completedPinkCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND b.final_verification_status = 'PINK'
                      AND c.status=1
                      AND a.is_deleted = 1;
              `;
          break;
        case 'completedOrangeCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND b.final_verification_status = 'ORANGE'
                      AND c.status=1
                      AND a.is_deleted = 1;
              `;
          break;
      }
      const results = await sequelize.query(sql, {
        type: QueryTypes.SELECT,
      });
      results.forEach((row) => {
        client_application_ids.push(row.id);
      });

      let customersIDConditionString = "";
      if (client_application_ids.length > 0) {
        customersIDConditionString = ` AND customers.id IN (${customers_id.join(
          ","
        )})`;
      } else {
        return callback(null, []);
      }
      const finalSql = `
            WITH BranchesCTE AS (
                SELECT 
                    b.id AS branch_id,
                    b.customer_id
                FROM 
                    branches b
            )
            SELECT 
                customers.client_unique_id,
                customers.name,
                customer_metas.tat_days,
                customer_metas.single_point_of_contact,
                customer_metas.client_spoc_name,
                customers.id AS main_id,
                COALESCE(branch_counts.branch_count, 0) AS branch_count,
                COALESCE(application_counts.application_count, 0) AS application_count
            FROM 
                customers
            LEFT JOIN 
                customer_metas ON customers.id = customer_metas.customer_id
            LEFT JOIN (
                SELECT 
                    customer_id, 
                    COUNT(*) AS branch_count
                FROM 
                    branches
                GROUP BY 
                    customer_id
            ) AS branch_counts ON customers.id = branch_counts.customer_id
            LEFT JOIN (
                SELECT 
                    b.customer_id, 
                    COUNT(ca.id) AS application_count,
                    MAX(ca.created_at) AS latest_application_date
                FROM 
                    BranchesCTE b
                INNER JOIN 
                    client_applications ca ON b.branch_id = ca.branch_id
                WHERE
                  ca.is_data_qc = 1
                  AND ca.id IN (${client_application_ids.join(",")})
                  AND ca.is_deleted = 1
                GROUP BY 
                    b.customer_id
            ) AS application_counts ON customers.id = application_counts.customer_id
            WHERE 
                customers.status = 1
                AND COALESCE(application_counts.application_count, 0) > 0
            ORDER BY 
                application_counts.latest_application_date DESC;
          `;
          console.log(`finalSql - `, finalSql);
      const resultss = await sequelize.query(finalSql, {
        type: QueryTypes.SELECT,
      });
      for (const result of resultss) {

        const headBranchApplicationsCountQuery = `SELECT COUNT(*) FROM \`client_applications\` ca INNER JOIN \`branches\` b ON ca.branch_id = b.id WHERE ca.customer_id = ? AND b.customer_id = ? AND b.is_head = ? AND ca.is_deleted = 1`;
        const headBranchApplicationsCount = await new Promise(async (resolve, reject) => {

          const headBranchResults = await sequelize.query(headBranchApplicationsCountQuery, {
            replacements: [result.main_id, result.main_id, 1], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });
          resolve(headBranchResults[0]["COUNT(*)"]); // Get the count result

        }
        );
        result.head_branch_applications_count =
          headBranchApplicationsCount;
        const headBranchQuery = `SELECT id, is_head FROM \`branches\` WHERE \`customer_id\` = ? AND \`is_head\` = ?`;

        try {
          const headBranchID = await new Promise(async (resolve, reject) => {
            const headBranchResults = await sequelize.query(headBranchQuery, {
              replacements: [result.main_id, 1],
              type: QueryTypes.SELECT,
            });
            resolve(
              headBranchResults.length > 0
                ? headBranchResults[0].id
                : null
            );

          });

          result.head_branch_id = headBranchID;
        } catch (headBranchErr) {
          console.error(
            "Error fetching head branch id or applications count:",
            headBranchErr
          );
          result.head_branch_id = null;
          result.head_branch_applications_count = 0;
        }
        // }
      }
      console.log(`results - `, results);
      callback(null, results);


    } else {
      // If no filter_status is provided, proceed with the final SQL query without filters
      const finalSql = `
          WITH BranchesCTE AS (
              SELECT 
                  b.id AS branch_id,
                  b.customer_id
              FROM 
                  branches b
          )
          SELECT 
              customers.client_unique_id,
              customers.name,
              customer_metas.tat_days,
              customer_metas.single_point_of_contact,
              customer_metas.client_spoc_name,
              customers.id AS main_id,
              COALESCE(branch_counts.branch_count, 0) AS branch_count,
              COALESCE(application_counts.application_count, 0) AS application_count
          FROM 
              customers
          LEFT JOIN 
              customer_metas ON customers.id = customer_metas.customer_id
          LEFT JOIN (
              SELECT 
                  customer_id, 
                  COUNT(*) AS branch_count
              FROM 
                  branches
              GROUP BY 
                  customer_id
          ) AS branch_counts ON customers.id = branch_counts.customer_id
          LEFT JOIN (
              SELECT 
                  b.customer_id, 
                  COUNT(ca.id) AS application_count,
                  MAX(ca.created_at) AS latest_application_date
              FROM 
                  BranchesCTE b
              INNER JOIN 
                  client_applications ca ON b.branch_id = ca.branch_id
              WHERE ca.is_data_qc = 1 AND ca.is_deleted = 1
              GROUP BY 
                  b.customer_id
          ) AS application_counts ON customers.id = application_counts.customer_id
          WHERE 
              customers.status = 1
              AND COALESCE(application_counts.application_count, 0) > 0
          ORDER BY 
              application_counts.latest_application_date DESC;
        `;
      const results = await sequelize.query(finalSql, {
        type: QueryTypes.SELECT,
      });

      for (const result of results) {
        const headBranchApplicationsCountQuery = `SELECT COUNT(*) FROM \`client_applications\` ca INNER JOIN \`branches\` b ON ca.branch_id = b.id WHERE ca.customer_id = ? AND b.customer_id = ? AND b.is_head = ? AND ca.is_data_qc = ? AND ca.is_deleted = 1`;
        const headBranchApplicationsCount = await new Promise(async (resolve, reject) => {
          const headBranchResults = await sequelize.query(headBranchApplicationsCountQuery, {
            replacements: [result.main_id, result.main_id, 1, 1], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });
          resolve(headBranchResults[0]["COUNT(*)"]); // Get the count result

        }
        );
        result.head_branch_applications_count = headBranchApplicationsCount;
        // if (result.branch_count === 1) {
        // Query client_spoc table to fetch names for these IDs
        const headBranchQuery = `SELECT id, is_head FROM \`branches\` WHERE \`customer_id\` = ? AND \`is_head\` = ?`;

        try {
          const headBranchID = await new Promise(async (resolve, reject) => {
            const headBranchResults = await sequelize.query(headBranchQuery, {
              replacements: [result.main_id, 1], // Positional replacements using ?
              type: QueryTypes.SELECT,
            });
            resolve(
              headBranchResults.length > 0
                ? headBranchResults[0].id
                : null
            );

          });

          // Attach head branch id and application count to the current result
          result.head_branch_id = headBranchID;
        } catch (headBranchErr) {
          console.error(
            "Error fetching head branch id or applications count:",
            headBranchErr
          );
          result.head_branch_id = null;
          result.head_branch_applications_count = 0;
        }
        // }
      }
      callback(null, results);

    }

  },

  listByCustomerID: async (customer_id, filter_status, callback) => {

    let sql = `
        SELECT b.id AS branch_id, 
               b.name AS branch_name, 
               COUNT(ca.id) AS application_count,
               MAX(ca.created_at) AS latest_application_date
        FROM client_applications ca
        INNER JOIN branches b ON ca.branch_id = b.id
        WHERE b.is_head != 1 AND b.customer_id = ? AND ca.is_data_qc = 1 AND ca.is_deleted = 1`;

    // Array to hold query parameters
    const queryParams = [customer_id];

    // Check if filter_status is provided
    if (filter_status && filter_status !== null && filter_status !== "") {
      sql += ` AND ca.status = ?`;
      queryParams.push(filter_status);
    }

    sql += ` GROUP BY b.id, b.name 
                ORDER BY latest_application_date DESC;`;

    const results = await sequelize.query(sql, {
      replacements: queryParams, // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
      callback(null, results);
  

  },

  getClientApplicationById:async  (id, callback) => {

      const sql = "SELECT * FROM `client_applications` WHERE id = ? AND is_deleted = 1";
      const results = await sequelize.query(sql, {
        replacements: [id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
        callback(null, results[0]);
      
  
  },

  applicationListByBranch:async  (
    filter_status,
    branch_id,
    filter_month,
    callback
  ) => {
      // Get the current date and month
      const now = new Date();
      const month = `${String(now.getMonth() + 1).padStart(2, '0')}`;
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      // Define SQL conditions for each filter status
      const conditions = {
        overallCount: `AND (cmt.overall_status='wip' OR cmt.overall_status='insuff' OR cmt.overall_status='initiated' OR cmt.overall_status='hold' OR cmt.overall_status='closure advice' OR cmt.overall_status='stopcheck' OR cmt.overall_status='active employment' OR cmt.overall_status='nil' OR cmt.overall_status='' OR cmt.overall_status='not doable' OR cmt.overall_status='candidate denied' OR (cmt.overall_status='completed' AND cmt.report_date LIKE '%-${month}-%') OR (cmt.overall_status='completed' AND cmt.report_date NOT LIKE '%-${month}-%')) AND c.status = 1`,
        qcStatusPendingCount: `AND ca.is_report_downloaded = '1' AND LOWER(cmt.is_verify) = 'no' AND ca.status = 'completed'`,
        wipCount: `AND cmt.overall_status = 'wip'`,
        insuffCount: `AND cmt.overall_status = 'insuff'`,
        completedGreenCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '%-${month}-%' AND cmt.final_verification_status = 'GREEN'`,
        completedRedCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '%-${month}-%' AND cmt.final_verification_status = 'RED'`,
        completedYellowCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '%-${month}-%' AND cmt.final_verification_status = 'YELLOW'`,
        completedPinkCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '%-${month}-%' AND cmt.final_verification_status = 'PINK'`,
        completedOrangeCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '%-${month}-%' AND cmt.final_verification_status = 'ORANGE'`,
        previousCompletedCount: `AND (cmt.overall_status = 'completed' AND cmt.report_date NOT LIKE '%-${month}-%') AND c.status=1`,
        stopcheckCount: `AND cmt.overall_status = 'stopcheck'`,
        activeEmploymentCount: `AND cmt.overall_status = 'active employment'`,
        nilCount: `AND cmt.overall_status IN ('nil', '')`,
        candidateDeniedCount: `AND cmt.overall_status = 'candidate denied'`,
        notDoableCount: `AND cmt.overall_status = 'not doable'`,
        initiatedCount: `AND cmt.overall_status = 'initiated'`,
        holdCount: `AND cmt.overall_status = 'hold'`,
        closureAdviceCount: `AND cmt.overall_status = 'closure advice'`
      };

      // Construct SQL condition based on filter_status
      let sqlCondition = '';
      if (filter_status && filter_status.trim() !== "") {
        sqlCondition = conditions[filter_status] || '';
      }

      // Base SQL query with JOINs to fetch data
      let sql = `
        SELECT 
          ca.*, 
          c.name AS customer_name,
          b.name AS branch_name, 
          ca.id AS main_id,
          ca.is_highlight, 
          cmt.first_insufficiency_marks,
          cmt.first_insuff_date,
          cm.custom_logo,
          cm.custom_template,
          cm.custom_address,
          cm.client_spoc_name,
          cmt.first_insuff_reopened_date,
          cmt.second_insufficiency_marks,
          cmt.second_insuff_date,
          cmt.second_insuff_reopened_date,
          cmt.third_insufficiency_marks,
          cmt.third_insuff_date,
          cmt.third_insuff_reopened_date,
          cmt.final_verification_status,
          cmt.dob,
          cmt.is_verify,
          cmt.qc_done_by,
          cmt.report_date,
          cmt.case_upload,
          cmt.report_type,
          cmt.delay_reason,
          cmt.report_status,
          cmt.overall_status,
          cmt.initiation_date,
          cmt.report_generate_by,
          qc_admin.name AS qc_done_by_name,
          report_admin.name AS report_generated_by_name
        FROM 
          \`client_applications\` ca
        LEFT JOIN 
          \`customers\` c ON c.id = ca.customer_id
        LEFT JOIN 
          \`customer_metas\` cm ON cm.customer_id = ca.customer_id
        LEFT JOIN 
          \`branches\` b ON b.id = ca.branch_id
        LEFT JOIN 
          \`cmt_applications\` cmt ON ca.id = cmt.client_application_id
        LEFT JOIN 
          \`admins\` AS qc_admin ON qc_admin.id = cmt.qc_done_by
        LEFT JOIN 
          \`admins\` AS report_admin ON report_admin.id = cmt.report_generate_by
        WHERE 
          ca.\`branch_id\` = ?
          AND ca.\`is_data_qc\` = 1
          AND ca.is_deleted = 1
          ${sqlCondition}
      `;

      // Parameters for SQL query
      const params = [branch_id];

      // Apply filter_month condition if provided
      if (filter_month && filter_month.trim() !== "") {
        sql += ` AND ca.\`created_at\` LIKE ?`; // Use LIKE for partial match
        params.push(`${filter_month}%`); // Append "%" to filter by year-month
      }

      // Final ordering of results
      sql += ` ORDER BY ca.\`created_at\` DESC, ca.\`is_highlight\` DESC`;

      const results = await sequelize.query(sql, {
        replacements:params, // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
        callback(null, results);
     
  
  },

  filterOptions:async  (callback) => {
      const sql = `
          SELECT \`status\`, COUNT(*) AS \`count\` 
          FROM \`client_applications\` 
          WHERE \`is_deleted\` = 1
          GROUP BY \`status\`
        `;
        const results = await sequelize.query(sql, {
          type: QueryTypes.SELECT,
        });
       
        callback(null, results);
;
  },

  filterOptionsForCustomers:async  (callback) => {

 
      // Get the current date
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      let filterOptions = {
        overallCount: 0,
        qcStatusPendingCount: 0,
        wipCount: 0,
        insuffCount: 0,
        previousCompletedCount: 0,
        stopcheckCount: 0,
        activeEmploymentCount: 0,
        nilCount: 0,
        notDoableCount: 0,
        candidateDeniedCount: 0,
        completedGreenCount: 0,
        completedRedCount: 0,
        completedYellowCount: 0,
        completedPinkCount: 0,
        completedOrangeCount: 0,
      };

      const overallCountSQL = `
            SELECT
              COUNT(*) as overall_count
            FROM 
              client_applications a 
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id 
            WHERE
              (
                b.overall_status = 'wip'
                OR b.overall_status = 'insuff'
                OR (b.overall_status = 'completed' 
                  AND b.final_verification_status IN ('GREEN', 'RED', 'YELLOW', 'PINK', 'ORANGE')
                  AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                )
              )
              AND a.is_deleted = 1
              AND (c.status = 1)
          `;
          const overallCountResult = await sequelize.query(overallCountSQL, {
            type: QueryTypes.SELECT,
          });
        if (overallCountResult.length > 0) {
          filterOptions.overallCount = overallCountResult[0].overall_count || 0;
        }

        const qcStatusPendingSQL = `
              select
                count(*) as overall_count
              from 
                client_applications a 
                JOIN customers c ON a.customer_id = c.id
                JOIN cmt_applications b ON a.id = b.client_application_id 
              where
                a.is_report_downloaded='1'
                AND LOWER(b.is_verify)='no'
                AND a.status='completed'
                AND a.is_deleted = 1
              order by 
                b.id DESC
            `;
            const qcStatusPendingResult = await sequelize.query(qcStatusPendingSQL, {
              type: QueryTypes.SELECT,
            });

          if (qcStatusPendingResult.length > 0) {
            filterOptions.qcStatusPendingCount = qcStatusPendingResult[0].overall_count || 0;
          }

          const wipInsuffSQL = `
              SELECT 
                b.overall_status, 
                COUNT(*) AS overall_count
              FROM 
                client_applications a 
                JOIN customers c ON a.customer_id = c.id
                JOIN cmt_applications b ON a.id = b.client_application_id 
              WHERE 
                c.status = 1
                AND b.overall_status IN ('wip', 'insuff')
                AND a.is_deleted = 1
              GROUP BY 
                b.overall_status
            `;
            const wipInsuffResult = await sequelize.query(wipInsuffSQL, {
              type: QueryTypes.SELECT,
            });
           

            wipInsuffResult.forEach(row => {
              if (row.overall_status === 'wip') {
                filterOptions.wipCount = row.overall_count;
              } else if (row.overall_status === 'insuff') {
                filterOptions.insuffCount = row.overall_count;
              }
            });

            const completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL = `
                SELECT
                  COUNT(*) as overall_count,
                  b.overall_status
                from 
                  client_applications a 
                  JOIN customers c ON a.customer_id = c.id
                  JOIN cmt_applications b ON a.id = b.client_application_id 
                where
                  b.overall_status IN ('completed','stopcheck','active employment','nil','not doable','candidate denied')
                  AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                  AND c.status=1
                  AND a.is_deleted = 1
                GROUP BY
                  b.overall_status
              `;
              const completedStocheckactiveEmployementNilNotDoubleCandidateDeniedResult = await sequelize.query(completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL, {
                type: QueryTypes.SELECT,
              });
              completedStocheckactiveEmployementNilNotDoubleCandidateDeniedResult.forEach(row => {
                if (row.overall_status === 'completed') {
                  filterOptions.previousCompletedCount = row.overall_count;
                } else if (row.overall_status === 'stopcheck') {
                  filterOptions.stopcheckCount = row.overall_count;
                } else if (row.overall_status === 'active employment') {
                  filterOptions.activeEmploymentCount = row.overall_count;
                } else if (row.overall_status === 'nil' || row.overall_status === '' || row.overall_status === null) {
                  filterOptions.nilCount = row.overall_count;
                } else if (row.overall_status === 'not doable') {
                  filterOptions.notDoableCount = row.overall_count;
                } else if (row.overall_status === 'candidate denied') {
                  filterOptions.candidateDeniedCount = row.overall_count;
                }
              });

              const completedGreenRedYellowPinkOrangeSQL = `
                  SELECT
                    COUNT(*) as overall_count,
                    b.final_verification_status
                  from
                    client_applications a 
                    JOIN customers c ON a.customer_id = c.id
                    JOIN cmt_applications b ON a.id = b.client_application_id 
                  where
                    b.overall_status ='completed'
                    AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                    AND b.final_verification_status IN ('GREEN', 'RED', 'YELLOW', 'PINK', 'ORANGE')
                    AND c.status=1
                    AND a.is_deleted = 1
                  GROUP BY
                    b.final_verification_status
                `;
                const completedGreenRedYellowPinkOrangeResult = await sequelize.query(completedGreenRedYellowPinkOrangeSQL, {
                  type: QueryTypes.SELECT,
                });
                

                completedGreenRedYellowPinkOrangeResult.forEach(row => {
                  if (row.final_verification_status === 'GREEN') {
                    filterOptions.completedGreenCount = row.overall_count;
                  } else if (row.final_verification_status === 'RED') {
                    filterOptions.completedRedCount = row.overall_count;
                  } else if (row.final_verification_status === 'YELLOW') {
                    filterOptions.completedYellowCount = row.overall_count;
                  } else if (row.final_verification_status === 'PINK') {
                    filterOptions.completedPinkCount = row.overall_count;
                  } else if (row.final_verification_status === 'ORANGE') {
                    filterOptions.completedOrangeCount = row.overall_count;
                  }
                });

                return callback(null, filterOptions);
            
          
         

    
   
   
  },

  filterOptionsForApplicationListing:async  (customer_id, branch_id, callback) => {

      // Get the current date
      const now = new Date();
      const month = `${String(now.getMonth() + 1).padStart(2, '0')}`;
      const year = `${now.getFullYear()}`;
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      let filterOptions = {
        overallCount: 0,
        wipCount: 0,
        insuffCount: 0,
        completedGreenCount: 0,
        completedRedCount: 0,
        completedYellowCount: 0,
        completedPinkCount: 0,
        completedOrangeCount: 0,
        previousCompletedCount: 0,
        stopcheckCount: 0,
        activeEmploymentCount: 0,
        nilCount: 0,
        candidateDeniedCount: 0,
        notDoableCount: 0,
        initiatedCount: 0,
        holdCount: 0,
        closureAdviceCount: 0,
      };

      let conditions = {
        overallCount: `AND (b.overall_status='wip' OR b.overall_status='insuff' OR b.overall_status='initiated' OR b.overall_status='hold' OR b.overall_status='closure advice' OR b.overall_status='stopcheck' OR b.overall_status='active employment' OR b.overall_status='nil' OR b.overall_status='' OR b.overall_status='not doable' OR b.overall_status='candidate denied' OR (b.overall_status='completed' AND b.report_date LIKE '%-${month}-%') OR (b.overall_status='completed' AND b.report_date NOT LIKE '%-${month}-%'))`,
        wipCount: `AND (b.overall_status = 'wip')`,
        insuffCount: `AND (b.overall_status = 'insuff')`,
        completedGreenCount: `AND (b.overall_status = 'completed' AND b.report_date LIKE '%-${month}-%') AND b.final_verification_status='GREEN'`,
        completedRedCount: `AND (b.overall_status = 'completed' AND b.report_date LIKE '%-${month}-%') AND b.final_verification_status='RED'`,
        completedYellowCount: `AND (b.overall_status = 'completed' AND b.report_date LIKE '%-${month}-%') AND b.final_verification_status='YELLOW'`,
        completedPinkCount: `AND (b.overall_status = 'completed' AND b.report_date LIKE '%-${month}-%') AND b.final_verification_status='PINK'`,
        completedOrangeCount: `AND (b.overall_status = 'completed' AND b.report_date LIKE '%-${month}-%') AND b.final_verification_status='ORANGE'`,
        previousCompletedCount: `AND (b.overall_status = 'completed' AND b.report_date NOT LIKE '%-${month}-%')`,
        stopcheckCount: `AND (b.overall_status = 'stopcheck')`,
        activeEmploymentCount: `AND (b.overall_status = 'active employment')`,
        nilCount: `AND (b.overall_status = 'nil' OR b.overall_status = '')`,
        candidateDeniedCount: `AND (b.overall_status = 'candidate denied')`,
        notDoableCount: `AND (b.overall_status = 'not doable')`,
        initiatedCount: `AND (b.overall_status = 'initiated')`,
        holdCount: `AND (b.overall_status = 'hold')`,
        closureAdviceCount: `AND (b.overall_status = 'closure advice')`
      };

      let sqlQueries = [];

      // Build SQL queries for each filter option
      for (let key in filterOptions) {
        if (filterOptions.hasOwnProperty(key)) {
          let condition = conditions[key];
          if (condition) {
            const SQL = `
                  SELECT count(*) AS ${key}
                  FROM client_applications a
                  JOIN customers c ON a.customer_id = c.id
                  JOIN cmt_applications b ON a.id = b.client_application_id
                  WHERE a.customer_id = ? 
                  AND CAST(a.branch_id AS CHAR) = ? 
                  ${condition}
                  AND c.status = 1
                  AND a.is_deleted = 1
                `;

            sqlQueries.push(new Promise(async (resolve, reject) => {
              const result = await sequelize.query(SQL, {
                replacements: [customer_id, branch_id], // Positional replacements using ?
                type: QueryTypes.SELECT,
              });
                filterOptions[key] = result[0] ? result[0][key] : 0;
                resolve();
            }));
          }
        }
      }
      Promise.all(sqlQueries)
        .then(() => {
          callback(null, filterOptions);
        })
        .catch((err) => {
          callback(err, null);
        });
   
  },

  filterOptionsForBranch:async  (branch_id, callback) => {

    
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      let filterOptions = {
        overallCount: 0,
        qcStatusPendingCount: 0,
        wipCount: 0,
        insuffCount: 0,
        previousCompletedCount: 0,
        stopcheckCount: 0,
        activeEmploymentCount: 0,
        nilCount: 0,
        notDoableCount: 0,
        candidateDeniedCount: 0,
        completedGreenCount: 0,
        completedRedCount: 0,
        completedYellowCount: 0,
        completedPinkCount: 0,
        completedOrangeCount: 0,
      };

      const overallCountSQL = `
            SELECT
              COUNT(*) as overall_count
            FROM 
              client_applications a 
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id 
            WHERE
              (
                b.overall_status = 'wip'
                OR b.overall_status = 'insuff'
                OR (b.overall_status = 'completed' 
                  AND b.final_verification_status IN ('GREEN', 'RED', 'YELLOW', 'PINK', 'ORANGE')
                  AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                )
              )
              AND a.is_deleted = 1
              AND (c.status = 1)
              AND CAST(a.branch_id AS CHAR) = ?
          `;
      console.log(`overallCountSQL - `, overallCountSQL);
      const overallCountResult = await sequelize.query(overallCountSQL, {
        replacements: [String(branch_id)], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });

        if (overallCountResult.length > 0) {
          filterOptions.overallCount = overallCountResult[0].overall_count || 0;
        }

        const qcStatusPendingSQL = `
              select
                count(*) as overall_count
              from 
                client_applications a 
                JOIN customers c ON a.customer_id = c.id
                JOIN cmt_applications b ON a.id = b.client_application_id 
              where
                a.is_report_downloaded='1'
                AND LOWER(b.is_verify)='no'
                AND a.status='completed'
                AND a.is_deleted = 1
                AND CAST(a.branch_id AS CHAR) = ?
              order by 
                b.id DESC
            `;

        console.log(`qcStatusPendingSQL - `, qcStatusPendingSQL);
const qcStatusPendingResult = await sequelize.query(qcStatusPendingSQL, {
      replacements: [String(branch_id)], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

          if (qcStatusPendingResult.length > 0) {
            filterOptions.qcStatusPendingCount = qcStatusPendingResult[0].overall_count || 0;
          }

          const wipInsuffSQL = `
              SELECT 
                b.overall_status, 
                COUNT(*) AS overall_count
              FROM 
                client_applications a 
                JOIN customers c ON a.customer_id = c.id
                JOIN cmt_applications b ON a.id = b.client_application_id 
              WHERE 
                c.status = 1
                AND b.overall_status IN ('wip', 'insuff')
                AND CAST(a.branch_id AS CHAR) = ?
                AND a.is_deleted = 1
              GROUP BY 
                b.overall_status
            `;
          console.log(`wipInsuffSQL - `, wipInsuffSQL);

          const wipInsuffResult = await sequelize.query(wipInsuffSQL, {
            replacements: [String(branch_id)], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });
            wipInsuffResult.forEach(row => {
              if (row.overall_status === 'wip') {
                filterOptions.wipCount = row.overall_count;
              } else if (row.overall_status === 'insuff') {
                filterOptions.insuffCount = row.overall_count;
              }
            });

            const completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL = `
                SELECT
                  COUNT(*) as overall_count,
                  b.overall_status
                from 
                  client_applications a 
                  JOIN customers c ON a.customer_id = c.id
                  JOIN cmt_applications b ON a.id = b.client_application_id 
                where
                  b.overall_status IN ('completed','stopcheck','active employment','nil','not doable','candidate denied')
                  AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                  AND c.status=1
                  AND CAST(a.branch_id AS CHAR) = ?
                  AND a.is_deleted = 1
                  AND c.is_deleted = 1
                GROUP BY
                  b.overall_status
              `;
            console.log(`completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL - `, completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL);
            const completedStocheckactiveEmployementNilNotDoubleCandidateDeniedResult = await sequelize.query(completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL, {
              replacements: [String(branch_id)], // Positional replacements using ?
              type: QueryTypes.SELECT,
            });
              completedStocheckactiveEmployementNilNotDoubleCandidateDeniedResult.forEach(row => {
                if (row.overall_status === 'completed') {
                  filterOptions.previousCompletedCount = row.overall_count;
                } else if (row.overall_status === 'stopcheck') {
                  filterOptions.stopcheckCount = row.overall_count;
                } else if (row.overall_status === 'active employment') {
                  filterOptions.activeEmploymentCount = row.overall_count;
                } else if (row.overall_status === 'nil' || row.overall_status === '' || row.overall_status === null) {
                  filterOptions.nilCount = row.overall_count;
                } else if (row.overall_status === 'not doable') {
                  filterOptions.notDoableCount = row.overall_count;
                } else if (row.overall_status === 'candidate denied') {
                  filterOptions.candidateDeniedCount = row.overall_count;
                }
              });

              const completedGreenRedYellowPinkOrangeSQL = `
                  SELECT
                    COUNT(*) as overall_count,
                    b.final_verification_status
                  from
                    client_applications a 
                    JOIN customers c ON a.customer_id = c.id
                    JOIN cmt_applications b ON a.id = b.client_application_id 
                  where
                    b.overall_status ='completed'
                    AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                    AND b.final_verification_status IN ('GREEN', 'RED', 'YELLOW', 'PINK', 'ORANGE')
                    AND c.status=1
                    AND CAST(a.branch_id AS CHAR) = ?
                    AND a.is_deleted = 1
                    AND c.is_deleted = 1
                  GROUP BY
                    b.final_verification_status
                `;
              const completedGreenRedYellowPinkOrangeResult = await sequelize.query(completedGreenRedYellowPinkOrangeSQL, {
                replacements: [String(branch_id)], // Positional replacements using ?
                type: QueryTypes.SELECT,
              });

                completedGreenRedYellowPinkOrangeResult.forEach(row => {
                  if (row.final_verification_status === 'GREEN') {
                    filterOptions.completedGreenCount = row.overall_count;
                  } else if (row.final_verification_status === 'RED') {
                    filterOptions.completedRedCount = row.overall_count;
                  } else if (row.final_verification_status === 'YELLOW') {
                    filterOptions.completedYellowCount = row.overall_count;
                  } else if (row.final_verification_status === 'PINK') {
                    filterOptions.completedPinkCount = row.overall_count;
                  } else if (row.final_verification_status === 'ORANGE') {
                    filterOptions.completedOrangeCount = row.overall_count;
                  }
                });

                return callback(null, filterOptions);
       
           
        

        
  },

};

module.exports = Customer;
