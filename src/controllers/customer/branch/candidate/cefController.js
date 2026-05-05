const Candidate = require("../../../../models/customer/branch/candidateApplicationModel");
const Customer = require("../../../../models/customer/customerModel");
const Branch = require("../../../../models/customer/branch/branchModel");
const BranchCommon = require("../../../../models/customer/branch/commonModel");
const CEF = require("../../../../models/customer/branch/cefModel");
const Service = require("../../../../models/admin/serviceModel");
const App = require("../../../../models/appModel");
const Admin = require("../../../../models/admin/adminModel");

const { cdfDataPDF } = require("../../../../utils/cefDataPDF");
const { candidateFormPDF } = require("../../../../utils/candidateFormPDF");
const { candidateDigitalConsent } = require("../../../../utils/candidateDigitalConsent");
const fs = require("fs");
const path = require("path");
const {
  upload,
  saveImage,
  saveImages,
} = require("../../../../utils/cloudImageSave");

const {
  cefSubmitMail,
} = require("../../../../mailer/customer/branch/candidate/cefSubmitMail");

const {
  reminderMail,
} = require("../../../../mailer/customer/branch/candidate/reminderMail");

exports.test = (req, res) => {
  sendNotificationEmails(
    90,
    35,
    "Vansh",
    79,
    65,
    'CL-992623424',
    'Development',
    '1',
    res
  );
};

exports.formJson = (req, res) => {
  const { service_id } = req.query;

  let missingFields = [];
  if (!service_id) missingFields.push("Service ID");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  CEF.formJson(service_id, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({
        status: false,
        message: "An error occurred while fetching service form json.",
      });
    }

    return res.json({
      status: true,
      message: "Service form json fetched successfully.",
      formJson: result,
      totalResults: result.length,
    });
  });
};

exports.isApplicationExist = (req, res) => {
  const { candidate_application_id, branch_id, customer_id } = req.query;

  let missingFields = [];
  if (
    !candidate_application_id ||
    candidate_application_id === "" ||
    candidate_application_id === undefined ||
    candidate_application_id === "undefined"
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

  Candidate.isApplicationExist(
    candidate_application_id,
    branch_id,
    customer_id,
    (err, currentCandidateApplication) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          status: false,
          message: err.message,
        });
      }

      if (currentCandidateApplication) {
        CEF.getCEFApplicationById(
          candidate_application_id,
          branch_id,
          customer_id,
          (err, currentCEFApplication) => {
            if (err) {
              console.error(
                "Database error during CEF application retrieval:",
                err
              );
              return res.status(500).json({
                status: false,
                message:
                  "Failed to retrieve CEF Application. Please try again.",
              });
            }

            Customer.getCustomerById(
              parseInt(customer_id),
              (err, currentCustomer) => {
                if (err) {
                  console.error(
                    "Database error during customer retrieval:",
                    err
                  );
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
                /*
            if (
              currentCEFApplication &&
              Object.keys(currentCEFApplication).length > 0
            ) {
              return res.status(400).json({
                status: false,
                message: `The application has already been submitted. Candidate Application ID: CD-${currentCustomer.client_unique_id}-${candidate_application_id}`,
              });
            }
            */

                if (
                  currentCEFApplication && currentCEFApplication?.is_submitted == 1
                ) {
                  return res.status(400).json({
                    status: false,
                    message: `The application has already been submitted. Candidate Application ID: CD-${currentCustomer.client_unique_id}-${candidate_application_id}`,
                  });
                }

                const services = currentCandidateApplication.data.services;

                // Check if services exists and is not empty
                if (!services || services.trim() === "") {
                  return res.status(200).json({
                    status: true,
                    data: {
                      application: currentCandidateApplication.data,
                      cefApplication: currentCEFApplication,
                      serviceData: [],
                      customer: currentCustomer,
                    },
                    message: "Application exists.",
                  });
                }

                const service_ids = Array.isArray(
                  services
                )
                  ? services
                  : services
                    .split(",")
                    .map((item) => item.trim());
                CEF.formJsonWithData(
                  service_ids,
                  candidate_application_id,
                  (err, serviceData) => {
                    if (err) {
                      console.error("Database error:", err);
                      return res.status(500).json({
                        status: false,
                        message:
                          "An error occurred while fetching service form json.",
                        token: newToken,
                      });
                    }
                    return res.status(200).json({
                      status: true,
                      data: {
                        application: currentCandidateApplication.data,
                        cefApplication: currentCEFApplication,
                        serviceData,
                        customer: currentCustomer,
                      },
                      message: "Application exists.",
                    });
                  }
                );
              }
            );
          }
        );
      } else {
        return res.status(404).json({
          status: false,
          message: "Application does not exist.",
        });
      }
    }
  );
};

