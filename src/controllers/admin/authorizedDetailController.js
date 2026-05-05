const AuthorizedDetail = require("../../models/admin/authorizedDetailModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to create a new Authorized Detail
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

      AuthorizedDetail.checkEmailExists(email, (err, emailExists) => {
        if (err) {
          console.error("Error checking email existence:", err);
          return res
            .status(500)
            .json({ status: false, message: "Internal server error", token: newToken, });
        }

        if (emailExists) {
          return res.status(401).json({
            status: false,
            message: "Email already used for another Authorized Detail",
            token: newToken,
          });
        }


        AuthorizedDetail.create(
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
                "Authorized Detail",
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
              "Authorized Detail",
              "Create",
              "1",
              `{id: ${result.insertId}}`,
              null,
              () => { }
            );

            res.json({
              status: true,
              message: "Authorized Detail created successfully",
              authorized_detail: result,
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

      AuthorizedDetail.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            err,
            message: err.message,
            token: newToken,
          });
        }

        res.json({
          status: true,
          message: "Authorized Details fetched successfully",
          authorized_details: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.getAuthorizedDetailById = (req, res) => {
  const { id, admin_id, _token } = req.query;
  let missingFields = [];
  if (!id || id === "") missingFields.push("Authorized Detail ID");
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

      AuthorizedDetail.getAuthorizedDetailById(
        id,
        (err, currentAuthorizedDetail) => {
          if (err) {
            console.error("Error fetching Authorized Detail data:", err);
            return res.status(500).json({
              status: false,
              err,
              message: err.message,
              token: newToken,
            });
          }

          if (!currentAuthorizedDetail) {
            return res.status(404).json({
              status: false,
              message: "Authorized Detail not found",
              token: newToken,
            });
          }

          res.json({
            status: true,
            message: "Authorized Detail retrieved successfully",
            authorized_detail: currentAuthorizedDetail,
            token: newToken,
          });
        }
      );
    });
  });
};

// Controller to update a Authorized Detail
exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const { id, name, designation, phone, email, admin_id, _token } = req.body;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Authorized Detail ID");
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

      AuthorizedDetail.getAuthorizedDetailById(
        id,
        (err, currentAuthorizedDetail) => {
          if (err) {
            console.error("Error fetching Authorized Detail data:", err);
            return res.status(500).json({
              status: false,
              err,
              message: err.message,
              token: newToken,
            });
          }

          const changes = {};
          if (currentAuthorizedDetail.name !== name) {
            changes.name = {
              old: currentAuthorizedDetail.name,
              new: name,
            };
          }
          if (currentAuthorizedDetail.designation !== designation) {
            changes.designation = {
              old: currentAuthorizedDetail.designation,
              new: designation,
            };
          }

          AuthorizedDetail.update(
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
                  "Authorized Detail",
                  "Update",
                  "0",
                  JSON.stringify({ id, ...changes }),
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
                "Authorized Detail",
                "Update",
                "1",
                JSON.stringify({ id, ...changes }),
                null,
                () => { }
              );

              res.json({
                status: true,
                message: "Authorized Detail updated successfully",
                authorized_detail: result,
                token: newToken,
              });
            }
          );
        }
      );
    });
  });
};

// Controller to delete a Authorized Detail
exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, admin_id, _token } = req.query;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Authorized Detail ID");
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

      AuthorizedDetail.getAuthorizedDetailById(
        id,
        (err, currentAuthorizedDetail) => {
          if (err) {
            console.error("Error fetching Authorized Detail data:", err);
            return res.status(500).json({
              status: false,
              err,
              message: err.message,
              token: newToken,
            });
          }

          AuthorizedDetail.delete(id, (err, result) => {
            if (err) {
              console.error("Database error:", err);
              Common.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Authorized Detail",
                "Delete",
                "0",
                JSON.stringify({ id, ...currentAuthorizedDetail }),
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
              "Authorized Detail",
              "Delete",
              "1",
              JSON.stringify(currentAuthorizedDetail),
              null,
              () => { }
            );

            res.json({
              status: true,
              message: "Authorized Detail deleted successfully",
              token: newToken,
            });
          });
        }
      );
    });
  });
};
