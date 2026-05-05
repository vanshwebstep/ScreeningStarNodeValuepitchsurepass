const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");


// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const recordTrackerModel = {
  recordTracker: async (
    customerId,
    from_month,
    to_month,
    from_year,
    to_year,
    callback
  ) => {
    try {
      /* -------------------- CUSTOMER -------------------- */
      const customerQuery = `
      SELECT 
        c.id,
        c.client_unique_id,
        c.name,
        c.emails,
        c.mobile,
        c.services,
        cm.address,
        cm.contact_person_name,
        cm.escalation_point_contact,
        cm.single_point_of_contact,
        cm.gst_number,
        cm.payment_contact_person,
        cm.state,
        cm.state_code
      FROM customers c
      LEFT JOIN customer_metas cm ON cm.customer_id = c.id
      WHERE c.id = ? AND c.is_deleted != 1
    `;

      const customerResults = await sequelize.query(customerQuery, {
        replacements: [customerId],
        type: QueryTypes.SELECT
      });

      if (!customerResults.length) {
        return callback(new Error("Customer not found"), null);
      }

      const customerData = customerResults[0];

      /* -------------------- UPDATE SERVICES -------------------- */
      let servicesData = [];

      if (customerData.services) {
        servicesData = JSON.parse(customerData.services);
      }
console.log(`Original services data for customer ID ${customerData.services}:`);
      const serviceIds = [];
      const packageIds = [];

      servicesData.forEach(group => {
        if (!Array.isArray(group.services)) return;

        group.services.forEach(service => {
          if (service.serviceId) serviceIds.push(service.serviceId);

          if (service.packages && typeof service.packages === "object") {
            Object.keys(service.packages).forEach(id => {
              if (!isNaN(id)) packageIds.push(Number(id));
            });
          }
        });
      });

      const [serviceRows, packageRows] = await Promise.all([
        serviceIds.length
          ? sequelize.query(
            `SELECT id, title FROM services WHERE id IN (:ids)`,
            {
              replacements: { ids: [...new Set(serviceIds)] },
              type: QueryTypes.SELECT
            }
          )
          : [],
        packageIds.length
          ? sequelize.query(
            `SELECT id, title FROM packages WHERE id IN (:ids)`,
            {
              replacements: { ids: [...new Set(packageIds)] },
              type: QueryTypes.SELECT
            }
          )
          : []
      ]);

      const serviceMap = {};
      serviceRows.forEach(r => (serviceMap[r.id] = r.title));

      const packageMap = {};
      packageRows.forEach(r => (packageMap[r.id] = r.title));

      servicesData = servicesData
        .map(group => {
          if (!Array.isArray(group.services)) return null;

          group.services = group.services
            .map(service => {
              if (!serviceMap[service.serviceId]) return null;

              service.serviceTitle = serviceMap[service.serviceId];

              const updatedPackages = {};
              if (service.packages) {
                Object.keys(service.packages).forEach(id => {
                  if (packageMap[id]) updatedPackages[id] = packageMap[id];
                });
              }

              service.packages = updatedPackages;
              return service;
            })
            .filter(Boolean);

          return group.services.length ? group : null;
        })
        .filter(Boolean);

      customerData.services = JSON.stringify(servicesData);

      /* -------------------- APPLICATIONS -------------------- */
      const applicationResults = await sequelize.query(
        `
      SELECT
        ca.id,
        ca.branch_id,
        ca.application_id,
        ca.employee_id,
        ca.name,
        ca.services,
        ca.status,
        ca.created_at,
        ca.check_id,
        ca.ticket_id,
        ca.sub_client,
        cmt.report_date
      FROM client_applications ca
      LEFT JOIN cmt_applications cmt
        ON cmt.client_application_id = ca.id
      WHERE ca.customer_id = ?
        AND ca.status IN ('completed','closed','complete')
        AND ca.is_deleted != 1
        AND MONTH(cmt.report_date) BETWEEN ? AND ?
        AND YEAR(cmt.report_date) BETWEEN ? AND ?
      ORDER BY ca.branch_id
      `,
        {
          replacements: [customerId, from_month, to_month, from_year, to_year],
          type: QueryTypes.SELECT
        }
      );

      /* -------------------- GROUP BY BRANCH -------------------- */
      const branchMap = {};

      applicationResults.forEach(app => {
        app.statusDetails = [];

        if (!branchMap[app.branch_id]) {
          branchMap[app.branch_id] = {
            id: app.branch_id,
            applications: []
          };
        }
        branchMap[app.branch_id].applications.push(app);
      });

      const branchIds = Object.keys(branchMap);

      const branchRows = branchIds.length
        ? await sequelize.query(
          `SELECT id, name FROM branches WHERE id IN (:ids)`,
          {
            replacements: { ids: branchIds },
            type: QueryTypes.SELECT
          }
        )
        : [];

      const branchesWithApplications = branchRows.map(b => ({
        id: b.id,
        name: b.name,
        applications: branchMap[b.id]?.applications || []
      }));

      /* -------------------- STATUS DETAILS -------------------- */
      for (const app of applicationResults) {
        if (!app.services) continue;

        const serviceList = app.services.split(",");

        for (const serviceId of serviceList) {
          const forms = await sequelize.query(
            `SELECT json FROM report_forms WHERE service_id = ?`,
            {
              replacements: [serviceId],
              type: QueryTypes.SELECT
            }
          );

          if (!forms.length) continue;

          const { db_table } = JSON.parse(forms[0].json);

          const cols = await sequelize.query(
            `SHOW COLUMNS FROM \`${db_table}\` WHERE Field LIKE 'additional_fee%'`,
            { type: QueryTypes.SELECT }
          );

          const feeColumn = cols[0]?.Field;

          const statusRows = await sequelize.query(
            `
          SELECT status${feeColumn ? `, ${feeColumn}` : ""}
          FROM ${db_table}
          WHERE client_application_id = ?
          `,
            {
              replacements: [app.id],
              type: QueryTypes.SELECT
            }
          );

          app.statusDetails.push({
            serviceId,
            status: statusRows[0]?.status || null,
            additionalFee: feeColumn ? statusRows[0]?.[feeColumn] || null : null
          });
        }
      }

      /* -------------------- FINAL RESPONSE -------------------- */
      callback(null, {
        customerInfo: customerData,
        applicationsByBranch: branchesWithApplications
      });
    } catch (err) {
      console.error("recordTracker error:", err);
      callback(err, null);
    }
  },

  list: async (from_month, from_year, to_month, to_year, callback) => {
    try {
      // Construct full start and end date strings
      const startDate = `${from_year}-${String(from_month).padStart(2, '0')}-01`;
      const endDate = new Date(to_year, to_month, 0); // Last day of to_month
      const formattedEndDate = endDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'

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
                            customer_metas 
                            ON customers.id = customer_metas.customer_id
                        LEFT JOIN (
                            SELECT 
                                customer_id, 
                                COUNT(*) AS branch_count
                            FROM 
                                branches
                            GROUP BY 
                                customer_id
                        ) AS branch_counts 
                            ON customers.id = branch_counts.customer_id
                        LEFT JOIN (
                            SELECT 
                                b.customer_id, 
                                COUNT(ca.id) AS application_count,
                                MAX(ca.created_at) AS latest_application_date
                            FROM 
                                BranchesCTE b
                            INNER JOIN 
                                client_applications ca 
                                ON b.branch_id = ca.branch_id
                            INNER JOIN
                                cmt_applications cmt 
                                ON ca.id = cmt.client_application_id
                            WHERE
                                ca.is_data_qc = 1
                                AND ca.status IN ('complete', 'completed', 'closed')
                                AND DATE(cmt.report_date) BETWEEN ? AND ?
                                AND ca.is_deleted != 1
                              GROUP BY 
                                b.customer_id
                            ) AS application_counts ON customers.id = application_counts.customer_id
                            WHERE 
                              COALESCE(application_counts.application_count, 0) > 0
                              AND customers.is_deleted != 1
                            ORDER BY 
                              application_counts.latest_application_date DESC;`;

      const results = await sequelize.query(finalSql, {
        replacements: [startDate, formattedEndDate],
        type: QueryTypes.SELECT,
      });

      for (const result of results) {
        if (result.branch_count === 1) {
          const headBranchQuery = `SELECT id FROM branches WHERE customer_id = ? AND is_head = 1`;

          try {
            const headBranchResults = await sequelize.query(headBranchQuery, {
              replacements: [result.main_id],
              type: QueryTypes.SELECT,
            });

            result.head_branch_id = headBranchResults.length > 0 ? headBranchResults[0].id : null;
          } catch (err) {
            console.error("Error fetching head branch id:", err);
            result.head_branch_id = null;
          }
        }
      }

      callback(null, results);
    } catch (error) {
      console.error("Error in customer list fetch:", error);
      callback(error);
    }
  }

};

module.exports = recordTrackerModel;
