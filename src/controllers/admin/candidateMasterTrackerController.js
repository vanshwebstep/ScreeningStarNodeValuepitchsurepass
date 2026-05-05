const crypto = require("crypto");
const CandidateMasterTrackerModel = require("../../models/admin/candidateMasterTrackerModel");
const Customer = require("../../models/customer/customerModel");
const CandidateApplication = require("../../models/customer/branch/candidateApplicationModel");
const Service = require("../../models/admin/serviceModel");
const Branch = require("../../models/customer/branch/branchModel");
const AdminCommon = require("../../models/admin/commonModel");
const Admin = require("../../models/admin/adminModel");
const App = require("../../models/appModel");
const CEF = require("../../models/customer/branch/cefModel");
const BranchCommon = require("../../models/customer/branch/commonModel");
const {
  createMail,
} = require("../../mailer/customer/branch/candidate/createMail");

const { davMail } = require("../../mailer/customer/branch/candidate/davMail");

const fs = require("fs");
const path = require("path");
const { generatePDF } = require("../../utils/finalReportPdf");
const { candidateFormPDF } = require("../../utils/candidateFormPDF");
const { candidateDAVFromPDF } = require("../../utils/candidateDAVFromPDF");
const { cdfDataPDF } = require("../../utils/cefDataPDF");
const { candidateDigitalConsent } = require("../../utils/candidateDigitalConsent");
const { upload, saveImage, saveImages } = require("../../utils/cloudImageSave");

// Controller to list all customers
exports.list = (req, res) => {
  const { admin_id, _token, filter_status } = req.query;

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

  const action = "candidate_manager";
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
          CandidateMasterTrackerModel.list(filter_status, (err, result) => {
            if (err) return resolve([]);
            resolve(result);
          })
        ),
      ];

      Promise.all(dataPromises).then(([customers, filterOptions]) => {
        res.json({
          status: true,
          message: "Clients fetched successfully",
          data: {
            customers,
          },
          totalResults: {
            customers: customers.length,
          },
          token: newToken,
        });
      });
    });
  });
};

exports.test = async (req, res) => {
  try {
    const candidate_application_id = 128;
    const client_unique_id = "SS-IND";
    const application_id = "SS-IND-128";
    const branch_id = 82;
    const customer_id = 68;
    const name = "test";

    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Generate the PDF
    const pdfTargetDirectory = `uploads/customers/${client_unique_id}/client-applications/${application_id}/final-reports`;

    const pdfFileName = `${name}_${formattedDate}.pdf`
      .replace(/\s+/g, "-")
      .toLowerCase();
    const pdfPath = await candidateFormPDF(
      candidate_application_id,
      branch_id,
      customer_id,
      pdfFileName,
      pdfTargetDirectory
    );
    // If successful, return the result
    res.json({
      status: true,
      message: "PDF generated successfully",
      pdfPath,
    });
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

exports.testDavPdf = async (req, res) => {
  try {
    const candidate_application_id = 113;
    const client_unique_id = "GQ-INDV";
    const application_id = "GQ-INDV-1";
    const branch_id = 86;
    const customer_id = 72;
    const name = "kalia";

    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Generate the PDF
    const pdfTargetDirectory = `uploads/customers/${client_unique_id}/client-applications/${application_id}/final-reports`;

    const pdfFileName = `${name}_${formattedDate}.pdf`
      .replace(/\s+/g, "-")
      .toLowerCase();
    const pdfPath = await candidateDAVFromPDF(
      candidate_application_id,
      branch_id,
      customer_id,
      pdfFileName,
      pdfTargetDirectory
    );
    // If successful, return the result
    res.json({
      status: true,
      message: "PDF generated successfully",
      pdfPath,
    });
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

exports.listByCustomerId = (req, res) => {
  const { customer_id, filter_status, admin_id, _token } = req.query;

  let missingFields = [];
  if (!customer_id || customer_id === "") missingFields.push("Customer ID");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "candidate_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      CandidateMasterTrackerModel.listByCustomerID(
        customer_id,
        filter_status,
        (err, result) => {
          if (err) {
            console.error("Database error:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          res.json({
            status: true,
            message: "Branches tracker fetched successfully",
            customers: result,
            totalResults: result.length,
            token: newToken,
          });
        }
      );
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

  const action = "candidate_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }
    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
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

      const dataPromises = [
        new Promise((resolve) =>
          CandidateMasterTrackerModel.applicationListByBranch(
            filter_status,
            branch_id,
            status,
            (err, result) => {
              if (err) return resolve([]);
              resolve(result);
            }
          )
        ),
      ];

      Promise.all(dataPromises).then(([applications]) => {
        res.json({
          status: true,
          message: "candidate applications fetched successfully",
          data: {
            applications,
          },
          totalResults: {
            applications: applications.length,
          },
          token: newToken,
        });
      });
    });
  });
};

