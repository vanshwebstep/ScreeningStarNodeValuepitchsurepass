const Candidate = require("../../../../models/customer/branch/candidateApplicationModel");
const Customer = require("../../../../models/customer/customerModel");
const Branch = require("../../../../models/customer/branch/branchModel");
const BranchCommon = require("../../../../models/customer/branch/commonModel");
const DAV = require("../../../../models/customer/branch/davModel");
const CEF = require("../../../../models/customer/branch/cefModel");
const Service = require("../../../../models/admin/serviceModel");
const App = require("../../../../models/appModel");
const Admin = require("../../../../models/admin/adminModel");
const { candidateDAVFromPDF } = require("../../../../utils/candidateDAVFromPDF");
const fs = require("fs");
const {
  upload,
  saveImage,
  saveImages,
} = require("../../../../utils/cloudImageSave");

const {
  davSubmitMail,
} = require("../../../../mailer/customer/branch/candidate/davSubmitMail");

exports.isApplicationExist = (req, res) => {
  const { app_id, branch_id, customer_id } = req.query;

  let missingFields = [];
  if (
    !app_id ||
    app_id === "" ||
    app_id === undefined ||
    app_id === "undefined"
  ) {
    missingFields.push("Application ID");
  }

  if (
    !branch_id ||
    branch_id === "" ||
    branch_id === undefined ||
    branch_id === "undefined"
  ) {
    missingFields.push("Branch ID");
  }

  if (
    !customer_id ||
    customer_id === "" ||
    customer_id === undefined ||
    customer_id === "undefined"
  ) {
    missingFields.push("Customer ID");
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  DAV.isApplicationExist(
    app_id,
    branch_id,
    customer_id,
    (err, applicationResult) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          status: false,
          message: err.message
        });
      }

      if (!applicationResult.status) {
        return res.status(404).json({
          status: false,
          message: applicationResult.message,
        });
      }

      // Store application data if status is true
      const currentCandidateApplication = applicationResult.data;

      if (currentCandidateApplication) {
        DAV.getDAVApplicationById(app_id, (err, currentDAVApplication) => {
          if (err) {
            console.error(
              "Database error during DAV application retrieval:",
              err
            );
            return res.status(500).json({
              status: false,
              message: "Failed to retrieve DAV Application. Please try again.",
            });
          }

          /*
          if (
            currentDAVApplication &&
            Object.keys(currentDAVApplication).length > 0
          ) {
            return res.status(400).json({
              status: false,
              message: "An application has already been submitted.",
            });
          }
          */

          return res.status(200).json({
            status: true,
            data: currentCandidateApplication,
            message: "Application exists.",
          });
        });
      } else {
        return res.status(404).json({
          status: false,
          message: "Application does not exist.",
        });
      }
    }
  );
};
exports.submit = (req, res) => {

  console.log("==== DAV SUBMIT API HIT ====");

  const { branch_id, customer_id, application_id, personal_information } = req.body;

  const requiredFields = {
    branch_id,
    customer_id,
    application_id,
    personal_information,
  };

  const missingFields = Object.keys(requiredFields)
    .filter(f => !requiredFields[f])
    .map(f => f.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`
    });
  }

  Candidate.isApplicationExist(
    application_id,
    branch_id,
    customer_id,
    (err, result) => {

      if (err) {
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status || !result.data) {
        return res.status(404).json({
          status: false,
          message: "Application does not exist"
        });
      }

      DAV.create(
        personal_information,
        application_id,
        branch_id,
        customer_id,
        (err) => {

          if (err) {
            return res.status(500).json({
              status: false,
              message: "DAV create failed"
            });
          }

          // ✅ NO EMAIL HERE
          return res.json({
            status: true,
            message: "DAV Form Submitted. Please upload documents."
          });

        }
      );
    }
  );
};


exports.testDavPdf = async (req, res) => {
  try {
    const candidate_application_id = 252;
    const client_unique_id = "CL-943";
    const branch_id = 96;
    const customer_id = 82;
    const name = "IMAGE TEST ";

    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    sendNotificationEmails(
      candidate_application_id,
      name,
      branch_id,
      customer_id,
      client_unique_id,
      'Demo',
      res
    );
  } catch (error) {
    console.error("Error:", error.message);

    // Return error response
    res.status(500).json({
      status: false,
      message: "Failed to generate PDF",
      error: error.message,
    });
  }
};

// Helper function to send notification emails
const sendNotificationEmails = (
  candidateAppId,
  name,
  branch_id,
  customer_id,
  client_unique_id,
  customer_name,
  res
) => {
  // console.log(`Step 1: Check if application exists`);
  Candidate.isApplicationExist(
    candidateAppId,
    branch_id,
    customer_id,
    (err, currentCandidateApplication) => {
      if (err) {
        console.error("Database error during application existence check:", err);
        return res.status(500).json({
          status: false,
          message: err.message,
        });
      }
      // console.log(`Step 2: Check if application exists - `, currentCandidateApplication);

      if (!currentCandidateApplication) {
        return res.status(404).json({
          status: false,
          message: "Application does not exist.",
        });
      }
      DAV.getDAVApplicationById(
        candidateAppId,
        (err, currentDAVApplication) => {
          if (err) {
            console.error("Database error during DAV application retrieval:", err);
            return res.status(500).json({
              status: false,
              message: "Failed to retrieve DAV Application. Please try again.",
            });
          }
          // console.log(`Step 3: Check if DAV application exists - `, currentDAVApplication);
          BranchCommon.getBranchandCustomerEmailsForNotification(
            branch_id,
            async (err, emailData) => {
              if (err) {
                console.error("Error fetching emails:", err);
                return res.status(500).json({
                  status: false,
                  message: "Failed to retrieve email addresses.",
                });
              }
              DAV.getAttachmentsByCandidateAppID(
                candidateAppId,
                async (err, attachments) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                      status: false,
                      message: "Database error occurred",
                    });
                  }

                  // console.log(`Step 4: Get attachments - `, attachments);

                  App.appInfo("backend", async (err, appInfo) => {
                    if (err) {
                      console.error("Database error:", err);
                      return res.status(500).json({
                        status: false,
                        err,
                        message: err.message,
                      });
                    }

                    let imageHost = "www.example.in";

                    if (appInfo) {
                      imageHost = appInfo.cloud_host || "www.example.in";
                    }
                    // console.log(`Step 5: App info - `, appInfo);

                    const today = new Date();
                    const formattedDate = `${today.getFullYear()}-${String(
                      today.getMonth() + 1
                    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

                    // Generate the PDF
                    const candidateFormPdfTargetDirectory = `uploads/customers/${client_unique_id}/candidate-applications/CD-${client_unique_id}-${candidateAppId}/digital-address-verification`;

                    const pdfFileName = `${name}_${formattedDate}.pdf`
                      .replace(/\s+/g, "-")
                      .toLowerCase();
                    const candidateDAVFromPDFPath = await candidateDAVFromPDF(
                      candidateAppId,
                      branch_id,
                      customer_id,
                      pdfFileName,
                      candidateFormPdfTargetDirectory
                    );

                    // console.log("candidateDAVFromPDFPath - ", candidateDAVFromPDFPath);

                    // console.log("step 5.1: Generate PDF - ", pdfPath);
                    let newAttachments = [];
                    if (candidateDAVFromPDFPath) newAttachments.push(`${imageHost}/${candidateDAVFromPDFPath}`);

                    if (newAttachments.length > 0) {
                      attachments += (attachments ? "," : "") + newAttachments.join(",");
                    }

                    // console.log("step 6: New attachments - ", newAttachments);
                    Admin.filterAdmins({ status: "active", role: "admin_user" }, (err, adminResult) => {
                      if (err) {
                        console.error("Database error:", err);
                        return res.status(500).json({
                          status: false,
                          message: "Error retrieving admin details.",
                          token: newToken,
                        });
                      }

                      // console.log("step 7: Filter admins - ", adminResult);
                      const { branch, customer } = emailData;

                      // Prepare recipient and CC lists
                      const toArr = [{ name: 'Address Team', email: 'addres@screeningstar.com' }];
                      // const toArr = [{ name: branch.name, email: branch.email }];
                      const candidateArr = [{ name: currentCandidateApplication.name, email: currentCandidateApplication.email }];
                      const bccArr = [
                        { name: "Karan Khurana", email: "khuranakaran2000@gmail.com" }
                      ];
                      const emailList = JSON.parse(customer.emails);
                      const ccArr1 = emailList.map(email => ({ name: customer.name, email }));

                      const mergedEmails = [
                        ...ccArr1,
                        ...adminResult.map(admin => ({ name: admin.name, email: admin.email }))
                      ];

                      const uniqueEmails = [
                        ...new Map(mergedEmails.map(item => [item.email, item])).values()
                      ];

                      const ccArr = [
                        ...new Map([...ccArr1, ...uniqueEmails].map(item => [item.email, item])).values()
                      ];

                      const toCC = [
                        { name: 'QC Team', email: 'qc@screeningstar.com' },
                        { name: 'BGV Team', email: 'Bgv@screeningstar.com' },
                        { name: 'Vansh', email: 'viteshwebstep@gmail.com' }
                      ];

                      // console.log("step 8: Merged emails - ", mergedEmails);
                      // Send application creation email
                      davSubmitMail(
                        "Candidate Digital Address Form",
                        "submit",
                        name,
                        customer_name,
                        attachments,
                        toArr || [],
                        toCC,
                        bccArr
                      )
                        .then(() => {
                          return res.status(201).json({
                            status: true,
                            message:
                              "DAV Form & documents Submitted.",
                          });
                        })
                        .catch((emailError) => {
                          console.error(
                            "Error sending application creation email:",
                            emailError
                          );
                          return res.status(201).json({
                            status: true,
                            message:
                              "DAV Form & documents Submitted.",
                          });
                        });
                    });
                  });
                }
              );
            }
          );
        });
    });
};