exports.unsubmittedApplications = (req, res) => {
  // console.log("Starting filledOrUnfilledServices function...");
  CEF.unsubmittedApplications((err, applications) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({
        status: false,
        message: "Database error occurred",
      });
    }

    if (!applications.length) {
      return res.status(200).json({
        status: true,
        data: [],
      });
    }

    // Create an array of promises for each application
    const applicationPromises = applications.map((application) => {
      return new Promise((resolve, reject) => {
        const serviceIds = application.services;

        let serviceIdsArr = [];
        if (serviceIds) {
          serviceIdsArr = Array.isArray(serviceIds) ? serviceIds : serviceIds.split(',').map(s => s.trim());
        }

        // Fetch service data for each application
        CEF.filledOrUnfilledServices(serviceIds, application.candidate_application_id, (err, serviceData) => {
          if (err) {
            console.error("Error fetching service data:", err);
            return reject({
              status: false,
              message: "Error fetching service data",
            });
          }
          application.filledServices = serviceData;

          BranchCommon.getBranchandCustomerEmailsForNotification(
            application.branch_id,
            (emailError, emailData) => {
              if (emailError) {
                console.error("Error fetching emails:", emailError);
                return res.status(500).json({
                  status: false,
                  message: "Failed to retrieve email addresses.",
                  token: newToken,
                });
              }
              Admin.filterAdmins({ status: "active", role: "admin" }, (err, adminResult) => {
                if (err) {
                  console.error("Database error:", err);
                  return res.status(500).json({
                    status: false,
                    message: "Error retrieving admin details.",
                    token: newToken,
                  });
                }
                // Once all service names are fetched, get app info
                App.appInfo("frontend", (err, appInfo) => {
                  if (err) {
                    console.error("Database error:", err);
                    if (!res.headersSent) {
                      return res.status(500).json({
                        status: false,
                        message: err.message,
                      });
                    }
                  }

                  if (appInfo) {
                    const toArr = [
                      { name: application.application_name, email: application.email }
                    ];

                    const adminMailArr = adminResult.map(admin => ({
                      name: admin.name,
                      email: admin.email
                    }));

                    const { branch, customer } = emailData;

                    // Prepare recipient and CC lists

                    const emailList = JSON.parse(customer.emails);
                    const ccArr1 = emailList.map((email) => ({
                      name: customer.name,
                      email,
                    }));

                    const mergedEmails = [
                      { name: branch.name, email: branch.email },
                      ...ccArr1,
                      ...adminResult.map((admin) => ({
                        name: admin.name,
                        email: admin.email,
                      })),
                    ];

                    const uniqueEmails = [
                      ...new Map(
                        mergedEmails.map((item) => [item.email, item])
                      ).values(),
                    ];

                    const ccArr2 = [
                      { name: 'QC Team', email: 'qc@screeningstar.com' },
                      ...uniqueEmails
                    ];

                    const ccArr = [
                      ...new Map(
                        [...ccArr1, ...ccArr2].map((item) => [
                          item.email,
                          item,
                        ])
                      ).values(),
                    ];

                    const appHost = appInfo.host || "www.example.com";
                    const base64_app_id = btoa(application.candidate_application_id);
                    const base64_branch_id = btoa(application.branch_id);
                    const base64_customer_id = btoa(application.customer_id);
                    const base64_link_with_ids = `YXBwX2lk=${base64_app_id}&YnJhbmNoX2lk=${base64_branch_id}&Y3VzdG9tZXJfaWQ==${base64_customer_id}`;

                    let bgv_href = '';
                    let dav_href = '';

                    if (application.cef_submitted == 0) {
                      bgv_href = `${appHost}/background-form?${base64_link_with_ids}`;
                    }

                    // Fetch and process digital address service
                    Service.digitlAddressService((err, serviceEntry) => {
                      if (err) {
                        console.error("Database error:", err);
                        return reject({
                          status: false,
                          message: err.message,
                        });
                      }

                      if (serviceEntry) {
                        const digitalAddressID = parseInt(serviceEntry.id, 10);
                        if (serviceIdsArr.includes(digitalAddressID)) {
                          dav_href = `${appHost}/digital-form?${base64_link_with_ids}`;
                        }
                      }

                      // Send application creation reminder email
                      reminderMail(
                        "candidate application",
                        "reminder",
                        application.application_name,
                        application.customer_name,
                        application.branch_name,
                        bgv_href,
                        dav_href,
                        serviceData,
                        toArr || [],
                        ccArr || []
                      )
                        .then(() => {
                          // console.log("Reminder email sent.");

                          CEF.updateReminderDetails(
                            { candidateAppId: application.candidate_application_id },
                            (err, result) => {
                              resolve(application);
                            }
                          );
                        })
                        .catch((emailError) => {
                          console.error("Error sending reminder email:", emailError);
                          resolve(application);  // Still resolve the application, but without email success
                        });
                    });
                  }
                });
              });
            });

        });
      });
    });

    // Wait for all promises to resolve
    Promise.all(applicationPromises)
      .then((updatedApplications) => {
        if (!res.headersSent) {
          return res.status(200).json({
            status: true,
            data: updatedApplications,
          });
        }
      })
      .catch((error) => {
        console.error("Error processing applications:", error);
        if (!res.headersSent) {
          return res.status(500).json({
            status: false,
            message: "Error processing applications",
          });
        }
      });
  });
};

