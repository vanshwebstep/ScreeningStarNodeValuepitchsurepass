const Package = require("../../models/admin/packageModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to create a new package
exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { title, description, admin_id, _token } = req.body;

  // Validate required fields
  const missingFields = [];
  if (!title || title === "") missingFields.push("Title");
  if (!description || description === "") missingFields.push("Description");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "client_overview";

  // Check admin authorization
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      // Check the status returned by the authorization function
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Validate admin token
    Common.isAdminTokenValid(_token, admin_id, (err, tokenValidationResult) => {
      if (err) {
        console.error("Token validation error:", err);
        return res.status(500).json({
          status: false,
          message: err.message,
        });
      }

      if (!tokenValidationResult.status) {
        return res.status(401).json({
          status: false,
          message: tokenValidationResult.message,
        });
      }

      const newToken = tokenValidationResult.newToken;

      // Create package
      Package.create(title, description, admin_id, (err, result) => {
        if (err) {
          console.error("Database error during package creation:", err);
          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Package",
            "Create",
            "0",
            null,
            err,
            () => { }
          );
          return res.status(500).json({
            status: false,
            message: "Failed to create package. Please try again.",
            token: newToken,
          });
        }

        Common.adminActivityLog(
          ipAddress,
          ipType,
          admin_id,
          "Package",
          "Create",
          "1",
          `{id: ${result.insertId}}`,
          null,
          () => { }
        );

        return res.status(201).json({
          status: true,
          message: "Package created successfully.",
          package: result,
          token: newToken,
        });
      });
    });
  });
};

// Controller to list all packages
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

      Package.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        return res.json({
          status: true,
          message: "Packages fetched successfully",
          packages: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

// Controller to get a package by ID
exports.getPackageById = (req, res) => {
  const { id, admin_id, _token } = req.query;
  let missingFields = [];
  if (!id || id === "") missingFields.push("Package ID");
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
        return res
          .status(401)
          .json({ status: false, message: result.message, token: newToken });
      }

      const newToken = result.newToken;

      Package.getPackageById(id, (err, currentPackage) => {
        if (err) {
          console.error("Error fetching package data:", err);
          return res
            .status(500)
            .json({ status: false, message: result.err, token: newToken });
        }

        if (!currentPackage) {
          return res.status(404).json({
            status: false,
            message: "Package not found",
            token: newToken,
          });
        }

        return res.json({
          status: true,
          message: "Package retrieved successfully",
          package: currentPackage,
          token: newToken,
        });
      });
    });
  });
};

// Controller to update a package
exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, title, description, admin_id, _token } = req.body;

  // Validate required fields
  const missingFields = [];
  if (!id || id === "") missingFields.push("Package ID");
  if (!title || title === "") missingFields.push("Title");
  if (!description || description === "") missingFields.push("Description");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "client_overview";

  // Check admin authorization
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      // Check the status returned by the authorization function
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Validate admin token
    Common.isAdminTokenValid(_token, admin_id, (err, tokenValidationResult) => {
      if (err) {
        console.error("Token validation error:", err);
        return res.status(500).json({
          status: false,
          message: err.message,
        });
      }

      if (!tokenValidationResult.status) {
        return res.status(401).json({
          status: false,
          message: tokenValidationResult.message,
        });
      }

      const newToken = tokenValidationResult.newToken;

      // Fetch the current package
      Package.getPackageById(id, (err, currentPackage) => {
        if (err) {
          console.error("Database error during package retrieval:", err);
          return res.status(500).json({
            status: false,
            message: "Failed to retrieve package. Please try again.",
            token: newToken,
          });
        }

        if (!currentPackage) {
          return res.status(404).json({
            status: false,
            message: "Package not found.",
            token: newToken,
          });
        }

        const changes = {};
        if (currentPackage.title !== title) {
          changes.title = { old: currentPackage.title, new: title };
        }
        if (currentPackage.description !== description) {
          changes.description = {
            old: currentPackage.description,
            new: description,
          };
        }

        // Update the package
        Package.update(id, title, description, (err, result) => {
          if (err) {
            console.error("Database error during package update:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Package",
              "Update",
              "0",
              JSON.stringify({ id, ...changes }),
              err,
              () => { }
            );
            return res.status(500).json({
              status: false,
              message: "Failed to update package. Please try again.",
              token: newToken,
            });
          }

          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Package",
            "Update",
            "1",
            JSON.stringify({ id, ...changes }),
            null,
            () => { }
          );

          return res.status(200).json({
            status: true,
            message: "Package updated successfully.",
            package: result,
            token: newToken,
          });
        });
      });
    });
  });
};

// Controller to delete a package
exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, admin_id, _token } = req.query;

  // Validate required fields
  const missingFields = [];
  if (!id || id === "") missingFields.push("Package ID");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "client_overview";

  // Check admin authorization
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      // Check the status returned by the authorization function
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Validate admin token
    Common.isAdminTokenValid(_token, admin_id, (err, tokenValidationResult) => {
      if (err) {
        console.error("Token validation error:", err);
        return res.status(500).json({
          status: false,
          message: err.message,
        });
      }

      if (!tokenValidationResult.status) {
        return res.status(401).json({
          status: false,
          message: tokenValidationResult.message,
        });
      }

      const newToken = tokenValidationResult.newToken;

      // Fetch the current package
      Package.getPackageById(id, (err, currentPackage) => {
        if (err) {
          console.error("Database error during package retrieval:", err);
          return res.status(500).json({
            status: false,
            message: "Failed to retrieve package. Please try again.",
            token: newToken,
          });
        }

        if (!currentPackage) {
          return res.status(404).json({
            status: false,
            message: "Package not found.",
            token: newToken,
          });
        }

        // Delete the package
        Package.delete(id, (err, result) => {
          if (err) {
            console.error("Database error during package deletion:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Package",
              "Delete",
              "0",
              JSON.stringify({ id }),
              err,
              () => { }
            );
            return res.status(500).json({
              status: false,
              message: "Failed to delete package. Please try again.",
              token: newToken,
            });
          }

          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Package",
            "Delete",
            "1",
            JSON.stringify({ id }),
            null,
            () => { }
          );

          return res.status(200).json({
            status: true,
            message: "Package deleted successfully.",
            result,
            token: newToken,
          });
        });
      });
    });
  });
};
