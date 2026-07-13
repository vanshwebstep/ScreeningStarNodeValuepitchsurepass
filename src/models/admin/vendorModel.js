const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

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
  authorized_details, created_at, updated_at
`;

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
          gst = ?, tat = ?, agreement_date = ?, email_id = ?, password = ?, services = ?,
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

  list: async (callback) => {
    try {
      const rows = await sequelize.query(
        `SELECT ${publicColumns} FROM vendor_managements WHERE ${activeVendorClause} ORDER BY created_at DESC`,
        { type: QueryTypes.SELECT }
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
