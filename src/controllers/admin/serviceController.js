const Service = require("../../models/admin/serviceModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to create a new service
exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    title,
    description,
    group_id,
    service_code,
    service_type,
    hsn_code,
    show_in_vendor_management,
    admin_id,
    _token,
  } = req.body;

  let missingFields = [];
  if (!title || title === "") missingFields.push("Title");
  if (!description || description === "") missingFields.push("Description");
  if (!group_id || group_id === "") missingFields.push("Group ID");
  if (!service_code || service_code === "") missingFields.push("Service Code");
  if (!service_type || service_type === "") missingFields.push("Service Type");
  if (!hsn_code || hsn_code === "") missingFields.push("HSN Code");
  if (!admin_id || description === "") missingFields.push("Admin ID");
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

      Service.create(
        title,
        description,
        group_id,
        service_code,
        service_type,
        hsn_code,
        show_in_vendor_management,
        admin_id,
        (err, result) => {
          if (err) {
            console.error("Database error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Service",
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
            "Service",
            "Create",
            "1",
            `{id: ${result[0]}}`,
            null,
            () => { }
          );

          console.log(`result - `, result);

          Service.createReportForm(
            result[0],
            admin_id,
            title,
            (err, reportFormRes) => {
              if (err) {
                console.error("Database error:", err);
                Common.adminActivityLog(
                  ipAddress,
                  ipType,
                  admin_id,
                  "Service",
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

              res.json({
                status: true,
                message: "Service created successfully",
                service: result,
                token: newToken,
              });
            }
          );
        }
      );
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

      Service.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        res.json({
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

exports.isServiceCodeUnique = (req, res) => {
  const { service_code, admin_id, _token } = req.query;

  // Validate required fields
  const missingFields = [];
  if (!service_code || service_code.trim() === "")
    missingFields.push("Service Code");
  if (!admin_id || admin_id.trim() === "") missingFields.push("Admin ID");
  if (!_token || _token.trim() === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "client_overview";

  // Check admin authorization
  Common.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        message: authResult.message, // Return the message from the authorization function
      });
    }

    // Validate admin token
    Common.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({
          status: false,
          message: "Internal Server Error: Token validation failed.",
          error: err,
        });
      }

      if (!tokenResult.status) {
        return res.status(401).json({
          status: false,
          message: tokenResult.message,
        });
      }

      const newToken = tokenResult.newToken;

      // Check if service code is unique
      Service.isServiceCodeUnique(service_code, (err, serviceCodeUsed) => {
        if (err) {
          console.error("Error checking service code uniqueness:", err);
          return res.status(500).json({
            status: false,
            message: "Internal Server Error: Unable to check Service Code.",
            error: err,
            token: newToken, // Pass the new token even on errors
          });
        }

        if (serviceCodeUsed) {
          return res.status(409).json({
            status: false,
            message: "Conflict: The Service Code has already been used.",
            token: newToken,
          });
        }

        // Service code is unique
        return res.status(200).json({
          status: true,
          message: "Service Code is unique and not used.",
          token: newToken,
        });
      });
    });
  });
};

exports.getServiceById = (req, res) => {
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

      Service.getServiceById(id, (err, currentService) => {
        if (err) {
          console.error("Error fetching service data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        if (!currentService) {
          return res.status(404).json({
            status: false,
            message: "Service not found",
            token: newToken,
          });
        }

        res.json({
          status: true,
          message: "Service retrieved successfully",
          service: currentService,
          token: newToken,
        });
      });
    });
  });
};

// Controller to update a service
exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    id,
    title,
    description,
    group_id,
    service_type,
    service_code,
    hsn_code,
    show_in_vendor_management,
    admin_id,
    _token,
  } = req.body;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Service ID");
  if (!title || title === "") missingFields.push("Title");
  if (!description || description === "") missingFields.push("Description");
  if (!group_id || group_id === "") missingFields.push("Group ID");
  if (!service_type || service_type === "") missingFields.push("Service Type");
  if (!service_code || service_code === "") missingFields.push("Service Code");
  if (!hsn_code || hsn_code === "") missingFields.push("HSN Code");
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

      Service.getServiceById(id, (err, currentService) => {
        if (err) {
          console.error("Error fetching service data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        const changes = {};
        if (currentService.title !== title) {
          changes.title = {
            old: currentService.title,
            new: title,
          };
        }
        if (currentService.description !== description) {
          changes.description = {
            old: currentService.description,
            new: description,
          };
        }

        Service.update(
          id,
          title,
          description,
          group_id,
          service_type,
          service_code,
          hsn_code,
          show_in_vendor_management,
          (err, result) => {
            if (err) {
              console.error("Database error:", err);
              Common.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Service",
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

            Service.updateReportForm(
              id,
              admin_id,
              title,
              (err, reportFormRes) => {
                if (err) {
                  console.error("Database error:", err);
                  Common.adminActivityLog(
                    ipAddress,
                    ipType,
                    admin_id,
                    "Service",
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
                  "Service",
                  "Update",
                  "1",
                  JSON.stringify({ id, ...changes }),
                  null,
                  () => { }
                );

                return res.json({
                  status: true,
                  message: "Service updated successfully",
                  service: result,
                  token: newToken,
                });
              }
            );
          }
        );
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

      Service.getServiceById(id, (err, currentService) => {
        if (err) {
          console.error("Error fetching service data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        Service.delete(id, (err, result) => {
          if (err) {
            console.error("Database error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Service",
              "Delete",
              "0",
              JSON.stringify({ id, ...currentService }),
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
            "Service",
            "Delete",
            "1",
            JSON.stringify(currentService),
            null,
            () => { }
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
