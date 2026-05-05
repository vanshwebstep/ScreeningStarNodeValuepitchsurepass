const ExpenseTrackerModel = require("../../models/admin/expenseTrackerModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

const expenseTrackerController = {
  create: (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
      admin_id,
      _token,
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
    } = req.body;

    console.log("REQ.BODY:", req.body);

    // Validate required fields
    const requiredFields = {
      admin_id,
      _token,
      invoice_date,
      invoice_number,
      vendor_name,
      invoice_value,
    };

    const missingFields = Object.keys(requiredFields)
      .filter(
        (key) =>
          requiredFields[key] === undefined ||
          requiredFields[key] === null ||
          requiredFields[key] === ""
      )
      .map((key) => key.replace(/_/g, " "));

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const action = "billing_dashboard";

    Common.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
      if (!authResult.status) {
        return res.status(403).json({
          status: false,
          message: authResult.message,
        });
      }

      Common.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
        if (err) {
          console.error("Token validation error:", err);
          return res.status(500).json({ status: false, message: err.message });
        }

        if (!tokenResult.status) {
          return res
            .status(401)
            .json({ status: false, message: tokenResult.message });
        }

        const newToken = tokenResult.newToken;

        ExpenseTrackerModel.create(
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
          async (err, result) => {
            if (err) {
              console.error("DB Error:", err);
              Common.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Expense Tracker",
                "Create",
                "0",
                null,
                err,
                () => {}
              );
              return res.status(500).json({
                status: false,
                message: "Failed to create invoice.",
                error: err.message,
                token: newToken,
              });
            }

            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Expense Tracker",
              "Create",
              "1",
              `{id: ${result.insertId}}`,
              null,
              () => {}
            );

            return res.status(200).json({
              status: true,
              message: "Invoice created successfully.",
              data: result,
              token: newToken,
            });
          }
        );
      });
    });
  },

  list: (req, res) => {
  const { admin_id, _token } = req.query;

  // ✅ Define missing variables
  const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const ipType = req.protocol;

  let missingFields = [];
  if (!admin_id || admin_id === "" || admin_id === "undefined") {
    missingFields.push("Admin ID");
  }

  if (!_token || _token === "" || _token === "undefined") {
    missingFields.push("Token");
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "billing_dashboard";

  Common.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        message: authResult.message,
      });
    }

    Common.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Token validation error:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!tokenResult.status) {
        return res
          .status(401)
          .json({ status: false, message: tokenResult.message });
      }

      const newToken = tokenResult.newToken;

      ExpenseTrackerModel.list((err, results) => {
        if (err) {
          console.error("List fetch error:", err);
          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Expense Tracker",
            "List",
            "0",
            null,
            err,
            () => {}
          );
          return res.status(500).json({
            status: false,
            message: "Failed to fetch expense list.",
            error: err.message,
            token: newToken,
          });
        }

        Common.adminActivityLog(
          ipAddress,
          ipType,
          admin_id,
          "Expense Tracker",
          "List",
          "1",
          null,
          null,
          () => {}
        );

        return res.status(200).json({
          status: true,
          message: "Expense list fetched successfully.",
          data: {
            customers: results,
          },
          token: newToken,
        });
      });
    });
  });
},

getUpdateById: (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { admin_id, _token, id } = req.body;

  if (!admin_id || !_token) {
    return res.status(400).json({
      status: false,
      message: "admin_id and _token are required.",
    });
  }

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "ID is required to fetch invoice.",
    });
  }

  const action = "billing_dashboard";

  Common.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        message: authResult.message,
      });
    }

    Common.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Token validation error:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!tokenResult.status) {
        return res.status(401).json({
          status: false,
          message: tokenResult.message,
        });
      }

      const newToken = tokenResult.newToken;

      ExpenseTrackerModel.getById(id, async (err, result) => {
        if (err) {
          console.error("Fetch error:", err);
          return res.status(500).json({
            status: false,
            message: "Failed to retrieve invoice.",
            error: err.message,
            token: newToken,
          });
        }

        if (!result) {
          return res.status(404).json({
            status: false,
            message: "Invoice not found.",
            token: newToken,
          });
        }

        await Common.adminActivityLog(
          ipAddress,
          ipType,
          admin_id,
          "Expense Tracker",
          "Fetch",
          "1",
          `{id: ${id}}`,
          null,
          () => {}
        );

        return res.status(200).json({
          status: true,
          message: "Invoice fetched successfully.",
          data: result,
          token: newToken,
        });
      });
    });
  });
},



 update: (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    admin_id,
    _token,
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
  } = req.body;

  if (!admin_id || !_token) {
    return res.status(400).json({
      status: false,
      message: "admin_id and _token are required.",
    });
  }

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "ID is required for update.",
    });
  }

  const action = "billing_dashboard";

  Common.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        message: authResult.message,
      });
    }

    Common.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Token validation error:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!tokenResult.status) {
        return res.status(401).json({
          status: false,
          message: tokenResult.message,
        });
      }

      const newToken = tokenResult.newToken;

      ExpenseTrackerModel.update(
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
        async (err, result) => {
          if (err) {
            console.error("Update error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Expense Tracker",
              "Update",
              "0",
              `{id: ${id}}`,
              err,
              () => {}
            );
            return res.status(500).json({
              status: false,
              message: "Failed to update invoice.",
              error: err.message,
              token: newToken,
            });
          }

          await Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Expense Tracker",
            "Update",
            "1",
            `{id: ${id}}`,
            null,
            () => {}
          );

          return res.status(200).json({
            status: true,
            message: "Invoice updated successfully.",
            data: result,
            token: newToken,
          });
        }
      );
    });
  });
},


  delete: (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);
    const { admin_id, _token, id } = req.body;

    // Validate required fields
    if (!admin_id || !_token || !id) {
      return res.status(400).json({
        status: false,
        message: "Missing required fields: admin_id, _token, id",
      });
    }

    const action = "billing_dashboard";

    Common.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
      if (!authResult.status) {
        return res.status(403).json({
          status: false,
          message: authResult.message,
        });
      }

      Common.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
        if (err) {
          console.error("Token validation error:", err);
          return res.status(500).json({ status: false, message: err.message });
        }

        if (!tokenResult.status) {
          return res
            .status(401)
            .json({ status: false, message: tokenResult.message });
        }

        const newToken = tokenResult.newToken;

        ExpenseTrackerModel.delete(id, async (err, result) => {
          if (err) {
            console.error("Delete error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Expense Tracker",
              "Delete",
              "0",
              `{id: ${id}}`,
              err,
              () => {}
            );
            return res.status(500).json({
              status: false,
              message: "Failed to delete invoice.",
              error: err.message,
              token: newToken,
            });
          }

          // Log successful deletion
          await Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Expense Tracker",
            "Delete",
            "1",
            `{id: ${id}}`,
            null,
            () => {}
          );

          return res.status(200).json({
            status: true,
            message: "Expense deleted successfully.",
            token: newToken,
            data: result,
          });
        });
      });
    });
  },
};

module.exports = expenseTrackerController;