exports.cefApplicationByID = (req, res) => {
  const { application_id, branch_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !application_id ||
    application_id === "" ||
    application_id === undefined ||
    application_id === "undefined"
  )
    missingFields.push("Application ID");
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

  const action = "candidate_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      CandidateMasterTrackerModel.applicationByID(
        application_id,
        branch_id,
        (err, application) => {
          if (err) {
            console.error("Database error:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          if (!application) {
            return res.status(404).json({
              status: false,
              message: "Application not found",
              token: newToken,
            });
          }

          const service_ids = Array.isArray(application.services)
            ? application.services
            : application.services.split(",").map((item) => item.trim());

          CandidateMasterTrackerModel.cefApplicationByID(
            application_id,
            branch_id,
            (err, CEFApplicationData) => {
              if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                  status: false,
                  message: err.message,
                  token: newToken,
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
                    token: newToken,
                  });
                }

                Admin.list((err, adminList) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                      status: false,
                      message: err.message,
                      token: newToken,
                    });
                  }
                  Customer.getCustomerById(
                    parseInt(currentBranch.customer_id),
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

                      CEF.formJsonWithData(
                        service_ids,
                        application_id,
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
                          return res.json({
                            status: true,
                            message: "Application fetched successfully 2",
                            application,
                            CEFData: CEFApplicationData,
                            branchInfo: currentBranch,
                            customerInfo: currentCustomer,
                            serviceData,
                            admins: adminList,
                            token: newToken,
                          });
                        }
                      );
                    }
                  );
                });
              });
            }
          );
        }
      );
    });
  });
};

exports.davApplicationByID = (req, res) => {
  const { application_id, branch_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !application_id ||
    application_id === "" ||
    application_id === undefined ||
    application_id === "undefined"
  )
    missingFields.push("Application ID");
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

  const action = "candidate_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      CandidateMasterTrackerModel.applicationByID(
        application_id,
        branch_id,
        (err, application) => {
          if (err) {
            console.error("Database error:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          if (!application) {
            return res.status(404).json({
              status: false,
              message: "Application not found",
              token: newToken,
            });
          }

          CandidateMasterTrackerModel.davApplicationByID(
            application_id,
            branch_id,
            (err, DAVApplicationData) => {
              if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                  status: false,
                  message: err.message,
                  token: newToken,
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
                    token: newToken,
                  });
                }

                Admin.list((err, adminList) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                      status: false,
                      message: err.message,
                      token: newToken,
                    });
                  }
                  Customer.getCustomerById(
                    parseInt(currentBranch.customer_id),
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

                      return res.json({
                        status: true,
                        message: "Application fetched successfully 2",
                        application,
                        DEFData: DAVApplicationData,
                        branchInfo: currentBranch,
                        customerInfo: currentCustomer,
                        admins: adminList,
                        token: newToken,
                      });
                    }
                  );
                });
              });
            }
          );
        }
      );
    });
  });
};

exports.filterOptions = (req, res) => {
  const { admin_id, _token } = req.query;

  let missingFields = [];
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

  const action = "candidate_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      CandidateMasterTrackerModel.filterOptions((err, filterOptions) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            message: "An error occurred while fetching Filter options data.",
            error: err,
            token: newToken,
          });
        }

        if (!filterOptions) {
          return res.status(404).json({
            status: false,
            message: "Filter options Data not found.",
            token: newToken,
          });
        }

        res.status(200).json({
          status: true,
          message: "Filter options fetched successfully.",
          filterOptions,
          token: newToken,
        });
      });
    });
  });
};

