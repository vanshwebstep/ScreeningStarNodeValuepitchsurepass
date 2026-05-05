const invoiceMaster = require("../../models/admin/invoiceMasterModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to create a new service
exports.sendData = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    admin_id,
    _token,
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
  } = req.body;

  // Define required fields for creating a new admin
  const requiredFields = {
    admin_id,
    _token,
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
  };

  // Check for missing fields
  const missingFields = Object.keys(requiredFields)
    .filter((field) => {
      const value = requiredFields[field];
      // Exclude 0 values for cgst, sgst, igst
      return value === null || value === undefined || value === "";
    })
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "billing_dashboard";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      // Check the status returned by the authorization function
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    Common.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json(err);
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      invoiceMaster.create(
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
        (err, result) => {
          if (err) {
            console.error("Database error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Service",
              "Create/Update",
              "0",
              null,
              err,
              () => { }
            );
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Invoice Master",
            result.type,
            "1",
            `{id: ${result.insertId}}`,
            null,
            () => { }
          );

          return res.json({
            status: true,
            message: `Invoice Master Successfully ${result.type}`,
            token: newToken,
          });
        }
      );
    });
  });
};

exports.list = (req, res) => {
  const { admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !admin_id ||
    admin_id === "" ||
    admin_id === undefined ||
    admin_id === "undefined"
  ) {
    missingFields.push("Admin ID");
  }

  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  ) {
    missingFields.push("Token");
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "billing_dashboard";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    Common.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;
      // Fetch customer list with filter status
      invoiceMaster.list((err, invoiceMasterResult) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            err,
            message: err.message,
            token: newToken,
          });
        }

        // Respond with the fetched customer data
        return res.json({
          status: true,
          message: "Invoice master fetched successfully",
          invoice: invoiceMasterResult,
          totalInvoice: invoiceMasterResult.length,
          token: newToken,
        });
      });
    });
  });
};

exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const { id, admin_id, _token } = req.query;

  // Validate required fields
  const missingFields = [];
  if (!id) missingFields.push("Invoice Master ID");
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "billing_dashboard";

  // Step 1: Check if admin is authorized for this action
  Common.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        message: authResult.message,
      });
    }

    // Step 2: Validate admin token
    Common.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Token validation error:", err);
        return res.status(500).json({ status: false, message: "Internal server error during token validation." });
      }

      if (!tokenResult.status) {
        return res.status(401).json({
          status: false,
          message: tokenResult.message,
        });
      }

      const newToken = tokenResult.newToken;

      // Step 3: Verify if invoice master exists
      invoiceMaster.getById(id, (err, currentInvoiceMaster) => {
        if (err) {
          console.error("DB error while fetching Invoice Master:", err);
          return res.status(500).json({
            status: false,
            message: "Unable to fetch Invoice Master. Please try again later.",
            token: newToken,
          });
        }

        if (!currentInvoiceMaster) {
          return res.status(404).json({
            status: false,
            message: "Invoice Master not found.",
            token: newToken,
          });
        }

        // Step 4: Perform soft delete
        invoiceMaster.delete(id, (err, deleteResult) => {
          if (err) {
            console.error("DB error during Invoice Master deletion:", err);

            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Invoice Master",
              "Delete",
              "0",
              null,
              err,
              () => { }
            );

            return res.status(500).json({
              status: false,
              message: "Failed to delete Invoice Master. Please try again.",
              token: newToken,
              error: err
            });
          }

          // Log successful deletion
          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Invoice Master",
            "Delete",
            "1",
            JSON.stringify({ id }),
            null,
            () => { }
          );

          return res.status(200).json({
            status: true,
            message: "Invoice Master deleted successfully.",
            token: newToken,
          });
        });
      });
    });
  });
};

exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    admin_id,
    _token,
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
  } = req.body;

  // Define required fields for creating a new admin
  const requiredFields = {
    admin_id,
    _token,
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
  };

  // Check for missing fields
  const missingFields = Object.keys(requiredFields)
    .filter((field) => {
      const value = requiredFields[field];
      // Exclude 0 values for cgst, sgst, igst
      return value === null || value === undefined || value === "";
    })
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "billing_dashboard";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      // Check the status returned by the authorization function
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    Common.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json(err);
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      invoiceMaster.update(
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
        (err, result) => {
          if (err) {
            console.error("Database error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Invoice Master",
              "Update",
              "0",
              null,
              err,
              () => { }
            );
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Invoice Master",
            "update",
            "1",
            `{id: ${result.insertId}}`,
            null,
            () => { }
          );

          return res.json({
            status: true,
            message: `Invoice Master Successfully Updated`,
            token: newToken,
          });
        }
      );
    });
  });
};
