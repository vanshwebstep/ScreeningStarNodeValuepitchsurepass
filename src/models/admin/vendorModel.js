const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const moment = require("moment");
const App = require("../appModel");

const parseJson = (value, fallback) => {
  try {
    if (value === null || value === undefined || value === "") return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};

const normalizeServices = (services) => JSON.stringify(parseJson(services, []));
const normalizeDetails = (details) => JSON.stringify(parseJson(details, {}));
const activeVendorClause = "(is_deleted IS NULL OR is_deleted != 1)";
const deletedVendorClause = "is_deleted = 1";
const normalizeFileHost = (host) => {
  const cleanHost = String(host || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!cleanHost) return "";
  return /^https?:\/\//i.test(cleanHost) ? cleanHost : `https://${cleanHost}`;
};

const buildPublicFileUrl = (filePath, host) => {
  if (!filePath) return null;
  const rawPath = String(filePath).trim();
  if (!rawPath) return null;
  if (/^https?:\/\//i.test(rawPath)) return rawPath.replace(/\\/g, "/");
  const cleanPath = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const baseHost = normalizeFileHost(host) || "http://localhost:5000";
  return `${baseHost}/${cleanPath}`;
};

const getBackendFileHost = () =>
  new Promise((resolve) => {
    App.appInfo("backend", (err, appInfo) => {
      if (err) console.error("Error fetching backend app info:", err);
      resolve((appInfo && (appInfo.cloud_host || appInfo.host)) || "");
    });
  });

const toReportMoment = (value) => {
  const text = String(value || "").trim();
  if (!text || text === "0000-00-00" || text.startsWith("0000-00-00")) return null;
  const date = moment(text).startOf("day");
  return date.isValid() ? date : null;
};

const isWorkingDay = (date, holidayDates, weekendsSet) => (
  !weekendsSet.has(date.format("dddd").toLowerCase()) &&
  !holidayDates.has(date.format("YYYY-MM-DD"))
);

const calculateDueDate = (startDate, tatDays, holidayDates, weekendsSet) => {
  const dueDate = startDate.clone().startOf("day");
  let daysRemaining = parseInt(tatDays || 0, 10);
  daysRemaining = Number.isNaN(daysRemaining) ? 0 : Math.max(daysRemaining, 0);

  while (daysRemaining > 0) {
    dueDate.add(1, "day");
    if (isWorkingDay(dueDate, holidayDates, weekendsSet)) daysRemaining--;
  }

  return dueDate;
};

const countWorkingDaysAfterStart = (startDate, endDate, holidayDates, weekendsSet) => {
  if (!startDate || !endDate || endDate.isSameOrBefore(startDate, "day")) return 0;
  let count = 0;
  const currentDate = startDate.clone().startOf("day");

  while (currentDate.isBefore(endDate, "day")) {
    currentDate.add(1, "day");
    if (isWorkingDay(currentDate, holidayDates, weekendsSet)) count++;
  }

  return count;
};

const calculateVendorTat = (row, holidayDates, weekendsSet) => {
  const startDate = toReportMoment(row.initiation_date) || toReportMoment(row.created_at);
  const reportDate = toReportMoment(row.report_date);
  if (!startDate || !reportDate) {
    return { tat_elapsed_days: 0, in_tat_days: 0, out_of_tat_days: 0 };
  }

  const dueDate = toReportMoment(row.deadline_date) || calculateDueDate(startDate, row.tat_days, holidayDates, weekendsSet);
  const elapsedWorkingDays = countWorkingDaysAfterStart(startDate, reportDate, holidayDates, weekendsSet);
  const outOfTatDays = reportDate.isAfter(dueDate, "day")
    ? countWorkingDaysAfterStart(dueDate, reportDate, holidayDates, weekendsSet)
    : 0;

  return {
    tat_elapsed_days: elapsedWorkingDays,
    in_tat_days: outOfTatDays > 0 ? 0 : elapsedWorkingDays,
    out_of_tat_days: outOfTatDays,
  };
};

const archivedEmail = (id, seed = Date.now()) => `deleted_${id}_${seed}@deleted.local`;
const archivedVendorCode = (id, seed = Date.now()) => `DEL-${id}-${seed}`;

const retireDeletedUniqueConflicts = async (data) => {
  const email = String(data.email_id || "").trim().toLowerCase();
  const vendorCode = String(data.vendor_code || "").trim();
  if (!email && !vendorCode) return;

  const rows = await sequelize.query(
    `SELECT id, email_id, vendor_code
     FROM vendor_managements
     WHERE ${deletedVendorClause}
       AND (LOWER(email_id) = LOWER(?) OR vendor_code = ?)`,
    { replacements: [email, vendorCode], type: QueryTypes.SELECT }
  );

  for (const row of rows) {
    const seed = `${Date.now()}${row.id}`;
    const nextEmail = String(row.email_id || "").toLowerCase() === email
      ? archivedEmail(row.id, seed)
      : row.email_id;
    const nextVendorCode = String(row.vendor_code || "") === vendorCode
      ? archivedVendorCode(row.id, seed)
      : row.vendor_code;

    await sequelize.query(
      `UPDATE vendor_managements
       SET email_id = ?, vendor_code = ?
       WHERE id = ? AND ${deletedVendorClause}`,
      { replacements: [nextEmail, nextVendorCode, row.id], type: QueryTypes.UPDATE }
    );
  }
};

const publicColumns = `
  id, admin_id, name_of_organization, vendor_code, registered_address, state, pin_code,
  gst, tat, agreement_date, email_id, services, vendor_spoc, escalation_manager,
  authorized_details, status, created_at, updated_at
`;
const vendorCaseColumns = {
  vendor_case_status: "VARCHAR(50) NULL DEFAULT 'assigned'",
  vendor_case_enabled: "TINYINT(1) NOT NULL DEFAULT 1",
  vendor_accepted_at: "DATETIME NULL",
  vendor_report_path: "TEXT NULL",
  vendor_report_uploaded_at: "DATETIME NULL",
  vendor_verified_date: "DATE NULL",
};

const ensureVendorCaseColumns = async () => {
  const columnResults = await sequelize.query("SHOW COLUMNS FROM client_applications", {
    type: QueryTypes.SELECT,
  });
  const existingColumns = columnResults.map((column) => column.Field);

  for (const [column, definition] of Object.entries(vendorCaseColumns)) {
    if (!existingColumns.includes(column)) {
      await sequelize.query(
        `ALTER TABLE \`client_applications\` ADD COLUMN \`${column}\` ${definition}`,
        { type: QueryTypes.RAW }
      );
    }
  }
};

const vendorCaseBaseSelect = `
  SELECT
    ca.id,
    ca.id AS main_id,
    ca.application_id,
    ca.employee_id,
    ca.case_id,
    ca.check_id,
    ca.ticket_id,
    ca.name,
    ca.gender,
    ca.location,
    ca.sub_client,
    ca.client_spoc_name AS screeningstar_spoc,
    ca.created_at,
    ca.vendor_id,
    ca.vendor_name,
    ca.vendor_code,
    ca.vendor_case_status,
    ca.vendor_case_enabled,
    ca.vendor_accepted_at,
    ca.vendor_report_path,
    ca.vendor_report_uploaded_at,
    ca.vendor_verified_date,
    c.name AS customer_name,
    c.client_unique_id,
    b.name AS branch_name,
    cm.tat_days,
    cm.client_spoc_name,
    vm.vendor_spoc,
    cmt.initiation_date,
    cmt.deadline_date,
    cmt.first_insufficiency_marks,
    cmt.first_insuff_date,
    cmt.second_insufficiency_marks,
    cmt.second_insuff_date,
    cmt.third_insufficiency_marks,
    cmt.third_insuff_date,
    cmt.final_verification_status,
    cmt.dob,
    cmt.report_date,
    cmt.report_status,
    cmt.overall_status,
    GROUP_CONCAT(DISTINCT s.title ORDER BY s.title SEPARATOR ', ') AS service_names
  FROM client_applications ca
  LEFT JOIN customers c ON c.id = ca.customer_id
  LEFT JOIN branches b ON b.id = ca.branch_id
  LEFT JOIN customer_metas cm ON cm.customer_id = ca.customer_id
  LEFT JOIN vendor_managements vm ON vm.id = ca.vendor_id
  LEFT JOIN cmt_applications cmt ON cmt.client_application_id = ca.id
  LEFT JOIN services s ON FIND_IN_SET(s.id, ca.services)
`;

const vendorCaseStatusWhere = (status) => {
  const normalized = String(status || "assigned").toLowerCase();
  if (normalized === "completed") {
    return "AND LOWER(COALESCE(ca.vendor_case_status, 'assigned')) = 'completed'";
  }
  if (normalized === "accepted") {
    return "AND LOWER(COALESCE(ca.vendor_case_status, 'assigned')) = 'accepted'";
  }
  return "AND LOWER(COALESCE(ca.vendor_case_status, 'assigned')) = 'assigned'";
};

const Vendor = {
  create: async (data, callback) => {
    try {
      await retireDeletedUniqueConflicts(data);
      const sql = `
        INSERT INTO vendor_managements (
          admin_id, name_of_organization, vendor_code, registered_address, state, pin_code,
          gst, tat, agreement_date, email_id, password, services,
          vendor_spoc, escalation_manager, authorized_details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = await sequelize.query(sql, {
        replacements: [
          data.admin_id,
          data.name_of_organization,
          data.vendor_code,
          data.registered_address,
          data.state,
          data.pin_code,
          data.gst || null,
          data.tat,
          data.agreement_date,
          data.email_id,
          data.password,
          normalizeServices(data.services),
          normalizeDetails(data.vendor_spoc),
          normalizeDetails(data.escalation_manager),
          normalizeDetails(data.authorized_details),
        ],
        type: QueryTypes.INSERT,
      });
      callback(null, { insertId: result[0] });
    } catch (error) {
      callback(error, null);
    }
  },

  update: async (id, data, callback) => {
    try {
      await retireDeletedUniqueConflicts(data);
      const sql = `
        UPDATE vendor_managements SET
          name_of_organization = ?, vendor_code = ?, registered_address = ?, state = ?, pin_code = ?,
          gst = ?, tat = ?, agreement_date = ?, email_id = ?, password = COALESCE(NULLIF(?, ''), password), services = ?,
          vendor_spoc = ?, escalation_manager = ?, authorized_details = ?
        WHERE id = ? AND ${activeVendorClause}
      `;
      const result = await sequelize.query(sql, {
        replacements: [
          data.name_of_organization,
          data.vendor_code,
          data.registered_address,
          data.state,
          data.pin_code,
          data.gst || null,
          data.tat,
          data.agreement_date,
          data.email_id,
          data.password,
          normalizeServices(data.services),
          normalizeDetails(data.vendor_spoc),
          normalizeDetails(data.escalation_manager),
          normalizeDetails(data.authorized_details),
          id,
        ],
        type: QueryTypes.UPDATE,
      });
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },

  list: async (statusFilter, callback) => {
    try {
      let statusClause = "";
      const replacements = [];
      const normalizedStatus = String(statusFilter || "all").toLowerCase();
      if (normalizedStatus === "active") {
        statusClause = " AND status = ?";
        replacements.push(1);
      } else if (normalizedStatus === "inactive") {
        statusClause = " AND status = ?";
        replacements.push(0);
      }

      const rows = await sequelize.query(
        `SELECT ${publicColumns} FROM vendor_managements WHERE ${activeVendorClause}${statusClause} ORDER BY created_at DESC`,
        { replacements, type: QueryTypes.SELECT }
      );
      callback(null, rows);
    } catch (error) {
      callback(error, null);
    }
  },

  findById: async (id, callback) => {
    try {
      const rows = await sequelize.query(
        `SELECT ${publicColumns}, login_token, token_expiry FROM vendor_managements WHERE id = ? AND ${activeVendorClause} LIMIT 1`,
        { replacements: [id], type: QueryTypes.SELECT }
      );
      callback(null, rows[0] || null);
    } catch (error) {
      callback(error, null);
    }
  },
  updateStatus: async (id, status, callback) => {
    try {
      const result = await sequelize.query(
        `UPDATE vendor_managements SET status = ? WHERE id = ? AND ${activeVendorClause}`,
        { replacements: [Number(status) === 1 ? 1 : 0, id], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },


  findByEmail: async (email, callback) => {
    try {
      const rows = await sequelize.query(
        `SELECT ${publicColumns}, password, login_token, token_expiry, status FROM vendor_managements WHERE LOWER(email_id) = LOWER(?) AND ${activeVendorClause} LIMIT 1`,
        { replacements: [email], type: QueryTypes.SELECT }
      );
      callback(null, rows[0] || null);
    } catch (error) {
      callback(error, null);
    }
  },

  isVendorCodeUsed: async (vendorCode, ignoreId, callback) => {
    try {
      const replacements = [vendorCode];
      let sql = `SELECT COUNT(*) AS count FROM vendor_managements WHERE vendor_code = ? AND ${activeVendorClause}`;
      if (ignoreId) {
        sql += " AND id != ?";
        replacements.push(ignoreId);
      }
      const rows = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
      callback(null, Number(rows[0]?.count || 0) > 0);
    } catch (error) {
      callback(error, null);
    }
  },

  isEmailUsed: async (email, ignoreId, callback) => {
    try {
      const replacements = [email];
      let sql = `SELECT COUNT(*) AS count FROM vendor_managements WHERE LOWER(email_id) = LOWER(?) AND ${activeVendorClause}`;
      if (ignoreId) {
        sql += " AND id != ?";
        replacements.push(ignoreId);
      }
      const rows = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
      callback(null, Number(rows[0]?.count || 0) > 0);
    } catch (error) {
      callback(error, null);
    }
  },

  updateLoginToken: async (id, token, tokenExpiry, callback) => {
    try {
      await sequelize.query(
        `UPDATE vendor_managements SET login_token = ?, token_expiry = ? WHERE id = ? AND ${activeVendorClause}`,
        { replacements: [token, tokenExpiry, id], type: QueryTypes.UPDATE }
      );
      callback(null, true);
    } catch (error) {
      callback(error, null);
    }
  },
  updatePassword: async (id, password, callback) => {
    try {
      await sequelize.query(
        `UPDATE vendor_managements
         SET password = ?, login_token = NULL, token_expiry = NULL
         WHERE id = ? AND ${activeVendorClause}`,
        { replacements: [password, id], type: QueryTypes.UPDATE }
      );
      callback(null, true);
    } catch (error) {
      callback(error, null);
    }
  },

  updateDashboardPassword: async (id, password, callback) => {
    try {
      await sequelize.query(
        `UPDATE vendor_managements
         SET password = ?
         WHERE id = ? AND ${activeVendorClause}`,
        { replacements: [password, id], type: QueryTypes.UPDATE }
      );
      callback(null, true);
    } catch (error) {
      callback(error, null);
    }
  },


  listCases: async (vendorId, status, callback) => {
    try {
      await ensureVendorCaseColumns();
      const sql = `
        ${vendorCaseBaseSelect}
        WHERE ca.vendor_id = ?
          AND ca.is_deleted != 1
          AND (c.is_deleted IS NULL OR c.is_deleted != 1)
          ${vendorCaseStatusWhere(status)}
        GROUP BY ca.id
        ORDER BY COALESCE(cmt.initiation_date, ca.created_at) DESC, ca.id DESC
      `;
      const rows = await sequelize.query(sql, {
        replacements: [vendorId],
        type: QueryTypes.SELECT,
      });
      const [fileHost, holidayRows, weekendRows] = await Promise.all([
        getBackendFileHost(),
        sequelize.query("SELECT date AS holiday_date FROM holidays", { type: QueryTypes.SELECT }),
        sequelize.query("SELECT weekends FROM company_info WHERE status = 1 LIMIT 1", { type: QueryTypes.SELECT }),
      ]);
      const holidayDates = new Set(holidayRows.map((holiday) => moment(holiday.holiday_date).format("YYYY-MM-DD")));
      const weekendsSet = new Set(parseJson(weekendRows[0]?.weekends, []).map((day) => String(day).toLowerCase()));
      const cases = rows.map((row) => ({
        ...row,
        ...calculateVendorTat(row, holidayDates, weekendsSet),
        vendor_report_url: buildPublicFileUrl(row.vendor_report_path, fileHost),
      }));
      callback(null, cases);
    } catch (error) {
      callback(error, null);
    }
  },

  acceptCase: async (vendorId, clientApplicationId, callback) => {
    try {
      await ensureVendorCaseColumns();
      const result = await sequelize.query(
        `UPDATE client_applications
         SET vendor_case_status = 'accepted', vendor_accepted_at = NOW()
         WHERE id = ? AND vendor_id = ? AND vendor_case_enabled = 1 AND is_deleted != 1`,
        { replacements: [clientApplicationId, vendorId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },


  completeCase: async (vendorId, clientApplicationId, callback) => {
    try {
      await ensureVendorCaseColumns();
      const result = await sequelize.query(
        `UPDATE client_applications
         SET vendor_case_status = 'completed'
         WHERE id = ?
           AND vendor_id = ?
           AND vendor_case_enabled = 1
           AND is_deleted != 1
           AND vendor_report_path IS NOT NULL
           AND TRIM(vendor_report_path) != ''`,
        { replacements: [clientApplicationId, vendorId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },
  saveCaseReport: async (vendorId, clientApplicationId, reportPath, callback) => {
    try {
      await ensureVendorCaseColumns();
      const result = await sequelize.query(
        `UPDATE client_applications
         SET vendor_report_path = ?, vendor_report_uploaded_at = NOW()
         WHERE id = ? AND vendor_id = ? AND vendor_case_enabled = 1 AND is_deleted != 1`,
        { replacements: [reportPath, clientApplicationId, vendorId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },

  updateVerifiedDate: async (vendorId, clientApplicationId, verifiedDate, callback) => {
    try {
      await ensureVendorCaseColumns();
      const result = await sequelize.query(
        `UPDATE client_applications
         SET vendor_verified_date = ?
         WHERE id = ? AND vendor_id = ? AND vendor_case_enabled = 1 AND is_deleted != 1`,
        { replacements: [verifiedDate || null, clientApplicationId, vendorId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },

  updateCaseAccess: async (clientApplicationId, enabled, callback) => {
    try {
      await ensureVendorCaseColumns();
      const result = await sequelize.query(
        `UPDATE client_applications SET vendor_case_enabled = ? WHERE id = ? AND is_deleted != 1`,
        { replacements: [enabled ? 1 : 0, clientApplicationId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },
  delete: async (id, callback) => {
    try {
      const seed = `${Date.now()}${id}`;
      const result = await sequelize.query(
        `UPDATE vendor_managements
         SET is_deleted = 1,
             deleted_at = NOW(),
             login_token = NULL,
             token_expiry = NULL,
             email_id = ?,
             vendor_code = ?
         WHERE id = ? AND ${activeVendorClause}`,
        { replacements: [archivedEmail(id, seed), archivedVendorCode(id, seed), id], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },
};

module.exports = Vendor;
