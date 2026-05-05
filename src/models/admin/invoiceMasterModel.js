const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const Service = {
  create: async (
    customer_id,
    month,
    year,
    orgenization_name,
    gst_number,
    state,
    state_code,
    invoice_date,
    invoice_number,
    taxable_value,
    cgst,
    sgst,
    igst,
    total_gst,
    invoice_subtotal,
    callback
  ) => {
    const checkTableSql = `SHOW TABLES LIKE 'invoice_masters'`;
    const tableResults = await sequelize.query(checkTableSql, {
      type: QueryTypes.SHOW,
    });

    if (tableResults.length === 0) {
      createInvoiceTable(callback); // Create table if not exists
    } else {
      proceedWithInsertOrUpdate(callback); // Proceed to insert or update
    }

    // Function to create the 'invoice_masters' table
    async function createInvoiceTable(callback) {
      const createTableSql = `
        CREATE TABLE \`invoice_masters\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`customer_id\` INT NOT NULL,
          \`month\` INT NOT NULL,
          \`year\` INT NOT NULL,
          \`orgenization_name\` VARCHAR(255) NOT NULL,
          \`gst_number\` VARCHAR(255) NOT NULL,
          \`state\` VARCHAR(255) NOT NULL,
          \`state_code\` VARCHAR(155) NOT NULL,
          \`invoice_date\` DATE NOT NULL,
          \`invoice_number\` VARCHAR(255) NOT NULL,
          \`taxable_value\` DECIMAL(15, 2) NOT NULL,
          \`cgst\` DECIMAL(15, 2) NOT NULL,
          \`sgst\` DECIMAL(15, 2) NOT NULL,
          \`igst\` DECIMAL(15, 2) NOT NULL,
          \`total_gst\` DECIMAL(15, 2) NOT NULL,
          \`invoice_subtotal\` DECIMAL(15, 2) NOT NULL,
          \`due_date\` DATE NOT NULL,
          \`payment_status\` VARCHAR(50) NOT NULL,
          \`received_date\` DATE NOT NULL,
          \`tds_percentage\` DECIMAL(5, 2) NOT NULL,
          \`tds_deducted\` DECIMAL(15, 2) NOT NULL,
          \`ammount_received\` DECIMAL(15, 2) NOT NULL,
          \`balance_payment\` DECIMAL(15, 2) NOT NULL,
          \`payment_remarks\` TEXT,
          \`created_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY \`customer_id\` (\`customer_id\`),
          CONSTRAINT \`fk_invoice_masters_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await sequelize.query(createTableSql, {
        replacements: [username, username], // Positional replacements using ?
        type: QueryTypes.CREATE,
      });

      proceedWithInsertOrUpdate(callback); // Proceed after table creation
    }

    // Function to proceed with insert or update
    async function proceedWithInsertOrUpdate(callback) {
      const checkInvoiceSql = `
        SELECT * FROM \`invoice_masters\` WHERE \`customer_id\` = ? AND \`month\` = ? AND \`year\` = ?
      `;
      const invoiceResults = await sequelize.query(checkInvoiceSql, {
        replacements: [customer_id, month, year], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      if (invoiceResults.length > 0) {
        updateInvoice(callback); // Update existing invoice if found
      } else {
        insertInvoice(callback); // Insert new invoice if not found
      }
    }

    // Function to update the invoice
    async function updateInvoice(callback) {
      const updateInvoiceSql = `
        UPDATE \`invoice_masters\` SET
          \`orgenization_name\` = ?,
          \`gst_number\` = ?,
          \`state\` = ?,
          \`state_code\` = ?,
          \`invoice_date\` = ?,
          \`invoice_number\` = ?,
          \`taxable_value\` = ?,
          \`cgst\` = ?,
          \`sgst\` = ?,
          \`igst\` = ?,
          \`total_gst\` = ?,
          \`invoice_subtotal\` = ?
        WHERE \`customer_id\` = ? AND \`month\` = ? AND \`year\` = ?
      `;
      const results = await sequelize.query(updateInvoiceSql, {
        replacements: [
          orgenization_name,
          gst_number,
          state,
          state_code,
          invoice_date,
          invoice_number,
          taxable_value,
          cgst,
          sgst,
          igst,
          total_gst,
          invoice_subtotal,
          customer_id,
          month,
          year,
        ], // Positional replacements using ?
        type: QueryTypes.UPDATE,
      });
      callback(null, { insertId: results.insertId, type: "Updated" });
    }

    // Function to insert a new invoice
    async function insertInvoice(callback) {
      const insertInvoiceSql = `
        INSERT INTO \`invoice_masters\` (
          \`customer_id\`, \`month\`, \`year\`, \`orgenization_name\`, \`gst_number\`, \`state\`, \`state_code\`,
          \`invoice_date\`, \`invoice_number\`, \`taxable_value\`, \`cgst\`, \`sgst\`, \`igst\`, \`total_gst\`,
          \`invoice_subtotal\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const results = await sequelize.query(insertInvoiceSql, {
        replacements: [
          customer_id,
          month,
          year,
          orgenization_name,
          gst_number,
          state,
          state_code,
          invoice_date,
          invoice_number,
          taxable_value,
          cgst,
          sgst,
          igst,
          total_gst,
          invoice_subtotal,
        ], // Positional replacements using ?
        type: QueryTypes.INSERT,
      });
      callback(null, { insertId: results.insertId, type: "Created" });
    }
  },

  list: async (callback) => {
    const sql = `
        SELECT 
            IM.*, 
            C.name AS customer_name 
        FROM invoice_masters AS IM 
        INNER JOIN customers AS C ON C.id = IM.customer_id 
        WHERE C.is_deleted != 1 
        ORDER BY IM.created_at DESC
    `;

    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  },

  getById: async (id, callback) => {
    try {
      const sql = `
        SELECT 
          IM.*, 
          C.name AS customer_name 
        FROM invoice_masters AS IM 
        INNER JOIN customers AS C ON C.id = IM.customer_id 
        WHERE C.is_deleted != 1 
          AND IM.id = :id
        LIMIT 1
      `;

      const results = await sequelize.query(sql, {
        replacements: { id },
        type: QueryTypes.SELECT,
      });

      callback(null, results.length ? results[0] : null);
    } catch (err) {
      callback(err, null);
    }
  },

  delete: async (id, callback) => {
    try {
      const sql = `
      DELETE FROM invoice_masters
      WHERE id = :id
    `;

      const result = await sequelize.query(sql, {
        replacements: { id },
        type: QueryTypes.DELETE, // <-- use DELETE instead of UPDATE
      });

      callback(null, result);
    } catch (err) {
      callback(err, null);
    }
  },

  update: async (
    id,
    year,
    month,
    due_date,
    customer_id,
    tds_deducted,
    received_date,
    payment_status,
    tds_percentage,
    payment_remarks,
    balance_payment,
    ammount_received,
    callback
  ) => {
    // Define the update SQL query with placeholders
    const updateInvoiceSql = `
      UPDATE \`invoice_masters\` SET
        \`due_date\` = ?,
        \`tds_deducted\` = ?,
        \`received_date\` = ?,
        \`payment_status\` = ?,
        \`tds_percentage\` = ?,
        \`payment_remarks\` = ?,
        \`balance_payment\` = ?,
        \`ammount_received\` = ?
      WHERE \`id\` = ? AND \`customer_id\` = ? AND \`month\` = ? AND \`year\` = ?
    `;

    const results = await sequelize.query(updateInvoiceSql, {
      replacements: [
        due_date,
        tds_deducted,
        received_date,
        payment_status,
        tds_percentage,
        payment_remarks,
        balance_payment,
        ammount_received,
        id, // Add the `id` to the query
        customer_id,
        month,
        year,
      ], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    if (results[1] > 0) {
      callback(null, {
        status: true,
        message: "Invoice updated successfully.",
      });
    } else {
      callback({ error: "Record not found." }, null);
    }
  },
};

module.exports = Service;
