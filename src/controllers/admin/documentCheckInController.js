const crypto = require("crypto");
const DocumentCheckInModel = require("../../models/admin/documentCheckInModel");
const Customer = require("../../models/customer/customerModel");
const ClientMasterTrackerModel = require("../../models/admin/clientMasterTrackerModel");
const ClientApplication = require("../../models/customer/branch/clientApplicationModel");
const Branch = require("../../models/customer/branch/branchModel");
const AdminCommon = require("../../models/admin/commonModel");
const App = require("../../models/appModel");
const BranchCommon = require("../../models/customer/branch/commonModel");
const {
  finalReportMail,
} = require("../../mailer/admin/client-master-tracker/finalReportMail");
const {
  qcReportCheckMail,
} = require("../../mailer/admin/client-master-tracker/qcReportCheckMail");
const {
  readyForReport,
} = require("../../mailer/admin/client-master-tracker/readyForReport");

const fs = require("fs");
const path = require("path");
const { generatePDF } = require("../../utils/finalReportPdf");
const { upload, saveImage, saveImages } = require("../../utils/cloudImageSave");
const { getClientIpAddress } = require("../../utils/ipAddress");

exports.list = (req, res) => {
  const { admin_id, _token, from, to } = req.query;

  // Check for missing fields
  const missingFields = [];
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");

  // Return error if there are missing fields
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "application_document";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        message: authResult.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!tokenResult.status) {
        return res
          .status(401)
          .json({ status: false, message: tokenResult.message });
      }

      const newToken = tokenResult.newToken;

      // Fetch all required data
      const dataPromises = [
        new Promise((resolve) =>
          ClientMasterTrackerModel.list(from, to, (err, result) => {
            if (err) return resolve([]);
            resolve(result);
          })
        ),
        new Promise((resolve) =>
          ClientMasterTrackerModel.filterOptionsForCustomers(from, to, (err, result) => {
            if (err) return resolve([]);
            resolve(result);
          })
        ),
      ];

      Promise.all(dataPromises).then(([customers, filterOptionsForCustomers]) => {
        res.json({
          status: true,
          message: "Customers fetched successfully",
          data: {
            customers,
            filterOptions: filterOptionsForCustomers,
          },
          totalResults: {
            customers: customers.length,
            filterOptions: filterOptionsForCustomers.length,
          },
          token: newToken,
        });
      });
    });
  });
};

exports.applicationListByBranch = (req, res) => {
  const { filter_status, branch_id, admin_id, _token, status } = req.query;

  let missingFields = [];
  if (
    !branch_id ||
    branch_id === "" ||
    branch_id === undefined ||
    branch_id === "undefined"
  )
    missingFields.push("Branch ID");
  if (
    !admin_id ||
    admin_id === "" ||
    admin_id === undefined ||
    admin_id === "undefined"
  )
    missingFields.push("Admin ID");
  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  )
    missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "application_document";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        err: result,
        message: result.message, // Return the message from the authorization function
      });
    }

    Branch.getBranchById(branch_id, (err, currentBranch) => {
      if (err) {
        console.error("Database error during branch retrieval:", err);
        return res.status(500).json({
          status: false,
          message: "Failed to retrieve Branch. Please try again.",
          token: newToken,
        });
      }

      if (!currentBranch) {
        return res.status(404).json({
          status: false,
          message: "Branch not found.",
        });
      }

      Customer.getCustomerById(
        parseInt(currentBranch.customer_id),
        (err, currentCustomer) => {
          if (err) {
            console.error("Database error during customer retrieval:", err);
            return res.status(500).json({
              status: false,
              message: "Failed to retrieve Customer. Please try again.",
              token: newToken,
            });
          }

          if (!currentCustomer) {
            return res.status(404).json({
              status: false,
              message: "Customer not found.",
              token: newToken,
            });
          }
          // Verify admin token
          AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
              console.error("Error checking token validity:", err);
              return res
                .status(500)
                .json({ status: false, err, message: err.message });
            }

            if (!result.status) {
              return res
                .status(401)
                .json({ status: false, err: result, message: result.message });
            }

            const newToken = result.newToken;

            if (
              !status ||
              status === "" ||
              status === undefined ||
              status === "undefined"
            ) {
              let status = null;
            }

            DocumentCheckInModel.applicationListByBranch(
              filter_status,
              branch_id,
              status,
              (err, result) => {
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
                  message: "Branches tracker fetched successfully",
                  branchName: currentBranch.name,
                  customerName: currentCustomer.name,
                  tatDays: currentCustomer.tat_days,
                  customers: result,
                  totalResults: result.length,
                  token: newToken,
                });
              }
            );
          });
        }
      );
    });
  });
};

