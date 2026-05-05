const SubUser = require("../../../../models/customer/branch/subUserModel");
const BranchCommon = require("../../../../models/customer/branch/commonModel");
const Branch = require("../../../../models/customer/branch/branchModel");
const { getClientIpAddress } = require("../../../../utils/ipAddress");

// Controller to create a new service
exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { email, password, sub_user_id, branch_id, _token } = req.body;

  // Validate missing fields
  let missingFields = [];
  if (!email || email === "") missingFields.push("Email Address");
  if (!branch_id || branch_id === "") missingFields.push("Branch ID");
  if (!password || password === "") missingFields.push("Password");
  if (!_token || _token === "") missingFields.push("Authentication Token");

  // If there are missing fields, return an error
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `The following required fields are missing: ${missingFields.join(
        ", "
      )}.`,
    });
  }

  const action = "sub_user";

  // Check if branch is authorized for the action
  BranchCommon.isBranchAuthorizedForAction(branch_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: `Authorization failed: ${result.message}`,
      });
    }

    // Validate the token for the branch
    BranchCommon.isBranchTokenValid(
      _token,
      sub_user_id || "",
      branch_id,
      async (err, result) => {
        if (err) {
          console.error("Error validating token:", err);
          return res.status(500).json({
            status: false,
            err,
            message: err.message,
          });
        }

        if (!result.status) {
          return res.status(401).json({
            status: false,
            message: `Invalid token: ${result.message}`,
          });
        }

        const newToken = result.newToken;

        // Retrieve branch details and proceed with sub-user creation
        Branch.getBranchById(branch_id, (err, currentBranch) => {
          if (err) {
            console.error("Database error retrieving branch:", err);
            return res.status(500).json({
              status: false,
              message:
                "Unable to retrieve branch details at this time. Please try again later.",
            });
          }

          const customer_id = currentBranch.customer_id;

          // Create SubUser
          SubUser.create(
            { branch_id, customer_id, email, password },
            (err, result) => {
              if (err) {
                console.error("Database error creating sub-user:", err);
                BranchCommon.branchActivityLog(
                  ipAddress,
                  ipType,
                  branch_id,
                  "Sub User",
                  "Create",
                  "0",
                  null,
                  err.message,
                  () => {}
                );
                return res.status(500).json({
                  status: false,
                  message: err.message,
                  token: newToken,
                });
              }

              // Log the activity
              BranchCommon.branchActivityLog(
                ipAddress,
                ipType,
                branch_id,
                "Sub User",
                "Create",
                "0",
                null,
                null,
                () => {}
              );

              return res.json({
                status: true,
                message: "Sub-user account successfully created.",
                token: newToken,
              });
            }
          );
        });
      }
    );
  });
};

// Controller to list all services
exports.list = (req, res) => {
  const { sub_user_id, branch_id, _token } = req.query;

  // Validate missing fields
  let missingFields = [];
  if (!branch_id || branch_id === "") missingFields.push("Branch ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "sub_user";

  // Check if branch is authorized for the action
  BranchCommon.isBranchAuthorizedForAction(branch_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: `Authorization failed: ${result.message}`,
      });
    }

    // Validate the token for the branch
    BranchCommon.isBranchTokenValid(
      _token,
      sub_user_id || "",
      branch_id,
      async (err, result) => {
        if (err) {
          console.error("Error validating token:", err);
          return res.status(500).json({
            status: false,
            message: `An error occurred while validating the token. Please try again later.`,
          });
        }

        if (!result.status) {
          return res.status(401).json({
            status: false,
            message: `Invalid token: ${result.message}`,
          });
        }

        const newToken = result.newToken;

        // Retrieve the list of Sub Users
        SubUser.list(branch_id, (err, subUserResults) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({
              status: false,
              message: `Failed to fetch Sub Users. Please try again later.`,
              token: newToken,
            });
          }

          if (subUserResults.length === 0) {
            return res.json({
              status: true,
              message: "No Sub Users found for this branch.",
              subUsers: [],
              totalResults: 0,
              token: newToken,
            });
          }

          // Return the list of Sub Users
          res.json({
            status: true,
            message: "Sub Users retrieved successfully.",
            subUsers: subUserResults,
            totalResults: subUserResults.length,
            token: newToken,
          });
        });
      }
    );
  });
};

