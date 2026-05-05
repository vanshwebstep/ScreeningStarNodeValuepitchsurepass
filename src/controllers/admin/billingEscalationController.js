const BillingEscalation = require("../../models/admin/billingEscalationModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to create a new billing escalation
exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const { name, designation, phone, email, admin_id, _token } = req.body;

  let missingFields = [];
  if (!name || name === "") missingFields.push("Name");
  if (!designation || designation === "") missingFields.push("Designation");
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
        err: result,
        message: result.message, // Return the message from the authorization function
      });
    }

    Common.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json(err);
      }

      if (!result.status) {
        return res
          .status(401)
          .json({ status: false, err: result, message: result.message });
      }

      const newToken = result.newToken;

      BillingEscalation.checkEmailExists(email, (err, emailExists) => {
        if (err) {
          console.error("Error checking email existence:", err);
          return res
            .status(500)
            .json({
              status: false, message: "Internal server error",
              token: newToken,
            });
        }

        if (emailExists) {
          return res.status(401).json({
            status: false,
            message: "Email already used for another billing escalation",
            token: newToken,
          });
        }

        BillingEscalation.create(
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
                "Billing Escalation",
                "Create",
                "0",
                null,
                err,
                () => { }
              );
              return res.status(500).json({
                status: false,
                err,
                message: err.message,
                token: newToken,
              });
            }

            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Billing Escalation",
              "Create",
              "1",
              `{id: ${result.insertId}}`,
              null,
              () => { }
            );

            res.json({
              status: true,
              message: "Billing escalation created successfully",
              billing_escalation: result,
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

      BillingEscalation.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        res.json({
          status: true,
          message: "Billing Escalations fetched successfully",
          billing_escalations: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.getBillingEscalationById = (req, res) => {
  const { id, admin_id, _token } = req.query;
  let missingFields = [];
  if (!id || id === "") missingFields.push("Billing escalation ID");
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

      BillingEscalation.getBillingEscalationById(
        id,
        (err, currentBillingEscalation) => {
          if (err) {
            console.error("Error fetching billing escalation data:", err);
            return res.status(500).json({
              status: false,
              message: err.message,
              token: newToken,
            });
          }

          if (!currentBillingEscalation) {
            return res.status(404).json({
              status: false,
              message: "Billing escalation not found",
              token: newToken,
            });
          }

          res.json({
            status: true,
            message: "Billing escalation retrieved successfully",
            billing_escalation: currentBillingEscalation,
            token: newToken,
          });
        }
      );
    });
  });
};

// Controller to update a billing escalation
exports.update = (req, res) => {
  const { id, name, designation, phone, email, admin_id, _token } = req.body;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Billing escalation ID");
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

      BillingEscalation.getBillingEscalationById(
        id,
        (err, currentBillingEscalation) => {
          if (err) {
            console.error("Error fetching billing escalation data:", err);
            return res.status(500).json({
              status: false,
              message: err.message,
              token: newToken,
            });
          }

          const changes = {};
          if (currentBillingEscalation.name !== name) {
            changes.name = {
              old: currentBillingEscalation.name,
              new: name,
            };
          }
          if (currentBillingEscalation.designation !== designation) {
            changes.designation = {
              old: currentBillingEscalation.designation,
              new: designation,
            };
          }

          BillingEscalation.update(
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
                  "Billing Escalation",
                  "Update",
                  "0",
                  JSON.stringify({ id, ...changes }),
                  err,
                  () => { }
                );
                return res.status(500).json({
                  status: false,
                  message: err.message,
                  token: newToken,
                });
              }

              Common.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Billing Escalation",
                "Update",
                "1",
                JSON.stringify({ id, ...changes }),
                null,
                () => { }
              );

              return res.json({
                status: true,
                message: "Billing escalation updated successfully",
                billing_escalation: result,
                token: newToken,
              });
            }
          );
        }
      );
    });
  });
};

// Controller to delete a billing escalation
exports.delete = (req, res) => {
  const { id, admin_id, _token } = req.query;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Billing escalation ID");
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

      BillingEscalation.getBillingEscalationById(
        id,
        (err, currentBillingEscalation) => {
          if (err) {
            console.error("Error fetching billing escalation data:", err);
            return res.status(500).json({
              status: false,
              message: err.message,
              token: newToken,
            });
          }

          BillingEscalation.delete(id, (err, result) => {
            if (err) {
              console.error("Database error:", err);
              Common.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Billing Escalation",
                "Delete",
                "0",
                JSON.stringify({ id, ...currentBillingEscalation }),
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
              "Billing Escalation",
              "Delete",
              "1",
              JSON.stringify(currentBillingEscalation),
              null,
              () => { }
            );

            return res.json({
              status: true,
              message: "Billing escalation deleted successfully",
              token: newToken,
            });
          });
        }
      );
    });
  });
};
