const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

const ALLOWED_FIELDS = ["father_name", "address", "state", "pin_code"];

const VendorCorrection = {
  isFieldAllowed: (fieldName) => ALLOWED_FIELDS.includes(String(fieldName || "").toLowerCase()),

  create: async ({ case_service_allocation_id, client_application_id, vendor_id, field_name, old_value, proposed_value }, callback) => {
    try {
      const result = await sequelize.query(
        `INSERT INTO vendor_correction_requests
          (case_service_allocation_id, client_application_id, vendor_id, field_name, old_value, proposed_value, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        {
          replacements: [case_service_allocation_id, client_application_id, vendor_id, field_name, old_value || null, proposed_value],
          type: QueryTypes.INSERT,
        }
      );
      callback(null, { insertId: result[0] });
    } catch (error) {
      callback(error, null);
    }
  },

  findById: async (id, callback) => {
    try {
      const rows = await sequelize.query(
        `SELECT * FROM vendor_correction_requests WHERE id = ? LIMIT 1`,
        { replacements: [id], type: QueryTypes.SELECT }
      );
      callback(null, rows[0] || null);
    } catch (error) {
      callback(error, null);
    }
  },

  review: async (id, { status, admin_final_value, reviewed_by }, callback) => {
    try {
      const result = await sequelize.query(
        `UPDATE vendor_correction_requests
         SET status = ?, admin_final_value = ?, reviewed_by = ?, reviewed_at = NOW()
         WHERE id = ? AND status = 'pending'`,
        { replacements: [status, admin_final_value ?? null, reviewed_by, id], type: QueryTypes.UPDATE }
      );
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  },

  listPendingForAdmin: async (callback) => {
    try {
      const rows = await sequelize.query(
        `SELECT vcr.*, csa.service_title, csa.client_application_id, ca.application_id, ca.name AS applicant_name
         FROM vendor_correction_requests vcr
         INNER JOIN case_service_allocations csa ON csa.id = vcr.case_service_allocation_id
         INNER JOIN client_applications ca ON ca.id = vcr.client_application_id
         WHERE vcr.status = 'pending'
         ORDER BY vcr.created_at DESC`,
        { type: QueryTypes.SELECT }
      );
      callback(null, rows);
    } catch (error) {
      callback(error, null);
    }
  },
};

module.exports = VendorCorrection;