// Controller to update a service
exports.updateEmail = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, email, sub_user_id, branch_id, _token } = req.body;
  // Validate missing fields
  let missingFields = [];
  if (!id || id === "") missingFields.push("Sub User ID");
  if (!email || email === "") missingFields.push("Email Address");
  if (!branch_id || branch_id === "") missingFields.push("Branch ID");
  if (!_token || _token === "") missingFields.push("Authentication Token");

  // If there are missing fields, return an error
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `The following required fields are missing: ${missingFields.join(
        ", "
      )}.`,
    });
  }

  const action = "sub_user";

  // Check if branch is authorized for the action
  BranchCommon.isBranchAuthorizedForAction(branch_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: `Authorization failed: ${result.message}`,
      });
    }

    // Validate the token for the branch
    BranchCommon.isBranchTokenValid(
      _token,
      sub_user_id || "",
      branch_id,
      async (err, result) => {
        if (err) {
          console.error("Error validating token:", err);
          return res.status(500).json({
            status: false,
            message: `An error occurred while validating the token. Please try again later.`,
          });
        }

        if (!result.status) {
          return res.status(401).json({
            status: false,
            message: `Invalid token: ${result.message}`,
          });
        }

        const newToken = result.newToken;

        // Retrieve branch details and proceed with sub-user creation
        Branch.getBranchById(branch_id, (err, currentBranch) => {
          if (err) {
            console.error("Database error retrieving branch:", err);
            return res.status(500).json({
              status: false,
              message:
                "Unable to retrieve branch details at this time. Please try again later.",
            });
          }

          const customer_id = currentBranch.customer_id;

          SubUser.getSubUserById(id, (err, currentSubUser) => {
            if (err) {
              console.error("Database error during branch retrieval:", err);
              return res.status(500).json({
                status: false,
                message: "Failed to retrieve sub user. Please try again.",
                token: newToken,
              });
            }

            if (!currentSubUser) {
              return res.status(404).json({
                status: false,
                message: "Sub user not found.",
              });
            }
            // Create SubUser
            SubUser.updateEmail(
              { id, branch_id, customer_id, email },
              (err, result) => {
                if (err) {
                  console.error("Database error creating sub-user:", err);
                  BranchCommon.branchActivityLog(
                    ipAddress,
                    ipType,
                    branch_id,
                    "Sub User",
                    "Update",
                    "0",
                    null,
                    err.message,
                    () => {}
                  );
                  return res.status(500).json({
                    status: false,
                    message: err.message,
                    token: newToken,
                  });
                }

                // Log the activity
                BranchCommon.branchActivityLog(
                  ipAddress,
                  ipType,
                  branch_id,
                  "Sub User",
                  "Update",
                  "0",
                  null,
                  null,
                  () => {}
                );

                return res.json({
                  status: true,
                  message: "Sub-user account successfully updated.",
                  token: newToken,
                });
              }
            );
          });
        });
      }
    );
  });
};

