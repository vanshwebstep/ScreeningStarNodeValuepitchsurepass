const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

const ExpenseTrackerModel = {
  create: async (
    invoice_date,
    invoice_number,
    vendor_name,
    invoice_value,
    gst_value,
    sub_total,
    tds_deduction,
    payable_mount,
    payment_status,
    date_of_payment,
    remarks,
    callback
  ) => {
    try {
      const sql = `
        INSERT INTO \`expense_tracker\` (
          \`invoice_date\`,
          \`invoice_number\`,
          \`vendor_name\`,
          \`invoice_value\`,
          \`gst_value\`,
          \`sub_total\`,
          \`tds_deduction\`,
          \`payable_mount\`,
          \`payment_status\`,
          \`date_of_payment\`,
          \`remarks\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,?,?,?)
      `;

      const [results] = await sequelize.query(sql, {
        replacements: [
          invoice_date,
          invoice_number,
          vendor_name,
          invoice_value,
          gst_value,
          sub_total,
          tds_deduction,
          payable_mount,
          payment_status,
          date_of_payment,
          remarks
        ],
        type: QueryTypes.INSERT,
      });

      callback(null, results);
    } catch (err) {
      console.error("Error inserting invoice:", err);
      callback(err, null);
    }
  },

  list: async (callback) => {
    try {
      const sql = `SELECT * FROM \`expense_tracker\``;
      const results = await sequelize.query(sql, {
        type: QueryTypes.SELECT,
      });
      callback(null, results);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      callback(err, null);
    }
  },

  getById: async (id, callback) => {
    try {
      const sql = `SELECT * FROM \`expense_tracker\` WHERE \`id\` = ?`;
      const results = await sequelize.query(sql, {
        replacements: [id],
        type: QueryTypes.SELECT,
      });

      callback(null, results[0]);
    } catch (err) {
      console.error("Error fetching invoice by ID:", err);
      callback(err, null);
    }
  },

  update: async (
    id,
    invoice_date,
    invoice_number,
    vendor_name,
    invoice_value,
    gst_value,
    sub_total,
    tds_deduction,
    payable_mount,
    payment_status,
    date_of_payment,
    remarks,
    callback
  ) => {
    try {
      const sql = `
       UPDATE \`expense_tracker\`
  SET
    \`invoice_date\` = ?,
    \`invoice_number\` = ?,
    \`vendor_name\` = ?,
    \`invoice_value\` = ?,
    \`gst_value\` = ?,
    \`sub_total\` = ?,
    \`tds_deduction\` = ?,
    \`payable_mount\` = ?,
    \`payment_status\` = ?,
    \`date_of_payment\` = ?,
    \`remarks\` = ?
  WHERE \`id\` = ?
`;

      const [results] = await sequelize.query(sql, {
        replacements: [
          invoice_date,
          invoice_number,
          vendor_name,
          invoice_value,
          gst_value,
          sub_total,
          tds_deduction,
          payable_mount,
          payment_status,
          date_of_payment,
          remarks,
          id,
        ],
        type: QueryTypes.UPDATE,
      });

      callback(null, results);
    } catch (err) {
      console.error("Error updating invoice:", err);
      callback(err, null);
    }
  },

  delete: async (id, callback) => {
    try {
      const sql = `DELETE FROM \`expense_tracker\` WHERE \`id\` = ?`;

      const results = await sequelize.query(sql, {
        replacements: [id],
        type: QueryTypes.DELETE,
      });

      callback(null, results);
    } catch (err) {
      console.error("Error deleting invoice:", err);
      callback(err, null);
    }
  },
};

module.exports = ExpenseTrackerModel;