exports.upload = async (req, res) => {
  // Use multer to handle the upload
  upload(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({
        status: false,
        message: "Error uploading file.",
      });
    }

    const {
      admin_id: adminId,
      branch_id: branchId,
      _token: token,
      customer_code: customerCode,
      application_id: appId,
      application_code: appCode,
      db_table: dbTable,
      db_column: dbColumn,
      send_mail: sendMail,
      email_status: emailStatus,
    } = req.body;

    // Validate required fields and collect missing ones
    const requiredFields = {
      adminId,
      branchId,
      token,
      customerCode,
      appCode,
      appId,
      dbTable,
      dbColumn,
    };

    const cleanDBColumn = dbColumn.replace("[", "").replace("]", "");
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

    if (sendMail == 1 && !emailStatus) {
      console.warn("Email status required when sending mail");
      return res.status(400).json({
        status: false,
        message: "The field 'emailStatus' is required when sending an email.",
      });
    }

    const action = "application_document";
    AdminCommon.isAdminAuthorizedForAction(adminId, action, (result) => {
      if (!result.status) {
        return res.status(403).json({
          status: false,
          message: result.message, // Return the message from the authorization function
        });
      }

      // Verify admin token
      AdminCommon.isAdminTokenValid(token, adminId, async (err, result) => {
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
        ClientMasterTrackerModel.applicationByID(
          appId,
          branchId,
          (err, application) => {
            if (err) {
              console.error("Database error:", err);
              return res.status(500).json({
                status: false,
                message: err.message,
                token: newToken,
              });
            }

            if (!application) {
              console.warn("Application not found 3");
              return res.status(404).json({
                status: false,
                message: "Application not found 3",
                token: newToken,
              });
            }
            App.appInfo("backend", async (err, appInfo) => {
              if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                  status: false,
                  err,
                  message: err.message,
                  token: newToken,
                });
              }

              let imageHost = "www.example.in";

              if (appInfo) {
                imageHost = appInfo.cloud_host || "www.example.in";
              }
              // Define the target directory for uploads
              const targetDirectory = `uploads/customer/${customerCode}/application/${application.application_id}/${dbTable}`;
              // Create the target directory for uploads
              await fs.promises.mkdir(targetDirectory, { recursive: true });

              let savedImagePaths = [];

              if (req.files.images && req.files.images.length > 0) {
                const uploadedImages = await saveImages(
                  req.files.images,
                  targetDirectory
                );
                uploadedImages.forEach((imagePath) => {
                  savedImagePaths.push(`${imageHost}/${imagePath}`);
                });
              }

              // Process single file upload
              if (req.files.image && req.files.image.length > 0) {
                const uploadedImage = await saveImage(
                  req.files.image[0],
                  targetDirectory
                );
                savedImagePaths.push(`${imageHost}/${uploadedImage}`);
              }

              const modifiedDbTable = dbTable.replace(/-/g, "_").toLowerCase();
              const cleanDBColumnForQry = cleanDBColumn
                .replace(/-/g, "_")
                .toLowerCase();

              // Call the model to upload images
              DocumentCheckInModel.upload(
                appId,
                modifiedDbTable,
                cleanDBColumnForQry,
                savedImagePaths,
                (success, result) => {
                  if (!success) {
                    console.error(
                      "Upload failed:",
                      result || "An error occurred while saving the image."
                    );
                    return res.status(500).json({
                      status: false,
                      message:
                        result || "An error occurred while saving the image.",
                      token: newToken,
                      savedImagePaths,
                    });
                  }

                  // Handle sending email notifications if required
                  if (sendMail == 1) {
                    BranchCommon.getBranchandCustomerEmailsForNotification(
                      branchId,
                      (emailError, emailData) => {
                        if (emailError) {
                          console.error("Error fetching emails:", emailError);
                          return res.status(500).json({
                            status: false,
                            message: "Failed to retrieve email addresses.",
                            token: newToken,
                            savedImagePaths,
                          });
                        }

                        const { branch, customer } = emailData;
                        const companyName = customer.name;

                        // Prepare recipient and CC lists
                        const toArr = [{ name: branch.name, email: branch.email }];
                        const ccArr = JSON.parse(customer.emails).map((email) => ({
                          name: customer.name,
                          email: email.trim(),
                        }));

                        // Step 4: Merge into final recipients
                        const finalCcEmails = [
                          { name: 'QC Team', email: 'qc@screeningstar.com' },
                          ...ccArr,
                        ];

                        if (application.is_data_qc !== 1) {
                          console.warn("Application Data QC is not done yet 3");
                          return res.status(404).json({
                            status: false,
                            message: "Data QC for application data is pending.",
                            token: newToken,
                            savedImagePaths,
                          });
                        }

                        DocumentCheckInModel.getAttachmentsByClientAppID(
                          appId,
                          (err, attachments) => {
                            if (err) {
                              console.error(
                                "Database error while fetching attachments:",
                                err
                              );
                              return res.status(500).json({
                                status: false,
                                message: "Database error occurred",
                                token: newToken,
                                savedImagePaths,
                              });
                            }

                            ClientMasterTrackerModel.getCMTApplicationById(
                              appId,
                              async (err, CMTApplicationData) => {
                                if (err) {
                                  console.error("Database error:", err);
                                  return res.status(500).json({
                                    status: false,
                                    message: err.message,
                                    token: newToken,
                                  });
                                }

                                const case_initiated_date =
                                  CMTApplicationData.initiation_date || "N/A";
                                const final_report_date =
                                  CMTApplicationData.report_date || "N/A";
                                const report_type =
                                  CMTApplicationData.report_type || "N/A";
                                const overall_status =
                                  CMTApplicationData.overall_status || "N/A";

                                const gender =
                                  application.gender?.toLowerCase();
                                const maritalStatus =
                                  application.marital_status?.toLowerCase();

                                let genderTitle = "Mr.";
                                if (gender === "male") {
                                  genderTitle = "Mr.";
                                } else if (gender === "female") {
                                  genderTitle =
                                    maritalStatus === "married"
                                      ? "Mrs."
                                      : "Ms.";
                                }

                                const today = new Date();
                                const formattedDate = `${today.getFullYear()}-${String(
                                  today.getMonth() + 1
                                ).padStart(2, "0")}-${String(
                                  today.getDate()
                                ).padStart(2, "0")}`;
                                const pdfTargetDirectory = `uploads/customers/${customerCode}/client-applications/${application.application_id}/final-reports`;
                                const pdfFileName =
                                  `${application.name}_${formattedDate}.pdf`
                                    .replace(/\s+/g, "-")
                                    .toLowerCase();
                                const pdfPath = await generatePDF(
                                  appId,
                                  branchId,
                                  pdfFileName,
                                  pdfTargetDirectory
                                );
                                attachments +=
                                  (attachments ? "," : "") +
                                  `${imageHost}/${pdfPath}`;

                                // Prepare and send email based on application status
                                // Final report email
                                if (emailStatus == 1) {
                                  finalReportMail(
                                    "cmt",
                                    "final",
                                    companyName,
                                    genderTitle,
                                    application.name,
                                    application.application_id,
                                    case_initiated_date,
                                    final_report_date,
                                    report_type,
                                    overall_status,
                                    application.final_verification_status,
                                    attachments,
                                    toArr,
                                    finalCcEmails
                                  )
                                    .then(() => {
                                      return res.status(200).json({
                                        status: true,
                                        message: "CMT Final Report mail sent.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    })
                                    .catch((emailError) => {
                                      console.error(
                                        "Error sending email for final report:",
                                        emailError
                                      );
                                      return res.status(200).json({
                                        status: true,
                                        message: "Failed to send CMT mail.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    });
                                }
                                // QC report email
                                else if (emailStatus == 2) {
                                  const toQCTeam = [
                                    { name: 'QC Team', email: 'qc@screeningstar.com' }
                                  ];
                                  qcReportCheckMail(
                                    "cmt",
                                    "qc",
                                    genderTitle,
                                    application.name,
                                    application.application_id,
                                    attachments,
                                    toQCTeam,
                                    []
                                  )
                                    .then(() => {
                                      return res.status(200).json({
                                        status: true,
                                        message:
                                          "CMT Quality Check Report mail sent.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    })
                                    .catch((emailError) => {
                                      console.error(
                                        "Error sending email for QC report:",
                                        emailError
                                      );
                                      return res.status(200).json({
                                        status: true,
                                        message: "Failed to send CMT mail.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    });
                                }
                                // Handling for other statuses
                                else if (emailStatus == 3) {
                                  readyForReport(
                                    "cmt",
                                    "ready",
                                    application.application_id,
                                    toArr,
                                    ccArr
                                  )
                                    .then(() => {
                                      return res.status(200).json({
                                        status: true,
                                        message: "Ready for Report mail sent.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    })
                                    .catch((emailError) => {
                                      console.error(
                                        "Error sending email for report:",
                                        emailError
                                      );
                                      return res.status(200).json({
                                        status: true,
                                        message: "Failed to send CMT mail.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    });
                                }
                                // Handle unknown email status
                                else {
                                  return res.status(200).json({
                                    status: true,
                                    message: "Images uploaded successfully.",
                                    token: newToken,
                                    savedImagePaths,
                                  });
                                }
                              }
                            );
                          }
                        );

                      }
                    );
                  } else {
                    return res.status(200).json({
                      status: true,
                      message: "Images uploaded successfully.",
                      token: newToken,
                      savedImagePaths,
                    });
                  }
                }
              );
            });
          });
      });
    });
  });
};