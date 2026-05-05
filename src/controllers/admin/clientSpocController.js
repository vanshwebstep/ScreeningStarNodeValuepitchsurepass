const ClientSpoc = require("../../models/admin/clientSpocModel");
const BranchCommon = require("../../models/customer/branch/commonModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

const areEmailsUsed = (emails) => {
  return new Promise((resolve, reject) => {
    // Validate inputs
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return reject(new Error("Missing required field: Emails"));
    }

    // Check each email, skipping empty or null emails
    const emailCheckPromises = emails
      .filter((email) => email && email.trim() !== "") // Skip empty or null emails
      .map((email) => {
        return new Promise((resolve, reject) => {
          ClientSpoc.checkEmailExists(email, (err, isUsed) => {
            if (err) {
              return reject(err);
            }
            resolve({ email, isUsed });
          });
        });
      });

    // Wait for all email checks to complete
    Promise.all(emailCheckPromises)
      .then((results) => {
        // Filter out emails that are in use
        const usedEmails = results
          .filter((result) => result.isUsed)
          .map((result) => result.email);

        // Determine if any emails are used
        const areAnyUsed = usedEmails.length > 0;

        // Create the response message if any emails are used
        let message = "";
        if (areAnyUsed) {
          const emailCount = usedEmails.length;

          if (emailCount === 1) {
            message = `${usedEmails[0]} is already used.`;
          } else if (emailCount === 2) {
            message = `${usedEmails[0]} and ${usedEmails[1]} are already used.`;
          } else {
            const lastEmail = usedEmails.pop(); // Remove the last email for formatting
            message = `${usedEmails.join(
              ", "
            )} and ${lastEmail} are already used.`;
          }
        }

        // Resolve with a boolean and the message
        resolve({ areAnyUsed, message });
      })
      .catch((err) => {
        console.error("Error checking email usage:", err);
        reject(new Error("Error checking email usage: " + err.message));
      });
  });
};

