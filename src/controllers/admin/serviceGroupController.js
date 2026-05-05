const ServiceGroup = require("../../models/admin/serviceGroupModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to create a new service
exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { title, symbol, admin_id, _token } = req.body;

  let missingFields = [];
  if (!title || title === "") missingFields.push("Title");
  if (!symbol || symbol === "") missingFields.push("Group Symbol");
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

      ServiceGroup.create(title, symbol, admin_id, (err, result) => {
        if (err) {
          console.error("Database error:", err);
          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Service Group",
            "Create",
            "0",
            null,
            err,
            () => {}
          );
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        Common.adminActivityLog(
          ipAddress,
          ipType,
          admin_id,
          "Service Group",
          "Create",
          "1",
          `{id: ${result.insertId}}`,
          null,
          () => {}
        );

        return res.json({
          status: true,
          message: "Service created successfully",
          service: result,
          token: newToken,
        });
      });
    });
  });
};

// Controller to list all services
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

      ServiceGroup.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        return res.json({
          status: true,
          message: "Services fetched successfully",
          services: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.getServiceGroupById = (req, res) => {
  const { id, admin_id, _token } = req.query;
  let missingFields = [];
  if (!id || id === "") missingFields.push("Service ID");
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

      ServiceGroup.getServiceGroupById(id, (err, currentServiceGroup) => {
        if (err) {
          console.error("Error fetching service data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        if (!currentServiceGroup) {
          return res.status(404).json({
            status: false,
            message: "Service Group not found",
            token: newToken,
          });
        }

        return res.json({
          status: true,
          message: "Service Group retrieved successfully",
          service: currentServiceGroup,
          token: newToken,
        });
      });
    });
  });
};

// Controller to update a service
exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, title, symbol, admin_id, _token } = req.body;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Service ID");
  if (!title || title === "") missingFields.push("Title");
  if (!symbol || symbol === "") missingFields.push("Group Symbol");
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

      ServiceGroup.getServiceGroupById(id, (err, currentServiceGroup) => {
        if (err) {
          console.error("Error fetching service data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        const changes = {};
        if (currentServiceGroup.title !== title) {
          changes.title = {
            old: currentServiceGroup.title,
            new: title,
          };
        }
        if (currentServiceGroup.symbol !== symbol) {
          changes.symbol = {
            old: currentServiceGroup.symbol,
            new: symbol,
          };
        }

        ServiceGroup.update(id, title, symbol, (err, result) => {
          if (err) {
            console.error("Database error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Service Group",
              "Update",
              "0",
              JSON.stringify({ id, ...changes }),
              err,
              () => {}
            );
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Service Group",
            "Update",
            "1",
            JSON.stringify({ id, ...changes }),
            null,
            () => {}
          );

          return res.json({
            status: true,
            message: "Service updated successfully",
            token: newToken,
          });
        });
      });
    });
  });
};

// Controller to delete a service
exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, admin_id, _token } = req.query;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Service ID");
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

      ServiceGroup.getServiceGroupById(id, (err, currentServiceGroup) => {
        if (err) {
          console.error("Error fetching service data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        ServiceGroup.delete(id, (err, result) => {
          if (err) {
            console.error("Database error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Service Group",
              "Delete",
              "0",
              JSON.stringify({ id, ...currentServiceGroup }),
              err,
              () => {}
            );
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Service Group",
            "Delete",
            "1",
            JSON.stringify(currentServiceGroup),
            null,
            () => {}
          );

          return res.json({
            status: true,
            message: "Service deleted successfully",
            token: newToken,
          });
        });
      });
    });
  });
};
