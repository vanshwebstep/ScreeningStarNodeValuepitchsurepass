const BillingSpoc = require("../../models/admin/billingSpocModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to create a new billing spoc
exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const { name, designation, phone, email, admin_id, _token } = req.body;

  let missingFields = [];
  if (!name || name === "") missingFields.push("Name");
  if (!designation || designation === "") missingFields.push("Sesignation");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");
  if (!phone || phone === "") missingFields.push("Phone");
  if (!email || email === "") missingFields.push("Email");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "client_overview";
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

      BillingSpoc.checkEmailExists(email, (err, emailExists) => {
        if (err) {
          console.error("Error checking email existence:", err);
          return res
            .status(500)
            .json({ status: false, message: "Internal server error", token: newToken });
        }

        if (emailExists) {
          return res.status(401).json({
            status: false,
            message: "Email already used for another billing SPOC",
            token: newToken
          });
        }

        BillingSpoc.create(
          name,
          designation,
          phone,
          email,
          admin_id,
          (err, result) => {
            if (err) {
              console.error("Database error:", err);
              Common.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Billing SPOC",
                "Create",
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
              "Billing SPOC",
              "Create",
              "1",
              `{id: ${result.insertId}}`,
              null,
              () => { }
            );

            res.json({
              status: true,
              message: "Billing SPOC created successfully",
              billing_spoc: result,
              token: newToken,
            });
          }
        );
      });
    });
  });
};

// Controller to list all Billing SPOCs
exports.list = (req, res) => {
  const { admin_id, _token } = req.query;

  let missingFields = [];
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const action = "client_overview";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
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

      BillingSpoc.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        res.json({
          status: true,
          message: "Billing SPOCs fetched successfully",
          billing_spocs: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.getBillingSpocById = (req, res) => {
  const { id, admin_id, _token } = req.query;
  let missingFields = [];
  if (!id || id === "") missingFields.push("Billing SPOC ID");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const action = "client_overview";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
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

      BillingSpoc.getBillingSpocById(id, (err, currentBillingSpoc) => {
        if (err) {
          console.error("Error fetching billing spoc data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        if (!currentBillingSpoc) {
          return res.status(404).json({
            status: false,
            message: "Billing SPOC not found",
            token: newToken,
          });
        }

        res.json({
          status: true,
          message: "Billing SPOC retrieved successfully",
          billing_spoc: currentBillingSpoc,
          token: newToken,
        });
      });
    });
  });
};

// Controller to update a billing spoc
exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, name, designation, phone, email, admin_id, _token } = req.body;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Billing SPOC ID");
  if (!name || name === "") missingFields.push("Name");
  if (!designation || designation === "") missingFields.push("Description");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");
  if (!phone || phone === "") missingFields.push("Phone");
  if (!email || email === "") missingFields.push("Email");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const action = "client_overview";
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

      BillingSpoc.getBillingSpocById(id, (err, currentBillingSpoc) => {
        if (err) {
          console.error("Error fetching billing spoc data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        const changes = {};
        if (currentBillingSpoc.name !== name) {
          changes.name = {
            old: currentBillingSpoc.name,
            new: name,
          };
        }
        if (currentBillingSpoc.designation !== designation) {
          changes.designation = {
            old: currentBillingSpoc.designation,
            new: designation,
          };
        }

        BillingSpoc.update(
          id,
          name,
          designation,
          phone,
          email,
          (err, result) => {
            if (err) {
              console.error("Database error:", err);
              Common.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Billing SPOC",
                "Update",
                "0",
                JSON.stringify({ id, ...changes }),
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
              "Billing SPOC",
              "Update",
              "1",
              JSON.stringify({ id, ...changes }),
              null,
              () => { }
            );

            res.json({
              status: true,
              message: "Billing SPOC updated successfully",
              billing_spoc: result,
              token: newToken,
            });
          }
        );
      });
    });
  });
};

// Controller to delete a billing spoc
exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const { id, admin_id, _token } = req.query;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Billing SPOC ID");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const action = "client_overview";
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

      BillingSpoc.getBillingSpocById(id, (err, currentBillingSpoc) => {
        if (err) {
          console.error("Error fetching billing spoc data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        BillingSpoc.delete(id, (err, result) => {
          if (err) {
            console.error("Database error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Billing SPOC",
              "Delete",
              "0",
              JSON.stringify({ id, ...currentBillingSpoc }),
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
            "Billing SPOC",
            "Delete",
            "1",
            JSON.stringify(currentBillingSpoc),
            null,
            () => { }
          );

          res.json({
            status: true,
            message: "Billing SPOC deleted successfully",
            token: newToken,
          });
        });
      });
    });
  });
};