// Controller to create a new Client SPOC
exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    name,
    designation,
    phone,
    email,
    email1 = null,
    email2 = null,
    email3 = null,
    email4 = null,
    admin_id,
    _token,
  } = req.body;

  // Validate required fields
  const missingFields = [];
  if (!name) missingFields.push("Name");
  if (!designation) missingFields.push("Designation");
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");
  if (!phone) missingFields.push("Phone");
  if (!email) missingFields.push("Email");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Normalize optional email fields
  const normalizeEmail = (emailField) =>
    emailField && emailField.trim() !== "" && emailField !== "undefined"
      ? emailField
      : null;

  const normalizedEmail1 = normalizeEmail(email1);
  const normalizedEmail2 = normalizeEmail(email2);
  const normalizedEmail3 = normalizeEmail(email3);
  const normalizedEmail4 = normalizeEmail(email4);

  const action = "client_overview";

  // Check admin authorization
  Common.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        message: authResult.message,
      });
    }

    const allEmails = [
      email,
      normalizedEmail1,
      normalizedEmail2,
      normalizedEmail3,
      normalizedEmail4,
    ].filter(Boolean);

    areEmailsUsed(allEmails)
      .then(({ areAnyUsed, message }) => {
        if (areAnyUsed) {
          return res.status(400).json({
            status: false,
            message: message,
          });
        }
        // Validate admin token
        Common.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
          if (err) {
            console.error("Token validation error:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message });
          }

          if (!tokenResult.status) {
            return res
              .status(401)
              .json({ status: false, message: tokenResult.message });
          }

          const newToken = tokenResult.newToken;

          // List of emails to check
          const emailsToCheck = [email, email1, email2, email3, email4].filter(
            Boolean
          );

          // Function to check each email using checkEmailExists
          const checkEmails = (emails, callback) => {
            const usedEmails = [];
            let checkedCount = 0;

            emails.forEach((email) => {
              ClientSpoc.checkEmailExists(email, (err, emailExists) => {
                checkedCount++;
                if (err) {
                  console.error(
                    `Error checking email existence for ${email}:`,
                    err
                  );
                  return callback(err);
                }

                if (emailExists) {
                  usedEmails.push(email);
                }

                // When all emails are checked
                if (checkedCount === emails.length) {
                  callback(null, usedEmails);
                }
              });
            });
          };

          // Check all emails
          checkEmails(emailsToCheck, (err, usedEmails) => {
            if (err) {
              return res.status(500).json({
                status: false,
                message: "Internal server error",
                token: newToken,
              });
            }

            if (usedEmails.length > 0) {
              return res.status(409).json({
                status: false,
                message: `The following emails are already in use: ${usedEmails.join(
                  ", "
                )}`,
                token: newToken,
              });
            }

            // Proceed with creating Client SPOC if all emails are available
            ClientSpoc.create(
              name,
              designation,
              phone,
              email,
              normalizedEmail1,
              normalizedEmail2,
              normalizedEmail3,
              normalizedEmail4,
              admin_id,
              (err, result) => {
                if (err) {
                  console.error("Database error:", err);
                  Common.adminActivityLog(
                    ipAddress,
                    ipType,
                    admin_id,
                    "Client SPOC",
                    "Create",
                    "0",
                    null,
                    err,
                    () => {}
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
                  "Client SPOC",
                  "Create",
                  "1",
                  `{id: ${result.insertId}}`,
                  null,
                  () => {}
                );

                res.json({
                  status: true,
                  message: "Client SPOC created successfully",
                  client_spocs: result,
                  token: newToken,
                });
              }
            );
          });
        });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({
          status: false,
          message: "An error occurred while checking email usage.",
          token: newToken
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

      ClientSpoc.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        res.json({
          status: true,
          message: "Client SPOCs fetched successfully",
          client_spocs: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.listByBranchAuth = (req, res) => {
  const { sub_user_id, branch_id, _token } = req.query;

  let missingFields = [];
  if (!branch_id || branch_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const action = "client_manager";

  // Check branch authorization
  BranchCommon.isBranchAuthorizedForAction(branch_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message,
      });
    }

    // Validate branch token
    BranchCommon.isBranchTokenValid(
      _token,
      sub_user_id || "",
      branch_id,
      (err, result) => {
        if (err) {
          console.error("Error checking token validity:", err);
          return res.status(500).json({ status: false, message: err.message });
        }

        if (!result.status) {
          return res
            .status(401)
            .json({ status: false, message: result.message });
        }

        const newToken = result.newToken;

        ClientSpoc.list((err, result) => {
          if (err) {
            console.error("Database error:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          res.json({
            status: true,
            message: "Client SPOCs fetched successfully",
            client_spocs: result,
            totalResults: result.length,
            token: newToken,
          });
        });
      }
    );
  });
};

exports.getClientSpocById = (req, res) => {
  const { id, admin_id, _token } = req.query;
  let missingFields = [];
  if (!id || id === "") missingFields.push("Client SPOC ID");
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

      ClientSpoc.getClientSpocById(id, (err, currentClientSpoc) => {
        if (err) {
          console.error("Error fetching Client SPOC data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        if (!currentClientSpoc) {
          return res.status(404).json({
            status: false,
            message: "Client SPOC not found",
            token: newToken,
          });
        }

        res.json({
          status: true,
          message: "Client SPOC retrieved successfully",
          client_spocs: currentClientSpoc,
          token: newToken,
        });
      });
    });
  });
};

