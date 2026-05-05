const crypto = require("crypto");
const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const generateInvoiceModel = {
  generateInvoice: async (customerId, month, year, callback) => {
    try {
      console.log("[STEP] Start generating invoice for:", { customerId, month, year });

      // Fetch customer details
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
        WHERE c.id = ? AND c.is_deleted != 1;
      `;

      const customerResults = await sequelize.query(customerQuery, {
        replacements: [customerId],
        type: QueryTypes.SELECT,
      });
      console.log("[STEP] Customer details fetched:", customerResults);

      if (!customerResults.length) {
        console.error("[ERROR] Customer not found");
        return callback(new Error("Customer not found."), null);
      }

      const customerData = customerResults[0];
      let servicesData;

      try {
        servicesData = JSON.parse(customerData.services);
        console.log("[STEP] Parsed services:", servicesData);
      } catch (parseError) {
        console.error("[ERROR] Failed to parse services:", parseError);
        return callback(parseError, null);
      }

      // Fetch service titles
      for (const group of servicesData) {
        for (const service of group.services) {
          const serviceSql = `SELECT title FROM services WHERE id = ?`;
          const [serviceResult] = await sequelize.query(serviceSql, {
            replacements: [service.serviceId],
            type: QueryTypes.SELECT,
          });

          if (serviceResult) {
            service.serviceTitle = serviceResult.title;
            console.log(`[STEP] Service title added for serviceId ${group.serviceId}:`, serviceResult.title);
          }
        }
      }

      customerData.services = JSON.stringify(servicesData);

      // Fetch completed applications
      const applicationQuery = `
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
          cmt.report_date
        FROM 
          client_applications ca
        LEFT JOIN 
          cmt_applications cmt ON cmt.client_application_id = ca.id
        WHERE 
          (ca.status = 'completed' OR ca.status = 'closed') 
          AND ca.customer_id = ?
          AND MONTH(cmt.report_date) = ?
          AND YEAR(cmt.report_date) = ? 
          AND ca.is_deleted != 1
        ORDER BY ca.branch_id;
      `;

      const applicationResults = await sequelize.query(applicationQuery, {
        replacements: [customerId, month, year],
        type: QueryTypes.SELECT,
      });
      console.log("[STEP] Applications fetched:", applicationResults.length);

      const branchApplicationsMap = {};
      applicationResults.forEach((application) => {
        const branchId = application.branch_id;
        if (!branchApplicationsMap[branchId]) {
          branchApplicationsMap[branchId] = { id: branchId, applications: [] };
        }
        application.statusDetails = [];
        branchApplicationsMap[branchId].applications.push(application);
      });

      const branchIds = Object.keys(branchApplicationsMap);
      console.log("[STEP] Branch IDs found:", branchIds);

      const branchesWithApplications = [];
      for (const branchId of branchIds) {
        const branchQuery = `SELECT id, name FROM branches WHERE id = ?;`;
        const branchResults = await sequelize.query(branchQuery, {
          replacements: [branchId],
          type: QueryTypes.SELECT,
        });

        if (branchResults.length > 0) {
          const branch = branchResults[0];
          branchesWithApplications.push({
            id: branch.id,
            name: branch.name,
            applications: branchApplicationsMap[branchId].applications,
          });
          console.log(`[STEP] Branch info added for ID ${branchId}:`, branch.name);
        }
      }

      // Process each application's services
      for (const application of applicationResults) {
        const services = application.services.split(",");
        for (const serviceId of services) {
          const reportFormQuery = `SELECT json FROM report_forms WHERE service_id = ?;`;
          const reportFormResults = await sequelize.query(reportFormQuery, {
            replacements: [serviceId],
            type: QueryTypes.SELECT,
          });

          if (reportFormResults.length > 0) {
            const reportFormJson = JSON.parse(reportFormResults[0].json);
            const dbTable = reportFormJson.db_table;
            console.log(`[STEP] Processing serviceId ${serviceId} using table ${dbTable}`);

            const additionalFeeColumnQuery = `SHOW COLUMNS FROM \`${dbTable}\` WHERE \`Field\` LIKE 'additional_fee%'`;
            const columnResults = await sequelize.query(additionalFeeColumnQuery, {
              type: QueryTypes.SELECT,
            });

            const additionalFeeColumn = columnResults.length ? columnResults[0].Field : null;
            if (additionalFeeColumn) {
              console.log(`[STEP] Found additional fee column: ${additionalFeeColumn}`);
            }

            const completeStatusGroups = [
              "completed",
              "completed_green",
              "completed_red",
              "completed_yellow",
              "completed_pink",
              "completed_orange",
            ];

            const statusQuery = `
              SELECT status${additionalFeeColumn ? `, ${additionalFeeColumn}` : ""}
              FROM ${dbTable}
              WHERE client_application_id = ?
                AND status IN (${completeStatusGroups.map(() => "?").join(", ")});
            `;

            const statusResults = await sequelize.query(statusQuery, {
              replacements: [application.id, ...completeStatusGroups],
              type: QueryTypes.SELECT,
            });

            if (statusResults.length && completeStatusGroups.includes(statusResults[0].status)) {
              application.statusDetails.push({
                serviceId,
                status: statusResults[0]?.status || null,
                additionalFee: additionalFeeColumn ? statusResults[0]?.[additionalFeeColumn] : null,
              });
              console.log(`[STEP] Status added to application ${application.id} for serviceId ${serviceId}:`, statusResults[0]);
            }
          }
        }
      }

      // Remove applications with no statusDetails
      branchesWithApplications.forEach((branch) => {
        const originalLength = branch.applications.length;
        branch.applications = branch.applications.filter((app) => app.statusDetails.length > 0);
        const filteredLength = branch.applications.length;
        console.log(`[STEP] Branch ${branch.name} - filtered ${originalLength - filteredLength} applications`);
      });

      const finalResults = {
        customerInfo: customerData,
        applicationsByBranch: branchesWithApplications,
      };

      console.log("[STEP] Final invoice structure prepared");
      callback(null, finalResults);
    } catch (err) {
      console.error("[ERROR] Error generating invoice:", err);
      callback(err, null);
    }
  },
};

module.exports = generateInvoiceModel;
