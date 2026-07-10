const Candidate = require("../../../../../models/customer/branch/candidateApplicationModel");
const Customer = require("../../../../../models/customer/customerModel");
const Branch = require("../../../../../models/customer/branch/branchModel");
const BranchCommon = require("../../../../../models/customer/branch/commonModel");
const CEF = require("../../../../../models/customer/branch/cefModel");
const Service = require("../../../../../models/admin/serviceModel");
const App = require("../../../../../models/appModel");
const Admin = require("../../../../../models/admin/adminModel");
const ClientApplication = require("../../../../../models/customer/branch/clientApplicationModel");
const { getClientIpAddress } = require("../../../../../utils/ipAddress");
const AppModel = require("../../../../../models/appModel");
const {
  createMail,
} = require("../../../../../mailer/customer/branch/client/createMail");
const { generatePDF } = require("../../../../../utils/finalReportPdf");
const { buildReportDetails } = require("../../../../../utils/reportDetailsBuilder");
const { toSnakeCaseKeys } = require("../../../../../utils/toSnakeCase");


const { cdfDataPDF } = require("../../../../../utils/cefDataPDF");
const { candidateFormPDF } = require("../../../../../utils/candidateFormPDF");
const { candidateDigitalConsent } = require("../../../../../utils/candidateDigitalConsent");
const fs = require("fs");
const path = require("path");
const {
  upload,
  saveImage,
  saveImages,
  saveBase64ImageAndUpload,
  saveImageFromUrlAndUpload
} = require("../../../../../utils/cloudImageSave");

// const upload = require("./uploadController");

const {
  cefSubmitMail,
} = require("../../../../../mailer/customer/branch/candidate/cefSubmitMail");

