const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const App = require("../appModel");

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
const VERIFICATION_STATUS_VALUES = ["WIP", "INSUFF", "NOT DOABLE", "CANDIDATE DENIED", "STOPCHECK", "HOLD", "UNABLE TO VERIFY"];
const getBackendFileHost = () =>
  new Promise((resolve) => {
    App.appInfo("backend", (err, appInfo) => {
      if (err) console.error("Error fetching backend app info:", err);
      resolve((appInfo && (appInfo.cloud_host || appInfo.host)) || "");
    });
  });

// ── Dynamic candidate-field column resolution ──────────────────────────────
// cmt_applications columns get created dynamically per report-form, so the
// actual column name for "father name"/"address"/etc. can vary by install.
// We detect what's really there and map to a stable output name.
const CANDIDATE_FIELD_CANDIDATES = {
  father_name: ["father_name", "fathers_name", "father_or_spouse_name"],
  address: ["permanent_address", "address"],
  state: ["permanent_address_state", "address_state", "state"],
  pin_code: ["permanent_address_pin_code", "address_pin_code", "pin_code"],
};

let cachedCmtColumns = null;
const getCmtColumns = async (force = false) => {
  if (cachedCmtColumns && !force) return cachedCmtColumns;
  const rows = await sequelize.query("SHOW COLUMNS FROM `cmt_applications`", { type: QueryTypes.SELECT });
  cachedCmtColumns = rows.map((row) => row.Field);
  return cachedCmtColumns;
};

const resolveCandidateColumn = (existingColumns, key) => {
  const candidates = CANDIDATE_FIELD_CANDIDATES[key] || [key];
  return candidates.find((column) => existingColumns.includes(column)) || null;
};

const buildCandidateSelectFragment = async () => {
  const columns = await getCmtColumns();
  const fatherCol = resolveCandidateColumn(columns, "father_name");
  const addressCol = resolveCandidateColumn(columns, "address");
  const stateCol = resolveCandidateColumn(columns, "state");
  const pinCol = resolveCandidateColumn(columns, "pin_code");
  const dobCol = columns.includes("dob") ? "dob" : null;

  return {
    fatherCol,
    addressCol,
    stateCol,
    pinCol,
    dobCol,
    sqlFragment: `
      ${fatherCol ? `cmt.\`${fatherCol}\`` : "NULL"} AS father_name,
      ${addressCol ? `cmt.\`${addressCol}\`` : "NULL"} AS address,
      ${stateCol ? `cmt.\`${stateCol}\`` : "NULL"} AS state,
      ${pinCol ? `cmt.\`${pinCol}\`` : "NULL"} AS pin_code,
      ${dobCol ? `cmt.\`${dobCol}\`` : "NULL"} AS dob
    `,
  };
};

// Resolve+write a correction field back into cmt_applications' real column.
const writeCandidateFieldValue = async (clientApplicationId, fieldKey, value) => {
  const columns = await getCmtColumns();
  const column = resolveCandidateColumn(columns, fieldKey);
  if (!column) {
    throw new Error(`Cannot resolve a database column for field "${fieldKey}".`);
  }
  await sequelize.query(
    `UPDATE \`cmt_applications\` SET \`${column}\` = ? WHERE \`client_application_id\` = ?`,
    { replacements: [value, clientApplicationId], type: QueryTypes.UPDATE }
  );
  return column;
};