exports.submit = (req, res) => {
  const {
    branch_id,
    customer_id,
    application_id,
    personal_information,
    annexure,
    is_submit,
  } = req.body;

  let submitStatus = is_submit;
  if (submitStatus === 1) {
    const requiredFields = {
      branch_id,
      customer_id,
      application_id,
      personal_information,
    };
    const missingFields = Object.keys(requiredFields)
      .filter((field) => !requiredFields[field] || requiredFields[field] === "")
      .map((field) => field.replace(/_/g, " "));

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }
  } else {
    submitStatus = 0;
  }
  const send_mail = submitStatus;

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
      const currentCandidateApplication = applicationResult.data;

      if (!currentCandidateApplication) {
        return res.status(404).json({
          status: false,
          message: "Application does not exist.",
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
        Customer.getCustomerById(customer_id, (err, currentCustomer) => {
          if (err) {
            console.error("Database error during customer retrieval:", err);
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
          // Check if CEF application exists
          CEF.getCEFApplicationById(
            application_id,
            branch_id,
            customer_id,
            (err, currentCEFApplication) => {
              if (err) {
                console.error(
                  "Database error during CEF application retrieval:",
                  err
                );
                return res.status(500).json({
                  status: false,
                  message:
                    "Failed to retrieve CEF Application. Please try again.",
                });
              }

              /*
              if (
                currentCEFApplication &&
                Object.keys(currentCEFApplication).length > 0
              ) {
                return res.status(400).json({
                  status: false,
                  message: "An application has already been submitted.",
                });
              }
              */

              // Create new CEF application
              CEF.create(
                personal_information,
                application_id,
                branch_id,
                customer_id,
                (err, cefResult) => {
                  if (err) {
                    console.error(
                      "Database error during CEF application creation:",
                      err
                    );
                    return res.status(500).json({
                      status: false,
                      message:
                        "An error occurred while submitting the application.",
                    });
                  }
                  // Handle annexures if provided
                  if (
                    typeof annexure === "object" &&
                    annexure !== null &&
                    Object.keys(annexure).length > 0
                  ) {
                    const annexurePromises = Object.keys(annexure).map(
                      (key) => {
                        const modifiedDbTable = `${key.replace(/-/g, "_")}`;
                        const modifiedDbTableForDbQuery = `cef_${key
                          .replace(/-/g, "_")
                          .toLowerCase()}`;
                        const subJson = annexure[modifiedDbTable];

                        return new Promise((resolve, reject) => {
                          CEF.getCMEFormDataByApplicationId(
                            application_id,
                            modifiedDbTableForDbQuery,
                            (err, currentCMEFormData) => {
                              if (err) {
                                console.error(
                                  "Database error during annexure retrieval:",
                                  err
                                );
                                return reject(
                                  "Error retrieving annexure data."
                                );
                              }

                              /*
                              if (
                                currentCMEFormData &&
                                Object.keys(currentCMEFormData).length > 0
                              ) {
                                return reject(
                                  "Annexure has already been filed."
                                );
                              }
                              */

                              CEF.createOrUpdateAnnexure(
                                cefResult.insertId,
                                application_id,
                                branch_id,
                                customer_id,
                                modifiedDbTableForDbQuery,
                                subJson,
                                (err) => {
                                  if (err) {
                                    console.error(
                                      "Database error during annexure update:",
                                      err
                                    );
                                    return reject(
                                      "Error updating annexure data."
                                    );
                                  }
                                  resolve();
                                }
                              );
                            }
                          );
                        });
                      }
                    );

                    // Process all annexure promises
                    Promise.all(annexurePromises)
                      .then(() => {
                        // console.log(`send_mail - `, send_mail);
                        // console.log(`submitStatus - `, submitStatus);
                        if (parseInt(send_mail) === 1 && submitStatus == 1) {
                          sendNotificationEmails(
                            application_id,
                            cefResult.insertId,
                            currentCandidateApplication.name,
                            branch_id,
                            customer_id,
                            currentCustomer.client_unique_id,
                            currentCustomer.name,
                            submitStatus,
                            res
                          );
                        } else {

                          // client applicatoin create
                          return res.status(200).json({
                            status: true,
                            cef_id: cefResult.insertId,
                            message: "BGV Form & documents Submitted.",
                          });
                        }
                      })
                      .catch((error) => {
                        console.error("Error in Promise.all:", error);
                        return res.status(400).json({
                          status: false,
                          message: error,
                        });
                      });
                  } else {
                    // console.log(`send_mail - `, send_mail);
                    // console.log(`submitStatus - `, submitStatus);

                    CEF.updateSubmitStatus(
                      {
                        candidateAppId: application_id,
                        status: 0,
                      },
                      (err, result) => {
                        if (err) {
                          console.error("Error updating submit status:", err);
                          return res.status(500).json({
                            status: false,
                            message:
                              "An error occurred while updating submit status. Please try again.",
                          });
                        }
                        if (parseInt(send_mail) === 1 && submitStatus == 1) {
                          sendNotificationEmails(
                            application_id,
                            cefResult.insertId,
                            currentCandidateApplication.name,
                            branch_id,
                            customer_id,
                            currentCustomer.client_unique_id,
                            currentCustomer.name,
                            submitStatus,
                            res
                          );
                        } else {
                          return res.status(200).json({
                            status: true,
                            cef_id: cefResult.insertId,
                            message: "BGV Form & documents Submitted.",
                          });
                        }
                      }
                    );
                  }
                }
              );
            }
          );
        });
      });
    }
  );
};

