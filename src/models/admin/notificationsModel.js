const moment = require("moment"); // Ensure you have moment.js installed
const crypto = require("crypto");
const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const notification = {
  index: async (callback) => {
    // SQL query to retrieve applications, customers, branches, and tat_days
    const applicationsQuery = `
          SELECT 
        cmt.report_date, 
        ca.id AS client_application_id, 
        ca.is_priority, 
        ca.customer_id, 
        ca.branch_id, 
        ca.application_id, 
        ca.name AS application_name, 
        ca.created_at AS application_created_at, 
        cust.name AS customer_name, 
        cust.client_unique_id AS customer_unique_id, 
        cm.tat_days AS tat_days,
        br.name AS branch_name,
        ca.is_new_notification_read,
        ca.is_tat_delay_notification_read
      FROM client_applications AS ca
      JOIN customers AS cust ON cust.id = ca.customer_id
      JOIN branches AS br ON br.id = ca.branch_id
      LEFT JOIN customer_metas AS cm ON cm.customer_id = cust.id
      LEFT JOIN cmt_applications AS cmt ON ca.id = cmt.client_application_id
      WHERE cmt.overall_status != 'completed' AND ca.is_deleted != 1 AND cust.is_deleted != 1;
    `;

    // SQL query to fetch holidays
    const holidaysQuery = `SELECT id AS holiday_id, title AS holiday_title, date AS holiday_date FROM holidays;`;

    // SQL query to fetch weekends
    const weekendsQuery = `SELECT weekends FROM company_info WHERE status = 1;`;
    const applicationResults = await sequelize.query(applicationsQuery, {
      type: QueryTypes.SELECT,
    });

    const holidayResults = await sequelize.query(holidaysQuery, {
      type: QueryTypes.SELECT,
    });

    // Prepare holiday dates for calculations
    const holidayDates = holidayResults.map((holiday) =>
      moment(holiday.holiday_date).startOf("day")
    );

    const weekendResults = await sequelize.query(weekendsQuery, {
      type: QueryTypes.SELECT,
    });
    const weekends = weekendResults[0]?.weekends
      ? JSON.parse(weekendResults[0].weekends)
      : [];
    const weekendsSet = new Set(
      weekends.map((day) => day.toLowerCase())
    );

    let tatDelaysApplicationIds = [];
    // Construct the hierarchical structure for applications
    const applicationHierarchy = applicationResults.reduce(
      (accumulator, row) => {
        const {
          customer_id,
          customer_name,
          customer_unique_id,
          tat_days,
          branch_id,
          branch_name,
          client_application_id,
          application_id,
          application_name,
          is_priority,
          application_created_at,
          is_tat_delay_notification_read
        } = row;

        // Initialize customer entry if it doesn't exist
        if (!accumulator[customer_id]) {
          accumulator[customer_id] = {
            customer_id,
            customer_name,
            customer_unique_id,
            tat_days: parseInt(tat_days, 10), // Parse TAT days as an integer
            branches: {},
          };
        }

        // Initialize branch entry if it doesn't exist
        if (!accumulator[customer_id].branches[branch_id]) {
          accumulator[customer_id].branches[branch_id] = {
            branch_id,
            branch_name,
            applications: [],
          };
        }

        // Calculate days out of TAT
        const applicationDate = moment(application_created_at);
        const tatDays = parseInt(tat_days, 10);
        const dueDate = calculateDueDate(
          applicationDate,
          tatDays,
          holidayDates,
          weekendsSet
        );

        // Calculate days out of TAT
        const daysOutOfTat = calculateDaysOutOfTat(
          dueDate,
          moment(),
          holidayDates,
          weekendsSet
        );

        // Only add application information if days out of TAT is greater than 0
        if (daysOutOfTat > 0) {
          tatDelaysApplicationIds.push(client_application_id);
          accumulator[customer_id].branches[
            branch_id
          ].applications.push({
            client_application_id,
            application_id,
            application_name,
            is_priority,
            application_created_at,
            days_out_of_tat: daysOutOfTat, // Include days out of TAT
            is_tat_delay_notification_read
          });
        }

        return accumulator;
      },
      {}
    );

    // Convert the application hierarchy object to an array with nested branches and applications
    const applicationHierarchyArray = Object.values(
      applicationHierarchy
    )
      .map((customer) => ({
        ...customer,
        branches: Object.values(customer.branches).filter(
          (branch) => branch.applications.length > 0 // Only include branches with applications
        ),
      }))
      .filter((customer) => customer.branches.length > 0); // Only include customers with branches

    // Map holiday results into a structured array
    const holidaysArray = holidayResults.map((holiday) => ({
      id: holiday.holiday_id,
      title: holiday.holiday_title,
      date: holiday.holiday_date,
    }));

    const additionalCondition = tatDelaysApplicationIds.length
      ? `AND ca.id NOT IN (${tatDelaysApplicationIds.join(",")})`
      : "";

    const sqlClient = `
                 SELECT 
                        ca.name AS client_applicant_name, 
                        ca.is_priority, 
                        ca.customer_id, 
                        ca.branch_id, 
                        ca.application_id, 
                        ca.id AS client_application_id, 
                        ca.id, 
                        c.name AS customer_name, 
                        c.client_unique_id AS customer_unique_id, 
                        br.name AS branch_name,
                        ca.is_new_notification_read
                    FROM 
                        \`client_applications\` AS ca
                    LEFT JOIN 
                        \`customers\` AS c 
                        ON ca.customer_id = c.id
                    LEFT JOIN 
                        \`branches\` AS br 
                        ON ca.branch_id = br.id
                    LEFT JOIN 
                        \`cmt_applications\` AS cmt 
                        ON ca.id = cmt.client_application_id
                    WHERE 
                        cmt.client_application_id IS NULL
                        AND ca.is_deleted != 1
                        AND c.is_deleted != 1
                        ${additionalCondition}
                    ORDER BY 
                        ca.created_at DESC;
                  `;
    const clientResults = await sequelize.query(sqlClient, {
      type: QueryTypes.SELECT,
    });
    const hierarchy = clientResults.reduce((acc, row) => {
      const {
        customer_id,
        customer_name,
        customer_unique_id,
        branch_id,
        branch_name,
        application_id,
        client_application_id,
        client_applicant_name,
        is_priority,
        is_new_notification_read
      } = row;

      // Initialize customer object if not already present
      if (!acc[customer_id]) {
        acc[customer_id] = {
          customer_id,
          customer_name,
          customer_unique_id,
          branches: {},
        };
      }

      // Initialize branch object if not already present under the customer
      if (!acc[customer_id].branches[branch_id]) {
        acc[customer_id].branches[branch_id] = {
          branch_id,
          branch_name,
          applications: [],
        };
      }

      // Add the application under the branch
      acc[customer_id].branches[branch_id].applications.push({
        client_application_id,
        client_applicant_name,
        application_id,
        is_priority,
        is_new_notification_read
      });

      return acc;
    }, {});

    // Convert hierarchical object to an array format
    const formattedHierarchy = Object.values(hierarchy).map(
      (customer) => ({
        ...customer,
        branches: Object.values(customer.branches),
      })
    );

    const sqlBulkUpload = `
                       SELECT 
                        bbu.customer_id, 
                        bbu.branch_id, 
                        bbu.zip,
                        c.name AS customer_name, 
                        c.client_unique_id AS customer_unique_id, 
                        br.name AS branch_name,
                        bbu.created_at,
                        bbu.is_notification_read
                    FROM 
                        \`branch_bulk_uploads\` AS bbu
                    LEFT JOIN 
                        \`customers\` AS c 
                        ON bbu.customer_id = c.id
                    LEFT JOIN 
                        \`branches\` AS br 
                        ON bbu.branch_id = br.id
                    WHERE
                      c.is_deleted != 1
                    ORDER BY 
                        bbu.created_at DESC;
                  `;
    const bulkUploadResults = await sequelize.query(sqlBulkUpload, {
      type: QueryTypes.SELECT,
    });
    const bulkHierarchy = bulkUploadResults.reduce(
      (acc, row) => {
        const {
          customer_id,
          customer_name,
          customer_unique_id,
          branch_id,
          branch_name,
          client_spoc_name,
          zip,
          created_at,
          is_notification_read
        } = row;

        // Initialize customer object if not already present
        if (!acc[customer_id]) {
          acc[customer_id] = {
            customer_id,
            customer_name,
            customer_unique_id,
            branches: {},
          };
        }

        // Initialize branch object if not already present under the customer
        if (!acc[customer_id].branches[branch_id]) {
          acc[customer_id].branches[branch_id] = {
            branch_id,
            branch_name,
            bulks: [],
          };
        }

        // Add the application under the branch
        acc[customer_id].branches[branch_id].bulks.push({
          zip,
          client_spoc_name,
          created_at,
          is_notification_read
        });

        return acc;
      },
      {}
    );

    // Convert hierarchical object to an array format
    const formattedBulkHierarchy = Object.values(
      bulkHierarchy
    ).map((customer) => ({
      ...customer,
      branches: Object.values(customer.branches),
    }));
    // Callback with both the application hierarchy and holidays array
    callback(null, {
      tatDelayList: applicationHierarchyArray,
      newApplications: formattedHierarchy,
      newBulkUploads: formattedBulkHierarchy,
    });



    function calculateDueDate(startDate, tatDays, holidayDates, weekendsSet) {
      let count = 0;
      let currentDate = startDate.clone();

      while (count < tatDays) {
        currentDate.add(1, "days");

        // Skip weekends
        if (weekendsSet.has(currentDate.format("dddd").toLowerCase())) {
          continue;
        }

        // Skip holidays
        if (
          holidayDates.some((holiday) => holiday.isSame(currentDate, "day"))
        ) {
          continue;
        }

        count++; // Only count valid business days
      }

      return currentDate; // This will be the due date
    }

    function calculateDaysOutOfTat(
      dueDate,
      endDate,
      holidayDates,
      weekendsSet
    ) {
      let count = 0;
      let currentDate = dueDate.clone();

      // Count business days from dueDate to endDate
      while (currentDate.isBefore(endDate, "day")) {
        currentDate.add(1, "days");

        // Skip weekends
        if (weekendsSet.has(currentDate.format("dddd").toLowerCase())) {
          continue;
        }

        // Skip holidays
        if (
          holidayDates.some((holiday) => holiday.isSame(currentDate, "day"))
        ) {
          continue;
        }

        count++; // Count only valid business days
      }
      return count; // Return total days out of TAT
    }
  },

  view: async(callback) => {
    const applicationsQuery = `
       SELECT 
        cmt.report_date, 
        ca.id AS client_application_id, 
        ca.is_priority, 
        ca.customer_id, 
        ca.branch_id, 
        ca.application_id, 
        ca.name AS application_name, 
        ca.created_at AS application_created_at, 
        cust.name AS customer_name, 
        cust.client_unique_id AS customer_unique_id, 
        cm.tat_days AS tat_days,
        br.name AS branch_name
      FROM client_applications AS ca
      JOIN customers AS cust ON cust.id = ca.customer_id
      JOIN branches AS br ON br.id = ca.branch_id
      LEFT JOIN customer_metas AS cm ON cm.customer_id = cust.id
      LEFT JOIN cmt_applications AS cmt ON ca.id = cmt.client_application_id
      WHERE cmt.overall_status != 'completed' 
        AND ca.is_tat_delay_notification_read != '1'
        AND ca.is_deleted != 1
        AND cust.is_deleted != 1;
    `;

    const holidaysQuery = `SELECT id AS holiday_id, title AS holiday_title, date AS holiday_date FROM holidays;`;
    const weekendsQuery = `SELECT weekends FROM company_info WHERE status = 1;`;



      const applicationResults = await sequelize.query(applicationsQuery, {
        type: QueryTypes.SELECT,
      });
        const holidayResults = await sequelize.query(holidaysQuery, {
          type: QueryTypes.SELECT,
        });

          const holidayDates = holidayResults.map(holiday => moment(holiday.holiday_date).startOf("day"));
          const weekendResults = await sequelize.query(weekendsQuery, {
            type: QueryTypes.SELECT,
          });

            const weekends = weekendResults[0]?.weekends ? JSON.parse(weekendResults[0].weekends) : [];
            const weekendsSet = new Set(weekends.map(day => day.toLowerCase()));

            let tatDelaysApplicationIds = [];
            const applicationHierarchy = applicationResults.reduce((acc, row) => {
              const { customer_id, customer_name, customer_unique_id, tat_days, branch_id, branch_name, client_application_id, application_id, application_name, is_priority, application_created_at } = row;

              if (!acc[customer_id]) {
                acc[customer_id] = { customer_id, customer_name, customer_unique_id, tat_days: parseInt(tat_days, 10), branches: {} };
              }

              if (!acc[customer_id].branches[branch_id]) {
                acc[customer_id].branches[branch_id] = { branch_id, branch_name, applications: [] };
              }

              const applicationDate = moment(application_created_at);
              const dueDate = calculateDueDate(applicationDate, parseInt(tat_days, 10), holidayDates, weekendsSet);
              const daysOutOfTat = calculateDaysOutOfTat(dueDate, moment(), holidayDates, weekendsSet);

              if (daysOutOfTat > 0) {
                tatDelaysApplicationIds.push(client_application_id);
                acc[customer_id].branches[branch_id].applications.push({
                  client_application_id, application_id, application_name, is_priority, application_created_at, days_out_of_tat: daysOutOfTat
                });
              }
              return acc;
            }, {});

            updateNotifications(tatDelaysApplicationIds, applicationResults, callback);
          
       

    function handleQueryError(error, connection, callback) {
      
      console.error("Database query error:", error);
      callback(error, null);
    }

    function calculateDueDate(startDate, tatDays, holidayDates, weekendsSet) {
      let count = 0;
      let currentDate = startDate.clone();
      while (count < tatDays) {
        currentDate.add(1, "days");
        if (!weekendsSet.has(currentDate.format("dddd").toLowerCase()) && !holidayDates.some(holiday => holiday.isSame(currentDate, "day"))) {
          count++;
        }
      }
      return currentDate;
    }

    function calculateDaysOutOfTat(dueDate, endDate, holidayDates, weekendsSet) {
      let count = 0;
      let currentDate = dueDate.clone();
      while (currentDate.isBefore(endDate, "day")) {
        currentDate.add(1, "days");
        if (!weekendsSet.has(currentDate.format("dddd").toLowerCase()) && !holidayDates.some(holiday => holiday.isSame(currentDate, "day"))) {
          count++;
        }
      }
      return count;
    }

 async   function updateNotifications(tatDelaysApplicationIds, applicationResults, callback) {

        const additionalCondition = tatDelaysApplicationIds.length ? `AND ca.id NOT IN (${tatDelaysApplicationIds.join(",")})` : "";
        const sqlClient = `
                 UPDATE client_applications AS ca
                LEFT JOIN cmt_applications AS cmt ON ca.id = cmt.client_application_id
                SET ca.is_new_notification_read = '1'
                WHERE cmt.client_application_id IS NULL
                  AND ca.is_new_notification_read != '1'
                  AND ca.is_deleted != 1
                  ${additionalCondition};
            `;

            await sequelize.query(sqlClient, {
              type: QueryTypes.UPDATE,
            });
          const sqlBulkUploadUpdate = `
                    UPDATE branch_bulk_uploads AS bbu
                    SET bbu.is_notification_read = '1'
                    WHERE bbu.is_notification_read != '1';
                `;

             await sequelize.query(sqlBulkUploadUpdate, {
                  type: QueryTypes.UPDATE,
                });

            const applicationIds = applicationResults.map(app => app.client_application_id);
            if (applicationIds.length > 0) {
              const updateQuery = `
                           UPDATE client_applications 
                          SET is_tat_delay_notification_read = '1'
                          WHERE id IN (${applicationIds.join(",")}) AND is_deleted != 1;
                      `;
                       await sequelize.query(updateQuery, {
                        type: QueryTypes.UPDATE,
                      });
                     callback(null, { message: "Notifications updated successfully" });
             
            } else {
              callback(null, { message: "No applications to update" });
            }

    }
  }
};

module.exports = notification;
