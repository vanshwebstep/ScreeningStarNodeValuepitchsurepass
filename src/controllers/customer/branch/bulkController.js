const BranchCommon = require("../../../models/customer/branch/commonModel");
const Branch = require("../../../models/customer/branch/branchModel");
const Bulk = require("../../../models/customer/branch/bulkModel");
const Customer = require("../../../models/customer/customerModel");
const AppModel = require("../../../models/appModel");
const Admin = require("../../../models/admin/adminModel");
const ClientSpoc = require("../../../models/admin/clientSpocModel");
const {
  createMail,
} = require("../../../mailer/customer/branch/bulk/createMail");

const fs = require("fs");
const path = require("path");
const {
  upload,
  saveZip,
  saveImage,
  saveImages,
} = require("../../../utils/cloudImageSave");
const { getClientIpAddress } = require("../../../utils/ipAddress");

exports.create = async (req, res) => {
  // Use multer to handle the upload
  upload(req, res, async (err) => {
    if (err) {
      console.log(`err- `, err);
      return res.status(400).json({
        status: false,
        message: "Error uploading file.",
      });
    }

    const {
      branch_id: branchId,
      customer_id: customerId,
      sub_user_id: subUserId,
      _token: token,
      client_spoc_name,
      remarks,
      send_mail,
    } = req.body;

    // Validate required fields and collect missing ones
    const requiredFields = {
      branchId,
      token,
      client_spoc_name,
      remarks,
      send_mail,
    };

    // Check for missing fields
    const missingFields = Object.keys(requiredFields)
      .filter(
        (field) =>
          !requiredFields[field] ||
          requiredFields[field] === "" ||
          requiredFields[field] == "undefined" ||
          requiredFields[field] == undefined
      )
      .map((field) => field.replace(/_/g, " "));

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const action = "verification_status";
    BranchCommon.isBranchAuthorizedForAction(branchId, action, (result) => {
      if (!result.status) {
        return res.status(403).json({
          status: false,
          message: result.message,
        });
      }

      BranchCommon.isBranchTokenValid(
        token,
        subUserId || null,
        branchId,
        async (err, result) => {
          if (err) {
            console.error("Error checking token validity:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message });
          }

          if (!result.status) {
            return res
              .status(401)
              .json({ status: false, message: result.message });
          }

          const newToken = result.newToken;
          Branch.getBranchById(branchId, (err, currentBranch) => {
            if (err) {
              console.error("Database error during branch retrieval:", err);
              return res.status(500).json({
                status: false,
                message: "Failed to retrieve Branch. Please try again.",
              });
            }

            if (
              !currentBranch ||
              parseInt(currentBranch.customer_id) !== parseInt(customerId)
            ) {
              return res.status(404).json({
                status: false,
                message: "Branch not found or customer mismatch.",
              });
            }
            // Retrieve customer details
            Customer.getCustomerById(
              customerId,
              async (err, currentCustomer) => {
                if (err) {
                  console.error(
                    "Database error during customer retrieval:",
                    err
                  );
                  return res.status(500).json({
                    status: false,
                    message: "Failed to retrieve Customer. Please try again.",
                  });
                }

                if (!currentCustomer) {
                  return res.status(404).json({
                    status: false,
                    message: "Customer not found.",
                  });
                }
                targetDirectory = `uploads/customer/${currentCustomer.client_unique_id}/bulks`;
                // Create the target directory for uploads
                await fs.promises.mkdir(targetDirectory, { recursive: true });

                AppModel.appInfo("backend", async (err, appInfo) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                      status: false,
                      err,
                      message: err.message,
                      token: newToken,
                    });
                  }

                  let zipHost = "www.example.in";

                  if (appInfo) {
                    zipHost = appInfo.cloud_host || "www.example.in";
                  }
                  let savedZipPaths = [];

                  // Process single file upload
                  if (req.files.zip && req.files.zip.length > 0) {
                    const uploadedZip = await saveZip(
                      req.files.zip[0],
                      targetDirectory
                    );
                    savedZipPaths.push(`${zipHost}/${uploadedZip}`);
                  }

                  Bulk.create(
                    branchId,
                    customerId,
                    subUserId,
                    client_spoc_name,
                    remarks,
                    savedZipPaths,
                    (success, result) => {
                      if (success) {
                        // If an error occurred, return the error details in the response
                        return res.status(500).json({
                          status: false,
                          message:
                            result ||
                            "An error occurred while saving the image.", // Use detailed error message if available
                          token: newToken,
                          savedZipPaths,
                          success,
                          // details: result.details,
                          // query: result.query,
                          // params: result.params,
                        });
                      }

                      // Handle the case where the upload was successful
                      if (result && result.affectedRows > 0) {
                        // Return success response if there are affected rows
                        if (send_mail == 1) {
                          // Retrieve admins and send email
                          Admin.list((err, adminResult) => {
                            if (err) {
                              console.error("Database error:", err);
                              return res.status(500).json({
                                status: false,
                                message: "Error retrieving admin details.",
                                token: newToken,
                              });
                            }

                            // Extract admin emails
                            /*
                            const toArr = adminResult.map((admin) => ({
                              name: admin.name,
                              email: admin.email,
                            }));
                            */

                            const toArr = [
                              { name: 'BGV Team', email: 'bgv@screeningstar.com' }
                            ];

                            const ccArr = [
                              { name: 'QC Team', email: 'qc@screeningstar.com' }
                            ];

                            createMail(
                              "Bulk",
                              "branch-create",
                              currentCustomer.name,
                              client_spoc_name,
                              [],
                              toArr || [],
                              ccArr
                            )
                              .then(() => {
                                return res.status(201).json({
                                  status: true,
                                  message:
                                    "Bulk files created successfully and email sent.",
                                  token: newToken,
                                  savedZipPaths,
                                });
                              })
                              .catch((emailError) => {
                                console.error(
                                  "Error sending email:",
                                  emailError
                                );
                                return res.status(201).json({
                                  status: true,
                                  message:
                                    "Bulk files created successfully, but failed to send email.",
                                  token: newToken,
                                  savedZipPaths,
                                });
                              });
                          });
                        } else {
                          return res.status(201).json({
                            status: true,
                            message: "Bulk files uploaded successfully.",
                            token: newToken,
                            savedZipPaths,
                          });
                        }
                      } else {
                        // If no rows were affected, indicate that no changes were made
                        return res.status(400).json({
                          status: false,
                          message:
                            "No changes were made. Please check the client application ID.",
                          token: newToken,
                          result,
                          savedZipPaths,
                        });
                      }
                    }
                  );
                });
              }
            );
          });
        }
      );
    });
  });
};

exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, sub_user_id, branch_id, _token } = req.query;

  // Validate required fields
  const missingFields = [];
  if (!id) missingFields.push("Client Application ID");
  if (!branch_id) missingFields.push("Branch ID");
  if (!_token) missingFields.push("Token");

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
      // Check the status returned by the authorization function
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Validate branch token
    BranchCommon.isBranchTokenValid(
      _token,
      sub_user_id || "",
      branch_id,
      (err, tokenValidationResult) => {
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

        // Fetch the current clientApplication
        Bulk.getBulkById(id, (err, currentBulk) => {
          if (err) {
            console.error("Database error during bulk entry retrieval:", err);
            return res.status(500).json({
              status: false,
              message: "Failed to retrieve bulk entry. Please try again.",
              token: newToken,
            });
          }

          if (!currentBulk) {
            return res.status(404).json({
              status: false,
              message: "Bulk Entry not found.",
              token: newToken,
            });
          }

          // Delete the clientApplication
          Bulk.delete(id, (err, result) => {
            if (err) {
              console.error("Database error during bulk entry deletion:", err);
              BranchCommon.branchActivityLog(
                ipAddress,
                ipType,
                branch_id,
                "Client Application",
                "Delete",
                "0",
                JSON.stringify({ id }),
                err,
                () => { }
              );
              return res.status(500).json({
                status: false,
                message: "Failed to delete bulk entry. Please try again.",
                token: newToken,
              });
            }

            BranchCommon.branchActivityLog(
              ipAddress,
              ipType,
              branch_id,
              "Bulk",
              "Delete",
              "1",
              JSON.stringify({ id }),
              null,
              () => { }
            );

            res.status(200).json({
              status: true,
              message: "Bulk Entry deleted successfully.",
              token: newToken,
            });
          });
        });
      }
    );
  });
};

exports.list = (req, res) => {
  const { sub_user_id, branch_id, _token, customer_id } = req.query;

  // Check for missing fields
  let missingFields = [];
  if (!branch_id || branch_id === "") missingFields.push("Branch ID");
  if (!_token || _token === "") missingFields.push("Token");
  if (!customer_id || _token === "") missingFields.push("Customer ID");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "client_manager";
  BranchCommon.isBranchAuthorizedForAction(branch_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message,
      });
    }

    BranchCommon.isBranchTokenValid(
      _token,
      sub_user_id || "",
      branch_id,
      async (err, result) => {
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

        // Fetch all required data
        const dataPromises = [
          new Promise((resolve) =>
            Customer.infoByID(customer_id, (err, result) => {
              if (err) return resolve([]);
              resolve(result);
            })
          ),
          new Promise((resolve) =>
            Bulk.list(branch_id, (err, result) => {
              if (err) return resolve([]);
              resolve(result);
            })
          ),
        ];

        Promise.all(dataPromises).then(([customer, bulks]) => {
          res.json({
            status: true,
            message: "Listings fetched successfully",
            data: {
              customer,
              bulks,
            },
            totalResults: {
              customer: customer.length,
              bulks: bulks.length,
            },
            token: newToken,
          });
        });
      }
    );
  });
};
