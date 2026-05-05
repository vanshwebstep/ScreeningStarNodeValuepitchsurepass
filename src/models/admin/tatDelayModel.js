const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const moment = require("moment"); // Ensure you have moment.js installed

const tatDelay = {
  list: async (callback) => {
    try {
      const applicationsQuery = `
         SELECT 
            ca.branch_id, 
            ca.customer_id, 
            ca.is_priority, 
            ca.application_id, 
            ca.name AS application_name, 
            ca.id AS client_application_id, 
            ca.created_at AS application_created_at, 
            ca.is_data_qc,
            cmt.report_date, 
            cmt.first_insufficiency_marks,
            cmt.first_insuff_date,
            cmt.first_insuff_reopened_date,
            cmt.second_insufficiency_marks,
            cmt.second_insuff_date,
            cmt.second_insuff_reopened_date,
            cmt.third_insufficiency_marks,
            cmt.third_insuff_date,
            cmt.third_insuff_reopened_date,
            cmt.delay_reason,
            cust.name AS customer_name, 
            cust.mobile AS customer_mobile, 
            cust.emails AS customer_emails, 
            cust.client_unique_id AS customer_unique_id, 
            cm.tat_days AS tat_days,
            br.name AS branch_name, 
            br.email AS branch_email, 
            br.mobile_number AS branch_mobile
        FROM 
            client_applications AS ca
        JOIN 
            customers AS cust ON cust.id = ca.customer_id
        JOIN 
            branches AS br ON br.id = ca.branch_id
        LEFT JOIN 
            customer_metas AS cm ON cm.customer_id = cust.id
        LEFT JOIN 
            cmt_applications AS cmt ON ca.id = cmt.client_application_id
        WHERE 
            ( 
                (cmt.id IS NULL) 
                OR 
                (cmt.id IS NOT NULL AND (cmt.overall_status != 'completed' OR cmt.overall_status IS NULL))
            )
            AND ca.status NOT IN ('stopcheck','hold')
            AND cust.is_deleted != 1
            AND ca.is_deleted != 1
            AND ca.tat_delete != 1;
        `;

      const holidaysQuery = `SELECT id AS holiday_id, title AS holiday_title, date AS holiday_date FROM holidays;`;
      const weekendsQuery = `SELECT weekends FROM company_info WHERE status = 1;`;

      const [applicationResults, holidayResults, weekendResults] = await Promise.all([
        sequelize.query(applicationsQuery, { type: QueryTypes.SELECT }),
        sequelize.query(holidaysQuery, { type: QueryTypes.SELECT }),
        sequelize.query(weekendsQuery, { type: QueryTypes.SELECT })
      ]);

      const holidayDates = new Set(holidayResults.map(holiday => moment(holiday.holiday_date).format("YYYY-MM-DD")));
      const weekendsSet = new Set(
        weekendResults[0]?.weekends ? JSON.parse(weekendResults[0].weekends).map(day => day.toLowerCase()) : []
      );

      const applicationHierarchy = applicationResults.reduce((acc, row) => {
        const {
          customer_id,
          customer_name,
          customer_emails,
          customer_unique_id,
          customer_mobile,
          tat_days,
          branch_id,
          branch_name,
          branch_email,
          branch_mobile,
          client_application_id,
          application_id,
          application_name,
          application_created_at,
          first_insufficiency_marks,
          first_insuff_date,
          first_insuff_reopened_date,
          second_insufficiency_marks,
          second_insuff_date,
          second_insuff_reopened_date,
          third_insufficiency_marks,
          third_insuff_date,
          third_insuff_reopened_date,
          delay_reason,
        } = row;

        const tatDays = parseInt(tat_days, 10) || 0;
        if (tatDays < 1 || tatDays > 365) return acc;

        if (!acc[customer_id]) {
          acc[customer_id] = {
            customer_id, customer_name, customer_emails, customer_unique_id,
            customer_mobile, tat_days: tatDays, branches: {}
          };
        }

        if (!acc[customer_id].branches[branch_id]) {
          acc[customer_id].branches[branch_id] = {
            branch_id, branch_name, branch_email, branch_mobile, applications: []
          };
        }

        const applicationDate = moment(application_created_at);
        const dueDate = calculateDueDate(applicationDate, tatDays, holidayDates, weekendsSet);
        const daysOutOfTat = calculateDaysOutOfTat(dueDate, moment(), holidayDates, weekendsSet);

        if (daysOutOfTat > 0) {
          acc[customer_id].branches[branch_id].applications.push({
            client_application_id,
            application_id,
            application_name,
            application_created_at,
            days_out_of_tat: daysOutOfTat,
            first_insufficiency_marks,
            first_insuff_date,
            first_insuff_reopened_date,
            second_insufficiency_marks,
            second_insuff_date,
            second_insuff_reopened_date,
            third_insufficiency_marks,
            third_insuff_date,
            third_insuff_reopened_date,
            delay_reason,
          });
        }

        return acc;
      }, {});

      const applicationHierarchyArray = Object.values(applicationHierarchy).map(customer => ({
        ...customer,
        branches: Object.values(customer.branches).filter(branch => branch.applications.length > 0)
      })).filter(customer => customer.branches.length > 0);

      callback(null, {
        applicationHierarchy: applicationHierarchyArray,
        holidays: holidayResults
      });

    } catch (error) {
      console.error("Error fetching applications:", error);
      callback(error, null);
    }

    function calculateDaysOutOfTat(dueDate, endDate, holidayDates, weekendsSet) {
      let daysOutOfTat = 0;
      let currentDate = dueDate.clone().add(1, "day");

      while (currentDate.isBefore(endDate, "day")) {
        if (!weekendsSet.has(currentDate.format("dddd").toLowerCase()) &&
          !holidayDates.has(currentDate.format("YYYY-MM-DD"))) {
          daysOutOfTat++;
        }
        currentDate.add(1, "day");
      }

      return daysOutOfTat;
    }

    function calculateDueDate(startDate, tatDays, holidayDates, weekendsSet) {
      let dueDate = startDate.clone();
      let daysRemaining = tatDays;

      while (daysRemaining > 0) {
        dueDate.add(1, "day");
        if (!weekendsSet.has(dueDate.format("dddd").toLowerCase()) &&
          !holidayDates.has(dueDate.format("YYYY-MM-DD"))) {
          daysRemaining--;
        }
      }

      return dueDate;
    }
  },

  delete: async (client_application_id, callback) => {
    const sql = `
        UPDATE \`client_applications\`
        SET \`tat_delete\` = ?
        WHERE \`id\` = ?
      `;
    const results = await sequelize.query(sql, {
      replacements: [1, client_application_id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);
  },

  deleteApplication: async (application_id, customer_id, callback) => {
    const sql = `
        UPDATE \`client_applications\`
        SET \`tat_delete\` = ?
        WHERE \`customer_id\` = ? AND \`id\` = ?
      `;
    const results = await sequelize.query(sql, {
      replacements: [1, customer_id, application_id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);
  },
};

module.exports = tatDelay;
