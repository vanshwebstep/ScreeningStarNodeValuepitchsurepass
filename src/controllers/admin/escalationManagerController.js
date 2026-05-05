const EscalationManager = require("../../models/admin/escalationManagerModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to create a new Escalation Manager
exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { name, designation, phone, email, admin_id, _token } = req.body;

  let missingFields = [];
  if (!name || name === "") missingFields.push("Name");
  if (!designation || designation === "") missingFields.push("designation");
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

      EscalationManager.checkEmailExists(email, (err, emailExists) => {
        if (err) {
          console.error("Error checking email existence:", err);
          return res
            .status(500)
            .json({ status: false, message: "Internal server error", token: newToken });
        }

        if (emailExists) {
          return res.status(401).json({
            status: false,
            message: "Email already used for another Escalation Manager", token: newToken
          });
        }

        EscalationManager.create(
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
                "Escalation Manager",
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
              "Escalation Manager",
              "Create",
              "1",
              `{id: ${result.insertId}}`,
              null,
              () => { }
            );

            res.json({
              status: true,
              message: "Escalation Manager created successfully",
              escalation_manager: result,
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

      EscalationManager.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        res.json({
          status: true,
          message: "Escalation Manager fetched successfully",
          escalation_managers: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.getEscalationManagerById = (req, res) => {
  const { id, admin_id, _token } = req.query;
  let missingFields = [];
  if (!id || id === "") missingFields.push("Escalation Manager ID");
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

      EscalationManager.getEscalationManagerById(
        id,
        (err, currentEscalationManager) => {
          if (err) {
            console.error("Error fetching Escalation Manager data:", err);
            return res.status(500).json({
              status: false,
              message: err.message,
              token: newToken,
            });
          }

          if (!currentEscalationManager) {
            return res.status(404).json({
              status: false,
              message: "Escalation Manager not found",
              token: newToken,
            });
          }

          res.json({
            status: true,
            message: "Escalation Manager retrieved successfully",
            escalation_manager: currentEscalationManager,
            token: newToken,
          });
        }
      );
    });
  });
};

// Controller to name a Escalation Manager
exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, name, designation, phone, email, admin_id, _token } = req.body;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Escalation Manager ID");
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

      EscalationManager.getEscalationManagerById(
        id,
        (err, currentEscalationManager) => {
          if (err) {
            console.error("Error fetching Escalation Manager data:", err);
            return res.status(500).json({
              status: false,
              message: err.message,
              token: newToken,
            });
          }

          const changes = {};
          if (currentEscalationManager.name !== name) {
            changes.name = {
              old: currentEscalationManager.name,
              new: name,
            };
          }
          if (currentEscalationManager.designation !== designation) {
            changes.designation = {
              old: currentEscalationManager.designation,
              new: designation,
            };
          }

          EscalationManager.update(
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
                  "Escalation Manager",
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
                "Escalation Manager",
                "Update",
                "1",
                JSON.stringify({ id, ...changes }),
                null,
                () => { }
              );

              res.json({
                status: true,
                message: "Escalation Manager named successfully",
                escalation_manager: result,
                token: newToken,
              });
            }
          );
        }
      );
    });
  });
};

// Controller to delete a Escalation Manager
exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, admin_id, _token } = req.query;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Escalation Manager ID");
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

      EscalationManager.getEscalationManagerById(
        id,
        (err, currentEscalationManager) => {
          if (err) {
            console.error("Error fetching Escalation Manager data:", err);
            return res.status(500).json({
              status: false,
              message: err.message,
              token: newToken,
            });
          }

          EscalationManager.delete(id, (err, result) => {
            if (err) {
              console.error("Database error:", err);
              Common.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Escalation Manager",
                "Delete",
                "0",
                JSON.stringify({ id, ...currentEscalationManager }),
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
              "Escalation Manager",
              "Delete",
              "1",
              JSON.stringify(currentEscalationManager),
              null,
              () => { }
            );

            res.json({
              status: true,
              message: "Escalation Manager deleted successfully",
              token: newToken,
            });
          });
        }
      );
    });
  });
};