const CaseServiceAllocation = {
  // ── Admin: full service-wise listing ──────────────────────────────────────
listForAdmin: async (callback) => {
  try {
    const { sqlFragment } = await buildCandidateSelectFragment();

    console.log("========== SQL FRAGMENT ==========");
    console.log(sqlFragment);

    const sql = `
      SELECT
        csa.id AS allocation_id,
        csa.client_application_id,
        csa.service_id,
        csa.service_title,
        csa.vendor_id,
        csa.vendor_name,
        csa.vendor_code,
        csa.vendor_case_status,
        csa.verification_status,
        csa.vendor_case_enabled,
        csa.vendor_upload_enabled,
        csa.vendor_allocated_at,
        csa.vendor_accepted_at,
        csa.vendor_report_path,
        csa.vendor_report_uploaded_at,
        csa.vendor_verified_date,
        csa.attachment_path,
        csa.attachment_uploaded_at,
        ca.id AS main_id,
        ca.application_id,
        ca.employee_id,
        ca.check_id,
        ca.ticket_id,
        ca.name AS applicant_name,
        ca.gender,
        ca.location,
        ca.sub_client,
        ca.client_spoc_name AS screeningstar_spoc,
        c.name AS customer_name,
        c.client_unique_id,
        b.name AS branch_name,
        cm.tat_days,
        cm.client_spoc_name AS customer_spoc_name,
        vm.vendor_spoc,
        cmt.initiation_date,
        cmt.deadline_date,
        cmt.overall_status,
        ${sqlFragment}
      FROM case_service_allocations csa
      INNER JOIN client_applications ca ON ca.id = csa.client_application_id
      LEFT JOIN customers c ON c.id = ca.customer_id
      LEFT JOIN branches b ON b.id = ca.branch_id
      LEFT JOIN customer_metas cm ON cm.customer_id = ca.customer_id
      LEFT JOIN vendor_managements vm ON vm.id = csa.vendor_id
      LEFT JOIN cmt_applications cmt ON cmt.client_application_id = ca.id
      WHERE ca.is_deleted != 1
        AND ca.is_data_qc = 1
        AND (c.is_deleted IS NULL OR c.is_deleted != 1)
      ORDER BY ca.created_at DESC, csa.id ASC
    `;

    console.log("========== FULL SQL ==========");
    console.log(sql);

    const rows = await sequelize.query(sql, {
      type: QueryTypes.SELECT
    });

    console.log("========== MAIN QUERY RESULT ==========");
    console.log("Rows count:", rows.length);
    console.log("Rows:", rows);

    const pendingRows = await sequelize.query(
      `SELECT * FROM vendor_correction_requests WHERE status = 'pending'`,
      { type: QueryTypes.SELECT }
    );

    console.log("========== PENDING REQUESTS ==========");
    console.log("Pending rows:", pendingRows.length);
    console.log(pendingRows);

    const pendingByAllocation = new Map();

    pendingRows.forEach((request) => {
      const list =
        pendingByAllocation.get(request.case_service_allocation_id) || [];

      list.push(request);
      pendingByAllocation.set(
        request.case_service_allocation_id,
        list
      );
    });

    const fileHost = await getBackendFileHost();

    console.log("========== FILE HOST ==========");
    console.log(fileHost);

    const applications = rows.map((row) => ({
      ...row,
      vendor_report_url: buildPublicFileUrl(
        row.vendor_report_path,
        fileHost
      ),
      attachment_url: buildPublicFileUrl(
        row.attachment_path,
        fileHost
      ),
      pending_correction_requests:
        pendingByAllocation.get(row.allocation_id) || [],
    }));

    console.log("========== FINAL APPLICATIONS ==========");
    console.log("Applications count:", applications.length);
    console.log(applications);

    callback(null, applications);

  } catch (error) {

    console.log("========== LIST FOR ADMIN ERROR ==========");
    console.error(error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    callback(error, null);
  }
},

  allocate: async (allocationId, vendor, adminId, callback) => {
    try {
      const result = await sequelize.query(
        `UPDATE case_service_allocations
       SET vendor_id = ?, vendor_name = ?, vendor_code = ?,
           vendor_allocated_at = NOW(), vendor_allocated_by = ?,
           vendor_case_status = 'assigned', vendor_case_enabled = 1,
           vendor_upload_enabled = 1
       WHERE id = ?`,
        { replacements: [vendor.id, vendor.name_of_organization, vendor.vendor_code || null, adminId, allocationId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) { callback(error, null); }
  },

  allocateBulk: async (allocationIds, vendor, adminId, callback) => {
    try {
      const ids = [...new Set((allocationIds || []).map((id) => Number(id)).filter(Boolean))];
      if (!ids.length) return callback(new Error("No valid service allocations selected."), null);
      const placeholders = ids.map(() => "?").join(",");
      const result = await sequelize.query(
        `UPDATE case_service_allocations
         SET vendor_id = ?, vendor_name = ?, vendor_code = ?,
             vendor_allocated_at = NOW(), vendor_allocated_by = ?,
             vendor_case_status = 'assigned', vendor_case_enabled = 1
         WHERE id IN (${placeholders})`,
        {
          replacements: [vendor.id, vendor.name_of_organization, vendor.vendor_code || null, adminId, ...ids],
          type: QueryTypes.UPDATE,
        }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },

  updateCaseAccess: async (allocationId, enabled, callback) => {
    try {
      const result = await sequelize.query(
        `UPDATE case_service_allocations SET vendor_case_enabled = ? WHERE id = ?`,
        { replacements: [enabled ? 1 : 0, allocationId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },
    updateVerificationStatus: async (allocationId, status, vendorId, callback) => {
    try {
      if (!VERIFICATION_STATUS_VALUES.includes(status)) {
        return callback(new Error("Invalid verification status."), null);
      }
      const replacements = [status, allocationId];
      let ownerClause = "";
      if (vendorId) {
        ownerClause = "AND vendor_id = ?";
        replacements.push(vendorId);
      }
      const result = await sequelize.query(
        `UPDATE case_service_allocations SET verification_status = ? WHERE id = ? ${ownerClause} AND vendor_case_enabled = 1`,
        { replacements, type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },

  saveAttachment: async (allocationId, attachmentPath, adminId, callback) => {
    try {
      const result = await sequelize.query(
        `UPDATE case_service_allocations
         SET attachment_path = ?, attachment_uploaded_at = NOW(), attachment_uploaded_by = ?
         WHERE id = ?`,
        { replacements: [attachmentPath, adminId, allocationId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },

  findById: async (allocationId, callback) => {
    try {
      const rows = await sequelize.query(
        `SELECT * FROM case_service_allocations WHERE id = ? LIMIT 1`,
        { replacements: [allocationId], type: QueryTypes.SELECT }
      );
      callback(null, rows[0] || null);
    } catch (error) {
      callback(error, null);
    }
  },

findForMail: async (allocationId, vendorId, callback) => {
    try {
      const { sqlFragment } = await buildCandidateSelectFragment();
      const replacements = [allocationId];
      let vendorFilter = "";
      if (vendorId) {
        vendorFilter = "AND csa.vendor_id = ?";
        replacements.push(vendorId);
      }
      const rows = await sequelize.query(
        `SELECT csa.*, ca.application_id, ca.name AS applicant_name, ca.gender,
                c.name AS customer_name, b.name AS branch_name,
                admins.email AS allocated_admin_email,
                cmt.initiation_date, cmt.deadline_date,
                ${sqlFragment}
         FROM case_service_allocations csa
         INNER JOIN client_applications ca ON ca.id = csa.client_application_id
         LEFT JOIN customers c ON c.id = ca.customer_id
         LEFT JOIN branches b ON b.id = ca.branch_id
         LEFT JOIN admins ON admins.id = csa.vendor_allocated_by
         LEFT JOIN cmt_applications cmt ON cmt.client_application_id = ca.id
         WHERE csa.id = ? ${vendorFilter}
         LIMIT 1`,
        { replacements, type: QueryTypes.SELECT }
      );
      const row = rows[0] || null;
      if (!row) return callback(null, null);
      const fileHost = await getBackendFileHost();
      callback(null, { ...row, attachment_url: buildPublicFileUrl(row.attachment_path, fileHost) });
    } catch (error) {
      callback(error, null);
    }
  },

  // ── Vendor side ────────────────────────────────────────────────────────────
  listForVendor: async (vendorId, status, serviceId, callback) => {
    try {
      const { sqlFragment } = await buildCandidateSelectFragment();
      const replacements = [vendorId];
      let statusClause = "AND LOWER(COALESCE(csa.vendor_case_status,'unassigned')) = 'assigned'";
      const normalizedStatus = String(status || "assigned").toLowerCase();
      if (normalizedStatus === "accepted") statusClause = "AND LOWER(csa.vendor_case_status) = 'accepted'";
      if (normalizedStatus === "completed") statusClause = "AND LOWER(csa.vendor_case_status) = 'completed'";

      let serviceClause = "";
      if (serviceId) {
        serviceClause = "AND csa.service_id = ?";
        replacements.push(serviceId);
      }

      const sql = `
        SELECT
          csa.id AS allocation_id,
          csa.client_application_id,
          csa.service_id,
          csa.service_title,
          csa.vendor_case_status,
          csa.verification_status,
          csa.vendor_case_enabled,
          csa.vendor_upload_enabled,
          csa.vendor_report_path,
          csa.vendor_report_uploaded_at,
          csa.vendor_verified_date,
          csa.attachment_path,
          ca.application_id,
          ca.employee_id,
          ca.name AS applicant_name,
          ca.gender,
          ca.client_spoc_name AS screeningstar_spoc,
          cmt.initiation_date,
          cmt.deadline_date,
          cmt.report_date,
          ${sqlFragment}
        FROM case_service_allocations csa
        INNER JOIN client_applications ca ON ca.id = csa.client_application_id
        LEFT JOIN cmt_applications cmt ON cmt.client_application_id = ca.id
        WHERE csa.vendor_id = ?
          AND ca.is_deleted != 1
           AND ca.is_data_qc = 1
          ${statusClause}
          ${serviceClause}
        ORDER BY COALESCE(cmt.initiation_date, ca.created_at) DESC, csa.id DESC
      `;
      const rows = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

      const pendingRows = await sequelize.query(
        `SELECT * FROM vendor_correction_requests WHERE vendor_id = ?`,
        { replacements: [vendorId], type: QueryTypes.SELECT }
      );
      const requestsByAllocation = new Map();
      pendingRows.forEach((request) => {
        const list = requestsByAllocation.get(request.case_service_allocation_id) || [];
        list.push(request);
        requestsByAllocation.set(request.case_service_allocation_id, list);
      });

      const fileHost = await getBackendFileHost();
      const cases = rows.map((row) => ({
        ...row,
        vendor_report_url: buildPublicFileUrl(row.vendor_report_path, fileHost),
        attachment_url: buildPublicFileUrl(row.attachment_path, fileHost),
        correction_requests: requestsByAllocation.get(row.allocation_id) || [],
      }));
      callback(null, cases);
    } catch (error) {
      callback(error, null);
    }
  },

  // distinct list of services currently allocated to a vendor — for the filter dropdown
  listVendorServices: async (vendorId, callback) => {
    try {
      const rows = await sequelize.query(
        `SELECT DISTINCT service_id, service_title
         FROM case_service_allocations
         WHERE vendor_id = ?
         ORDER BY service_title ASC`,
        { replacements: [vendorId], type: QueryTypes.SELECT }
      );
      callback(null, rows);
    } catch (error) {
      callback(error, null);
    }
  },

  acceptCase: async (vendorId, allocationId, callback) => {
    try {
      const result = await sequelize.query(
        `UPDATE case_service_allocations
         SET vendor_case_status = 'accepted', vendor_accepted_at = NOW()
         WHERE id = ? AND vendor_id = ? AND vendor_case_enabled = 1`,
        { replacements: [allocationId, vendorId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },

  saveReport: async (vendorId, allocationId, reportPath, callback) => {
    try {
      const result = await sequelize.query(
        `UPDATE case_service_allocations
       SET vendor_report_path = ?, vendor_report_uploaded_at = NOW(),
           vendor_upload_enabled = 0
       WHERE id = ? AND vendor_id = ? AND vendor_case_enabled = 1 AND vendor_upload_enabled = 1`,
        { replacements: [reportPath, allocationId, vendorId], type: QueryTypes.UPDATE }
      );
      callback(null, result); // result[1] === 0 means blocked (already uploaded/disabled)
    } catch (error) { callback(error, null); }
  },
  updateUploadAccess: async (allocationId, enabled, callback) => {
    try {
      const result = await sequelize.query(
        `UPDATE case_service_allocations SET vendor_upload_enabled = ? WHERE id = ?`,
        { replacements: [enabled ? 1 : 0, allocationId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) { callback(error, null); }
  },

  updateVerifiedDate: async (vendorId, allocationId, verifiedDate, callback) => {
    try {
      const result = await sequelize.query(
        `UPDATE case_service_allocations
         SET vendor_verified_date = ?
         WHERE id = ? AND vendor_id = ? AND vendor_case_enabled = 1`,
        { replacements: [verifiedDate || null, allocationId, vendorId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },

completeCase: async (vendorId, allocationId, callback) => {
    try {
      const result = await sequelize.query(
        `UPDATE case_service_allocations
         SET vendor_case_status = 'completed', verification_status = 'COMPLETED'
         WHERE id = ? AND vendor_id = ? AND vendor_case_enabled = 1
           AND vendor_report_path IS NOT NULL AND TRIM(vendor_report_path) != ''
           AND vendor_verified_date IS NOT NULL`,
        { replacements: [allocationId, vendorId], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },
};

module.exports = { CaseServiceAllocation, writeCandidateFieldValue, resolveCandidateColumn, getCmtColumns, VERIFICATION_STATUS_VALUES };