// Controller to update a service
exports.updatePassword = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, password, sub_user_id, branch_id, _token } = req.body;
  // Validate missing fields
  let missingFields = [];
  if (!id || id === "") missingFields.push("Sub User ID");
  if (!branch_id || branch_id === "") missingFields.push("Branch ID");
  if (!password || password === "") missingFields.push("Password");
  if (!_token || _token === "") missingFields.push("Authentication Token");

  // If there are missing fields, return an error
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `The following required fields are missing: ${missingFields.join(
        ", "
      )}.`,
    });
  }

  const action = "sub_user";

  // Check if branch is authorized for the action
  BranchCommon.isBranchAuthorizedForAction(branch_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: `Authorization failed: ${result.message}`,
      });
    }

    // Validate the token for the branch
    BranchCommon.isBranchTokenValid(
      _token,
      sub_user_id || "",
      branch_id,
      async (err, result) => {
        if (err) {
          console.error("Error validating token:", err);
          return res.status(500).json({
            status: false,
            message: `An error occurred while validating the token. Please try again later.`,
          });
        }

        if (!result.status) {
          return res.status(401).json({
            status: false,
            message: `Invalid token: ${result.message}`,
          });
        }

        const newToken = result.newToken;

        // Retrieve branch details and proceed with sub-user creation
        Branch.getBranchById(branch_id, (err, currentBranch) => {
          if (err) {
            console.error("Database error retrieving branch:", err);
            return res.status(500).json({
              status: false,
              message:
                "Unable to retrieve branch details at this time. Please try again later.",
            });
          }

          const customer_id = currentBranch.customer_id;

          SubUser.getSubUserById(id, (err, currentSubUser) => {
            if (err) {
              console.error("Database error during branch retrieval:", err);
              return res.status(500).json({
                status: false,
                message: "Failed to retrieve sub user. Please try again.",
                token: newToken,
              });
            }

            if (!currentSubUser) {
              return res.status(404).json({
                status: false,
                message: "Sub user not found.",
              });
            }
            // Create SubUser
            SubUser.updatePassword(
              { id, branch_id, customer_id, password },
              (err, result) => {
                if (err) {
                  console.error("Database error creating sub-user:", err);
                  BranchCommon.branchActivityLog(
                    ipAddress,
                    ipType,
                    branch_id,
                    "Sub User",
                    "Update",
                    "0",
                    null,
                    err.message,
                    () => {}
                  );
                  return res.status(500).json({
                    status: false,
                    message: err.message,
                    token: newToken,
                  });
                }

                // Log the activity
                BranchCommon.branchActivityLog(
                  ipAddress,
                  ipType,
                  branch_id,
                  "Sub User",
                  "Update",
                  "0",
                  null,
                  null,
                  () => {}
                );

                return res.json({
                  status: true,
                  message: "Sub-user account successfully updated.",
                  token: newToken,
                });
              }
            );
          });
        });
      }
    );
  });
};

// Controller to delete a service
exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, sub_user_id, branch_id, _token } = req.query;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Sub User ID");
  if (!branch_id || branch_id === "") missingFields.push("Branch ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "sub_user";

  // Check if branch is authorized for the action
  BranchCommon.isBranchAuthorizedForAction(branch_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: `Authorization failed: ${result.message}`,
      });
    }

    // Validate the token for the branch
    BranchCommon.isBranchTokenValid(
      _token,
      sub_user_id || "",
      branch_id,
      async (err, result) => {
        if (err) {
          console.error("Error validating token:", err);
          return res.status(500).json({
            status: false,
            message: `An error occurred while validating the token. Please try again later.`,
          });
        }

        if (!result.status) {
          return res.status(401).json({
            status: false,
            message: `Invalid token: ${result.message}`,
          });
        }

        const newToken = result.newToken;

        // Retrieve the sub-user details before deletion
        SubUser.getSubUserById(id, (err, currentSubUser) => {
          if (err) {
            console.error("Database error during sub-user retrieval:", err);
            return res.status(500).json({
              status: false,
              message: "Failed to retrieve sub-user. Please try again.",
              token: newToken,
            });
          }

          if (!currentSubUser) {
            return res.status(404).json({
              status: false,
              message: "Sub-user not found.",
            });
          }

          // Delete the sub-user
          SubUser.delete(id, (err, result) => {
            if (err) {
              console.error("Database error during deletion:", err);
              BranchCommon.branchActivityLog(
                ipAddress,
                ipType,
                branch_id,
                "Sub User",
                "Delete",
                "0", // Failure
                JSON.stringify({ id, ...currentSubUser }),
                err.message,
                () => {}
              );
              return res.status(500).json({
                status: false,
                message: "Failed to delete sub-user. Please try again later.",
                token: newToken,
              });
            }

            // Log the successful deletion
            BranchCommon.branchActivityLog(
              ipAddress,
              ipType,
              branch_id,
              "Sub User",
              "Delete",
              "1", // Success
              JSON.stringify(currentSubUser),
              null,
              () => {}
            );

            return res.json({
              status: true,
              message: "Sub-user deleted successfully.",
              token: newToken,
            });
          });
        });
      }
    );
  });
};
