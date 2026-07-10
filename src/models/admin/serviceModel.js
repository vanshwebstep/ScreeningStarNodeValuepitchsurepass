const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

function generateDbTableName(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")  // replace spaces & special chars with "_"
    .replace(/^_|_$/g, "");       // trim leading/trailing "_"
}

const Service = {
  isServiceCodeUnique: async (service_code, callback) => {
    const serviceCodeCheckSql = `
        SELECT COUNT(*) as count
        FROM \`services\`
        WHERE \`service_code\` = ?
      `;
    const serviceCodeCheckResults = await sequelize.query(serviceCodeCheckSql, {
      replacements: [service_code], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    const serviceCodeExists = serviceCodeCheckResults[0].count > 0;
    return callback(null, serviceCodeExists);
  },

  createReportForm: async (service_id, admin_id, serviceTitle, callback) => {
    try {
      /* ---------------- STEP 1: CHECK EXISTENCE ---------------- */
      const existing = await sequelize.query(
        `SELECT id FROM report_forms WHERE service_id = ?`,
        {
          replacements: [service_id],
          type: QueryTypes.SELECT
        }
      );

      if (existing.length > 0) {
        return callback(null, {
          message: "Report form already exists",
          service_id
        });
      }

      /* ---------------- STEP 2: GENERATE UNIQUE DB TABLE ---------------- */
      const generateDbTableName = title =>
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");

      let baseName = generateDbTableName(serviceTitle);
      let dbTable = baseName;
      let counter = 1;

      while (true) {
        const [{ count }] = await sequelize.query(
          `
        SELECT COUNT(*) AS count
        FROM report_forms
        WHERE JSON_EXTRACT(json, '$.db_table') = ?
        `,
          {
            replacements: [dbTable],
            type: QueryTypes.SELECT
          }
        );

        if (count === 0) break;
        dbTable = `${baseName}_${counter++}`;
      }

      /* ---------------- STEP 3: BUILD JSON SAFELY ---------------- */
      const jsonTemplate = {
        heading: serviceTitle,
        db_table: dbTable,
        headers: [
          "PARTICULARS",
          "APPLICANT DETAILS",
          "VERIFIED DETAILS"
        ],
        rows: [
          {
            label: "Name Of The Applicant:",
            inputs: [
              { name: `name_of_the_applicant${dbTable}`, type: "text" },
              { name: `verified_name_of_the_applicant${dbTable}`, type: "text" }
            ]
          },
          {
            label: "Information Source:",
            inputs: [{ name: `information_source${dbTable}`, type: "text" }]
          },
          {
            label: "Date Of Verification:",
            inputs: [{ name: `date_of_verification${dbTable}`, type: "datepicker" }]
          },
          {
            label: "Additional Fee:",
            inputs: [{ name: `additional_fee${dbTable}`, type: "text" }]
          },
          {
            label: "Remarks:",
            inputs: [{ name: `remarks${dbTable}`, type: "text" }]
          },
          {
            label: "Annexure:",
            inputs: [
              {
                name: `annexure${dbTable}`,
                type: "file",
                multiple: true,
                required: true
              }
            ]
          },
          {
            label: "Colour Code:",
            inputs: [
              {
                name: `colour_code${dbTable}`,
                type: "dropdown",
                options: [
                  { value: "", showText: "Select Colour" },
                  { value: "green", showText: "GREEN" },
                  { value: "red", showText: "RED" },
                  { value: "yellow", showText: "YELLOW" },
                  { value: "orange", showText: "ORANGE" },
                  { value: "pink", showText: "PINK" }
                ]
              }
            ]
          }
        ]
      };

      /* ---------------- STEP 4: INSERT ---------------- */
      await sequelize.query(
        `
      INSERT INTO report_forms (service_id, admin_id, json)
      VALUES (?, ?, ?)
      `,
        {
          replacements: [
            service_id,
            admin_id,
            JSON.stringify(jsonTemplate)
          ],
          type: QueryTypes.INSERT
        }
      );

      return callback(null, {
        message: "Report form created successfully",
        service_id,
        dbTable
      });

    } catch (err) {
      console.error("createReportForm error:", err);
      callback(err, null);
    }
  },

  updateReportForm: async (
    service_id,
    admin_id,
    serviceTitle,
    callback
  ) => {
    try {
      /* ---------------- STEP 1: CHECK EXISTENCE ---------------- */
      const checkSql = `
      SELECT id, json
      FROM report_forms
      WHERE service_id = ?
    `;

      const existing = await sequelize.query(checkSql, {
        replacements: [service_id],
        type: QueryTypes.SELECT
      });

      /* =========================================================
         ✅ CASE 1: REPORT FORM EXISTS → UPDATE SERVICE NAME ONLY
         ========================================================= */
      if (existing.length > 0) {
        const reportForm = existing[0];
        const parsedJson = JSON.parse(reportForm.json);

        // Update heading only
        parsedJson.heading = serviceTitle;

        const updateSql = `
        UPDATE report_forms
        SET json = ?
        WHERE service_id = ?
      `;

        await sequelize.query(updateSql, {
          replacements: [JSON.stringify(parsedJson), service_id],
          type: QueryTypes.UPDATE
        });

        return callback(null, {
          message: "Service name updated successfully",
          service_id,
          dbTable: parsedJson.db_table
        });
      }

      /* =========================================================
         ✅ CASE 2: REPORT FORM DOES NOT EXIST → CREATE NEW
         ========================================================= */

      // Generate db table name
      const generateDbTableName = title =>
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");

      let baseName = generateDbTableName(serviceTitle);
      let dbTable = baseName;
      let counter = 1;

      while (true) {
        const [{ count }] = await sequelize.query(
          `
        SELECT COUNT(*) AS count
        FROM report_forms
        WHERE JSON_EXTRACT(json, '$.db_table') = ?
        `,
          {
            replacements: [dbTable],
            type: QueryTypes.SELECT
          }
        );

        if (count === 0) break;
        dbTable = `${baseName}_${counter++}`;
      }

      /* ---------------- JSON TEMPLATE ---------------- */
      const jsonTemplate = {
        heading: serviceTitle,
        db_table: dbTable,
        headers: [
          "PARTICULARS",
          "APPLICANT DETAILS",
          "VERIFIED DETAILS"
        ],
        rows: [
          {
            label: "Name Of The Applicant:",
            inputs: [
              { name: `name_of_the_applicant${dbTable}`, type: "text" },
              { name: `verified_name_of_the_applicant${dbTable}`, type: "text" }
            ]
          },
          {
            label: "Information Source:",
            inputs: [{ name: `information_source${dbTable}`, type: "text" }]
          },
          {
            label: "Date Of Verification:",
            inputs: [{ name: `date_of_verification${dbTable}`, type: "datepicker" }]
          },
          {
            label: "Additional Fee:",
            inputs: [{ name: `additional_fee${dbTable}`, type: "text" }]
          },
          {
            label: "Remarks:",
            inputs: [{ name: `remarks${dbTable}`, type: "text" }]
          },
          {
            label: "Annexure:",
            inputs: [
              {
                name: `annexure${dbTable}`,
                type: "file",
                multiple: true,
                required: true
              }
            ]
          },
          {
            label: "Colour Code:",
            inputs: [
              {
                name: `colour_code${dbTable}`,
                type: "dropdown",
                options: [
                  { value: "", showText: "Select Colour" },
                  { value: "green", showText: "GREEN" },
                  { value: "red", showText: "RED" },
                  { value: "yellow", showText: "YELLOW" },
                  { value: "orange", showText: "ORANGE" },
                  { value: "pink", showText: "PINK" }
                ]
              }
            ]
          }
        ]
      };

      /* ---------------- INSERT ---------------- */
      await sequelize.query(
        `
      INSERT INTO report_forms (service_id, admin_id, json)
      VALUES (?, ?, ?)
      `,
        {
          replacements: [service_id, admin_id, JSON.stringify(jsonTemplate)],
          type: QueryTypes.INSERT
        }
      );

      return callback(null, {
        message: "Report form created successfully",
        service_id,
        dbTable
      });

    } catch (err) {
      console.error("updateReportFormServiceName error:", err);
      callback(err, null);
    }
  }
  ,

  create: async (
    title,
    description,
    group_id,
    service_code,
    service_type,
    hsn_code,
    show_in_vendor_management,
    admin_id,
    callback
  ) => {
    // Step 1: Check if a service with the same title already exists
    const checkServiceSql = `
      SELECT * FROM \`services\` WHERE \`title\` = ? OR \`service_code\` = ?
    `;
    const serviceResults = await sequelize.query(checkServiceSql, {
      replacements: [title, service_code], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    // Step 2: If a service with the same title exists, return an error
    if (serviceResults.length > 0) {
      const error = new Error(
        "Service with the same name or service code already exists"
      );
      console.error(error.message);
      return callback(error, null);
    }

    const insertServiceSql = `
          INSERT INTO \`services\` (\`title\`, \`description\`, \`group_id\`, \`service_code\`, \`service_type\`,  \`hsn_code\`, \`show_in_vendor_management\`, \`admin_id\`)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
   const formattedServiceType = Array.isArray(service_type)
  ? service_type.filter(Boolean).join(",") // remove empty values
  : typeof service_type === "string"
    ? service_type.replace(/,+$/, "").trim() // remove trailing commas
    : service_type;

    const results = await sequelize.query(insertServiceSql, {
      replacements: [title, description, group_id, service_code, formattedServiceType, hsn_code, show_in_vendor_management ? 1 : 0, admin_id], // Positional replacements using ?
      type: QueryTypes.INSERT,
    });
    callback(null, results);

  },

  list: async (callback) => {
    const sql = `
      SELECT 
        s.*, 
        sg.title AS group_name 
      FROM \`services\` s
      JOIN \`service_groups\` sg ON s.group_id = sg.id
    `;


    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });

    callback(null, results);

  },
  customerAllocatedServices: async (customer_id, callback) => {
    try {
      const sql = "SELECT * FROM `customers` WHERE `id` = ? LIMIT 1";

      // Execute query using Sequelize raw query
      const results = await sequelize.query(sql, {
        replacements: [customer_id],
        type: QueryTypes.SELECT,
      });

      if (results.length === 0) {
        return callback(null, {
          status: false,
          message: "Customer not found.",
        });
      }

      const customer = results[0];
      // Parse services if stored as JSON string
      let servicesArray = [];
      if (customer.services) {
        try {
          if (typeof customer.services === "string") {
            servicesArray = JSON.parse(customer.services);
          } else if (Array.isArray(customer.services)) {
            servicesArray = customer.services;
          }
        } catch (err) {
          console.error("Error parsing customer.services:", err);
        }
      }

      console.log(`Customer ${customer_id} servicesArray:`, servicesArray);

      // Extract all serviceIds into a single flat array
      const serviceIds = servicesArray.flatMap(group =>
        group.services.map(service => service.serviceId)
      );

      console.log(`Customer ${customer_id} serviceIds:`, serviceIds);


      // ✅ Fetch full service details from `services` table
      let servicesDetails = [];
      if (serviceIds.length > 0) {
        const serviceSql = `SELECT \`id\`, \`title\` FROM services WHERE id IN (:ids)`;
        servicesDetails = await sequelize.query(serviceSql, {
          replacements: { ids: serviceIds },
          type: QueryTypes.SELECT,
        });
      }

      return callback(null, {
        status: true,
        message: "Customer allocated services fetched successfully.",
        data: {
          // customer,
          services: servicesDetails,
        },
      });
    } catch (err) {
      console.error("Database query error:", err);
      return callback(
        { status: false, message: "Database query failed.", error: err },
        null
      );
    }
  },
  digitlAddressService: async (callback) => {
    const sql = `
      SELECT * FROM \`services\`
      WHERE LOWER(\`title\`) LIKE '%digital%'
      AND (LOWER(\`title\`) LIKE '%verification%' OR LOWER(\`title\`) LIKE '%address%')
      LIMIT 1
    `;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    const singleEntry = results.length > 0 ? results[0] : null;
    callback(null, singleEntry); // Return single entry or null if not found


  },

  getServiceById: async (id, callback) => {
    const sql = `SELECT * FROM \`services\` WHERE \`id\` = ?`;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);
  },

  getServiceRequiredDocumentsByServiceId: async (service_id, callback) => {
    const sql = `SELECT * FROM \`service_required_documents\` WHERE \`service_id\` = ?`;
    const results = await sequelize.query(sql, {
      replacements: [service_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);

  },

update: async (
  id,
  title,
  description,
  group_id,
  service_type,
  service_code,
  hsn_code,
  show_in_vendor_management,
  callback
) => {
  try {
    // 👇 Convert array to comma-separated string
const formattedServiceType = Array.isArray(service_type)
  ? service_type.filter(Boolean).join(",") // remove empty values
  : typeof service_type === "string"
    ? service_type.replace(/,+$/, "").trim() // remove trailing commas
    : service_type;

    const sql = `
      UPDATE \`services\`
      SET 
        \`title\` = ?, 
        \`description\` = ?, 
        \`group_id\` = ?, 
        \`service_type\` = ?, 
        \`service_code\` = ?, 
        \`hsn_code\` = ?,
        \`show_in_vendor_management\` = ?
      WHERE \`id\` = ?
    `;

    const results = await sequelize.query(sql, {
      replacements: [
        title,
        description,
        group_id,
        formattedServiceType, // 👈 yaha change
        service_code,
        hsn_code,
        show_in_vendor_management ? 1 : 0,
        id
      ],
      type: QueryTypes.UPDATE,
    });

    callback(null, results);

  } catch (error) {
    console.error(error);
    callback(error, null);
  }
},

  delete: async (id, callback) => {
    try {
      /* ---------- STEP 1: DELETE SERVICE ---------- */
      const serviceResult = await sequelize.query(
        `
      DELETE FROM services
      WHERE id = ?
      `,
        {
          replacements: [id],
          type: QueryTypes.DELETE,
        }
      );

      /* ---------- STEP 2: DELETE REPORT FORM ---------- */
      const reportFormResult = await sequelize.query(
        `
      DELETE FROM report_forms
      WHERE service_id = ?
      `,
        {
          replacements: [id],
          type: QueryTypes.DELETE,
        }
      );

      return callback(null, {
        message: "Service and related report form deleted successfully",
        serviceResult,
        reportFormResult
      });

    } catch (err) {
      console.error("Delete error:", err);
      callback(err, null);
    }
  },

  servicesWithGroup: async (callback) => {
    const sql = `
      SELECT 
        sg.id AS group_id, 
        sg.symbol, 
        sg.title AS group_title, 
        s.id AS service_id, 
        s.title AS service_title,
        s.service_code AS service_code
      FROM 
        service_groups sg
      LEFT JOIN 
        services s ON s.group_id = sg.id
      ORDER BY 
        sg.id, s.id
    `;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    const groupedData = [];
    const groupMap = new Map();

    results.forEach((row) => {
      const {
        group_id,
        symbol,
        group_title,
        service_id,
        service_title,
        service_code,
      } = row;

      // Retrieve the group from the map, or initialize a new entry
      let group = groupMap.get(group_id);
      if (!group) {
        group = {
          group_id,
          symbol,
          group_title,
          services: [],
        };
        groupMap.set(group_id, group);
        groupedData.push(group);
      }

      // Add service details if the service exists
      if (service_id) {
        group.services.push({
          service_id,
          service_title,
          service_code,
        });
      }
    });

    callback(null, groupedData);


  },
};

module.exports = Service;