// Controller to name a Client SPOC
exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    id,
    name,
    designation,
    phone,
    email,
    email1 = null,
    email2 = null,
    email3 = null,
    email4 = null,
    admin_id,
    _token,
  } = req.body;

  // Validate required fields
  const missingFields = [];
  if (!id) missingFields.push("Client SPOC ID");
  if (!name) missingFields.push("Name");
  if (!designation) missingFields.push("Designation");
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");
  if (!phone) missingFields.push("Phone");
  if (!email) missingFields.push("Email");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Normalize optional email fields
  const normalizeEmail = (emailField) =>
    emailField && emailField.trim() !== "" && emailField !== "undefined"
      ? emailField
      : null;

  const normalizedEmail1 = normalizeEmail(email1);
  const normalizedEmail2 = normalizeEmail(email2);
  const normalizedEmail3 = normalizeEmail(email3);
  const normalizedEmail4 = normalizeEmail(email4);

  const action = "client_overview";

  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message,
      });
    }

    Common.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error validating token:", err);
        return res.status(500).json({
          status: false,
          message: "Internal server error while validating token",
        });
      }

      if (!result.status) {
        return res.status(401).json({
          status: false,
          message: result.message,
        });
      }

      const newToken = result.newToken;

      // Fetch current Client SPOC details
      ClientSpoc.getClientSpocById(id, (err, currentClientSpoc) => {
        if (err) {
          console.error("Error fetching Client SPOC data:", err);
          return res.status(500).json({
            status: false,
            message: "Error fetching Client SPOC data",
            token: newToken,
          });
        }

        if (!currentClientSpoc) {
          return res.status(404).json({
            status: false,
            message: "Client SPOC not found",
            token: newToken,
          });
        }

        // Track changes
        const changes = {};
        if (currentClientSpoc.name !== name) {
          changes.name = { old: currentClientSpoc.name, new: name };
        }
        if (currentClientSpoc.designation !== designation) {
          changes.designation = {
            old: currentClientSpoc.designation,
            new: designation,
          };
        }

        // Update Client SPOC in the database
        ClientSpoc.update(
          id,
          name,
          designation,
          phone,
          email,
          normalizedEmail1,
          normalizedEmail2,
          normalizedEmail3,
          normalizedEmail4,
          (err, updateResult) => {
            if (err) {
              console.error("Database update error:", err);
              Common.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Client SPOC",
                "Update",
                "0",
                JSON.stringify({ id, ...changes }),
                err,
                () => {}
              );
              return res.status(500).json({
                status: false,
                message: "Error updating Client SPOC",
                token: newToken,
              });
            }

            // Log admin activity
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Client SPOC",
              "Update",
              "1",
              JSON.stringify({ id, ...changes }),
              null,
              () => {}
            );

            res.json({
              status: true,
              message: "Client SPOC updated successfully",
              client_spocs: updateResult,
              token: newToken,
            });
          }
        );
      });
    });
  });
};

// Controller to delete a Client SPOC
exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, admin_id, _token } = req.query;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Client SPOC ID");
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

      ClientSpoc.getClientSpocById(id, (err, currentClientSpoc) => {
        if (err) {
          console.error("Error fetching Client SPOC data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        ClientSpoc.delete(id, (err, result) => {
          if (err) {
            console.error("Database error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Client SPOC",
              "Delete",
              "0",
              JSON.stringify({ id, ...currentClientSpoc }),
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
            "Client SPOC",
            "Delete",
            "1",
            JSON.stringify(currentClientSpoc),
            null,
            () => {}
          );

          res.json({
            status: true,
            message: "Client SPOC deleted successfully",
            token: newToken,
          });
        });
      });
    });
  });
};

exports.checkEmailExists = (req, res) => {
  const { email, admin_id, _token } = req.body;

  // Validate required fields
  const missingFields = [];
  if (!email) missingFields.push("Email");
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");

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
        message: authResult.message,
      });
    }

    // Validate admin token
    Common.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Token validation error:", err);
        return res
          .status(500)
          .json({ status: false, message: "Internal server error" });
      }

      if (!tokenResult.status) {
        return res
          .status(401)
          .json({ status: false, message: tokenResult.message });
      }

      const newToken = tokenResult.newToken;

      // Check if the email already exists
      ClientSpoc.checkEmailExists(email, (err, emailExists) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            message: "Internal server error",
            token: newToken,
          });
        }

        if (emailExists) {
          return res.status(409).json({
            status: false,
            message: "Email is already in use for another Client SPOC",
            token: newToken,
          });
        }

        return res.status(200).json({
          status: true,
          message: "Email is available for use",
          token: newToken,
        });
      });
    });
  });
};