exports.upload = async (req, res) => {
  // Use multer to handle the upload
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        status: false,
        message: "Error uploading file.",
      });
    }

    try {
      const {
        branch_id,
        customer_id,
        application_id,
        upload_category,
        send_mail,
      } = req.body;

      // Validate required fields and collect missing ones
      const requiredFields = {
        branch_id,
        customer_id,
        application_id,
        upload_category,
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

      // Check if the application exists
      Candidate.isApplicationExist(
        application_id,
        branch_id,
        customer_id,
        (err, applicationResult) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({
              status: false,
              message: err.message
            });
          }

          if (!applicationResult.status) {
            return res.status(404).json({
              status: false,
              message: applicationResult.message,
            });
          }

          // Store application data if status is true
          const exists = applicationResult.data;

          const candidateName = applicationResult.data.name;
          if (!exists) {
            return res.status(404).json({
              status: false,
              message: "Application does not exist.",
            });
          }
          // Check if DAV application exists
          DAV.getDAVApplicationById(
            application_id,
            (err, currentDAVApplication) => {
              if (err) {
                console.error(
                  "Database error during DAV application retrieval:",
                  err
                );
                return res.status(500).json({
                  status: false,
                  message:
                    "Failed to retrieve DAV Application. Please try again.",
                });
              }

              if (
                !currentDAVApplication &&
                Object.keys(currentDAVApplication).length === 0
              ) {
                return res.status(400).json({
                  status: false,
                  message: "An application has not submmited.",
                });
              }

              // Retrieve branch details
              Branch.getBranchById(branch_id, (err, currentBranch) => {
                if (err) {
                  console.error("Database error during branch retrieval:", err);
                  return res.status(500).json({
                    status: false,
                    message: "Failed to retrieve Branch. Please try again.",
                  });
                }

                if (
                  !currentBranch ||
                  parseInt(currentBranch.customer_id) !== parseInt(customer_id)
                ) {
                  return res.status(404).json({
                    status: false,
                    message: "Branch not found or customer mismatch.",
                  });
                }

                // Retrieve customer details
                Customer.getCustomerById(
                  customer_id,
                  (err, currentCustomer) => {
                    if (err) {
                      console.error(
                        "Database error during customer retrieval:",
                        err
                      );
                      return res.status(500).json({
                        status: false,
                        message:
                          "Failed to retrieve Customer. Please try again.",
                      });
                    }

                    if (!currentCustomer) {
                      return res.status(404).json({
                        status: false,
                        message: "Customer not found.",
                      });
                    }
                    const customer_code = currentCustomer.client_unique_id;
                    // Check if the admin is authorized
                    App.appInfo("backend", async (err, appInfo) => {
                      if (err) {
                        console.error("Database error:", err);
                        return res.status(500).json({
                          status: false,
                          err,
                          message: err.message,
                        });
                      }

                      let imageHost = "www.example.in";

                      if (appInfo) {
                        imageHost = appInfo.cloud_host || "www.example.in";
                      }
                      // Define the target directory for uploads
                      let targetDir;
                      let db_column;
                      switch (upload_category) {
                        case "identity_proof":
                          targetDir = `uploads/customers/${currentCustomer.client_unique_id}/candidate-applications/CD-${currentCustomer.client_unique_id}-${application_id}/dav/documents/identity-proofs`;
                          db_column = `identity_proof`;
                          break;
                        case "home_photo":
                          targetDir = `uploads/customers/${currentCustomer.client_unique_id}/candidate-applications/CD-${currentCustomer.client_unique_id}-${application_id}/dav/documents/home-photos`;
                          db_column = `home_photo`;
                          break;
                        case "locality":
                          targetDir = `uploads/customers/${currentCustomer.client_unique_id}/candidate-applications/CD-${currentCustomer.client_unique_id}-${application_id}/dav/documents/localities`;
                          db_column = `locality`;
                          break;
                        default:
                          return res.status(400).json({
                            status: false,
                            message: "Invalid upload category.",
                          });
                      }

                      try {
                        // Create the target directory for uploads
                        await fs.promises.mkdir(targetDir, { recursive: true });

                        let savedImagePaths = [];

                        if (req.files.images && req.files.images.length > 0) {
                          const uploadedImages = await saveImages(
                            req.files.images,
                            targetDir
                          );
                          uploadedImages.forEach((imagePath) => {
                            savedImagePaths.push(`${imageHost}/${imagePath}`);
                          });
                        }

                        // Process single file upload
                        if (req.files.image && req.files.image.length > 0) {
                          const uploadedImage = await saveImage(
                            req.files.image[0],
                            targetDir
                          );
                          savedImagePaths.push(`${imageHost}/${uploadedImage}`);
                        }

                        DAV.updateImages(
                          currentDAVApplication.id,
                          application_id,
                          savedImagePaths,
                          db_column,
                          (err) => {

                            if (err) {
                              return res.status(500).json({
                                status: false,
                                message: "Image save failed"
                              });
                            }

                            // ✅ SEND EMAIL ONLY WHEN FRONTEND SAYS SO
                            if (send_mail == 1) {

                              sendNotificationEmails(
                                application_id,
                                candidateName,
                                branch_id,
                                customer_id,
                                currentCustomer.client_unique_id,
                                currentCustomer.name,
                                res
                              );

                            } else {

                              return res.json({
                                status: true,
                                message: "Image uploaded"
                              });

                            }

                          }
                        );

                      } catch (error) {
                        console.error("Error saving image:", error);
                        return res.status(500).json({
                          status: false,
                          message: "An error occurred while saving the image.",
                        });
                      }
                    });
                  }
                );
              });
            }
          );
        }
      );
    } catch (error) {
      console.error("Error processing upload:", error);
      return res.status(500).json({
        status: false,
        message: "An error occurred during the upload process.",
      });
    }
  });
};