// Helper function to send notification emails
const sendNotificationEmails = (
  candidateAppId,
  cefID,
  name,
  branch_id,
  customer_id,
  client_unique_id,
  customer_name,
  submitStatus,
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
      CEF.getCEFApplicationById(
        candidateAppId,
        branch_id,
        customer_id,
        (err, currentCEFApplication) => {
          if (err) {
            console.error("Database error during CEF application retrieval:", err);
            return res.status(500).json({
              status: false,
              message: "Failed to retrieve CEF Application. Please try again.",
            });
          }
          // console.log(`Step 3: Check if CEF application exists - `, currentCEFApplication);
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
              CEF.getAttachmentsByClientAppID(
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
                    const pdfTargetDirectory = `uploads/customers/${client_unique_id}/candidate-applications/CD-${client_unique_id}-${candidateAppId}/background-reports`;
                    const candidateFormPdfTargetDirectory = `uploads/customers/${client_unique_id}/candidate-applications/CD-${client_unique_id}-${candidateAppId}/background-form-reports`;
                    const digitalConsentPdfTargetDirectory = `uploads/customers/${client_unique_id}/candidate-applications/CD-${client_unique_id}-${candidateAppId}digital-concent`;

                    const candidateFormPDFName = `BGV Form-${name}_${formattedDate}.pdf`
                      .replace(/\s+/g, "-")
                      .toLowerCase();
                    const candidateFormPDFPath = await candidateFormPDF(
                      candidateAppId,
                      branch_id,
                      customer_id,
                      candidateFormPDFName,
                      candidateFormPdfTargetDirectory
                    );
                    console.log("candidateFormPDFPath - ", candidateFormPDFPath);
                    const pdfPath = '';
                    /*
                    const pdfPath = await cdfDataPDF(
                      candidateAppId,
                      branch_id,
                      customer_id,
                      pdfFileName,
                      pdfTargetDirectory
                    );
                    */

                    const digitalConsentPdfName = `Applicant Consent-${name}_${formattedDate}.pdf`
                      .replace(/\s+/g, "-")
                      .toLowerCase();
                    const digitalConsentPdfPath = await candidateDigitalConsent(
                      name,
                      digitalConsentPdfName,
                      digitalConsentPdfTargetDirectory
                    );

                    // console.log("step 5.1: Generate PDF - ", pdfPath);
                    let newAttachments = [];
                    if (pdfPath) newAttachments.push(`${imageHost}/${pdfPath}`);
                    if (digitalConsentPdfPath) newAttachments.push(`${imageHost}/${digitalConsentPdfPath}`);
                    if (candidateFormPDFPath) newAttachments.push(`${imageHost}/${candidateFormPDFPath}`);

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
                      const toArr = [{ name: 'BGV Team', email: 'bgv@screeningstar.com' }];
                      // const toArr = [{ name: branch.name, email: branch.email }];
                      const candidateArr = [{ name: currentCandidateApplication.name, email: currentCandidateApplication.email }];

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

                      const finalEmailCC = [
                        { name: 'QC Team', email: 'qc@screeningstar.com' },
                        ...ccArr
                      ];

                      // console.log("step 8: Merged emails - ", mergedEmails);
                      // Send application creation email
                      cefSubmitMail(
                        "Candidate Background Form",
                        "submit",
                        name,
                        customer_name,
                        attachments,
                        toArr || [],
                        [{ name: 'QC Team', email: 'qc@screeningstar.com' }]
                      )
                        .then(() => {
                          CEF.updateSubmitStatus(
                            { candidateAppId, status: submitStatus },
                            (err, result) => {
                              if (err) {
                                console.error("Error updating submit status:", err);
                                return res.status(500).json({
                                  status: false,
                                  message:
                                    "An error occurred while updating submit status. Please try again.",
                                });
                              }
                              return res.status(201).json({
                                status: true,
                                message:
                                  "BGV Form & documents Submitted.",
                              });
                            }
                          );
                        })
                        .catch((emailError) => {
                          console.error(
                            "Error sending application creation email:",
                            emailError
                          );
                          return res.status(201).json({
                            status: true,
                            message:
                              "BGV Form & documents Submitted.",
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

    const {
      cef_id: CefID,
      branch_id: branchId,
      customer_id: customerID,
      candidate_application_id: candidateAppId,
      db_table: dbTable,
      db_column: dbColumn,
      send_mail,
      is_submit,
    } = req.body;
    let submitStatus = is_submit; // Use a local variable to avoid direct modification

    if (submitStatus !== 1) {
      submitStatus = 0;
    }
    // Validate required fields and collect missing ones
    const requiredFields = {
      branchId,
      customerID,
      candidateAppId,
      dbTable,
      dbColumn,
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

    Candidate.isApplicationExist(
      candidateAppId,
      branchId,
      customerID,
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
              parseInt(currentBranch.customer_id) !== parseInt(customerID)
            ) {
              return res.status(404).json({
                status: false,
                message: "Branch not found or customer mismatch.",
              });
            }
            // Retrieve customer details
            Customer.getCustomerById(
              customerID,
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
                // Define the target directory for uploads
                const modifiedDbTable = dbTable
                  .replace(/-/g, "_")
                  .toLowerCase();
                const cleanDBColumnForQry = dbColumn
                  .replace(/-/g, "_")
                  .toLowerCase();

                let modifiedDbTableForDbQuery;
                if (dbTable == 'cef_applications') {
                  modifiedDbTableForDbQuery = 'cef_applications';
                } else {
                  modifiedDbTableForDbQuery = `cef_${dbTable.replace(
                    /-/g,
                    "_"
                  )}`;
                }

                const targetDirectory = `uploads/customers/${currentCustomer.client_unique_id}/candidate-applications/CD-${currentCustomer.client_unique_id}-${candidateAppId}/annexures/${modifiedDbTable}`;

                // Create the target directory for uploads
                await fs.promises.mkdir(targetDirectory, {
                  recursive: true,
                });
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
                  let savedImagePaths = [];

                  // Check for multiple files under the "images" field
                  if (req.files.images && req.files.images.length > 0) {
                    const uploadedImages = await saveImages(
                      req.files.images,
                      targetDirectory,
                      'Applicant Document'
                    );
                    uploadedImages.forEach((imagePath) => {
                      savedImagePaths.push(`${imageHost}/${imagePath}`);
                    });
                  }

                  // Process single file upload
                  if (req.files.image && req.files.image.length > 0) {
                    const uploadedImage = await saveImage(
                      req.files.image[0],
                      targetDirectory,
                      'Applicant Document'
                    );
                    savedImagePaths.push(`${imageHost}/${uploadedImage}`);
                  }
                  CEF.upload(
                    CefID,
                    candidateAppId,
                    modifiedDbTableForDbQuery,
                    cleanDBColumnForQry,
                    savedImagePaths,
                    async (success, result) => {
                      if (!success) {
                        // If an error occurred, return the error details in the response
                        return res.status(500).json({
                          status: false,
                          message:
                            result ||
                            "An error occurred while saving the image.",
                          savedImagePaths,
                          // details: result.details,
                          // query: result.query,
                          // params: result.params,
                        });
                      }

                      if (parseInt(send_mail) === 1 && submitStatus == 1) {
                        sendNotificationEmails(
                          candidateAppId,
                          CefID,
                          currentCandidateApplication.name,
                          branchId,
                          customerID,
                          currentCustomer.client_unique_id,
                          currentCustomer.name,
                          submitStatus,
                          res
                        );
                      } else {
                        // Handle the case where the upload was successful
                        // if (result && result.affectedRows > 0) {
                        return res.status(201).json({
                          status: true,
                          message:
                            "BGV Form & documents Submitted.",
                          savedImagePaths,
                        });
                        /*
                    } else {
                      // If no rows were affected, indicate that no changes were made
                    return res.status(400).json({
                      status: false,
                      message:
                      "BGV Form & documents Submitted.",
                      result,
                      savedImagePaths,
                    });
                    */
                        // }
                      }
                    }
                  );
                });
              }
            );
          });
        } else {
          return res.status(404).json({
            status: false,
            message: "Application does not exist.",
          });
        }
      }
    );
  });
};