exports.filterOptionsForBranch = (req, res) => {
  const { branch_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !branch_id ||
    branch_id === "" ||
    branch_id === undefined ||
    branch_id === "undefined"
  ) {
    missingFields.push("Branch ID");
  }
  if (
    !admin_id ||
    admin_id === "" ||
    admin_id === undefined ||
    admin_id === "undefined"
  ) {
    missingFields.push("Admin ID");
  }
  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  ) {
    missingFields.push("Token");
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "candidate_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      CandidateMasterTrackerModel.filterOptionsForBranch(
        branch_id,
        (err, filterOptions) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({
              status: false,
              message: "An error occurred while fetching Filter options data.",
              error: err,
              token: newToken,
            });
          }

          if (!filterOptions) {
            return res.status(404).json({
              status: false,
              message: "Filter options Data not found.",
              token: newToken,
            });
          }

          res.status(200).json({
            status: true,
            message: "Filter options fetched successfully.",
            filterOptions,
            token: newToken,
          });
        }
      );
    });
  });
};

exports.sendLink = (req, res) => {
  const { application_id, branch_id, customer_id, admin_id, _token } =
    req.query;

  // Define required fields
  const requiredFields = {
    application_id,
    branch_id,
    customer_id,
    admin_id,
    _token,
  };

  // Check for missing fields
  const missingFields = Object.keys(requiredFields)
    .filter((field) => !requiredFields[field] || requiredFields[field] === "")
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "candidate_manager";

  // Check if admin is authorized for the action
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message,
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      // Fetch application by ID
      CandidateMasterTrackerModel.applicationByID(
        application_id,
        branch_id,
        (err, application) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({
              status: false,
              message: "Database error occurred.",
              token: newToken,
            });
          }

          if (!application) {
            return res.status(404).json({
              status: false,
              message: "Application not found.",
              token: newToken,
            });
          }

          // Fetch CEF application by ID
          CandidateMasterTrackerModel.cefApplicationByID(
            application_id,
            branch_id,
            (err, CEFApplicationData) => {
              if (err) {
                if (
                  err.message.toLowerCase().includes("bgv") &&
                  err.message.toLowerCase().includes("not") &&
                  err.message.toLowerCase().includes("submitted")
                ) {
                  BranchCommon.getBranchandCustomerEmailsForNotification(
                    branch_id,
                    (emailError, emailData) => {
                      if (emailError) {
                        console.error("Error fetching emails:", emailError);
                        return res.status(500).json({
                          status: false,
                          message: "Failed to retrieve email addresses.",
                          token: newToken,
                        });
                      }

                      const { branch, customer } = emailData;
                      const name = application.name;
                      const email = application.email;
                      const services = application.services;

                      const toArr = [{ name, email }];
                      let ccArr = [{ name: 'QC Team', email: 'qc@screeningstar.com' }, { name: 'BGV Team', email: 'bgv@screeningstar.com' }];
                      
                      const serviceIds = services
                        ? services
                          .split(",")
                          .map((id) => parseInt(id.trim(), 10))
                          .filter(Number.isInteger)
                        : [];
                      const serviceNames = [];

                      const fetchServiceNames = (index = 0) => {
                        if (index >= serviceIds.length) {
                          App.appInfo("frontend", (err, appInfo) => {
                            if (err) {
                              console.error("Error fetching app info:", err);
                              return res.status(500).json({
                                status: false,
                                message:
                                  "Error fetching application information.",
                                token: newToken,
                              });
                            }

                            if (appInfo) {
                              const appHost =
                                appInfo.host || "www.example.com";
                              const base64_app_id = btoa(application_id);
                              const base64_branch_id = btoa(branch_id);
                              const base64_customer_id = btoa(customer_id);
                              const base64_link_with_ids = `YXBwX2lk=${base64_app_id}&YnJhbmNoX2lk=${base64_branch_id}&Y3VzdG9tZXJfaWQ==${base64_customer_id}`;

                              const dav_href = `${appHost}/digital-form?${base64_link_with_ids}`;
                              const bgv_href = `${appHost}/background-form?${base64_link_with_ids}`;

                              let davExist = parseInt(
                                application.dav_exist,
                                10
                              );
                              let davSubmitted = parseInt(
                                application.dav_submitted,
                                10
                              );
                              let cefSubmitted = parseInt(
                                application.cef_submitted,
                                10
                              );

                              // Initialize flags for sent mails and errors
                              let davMailSent = false;
                              let cefMailSent = false;
                              let davErrors = [];
                              let cefErrors = [];

                              const emailTasks = [];

                              const toCC = [
                                { name: 'QC Team', email: 'qc@screeningstar.com' }
                              ];

                              // Send Digital Address Verification Mail if required
                              if (davExist === 1 && davSubmitted === 0) {
                                const davMailPromise = davMail(
                                  "candidate application",
                                  "dav",
                                  name,
                                  customer.name,
                                  dav_href,
                                  toArr,
                                  toCC
                                )
                                  .then(() => {
                                    davMailSent = true;
                                    console.log(
                                      "Digital address verification mail sent."
                                    );
                                  })
                                  .catch((emailError) => {
                                    davErrors.push(emailError);
                                    console.error(
                                      "Error sending DAV email:",
                                      emailError
                                    );
                                  });
                                emailTasks.push(davMailPromise); // Add to emailTasks
                              }

                              // Send CEF application email if required
                              if (cefSubmitted === 0) {
                                const cefMailPromise = createMail(
                                  "candidate application",
                                  "create",
                                  name,
                                  customer.name,
                                  application_id,
                                  bgv_href,
                                  serviceNames,
                                  toArr,
                                  ccArr
                                )
                                  .then(() => {
                                    cefMailSent = true;
                                    console.log("CEF application mail sent.");
                                  })
                                  .catch((emailError) => {
                                    cefErrors.push(emailError);
                                    console.error(
                                      "Error sending CEF email:",
                                      emailError
                                    );
                                  });
                                emailTasks.push(cefMailPromise); // Add to emailTasks
                              }

                              // Wait for all email tasks to complete
                              Promise.all(emailTasks)
                                .then(() => {
                                  // Final response based on email sending status
                                  const responseMessage = {
                                    status: true,
                                    token: newToken,
                                    message:
                                      "Email notifications successfully sent.",
                                    details: {
                                      davMailSent,
                                      cefMailSent,
                                      davErrors,
                                      cefErrors,
                                    },
                                  };

                                  if (!davMailSent && !cefMailSent) {
                                    responseMessage.message =
                                      "No email notifications sent.";
                                    responseMessage.status = false;
                                  }

                                  return res.status(201).json(responseMessage);
                                })
                                .catch((err) => {
                                  console.error("Error sending emails:", err);
                                  return res.status(500).json({
                                    status: false,
                                    message: "Error sending emails.",
                                    token: newToken,
                                  });
                                });
                            }
                          });
                          return;
                        }

                        const id = serviceIds[index];
                        Service.getServiceRequiredDocumentsByServiceId(
                          id,
                          (err, currentService) => {
                            if (err) {
                              console.error(
                                "Error fetching service data:",
                                err
                              );
                              return res.status(500).json({
                                status: false,
                                message: "Service data error.",
                                token: newToken,
                              });
                            }

                            if (!currentService || !currentService.title) {
                              return fetchServiceNames(index + 1);
                            }

                            serviceNames.push(
                              `${currentService.title}: ${currentService.description}`
                            );
                            fetchServiceNames(index + 1);
                          }
                        );
                      };

                      fetchServiceNames();
                    }
                  );
                } else {
                  console.error("Error fetching CEF application data:", err);
                  return res.status(500).json({
                    status: false,
                    message: "Failed to retrieve CEF application data.",
                    token: newToken,
                  });
                }
              } else {
                return res.status(500).json({
                  status: false,
                  message: "BFV form already submitted",
                  token: newToken,
                });
              }
            }
          );
        }
      );
    });
  });
};