const {
  reminderMail,
} = require("../../../../../mailer/customer/branch/candidate/reminderMail");

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
  const { client_application_id, branch_id, customer_id } = req.query;

  let missingFields = [];
  if (
    !client_application_id ||
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
  const { ipAddress, ipType } = getClientIpAddress(req);
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
      const currentCandidateApplication = applicationResult.data
        ;
      const services = currentCandidateApplication.services;
      const package = currentCandidateApplication.package;
      const employee_id = currentCandidateApplication.employee_id;


      console.log('services are', services)

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
        const newToken = currentBranch.newToken;
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
              console.log('step-111');
              AppModel.appInfo("backend", async (err, appInfo) => {
                console.log('step-222');

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

                const customerCode = currentCustomer.client_unique_id;

                let savedPhotoPath = null;
                let savedResumeFilePath = null;

                let govt_id = personal_information.govt_id || null;
                let resume_file = personal_information.resume_file || null;

                if (govt_id) {
                  const govtDir = `uploads/customer/${customerCode}/application/${application_id}/photo`;

                  try {
                    let savedPath = null;

                    if (govt_id.startsWith("data:")) {
                      console.log("✅ Govt ID: BASE64 detected");

                      savedPath = await saveBase64ImageAndUpload(
                        govt_id,
                        govtDir
                      );

                    } else if (govt_id.startsWith("http")) {
                      console.log("🌐 Govt ID: URL detected");

                      savedPath = await saveImageFromUrlAndUpload(
                        govt_id,
                        govtDir
                      );

                    } else {
                      console.log("❌ Govt ID: Unsupported format");
                    }

                    if (savedPath) {
                      // 🔥 FIX: normalize path
                      const normalizedPath = savedPath.replace(/\\/g, "/");

                      savedPhotoPath = `${imageHost}/${normalizedPath}`;
                      console.log("📁 Govt ID saved:", savedPhotoPath);
                    }

                  } catch (err) {
                    console.error("🚨 Govt ID upload failed:", err.message);
                  }
                }

                // 🔥 FIX: overwrite correctly
                personal_information.govt_id = savedPhotoPath || govt_id;



                // ===== Resume Upload =====
                if (resume_file) {
                  const resumeDir = `uploads/customer/${customerCode}/application/${application_id}/resume`;

                  try {
                    let savedPath = null;

                    if (resume_file.startsWith("data:")) {
                      console.log("✅ Resume: BASE64 detected");

                      savedPath = await saveBase64ImageAndUpload(
                        resume_file,
                        resumeDir
                      );

                    } else if (resume_file.startsWith("http")) {
                      console.log("🌐 Resume: URL detected");

                      savedPath = await saveImageFromUrlAndUpload(
                        resume_file,
                        resumeDir
                      );

                    } else {
                      console.log("❌ Resume: Unsupported format");
                    }

                    if (savedPath) {
                      // 🔥 FIX: normalize path
                      const normalizedPath = savedPath.replace(/\\/g, "/");

                      savedResumeFilePath = `${imageHost}/${normalizedPath}`;
                      console.log("📁 Resume saved:", savedResumeFilePath);
                    }

                  } catch (err) {
                    console.error("🚨 Resume upload failed:", err.message);
                  }
                }

                // 🔥 FIX: overwrite correctly
                personal_information.resume_file = savedResumeFilePath || resume_file;

                console.log('step-444');

                console.log('govt_id after saveBase64ImageAndUpload', govt_id);

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

                    const candidateApplicationId = Array.isArray(cefResult)
                      ? cefResult[0]
                      : cefResult?.insertId;

                    console.log("CEF application create start:");
                    // CLient application create yaha hoga 

                    const {
                      full_name,
                      mb_no,
                      gender
                    } = personal_information || {};

                    console.log("personal_information", personal_information)
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

                          CEF.getAttachmentsByClientAppID(

                            candidateApplicationId,
                            async (err, attachments) => {
                              if (err) {
                                console.error("Database error:", err);
                                return res.status(500).json({
                                  status: false,
                                  message: "Database error occurred",
                                });
                              }
                              console.log('attachments', attachments)
                              console.log('ClientApplicationstrat');
                              ClientApplication.create(
                                {
                                  name: full_name,
                                  generate_report_type: "CONFIDENTIAL BACKGROUND SCREENING REPORT",
                                  employee_id: employee_id,
                                  // client_spoc_name,
                                  // location,
                                  branch_id: branch_id,
                                  services: services,
                                  packages: package,
                                  customer_id: customer_id,
                                  is_priority: 0,
                                  // case_id,
                                  // check_id,
                                  // batch_no,
                                  // sub_client,
                                  // ticket_id,
                                  photo: personal_information?.govt_id || govt_id,
                                  attach_documents: resume_file,
                                  gender: gender
                                },
                                (err, result) => {
                                  console.log('full_name', full_name, 'employee_id', employee_id, 'branch_id', branch_id, 'services', services, 'packages', package, 'customer_id', customer_id, 'govt_id', govt_id, 'attachments', attachments, 'gender', gender);

                                  if (err) {
                                    console.error(
                                      "Database error during client application creation:",
                                      err
                                    );
                                    BranchCommon.branchActivityLog(
                                      ipAddress,
                                      ipType,
                                      branch_id,
                                      "Client Application",
                                      "Create",
                                      "0",
                                      null,
                                      err,
                                      () => { }
                                    );
                                    return res.status(500).json({
                                      status: false,
                                      message:
                                        "Failed to create client application. Please try again.",
                                      token: newToken,
                                      err,
                                    });
                                  }

                                  BranchCommon.branchActivityLog(
                                    ipAddress,
                                    ipType,
                                    branch_id,
                                    "Client Application",
                                    "Create",
                                    "1",
                                    `{id: ${result.insertId}}`,
                                    null,
                                    () => { }
                                  );

                                  if (send_mail == 0) {
                                    return res.status(201).json({
                                      status: true,
                                      message: "Client application created successfully.",
                                      client_application_id: result.insertId || result?.results?.insertId,
                                      token: newToken,
                                      result,
                                    });
                                  }

                                  let newAttachedDocsString = "";

                                  Branch.getClientUniqueIDByBranchId(
                                    branch_id,
                                    (err, clientCode) => {
                                      if (err) {
                                        console.error("Error checking unique ID:", err);
                                        return res.status(500).json({
                                          status: false,
                                          message: err.message,
                                          token: newToken,
                                        });
                                      }

                                      // Check if the unique ID exists
                                      if (!clientCode) {
                                        return res.status(400).json({
                                          status: false,
                                          message: `Customer Unique ID not Found`,
                                          token: newToken,
                                        });
                                      }

                                      Branch.getClientNameByBranchId(
                                        branch_id,
                                        (err, clientName) => {
                                          if (err) {
                                            console.error("Error checking client name:", err);
                                            return res.status(500).json({
                                              status: false,
                                              message: err.message,
                                              token: newToken,
                                            });
                                          }

                                          // Check if the client name exists
                                          if (!clientName) {
                                            return res.status(400).json({
                                              status: false,
                                              message: "Customer Unique ID not found",
                                              token: newToken,
                                            });
                                          }

                                          const serviceIds =
                                            typeof services === "string" && services.trim() !== ""
                                              ? services.split(",").map((id) => id.trim())
                                              : services;

                                          const serviceNames = [];

                                          // Function to fetch service names
                                          const fetchServiceNames = (index = 0) => {
                                            if (index >= serviceIds.length) {
                                              AppModel.appInfo(
                                                "frontend",
                                                async (err, appInfo) => {
                                                  if (err) {
                                                    console.error("Database error:", err);
                                                    return res.status(500).json({
                                                      status: false,
                                                      message:
                                                        "An error occurred while retrieving application information. Please try again.",
                                                    });
                                                  }

                                                  if (!appInfo) {
                                                    console.error(
                                                      "Database error during app info retrieval:",
                                                      err
                                                    );
                                                    return reject(
                                                      new Error(
                                                        "Information of the application not found."
                                                      )
                                                    );
                                                  }

                                                  BranchCommon.getBranchandCustomerEmailsForNotification(
                                                    branch_id,
                                                    (emailError, emailData) => {
                                                      if (emailError) {
                                                        console.error(
                                                          "Error fetching emails:",
                                                          emailError
                                                        );
                                                        return res.status(500).json({
                                                          status: false,
                                                          message:
                                                            "Failed to retrieve email addresses.",
                                                          token: newToken,
                                                        });
                                                      }

                                                      const { branch, customer } = emailData;
                                                      Admin.list((err, adminResult) => {
                                                        if (err) {
                                                          console.error("Database error:", err);
                                                          return res.status(500).json({
                                                            status: false,
                                                            message:
                                                              "Error retrieving admin details.",
                                                            token: newToken,
                                                          });
                                                        }

                                                        // Extract admin emails into adminList
                                                        const adminList = adminResult.map(
                                                          (admin) => ({
                                                            name: admin.name,
                                                            email: admin.email,
                                                          })
                                                        );
                                                        const toNewArr = [
                                                          { name: 'BGV Team', email: 'bgv@screeningstar.com' },
                                                        ];

                                                        const toNewCC = [
                                                          { name: 'QC Team', email: 'qc@screeningstar.com' },
                                                          { name: 'Rohit Webstep', email: 'vanshwebstep@gmail.com' },
                                                        ];
                                                        const ccArr1 = customer.emails
                                                          .split(",")
                                                          .map((email) => ({
                                                            name: customer.name,
                                                            email: email.trim(),
                                                          }));

                                                        const toArr = [
                                                          ...ccArr1,
                                                          ...adminList.map((admin) => ({
                                                            name: admin.name,
                                                            email: admin.email,
                                                          })),
                                                        ];
                                                        const appHost =
                                                          appInfo.host || "www.example.com";
                                                        const appName =
                                                          appInfo.name || "Example Company";

                                                        // Once all services have been processed, send email notification
                                                        createMail(
                                                          "client application",
                                                          "create",
                                                          full_name,
                                                          result.new_application_id,
                                                          clientName,
                                                          clientCode,
                                                          serviceNames,
                                                          newAttachedDocsString,
                                                          appHost,
                                                          toNewArr,
                                                          toNewCC
                                                        )
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
                                                                result?.results?.insertId,
                                                                res
                                                              );
                                                            } else {

                                                              // client applicatoin create vansh
                                                              return res.status(200).json({
                                                                status: true,
                                                                cef_id: cefResult.insertId,
                                                                message: "BGV Form & documents Submitted.",
                                                              });
                                                            }
                                                          })
                                                          .catch((emailError) => {
                                                            console.error(
                                                              "Error sending email:",
                                                              emailError
                                                            );
                                                            return res.status(201).json({
                                                              status: true,
                                                              message:
                                                                "Client application created successfully, but failed to send email.",
                                                              client: result,
                                                              token: newToken,
                                                            });
                                                          });
                                                      });
                                                    }
                                                  );
                                                }
                                              );
                                              return;
                                            }

                                            const id = serviceIds[index];

                                            Service.getServiceById(id, (err, currentService) => {
                                              if (err) {
                                                console.error(
                                                  "Error fetching service data:",
                                                  err
                                                );
                                                return res.status(500).json({
                                                  status: false,
                                                  message: err.message,
                                                  token: newToken,
                                                });
                                              }

                                              // Skip invalid services and continue to the next index
                                              if (!currentService || !currentService.title) {
                                                return fetchServiceNames(index + 1);
                                              }

                                              // Add the current service name to the array
                                              serviceNames.push(currentService.title);

                                              // Recursively fetch the next service
                                              fetchServiceNames(index + 1);
                                            });
                                          };

                                          // Start fetching service names
                                          fetchServiceNames();
                                        }
                                      );
                                    }
                                  );
                                });
                            });


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
                              result.results.insertId,
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
              });
            }
          );
        });
      });
    }
  );
};
const sendNotificationEmails = (
  candidateAppId,
  cefID,
  name,
  branch_id,
  customer_id,
  client_unique_id,
  customer_name,
  submitStatus,
  clientApplicationInsertId,
  res, onComplete
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
                    const pdfUrl = candidateFormPDFPath
                      ? `${imageHost}/${candidateFormPDFPath}`
                      : null;
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
                                client_application_id: clientApplicationInsertId,
                                message:
                                  "BGV Form & documents Submitted.",
                                bgv_form_pdf: pdfUrl || null,
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
                            client_application_id: clientApplicationInsertId,
                            message:
                              "BGV Form & documents Submitted.",
                            bgv_form_pdf: pdfUrl || null,
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
  try {

    upload(req, res, async (err) => {
      if (err) {
        console.error(err);
        return res.status(400).json({
          status: false,
          message: "Error uploading file"
        });
      }

      /************************************
       * ✅ FULL PAYLOAD LOG
       ************************************/
      console.log("========== BGV UPLOAD START ==========");
      console.log("TIME:", new Date().toISOString());
      console.log("IP:", req.ip);
      console.log("HEADERS:", req.headers);
      console.log("BODY:", req.body);
      console.log(
        "FILES:",
        Object.keys(req.files || {}).reduce((acc, key) => {
          acc[key] = req.files[key].map(f => ({
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size
          }));
          return acc;
        }, {})
      );
      console.log("====================================");

      /************************************
       * 1️⃣ READ BODY
       ************************************/
      const {
        cef_id,
        branch_id,
        customer_id,
        candidate_application_id,
        db_table,
        db_column,
        send_mail,
        is_submit
      } = req.body;

      let submitStatus = Number(is_submit) === 1 ? 1 : 0;

      /************************************
       * 2️⃣ VALIDATION
       ************************************/
      const requiredFields = {
        branch_id,
        customer_id,
        candidate_application_id,
        db_table,
        db_column
      };

      const missing = Object.keys(requiredFields)
        .filter(k => !requiredFields[k])
        .map(k => k.replace(/_/g, " "));

      if (missing.length) {
        return res.status(400).json({
          status: false,
          message: `Missing required fields: ${missing.join(", ")}`
        });
      }

      /************************************
       * 3️⃣ CHECK APPLICATION
       ************************************/
      Candidate.isApplicationExist(
        candidate_application_id,
        branch_id,
        customer_id,
        async (err, appResult) => {
          if (err)
            return res.status(500).json({ status: false, message: err.message });

          if (!appResult.status)
            return res.status(404).json({ status: false, message: appResult.message });

          const currentCandidate = appResult.data;

          /************************************
           * 4️⃣ GET CUSTOMER
           ************************************/
          Customer.getCustomerById(customer_id, async (err, customer) => {
            if (err || !customer)
              return res.status(404).json({ status: false, message: "Customer not found" });

            /************************************
             * 5️⃣ DETERMINE CATEGORY FROM db_column
             ************************************/
            let uploadCategory = "attach_documents";
            let clientDbColumn = "attach_documents";

            if (db_column === "govt_id") {
              uploadCategory = "photo";
              clientDbColumn = "photo";
            }

            if (db_column === "resume_file") {
              uploadCategory = "attach_documents";
              clientDbColumn = "attach_documents";
            }

            /************************************
             * 6️⃣ BUILD DIRECTORY
             ************************************/
            const targetDirectory =
              `uploads/customers/${customer.client_unique_id}` +
              `/candidate-applications/CD-${customer.client_unique_id}-${candidate_application_id}` +
              `/${uploadCategory}`;

            await fs.promises.mkdir(targetDirectory, { recursive: true });

            /************************************
             * 7️⃣ SAVE FILES
             ************************************/
            let savedImagePaths = [];
            let imageHost = "www.example.in";

            if (req.files?.images?.length) {
              const imgs = await saveImages(req.files.images, targetDirectory);
              imgs.forEach(p => savedImagePaths.push(`${imageHost}/${p}`));
            }

            if (req.files?.image?.length) {
              const img = await saveImage(req.files.image[0], targetDirectory);
              savedImagePaths.push(`${imageHost}/${img}`);
            }

            if (!savedImagePaths.length) {
              return res.status(400).json({
                status: false,
                message: "No files received"
              });
            }

            /************************************
             * 8️⃣ UPDATE CEF TABLE
             ************************************/
            const cleanTable =
              db_table === "cef_applications"
                ? "cef_applications"
                : `cef_${db_table.replace(/-/g, "_")}`;

            const cleanColumn = db_column.replace(/-/g, "_");

            CEF.upload(
              cef_id,
              candidate_application_id,
              cleanTable,
              cleanColumn,
              savedImagePaths,
              async (success) => {

                if (!success) {
                  return res.status(500).json({
                    status: false,
                    message: "Failed to update CEF",
                    savedImagePaths
                  });
                }

                /************************************
                 * 9️⃣ UPDATE CLIENT APPLICATION
                 ************************************/
                ClientApplication.upload(
                  candidate_application_id,
                  clientDbColumn,
                  savedImagePaths,
                  async (success2) => {

                    if (!success2) {
                      return res.status(500).json({
                        status: false,
                        message: "Failed to update Client Application",
                        savedImagePaths
                      });
                    }

                    /************************************
                     * 🔟 SEND MAIL IF REQUIRED
                     ************************************/
                    if (Number(send_mail) === 1 && submitStatus === 1) {
                      sendNotificationEmails(
                        candidate_application_id,
                        cef_id,
                        currentCandidate.name,
                        branch_id,
                        customer_id,
                        customer.client_unique_id,
                        customer.name,
                        submitStatus
                      );
                    }

                    /************************************
                     * ✅ FINAL RESPONSE
                     ************************************/
                    return res.status(201).json({
                      status: true,
                      message: "BGV Form & documents submitted successfully",
                      upload_category: uploadCategory,
                      db_updated_column: clientDbColumn,
                      savedImagePaths
                    });
                  }
                );
              }
            );
          });
        }
      );
    });

  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
};


exports.fetch_report_status = async (req, res) => {
  try {
    const {
      access_token: bodyAccessToken,
      _token,
      client_application_id,
      branch_id,
      customer_id,
    } = req.body || {};
    const access_token = bodyAccessToken || _token;

    const missingFields = [];

    if (!access_token || access_token === "undefined") {
      missingFields.push("Access Token");
    }
    if (!client_application_id || client_application_id === "undefined") {
      missingFields.push("Application ID");
    }
    if (!branch_id || branch_id === "undefined") {
      missingFields.push("Branch ID");
    }
    if (!customer_id || customer_id === "undefined") {
      missingFields.push("Customer ID");
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    Branch.getBranchAndCustomerByAccessToken(access_token, (tokenErr, tokenResult) => {
      if (tokenErr) {
        console.error("Access token validation error:", tokenErr);
        return res.status(500).json({
          status: false,
          message: "Internal server error. Please try again later.",
        });
      }

      if (!tokenResult.status) {
        return res.status(401).json({
          status: false,
          message: tokenResult.message || "Invalid or expired access token.",
        });
      }

      const tokenBranch = tokenResult.data.branch;
      const tokenCustomer = tokenResult.data.customer;

      if (
        String(tokenBranch.id) !== String(branch_id) ||
        String(tokenCustomer.id) !== String(customer_id)
      ) {
        return res.status(403).json({
          status: false,
          message: "Access token does not match the requested branch or customer.",
        });
      }

      ClientApplication.listAllApplications(branch_id, async (err, applications) => {
        try {
          if (err) {
            return res.status(500).json({
              status: false,
              message: err.message,
            });
          }

          if (!applications || applications.length === 0) {
            return res.status(404).json({
              status: false,
              message: "No applications found for this branch.",
            });
          }

          const application = applications.find(
            (app) =>
              String(app.id) === String(client_application_id) &&
              String(app.customer_id) === String(customer_id)
          );

          if (!application) {
            return res.status(404).json({
              status: false,
              message: "Application does not exist.",
            });
          }

          // ---------------- STATUS LOGIC ----------------
          let applicationStatus = "NOT READY";

          if (Array.isArray(application.cmtApplications)) {
            const matchedCmt = application.cmtApplications.find(
              (cmt) =>
                String(cmt.cmt_client_application_id) === String(application.id)
            );

            if (matchedCmt) {
              if (matchedCmt.cmt_overall_status === "completed") {
                applicationStatus =
                  matchedCmt.cmt_is_verify === "yes"
                    ? "COMPLETED"
                    : "QC PENDING";
              } else if (matchedCmt.cmt_overall_status === "wip") {
                applicationStatus = "WIP";
              }
            }
          }

          // ---------------- APP INFO ----------------
          App.appInfo("backend", async (err, appInfo) => {
            if (err) {
              console.error("AppInfo error:", err);
              return res.status(500).json({
                status: false,
                message: "Failed to fetch app configuration",
              });
            }

            let finalReportUrl = null;
            let finalReportPath = null;
            let reportDetails = null;

            // Generate PDF only if eligible
            if (["COMPLETED", "QC PENDING"].includes(applicationStatus)) {
              const today = new Date();
              const formattedDate = `${today.getFullYear()}-${String(
                today.getMonth() + 1
              ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

              const pdfTargetDirectory = `uploads/customers/${application.application_id}/client-applications/${application.application_id}/final-reports`;

              const pdfFileName = `${application.name}_${formattedDate}.pdf`
                .replace(/\s+/g, "-")
                .toLowerCase();

              const pdfPath = await generatePDF(
                application.id,
                application.branch_id,
                pdfFileName,
                pdfTargetDirectory
              );

              const imageHost =
                (appInfo && appInfo.cloud_host) || "www.example.in";

              finalReportPath = pdfPath;
              finalReportUrl = `${imageHost}/${pdfPath}`;
              reportDetails = await buildReportDetails(application.id, application.branch_id);
              reportDetails = toSnakeCaseKeys(reportDetails);
            }

            const responseData = {
              application_id: application.id,
              application_status: applicationStatus,
            };

            // Send report URL only if PDF is ready
            if (finalReportPath && finalReportUrl) {
              responseData.report_url = finalReportUrl;
            }

            if (reportDetails) {
              responseData.report_details = reportDetails;
            }

            return res.status(200).json({
              status: true,
              data: responseData,
            });
          });
        } catch (innerError) {
          console.error("Processing error:", innerError);
          return res.status(500).json({
            status: false,
            message: "Something went wrong while processing the application.",
          });
        }
      });
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      status: false,
      message: "Something went wrong.",
    });
  }
};
