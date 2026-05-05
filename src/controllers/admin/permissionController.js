const Permission = require("../../models/admin/permissionModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to list all services
exports.rolesList = (req, res) => {
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
  const action = "admin_access";
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

      Permission.rolesList((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        return res.json({
          status: true,
          message: "Roles fetched successfully",
          roles: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

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
  const action = "admin_access";
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

      Permission.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        return res.json({
          status: true,
          message: "Roles fetched successfully",
          roles: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

// Controller to update a service
exports.update = (req, res) => {
  const { id, permission_json, admin_id, _token, service_ids } = req.body;

  // Validate required fields and collect missing ones
  const requiredFields = {
    id,
    permission_json,
    admin_id,
  };

  // Check for missing fields
  const missingFields = Object.keys(requiredFields)
    .filter(
      (field) =>
        !requiredFields[field] ||
        requiredFields[field] === "" ||
        requiredFields[field] === "undefined" ||
        requiredFields[field] == undefined
    )
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "admin_access";
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

      Permission.getPermissionById(id, (err, currentPermission) => {
        if (err) {
          console.error("Error fetching permission data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        const changes = {};
        if (currentPermission.permission_json !== permission_json) {
          changes.permission_json = {
            old: currentPermission.permission_json,
            new: permission_json,
          };
        }

        if (currentPermission.role === "team_management") {
          if (!service_ids || service_ids.trim() === "") {
            return res.status(400).json({
              status: false,
              message: `At least one service must be granted`,
              token: newToken,
            });
          }

          // Optionally, you can validate that service_ids is a comma-separated list of valid numbers
          const serviceIdsArray = service_ids.split(",").map((id) => id.trim());

          if (serviceIdsArray.some((id) => isNaN(id) || id === "")) {
            return res.status(400).json({
              status: false,
              message: `Service IDs must be valid numbers`,
              token: newToken,
            });
          }
        }

        Permission.update(
          id,
          JSON.stringify(permission_json),
          service_ids || null, // Fix: Use `null` instead of `NULL`
          (err, result) => {
            if (err) {
              console.error("Database error:", err);
              Common.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Permission",
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
              "Permission",
              "Update",
              "1",
              JSON.stringify({ id, ...changes }),
              null,
              () => { }
            );

            return res.json({
              status: true,
              message: "Permission updated successfully",
              token: newToken,
            });
          }
        );
      });
    });
  });
};
