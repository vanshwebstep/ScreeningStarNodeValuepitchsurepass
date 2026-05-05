const crypto = require("crypto");
const Customer = require("../../models/customer/customerModel");
const Branch = require("../../models/customer/branch/branchModel");
const AdminCommon = require("../../models/admin/commonModel");
const App = require("../../models/appModel");
const BranchCommon = require("../../models/customer/branch/commonModel");
const { createMail } = require("../../mailer/customer/createMail");
const AppModel = require("../../models/appModel");
const fs = require("fs");
const path = require("path");
const { upload, saveImage, saveImages } = require("../../utils/cloudImageSave");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Helper function to generate a password
const generatePassword = (companyName) => {
  // Check if companyName is null, undefined, or has a length of 0
  if (!companyName || companyName.length < 1) {
    // Generate a random password if companyName is invalid
    return Math.random().toString(36).slice(-8) + "@123";
  }

  // Extract the first word (company name) and remove special characters
  const firstName = companyName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "");

  // Create the raw password and return the final password
  const rawPassword = firstName;
  return `${rawPassword}@123`;
};

const areEmailsUsed = (emails) => {
  return new Promise((resolve, reject) => {
    // Validate inputs
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return reject(new Error("Missing required field: Emails"));
    }

    // Check each email
    const emailCheckPromises = emails.map((email) => {
      return new Promise((resolve, reject) => {
        Branch.isEmailUsed(email, (err, isUsed) => {
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

const areEmailsUsedForUpdate = (emails, customer_id) => {
  return new Promise((resolve, reject) => {
    console.log("Starting areEmailsUsedForUpdate...");
    console.log("Input emails:", emails);
    console.log("Customer ID:", customer_id);

    // Validate inputs
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      console.error("Validation failed: Emails are missing or invalid.");
      return reject(new Error("Missing required field: Emails"));
    }

    // Check each email
    const emailCheckPromises = emails.map((email, index) => {
      console.log(`Checking email [${index}]:`, email);
      return new Promise((resolve, reject) => {
        Branch.isEmailUsedForUpdate(email, customer_id, (err, isUsed) => {
          if (err) {
            console.error(`Error for email "${email}":`, err);
            return reject(err);
          }
          console.log(`Result for "${email}": isUsed =`, isUsed);
          resolve({ email, isUsed });
        });
      });
    });

    // Wait for all email checks to complete
    Promise.all(emailCheckPromises)
      .then((results) => {
        console.log("All email checks completed. Results:", results);

        const usedEmails = results
          .filter((result) => result.isUsed)
          .map((result) => result.email);

        const areAnyUsed = usedEmails.length > 0;
        console.log("Used emails:", usedEmails);
        console.log("Are any used?:", areAnyUsed);

        let message = "";
        if (areAnyUsed) {
          const emailCount = usedEmails.length;

          if (emailCount === 1) {
            message = `${usedEmails[0]} is already used.`;
          } else if (emailCount === 2) {
            message = `${usedEmails[0]} and ${usedEmails[1]} are already used.`;
          } else {
            const lastEmail = usedEmails.pop();
            message = `${usedEmails.join(", ")} and ${lastEmail} are already used.`;
          }
          console.log("Generated message:", message);
        }

        resolve({ areAnyUsed, message });
      })
      .catch((err) => {
        console.error("Error checking email usage:", err);
        reject(new Error("Error checking email usage: " + err.message));
      });
  });
};

exports.servicesPackagesData = (req, res) => {
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

  const action = "see_more";
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

      Customer.servicesPackagesData((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            message: "Internal server error while fetching data.",
            error: err.message, // Provide more specific error message
            token: newToken, // Send back the new token in case the session is refreshed
          });
        }

        if (!result || result.length === 0) {
          return res.status(404).json({
            status: false,
            message: "No data found.",
            token: newToken, // Ensure the token is still included
          });
        }

        return res.json({
          status: true,
          message: "Services packages fetched successfully.",
          data: result, // Customer data or services packages based on what 'result' contains
          totalResults: result.length,
          token: newToken, // Return the new token in the response
        });
      });
    });
  });
};

exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    admin_id,
    _token,
    tat,
    role,
    state,
    gstin,
    emails,
    address,
    username,
    branches,
    state_code,
    client_code,
    company_name,
    mobile_number,
    date_agreement,
    client_standard,
    scopeOfServices,
    billing_spoc_id,
    additional_login,
    agreement_period,
    authorized_detail_id,
    billing_escalation_id,
    escalation_manager_id,
    dedicated_point_of_contact,
    first_level_matrix_name,
    first_level_matrix_designation,
    first_level_matrix_mobile,
    first_level_matrix_email,
    send_mail,
    visible_fields,
    custom_template,
    custom_address,
    disclaimer_emails,
    esc_manager_name,
    esc_manager_email,
    esc_manager_mobile,
    esc_manager_desgn,
    client_spoc_name,
    client_spoc_email,
    client_spoc_mobile,
    client_spoc_desgn,
    billing_spoc_name,
    billing_spoc_email,
    billing_spoc_mobile,
    billing_spoc_desgn,
    billing_escalation_name,
    billing_escalation_email,
    billing_escalation_mobile,
    billing_escalation_desgn,
    authorized_detail_name,
    authorized_detail_email,
    authorized_detail_mobile,
    authorized_detail_desgn
  } = req.body;

  // Define required fields
  const requiredFields = {
    admin_id,
    _token,
    tat,
    state,
    gstin,
    emails,
    address,
    branches,
    state_code,
    client_code,
    company_name,
    mobile_number,
    date_agreement,
    scopeOfServices,
    client_standard,
    agreement_period,
  };

  let additional_login_int = 0;
  if (additional_login && additional_login.toLowerCase() === "yes") {
    additional_login_int = 1;
    requiredFields.username = username;
  }

  let custom_template_string = "no";
  if (
    custom_template &&
    (String(custom_template).trim().toLowerCase() === "yes" ||
      String(custom_template).trim() === "1" ||
      Number(custom_template) === 1)
  ) {
    custom_template_string = "yes";
    requiredFields.custom_address = custom_address;
    requiredFields.disclaimer_emails = disclaimer_emails;
    // requiredFields.custom_logo = custom_logo;
  }

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

  const visibleFields = [
    'batch_number',
    'case_id',
    'ticket_id',
    'sub_client',
    'gender',
    'photo',
    'location',
    'client_reference_id'
  ];

  const action = "client_overview";
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

      const allEmails = emails.concat(
        branches.map((branch) => branch.branch_email)
      );

      if (allEmails.length === 0) {
        return res.status(400).json({ status: false, message: "Emails are empty" });
      }

      areEmailsUsed(allEmails)
        .then(({ areAnyUsed, message }) => {
          if (areAnyUsed) {
            return res.status(400).json({
              status: false,
              message: message, // Return the formatted message in the response
              token: newToken,
            });
          }
          const password = generatePassword(company_name);

          // Check if client_unique_id already exists
          Customer.checkUniqueId(client_code, (err, exists) => {
            if (err) {
              console.error("Error checking unique ID:", err);
              return res.status(500).json({
                status: false,
                message: "Internal server error",
                token: newToken,
              });
            }

            if (exists) {
              return res.status(400).json({
                status: false,
                message: `Client Unique ID '${client_code}' already exists.`,
                token: newToken,
              });
            }

            // Check if username is required and exists
            if (additional_login && additional_login.toLowerCase() === "yes") {
              Customer.checkUsername(username, (err, exists) => {
                if (err) {
                  console.error("Error checking username:", err);
                  return res.status(500).json({
                    status: false,
                    message: "Internal server error",
                    token: newToken,
                  });
                }

                if (exists) {
                  return res.status(400).json({
                    status: false,
                    message: `Username '${username}' already exists.`,
                    token: newToken,
                  });
                }

                // Create new customer record
                createCustomerRecord();
              });
            } else {
              // Create new customer record
              createCustomerRecord();
            }
          });

          function createCustomerRecord() {
            Customer.create(
              {
                admin_id,
                client_unique_id: client_code,
                name: company_name,
                address,
                profile_picture: null,
                emails_json: JSON.stringify(emails),
                mobile_number,
                role,
                services: JSON.stringify(scopeOfServices),
                additional_login: additional_login_int,
                username:
                  additional_login && additional_login.toLowerCase() === "yes"
                    ? username
                    : null,
              },
              (err, result) => {
                if (err) {
                  console.error("Database error while creating customer:", err);
                  AdminCommon.adminActivityLog(
                    ipAddress,
                    ipType,
                    admin_id,
                    "Customer",
                    "Create",
                    "0",
                    null,
                    err,
                    () => { }
                  );
                  return res.status(500).json({
                    status: false,
                    message: err.message,
                    token: newToken,
                  });
                }

                const customerId = result.insertId;

                Customer.createCustomerMeta(
                  {
                    customer_id: customerId,
                    address,
                    escalation_manager_id,
                    billing_spoc_id,
                    billing_escalation_id,
                    authorized_detail_id,
                    gst_number: gstin,
                    tat_days: tat,
                    agreement_date: date_agreement,
                    agreement_duration: agreement_period,
                    custom_template,
                    custom_address:
                      custom_template_string &&
                        custom_template_string.toLowerCase() === "yes"
                        ? custom_address
                        : null,
                    disclaimer_emails:
                      custom_template_string &&
                        custom_template_string.toLowerCase() === "yes"
                        ? disclaimer_emails
                        : null,
                    state,
                    state_code,
                    client_standard,
                    dedicated_point_of_contact,
                    first_level_matrix_name,
                    first_level_matrix_designation,
                    first_level_matrix_mobile,
                    first_level_matrix_email,
                    visible_fields: JSON.stringify(visible_fields) || 'null',
                    esc_manager_name,
                    esc_manager_email,
                    esc_manager_mobile,
                    esc_manager_desgn,
                    client_spoc_name,
                    client_spoc_email: JSON.stringify(client_spoc_email),
                    client_spoc_mobile,
                    client_spoc_desgn,
                    billing_spoc_name,
                    billing_spoc_email,
                    billing_spoc_mobile,
                    billing_spoc_desgn,
                    billing_escalation_name,
                    billing_escalation_email,
                    billing_escalation_mobile,
                    billing_escalation_desgn,
                    authorized_detail_name,
                    authorized_detail_email,
                    authorized_detail_mobile,
                    authorized_detail_desgn
                  },
                  (err, metaResult) => {
                    if (err) {
                      console.error(
                        "Database error while creating customer meta:",
                        err
                      );
                      AdminCommon.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Customer Meta",
                        "Create",
                        "0",
                        `{id: ${customerId}}`,
                        err,
                        () => { }
                      );
                      return res.status(500).json({
                        status: false,
                        message: err.error,
                        token: newToken,
                      });
                    }
                    const headBranchEmail = emails[0];
                    // Create the first branch (head branch)
                    Branch.create(
                      {
                        customer_id: customerId,
                        name: company_name,
                        email: headBranchEmail,
                        head: 1,
                        password,
                        mobile_number,
                      },
                      (err, headBranchResult) => {
                        if (err) {
                          console.error("Error creating head branch:", err);
                          return res.status(500).json({
                            status: false,
                            message: err.message,
                            token: newToken,
                          });
                        }

                        const headBranchId = headBranchResult.insertId;

                        // Create remaining branches with head_branch_id as foreign key
                        const branchCreationPromises = branches.map(
                          (branch) => {
                            return new Promise((resolve, reject) => {
                              Branch.create(
                                {
                                  customer_id: customerId,
                                  name: branch.branch_name,
                                  email: branch.branch_email,
                                  head: 0,
                                  head_id: headBranchId,
                                  password,
                                },
                                (err, branchResult) => {
                                  if (err) {
                                    console.error(
                                      "Error creating branch:",
                                      branch.branch_name,
                                      err
                                    );
                                    return reject(err);
                                  }
                                  resolve(branchResult);
                                }
                              );
                            });
                          }
                        );

                        Promise.all(branchCreationPromises)
                          .then((branchResults) => {
                            AdminCommon.adminActivityLog(
                              ipAddress,
                              ipType,
                              admin_id,
                              "Customer",
                              "Create",
                              "1",
                              `{id: ${customerId}}`,
                              null,
                              () => { }
                            );

                            if (send_mail == 1) {
                              Customer.getAllBranchesByCustomerId(
                                customerId,
                                (err, dbBranches) => {
                                  if (err) {
                                    console.error(
                                      "Database error while fetching branches:",
                                      err
                                    );

                                    // Log the error using your admin activity log function
                                    AdminCommon.adminActivityLog(
                                      ipAddress,
                                      ipType,
                                      admin_id,
                                      "Branch",
                                      "Fetch",
                                      "0",
                                      null,
                                      err,
                                      () => { }
                                    );

                                    return res.status(500).json({
                                      status: false,
                                      message: err.message,
                                      token: newToken,
                                    });
                                  }
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
                                      const appHost =
                                        appInfo.host || "www.example.com";
                                      const appName =
                                        appInfo.name || "Example Company";
                                      const formattedBranches = dbBranches.map(
                                        (dbBranch) => ({
                                          email: dbBranch.email,
                                          name: dbBranch.name,
                                        })
                                      );

                                      const emailPromises = dbBranches.map(
                                        (dbBranch) => {
                                          if (dbBranch.is_head == 1) {
                                            // For head branches, fetch customer details
                                            return new Promise(
                                              (resolve, reject) => {
                                                Customer.getCustomerById(
                                                  customerId,
                                                  (err, currentCustomer) => {
                                                    if (err) {
                                                      console.error(
                                                        "Database error during customer retrieval:",
                                                        err
                                                      );
                                                      return reject(
                                                        new Error(
                                                          "Failed to retrieve Customer. Please try again."
                                                        )
                                                      );
                                                    }

                                                    if (!currentCustomer) {
                                                      return reject(
                                                        new Error(
                                                          "Customer not found."
                                                        )
                                                      );
                                                    }

                                                    const customerName =
                                                      currentCustomer.name;
                                                    const customerJsonArr =
                                                      JSON.parse(
                                                        currentCustomer.emails
                                                      );

                                                    // Create a recipient list
                                                    const customerRecipientList =
                                                      customerJsonArr.map(
                                                        (email) => ({
                                                          name: customerName,
                                                          email: email,
                                                        })
                                                      );

                                                    const toCC = [{ name: 'QC Team', email: 'qc@screeningstar.com' }];

                                                    // Create email for head branch
                                                    createMail(
                                                      "customer",
                                                      "create",
                                                      company_name,
                                                      formattedBranches,
                                                      password,
                                                      dbBranch.is_head,
                                                      customerRecipientList,
                                                      toCC,
                                                      appHost
                                                    )
                                                      .then(resolve)
                                                      .catch(reject);
                                                  }
                                                );
                                              }
                                            );
                                          } else {
                                            // For non-head branches
                                            return createMail(
                                              "customer",
                                              "create",
                                              company_name,
                                              [
                                                {
                                                  email: dbBranch.email,
                                                  name: dbBranch.name,
                                                },
                                              ],
                                              password,
                                              dbBranch.is_head,
                                              [],
                                              appHost
                                            ).catch((emailError) => {
                                              console.error(
                                                "Error sending email:",
                                                emailError
                                              );
                                              return Promise.resolve(
                                                "Email sending failed for this branch."
                                              );
                                            });
                                          }
                                        }
                                      );

                                      // Wait for all email promises to resolve
                                      Promise.all(emailPromises)
                                        .then(() => {
                                          return res.json({
                                            status: true,
                                            message:
                                              "Client successfully created",
                                            branches: formattedBranches,
                                            data: { customerId },
                                            password,
                                            token: newToken,
                                          });
                                        })
                                        .catch((error) => {
                                          console.error(
                                            "An error occurred during processing:",
                                            error
                                          );
                                          return res.status(500).json({
                                            status: false,
                                            message:
                                              "An error occurred while processing requests.",
                                            token: newToken,
                                          });
                                        });
                                    });
                                }
                              );
                            } else {
                              return res.json({
                                status: true,
                                message:
                                  "Client successfully created",
                                data: { customerId },
                                password,
                                token: newToken,
                              });
                            }
                          })
                          .catch((error) => {
                            console.error("Error creating branches:", error);
                            return res.status(500).json({
                              status: false,
                              message: error.error || error.message || "Error creating some branches.",
                              token: newToken,
                            });
                          });
                      }
                    );
                  }
                );
              }
            );
          }
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
  });
};

exports.upload = async (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

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
        admin_id,
        _token,
        customer_code,
        customer_id,
        upload_category,
        send_mail,
        company_name,
        password,
      } = req.body;

      // Validate required fields and collect missing ones
      const requiredFields = {
        admin_id,
        _token,
        customer_code,
        customer_id,
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

      // If send_mail is 1, add additional required fields
      if (send_mail == 1) {
        requiredFields.company_name = company_name;
        requiredFields.password = password;
      }

      // Check if the admin is authorized
      const action = "client_overview";
      AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
          console.warn("Admin not authorized:", result.message);
          return res.status(403).json({
            status: false,
            message: result.message,
          });
        }

        // Verify admin token
        AdminCommon.isAdminTokenValid(_token, admin_id, async (err, result) => {
          if (err) {
            console.error("Error checking token validity:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message });
          }

          if (!result.status) {
            console.warn("Invalid admin token:", result.message);
            return res
              .status(401)
              .json({ status: false, message: result.message });
          }

          const newToken = result.newToken;
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
            let targetDir;
            let db_column;
            switch (upload_category) {
              case "logo":
                targetDir = `uploads/customer/${customer_code}/logo`;
                db_column = `logo`;
                break;
              case "custom_logo":
                targetDir = `uploads/customer/${customer_code}/custom-logo`;
                db_column = `custom_logo`;
                break;
              case "agr_upload":
                targetDir = `uploads/customer/${customer_code}/agreement`;
                db_column = `agreement`;
                break;
              default:
                return res.status(400).json({
                  status: false,
                  message: "Invalid upload category.",
                  token: newToken,
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

              Customer.documentUpload(
                customer_id,
                db_column,
                savedImagePaths,
                (err, result) => {
                  if (err) {
                    console.error(
                      "Database error while creating customer:",
                      err
                    );
                    AdminCommon.adminActivityLog(
                      ipAddress,
                      ipType,
                      admin_id,
                      "Customer",
                      "Create",
                      "0",
                      null,
                      err,
                      () => { }
                    );
                    return res.status(500).json({
                      status: false,
                      message: err.message,
                      token: newToken,
                    });
                  }

                  if (send_mail == 1) {
                    Customer.getAllBranchesByCustomerId(
                      customer_id,
                      (err, dbBranches) => {
                        if (err) {
                          console.error(
                            "Database error while fetching branches:",
                            err
                          );

                          // Log the error using your admin activity log function
                          AdminCommon.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id, // Assuming admin_id is defined in your context
                            "Branch",
                            "Fetch",
                            "0",
                            null,
                            err,
                            () => { } // Callback after logging the error
                          );

                          // Return error response
                          return res.status(500).json({
                            status: false,
                            message: err.message,
                            token: newToken, // Assuming newToken is defined in your context
                          });
                        }

                        AppModel.appInfo("frontend", async (err, appInfo) => {
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
                          const appHost = appInfo.host || "www.example.com";
                          const appName = appInfo.name || "Example Company";

                          // Create an array to hold all promises
                          const emailPromises = [];

                          // Format the branches into the desired structure
                          const formattedBranches = dbBranches.map(
                            (dbBranch) => ({
                              email: dbBranch.email,
                              name: dbBranch.name,
                            })
                          );

                          // Iterate through each branch
                          dbBranches.forEach((dbBranch) => {
                            const toCC = [
                              { name: 'QC Team', email: 'qc@screeningstar.com' }
                            ];

                            // Check if the branch is a head branch
                            if (dbBranch.is_head == 1) {
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
                                  const customerName = currentCustomer.name;
                                  const customerJsonArr = JSON.parse(
                                    currentCustomer.emails
                                  );

                                  const customerRecipientList =
                                    customerJsonArr.map((email) => ({
                                      name: customerName,
                                      email: email,
                                    }));

                                  // Send email with all formatted branches
                                  const emailPromise = createMail(
                                    "customer",
                                    "create",
                                    company_name,
                                    formattedBranches,
                                    password,
                                    dbBranch.is_head,
                                    customerRecipientList,
                                    toCC,
                                    appHost
                                  ).catch((emailError) => {
                                    console.error(
                                      "Error sending email:",
                                      emailError
                                    );
                                    return Promise.resolve(
                                      "Email sending failed for this branch."
                                    );
                                  });

                                  emailPromises.push(emailPromise);
                                }
                              );
                            } else {
                              // Send email with the single formatted branch
                              const emailPromise = createMail(
                                "customer",
                                "create",
                                company_name,
                                [{ email: dbBranch.email, name: dbBranch.name }], // Send only the current branch
                                password,
                                dbBranch.is_head,
                                toCC,
                                appHost
                              ).catch((emailError) => {
                                console.error("Error sending email:", emailError);
                                return Promise.resolve(
                                  "Email sending failed for this branch."
                                );
                              });

                              emailPromises.push(emailPromise);
                            }
                          });

                          // Wait for all email promises to resolve
                          Promise.all(emailPromises)
                            .then(() => {
                              return res.json({
                                status: true,
                                message:
                                  "Client successfully created",
                                branches: formattedBranches, // Optionally send the formatted branches
                                data: savedImagePaths,
                                token: newToken,
                              });
                            })
                            .catch((error) => {
                              console.error(
                                "An error occurred during processing:",
                                error
                              );
                              return res.status(500).json({
                                status: false,
                                message:
                                  "An error occurred while processing requests.",
                                token: newToken,
                              });
                            });
                        });
                      }
                    );
                  } else {
                    return res.json({
                      status: true,
                      message:
                        "Customer and branches created and file saved successfully.",
                      data: savedImagePaths,
                      token: newToken,
                    });
                  }
                }
              );
            } catch (error) {
              console.error("Error saving image:", error);
              return res.status(500).json({
                status: false,
                message: "An error occurred while saving the image.",
                token: newToken,
              });
            }
          });
        });
      });
    } catch (error) {
      console.error("Error processing upload:", error);
      return res.status(500).json({
        status: false,
        message: "An error occurred during the upload process.",
        token: newToken
      });
    }
  });
};

// Controller to list all customers
exports.inactiveList = (req, res) => {
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

      Customer.inactiveList((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        return res.json({
          status: true,
          message: "Customers fetched successfully",
          customers: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

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

      Customer.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        return res.json({
          status: true,
          message: "Customers fetched successfully",
          customers: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.listWithBasicInfo = (req, res) => {
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

      Customer.listWithBasicInfo((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        return res.json({
          status: true,
          message: "Customers fetched successfully",
          customers: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    admin_id,
    _token,
    customer_id,
    name,
    role,
    state,
    mobile,
    emails,
    address,
    username,
    tat_days,
    services,
    state_code,
    gst_number,
    agreement_date,
    client_standard,
    billing_spoc_id,
    additional_login,
    client_unique_id,
    agreement_duration,
    authorized_detail_id,
    escalation_manager_id,
    billing_escalation_id,
    dedicated_point_of_contact,
    first_level_matrix_name,
    first_level_matrix_designation,
    first_level_matrix_mobile,
    first_level_matrix_email,
    visible_fields,
    custom_template,
    custom_address,
    disclaimer_emails,
    esc_manager_name,
    esc_manager_email,
    esc_manager_mobile,
    esc_manager_desgn,
    client_spoc_name,
    client_spoc_email,
    client_spoc_mobile,
    client_spoc_desgn,
    billing_spoc_name,
    billing_spoc_email,
    billing_spoc_mobile,
    billing_spoc_desgn,
    billing_escalation_name,
    billing_escalation_email,
    billing_escalation_mobile,
    billing_escalation_desgn,
    authorized_detail_name,
    authorized_detail_email,
    authorized_detail_mobile,
    authorized_detail_desgn
  } = req.body;

  // Define required fields
  const requiredFields = {
    admin_id,
    _token,
    customer_id,
    name,
    state,
    mobile,
    emails,
    address,
    services,
    tat_days,
    state_code,
    gst_number,
    client_unique_id,
    agreement_date,
    client_standard,
    agreement_duration,
  };

  let additional_login_int = 0;
  if (additional_login && additional_login.toLowerCase() === "yes") {
    additional_login_int = 1;
    requiredFields.username = username;
  }

  let custom_template_string = "no";
  if (
    custom_template &&
    (String(custom_template).trim().toLowerCase() === "yes" ||
      String(custom_template).trim() === "1" ||
      Number(custom_template) === 1)
  ) {
    custom_template_string = "yes";
    requiredFields.custom_address = custom_address;
    requiredFields.disclaimer_emails = disclaimer_emails;
    // requiredFields.custom_logo = custom_logo;
  }

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

  if (emails.length === 0) {
    return res.status(400).json({ status: false, message: "Emails are empty" });
  }

  const action = "client_overview";

  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message,
      });
    }

    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      const filterEmails = Array.isArray(emails) ? emails : JSON.parse(emails);

      // Get the first email in the array
      const firstEmail = filterEmails[0];

      // Correct way to create an array with the first email
      const firstEmailInArr = [firstEmail];

      // Find duplicate emails
      const duplicateEmails = filterEmails.filter(
        (email, index, self) => self.indexOf(email) !== index
      );

      // Get unique duplicates and show in the error message
      if (duplicateEmails.length > 0) {
        const uniqueDuplicateEmails = [...new Set(duplicateEmails)]; // Get unique duplicate emails
        console.error(`Email(s) used many times: ${uniqueDuplicateEmails.join(", ")}`);

        return res.status(400).json({
          status: false,
          message: `${uniqueDuplicateEmails.join(", ")} email(s) are used many times`,
          repeatedEmails: uniqueDuplicateEmails,
          token: newToken,
        });
      }

      console.log(`firstEmailInArr - `, firstEmailInArr);

      areEmailsUsedForUpdate(firstEmailInArr, customer_id)
        .then(({ areAnyUsed, message }) => {
          console.log({ areAnyUsed, message });
          if (areAnyUsed) {
            console.log("Email(s) already used:", message);
            return res.status(400).json({
              status: false,
              message: message, // Return the formatted message in the response
              token: result.newToken,
            });
          }

          Customer.getCustomerById(customer_id, (err, currentCustomer) => {
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

            const changes = {};
            const compareAndAddChanges = (key, newValue) => {
              if (currentCustomer[key] !== newValue) {
                changes[key] = {
                  old: currentCustomer[key],
                  new: newValue,
                };
              }
            };

            compareAndAddChanges("name", name);
            compareAndAddChanges("emails_json", JSON.stringify(emails));
            compareAndAddChanges("additional_login", additional_login_int);
            if (additional_login && additional_login.toLowerCase() === "yes") {
              compareAndAddChanges("username", username);
            }
            compareAndAddChanges("mobile", mobile);
            compareAndAddChanges("services", services);
            compareAndAddChanges("role", role);

            Customer.getCustomerMetaById(
              customer_id,
              (err, currentCustomerMeta) => {
                if (err) {
                  console.error(
                    "Database error during customer meta retrieval:",
                    err
                  );
                  return res.status(500).json({
                    status: false,
                    message: "Failed to retrieve Customer meta. Please try again.",
                    token: newToken,
                  });
                }

                if (currentCustomerMeta) {
                  compareAndAddChanges("address", address);
                  compareAndAddChanges(
                    "escalation_manager_id",
                    escalation_manager_id
                  );
                  compareAndAddChanges("billing_spoc_id", billing_spoc_id);
                  compareAndAddChanges(
                    "billing_escalation_id",
                    billing_escalation_id
                  );
                  compareAndAddChanges(
                    "authorized_detail_id",
                    authorized_detail_id
                  );
                  compareAndAddChanges("gst_number", gst_number);
                  compareAndAddChanges("tat_days", tat_days);
                  compareAndAddChanges("agreement_date", agreement_date);
                  compareAndAddChanges("client_standard", client_standard);
                  compareAndAddChanges("agreement_duration", agreement_duration);
                  compareAndAddChanges("state", state);
                  compareAndAddChanges("state_code", state_code);
                }

                if (client_unique_id !== currentCustomer.client_unique_id) {
                  Customer.checkUniqueIdForUpdate(
                    customer_id,
                    client_unique_id,
                    (err, exists) => {
                      if (err) {
                        console.error("Error checking unique ID:", err);
                        return res.status(500).json({
                          status: false,
                          message: "Internal server error",
                          token: newToken,
                        });
                      }

                      if (exists) {
                        return res.status(400).json({
                          status: false,
                          message: `Client Unique ID '${client_unique_id}' already exists.`,
                          token: newToken,
                        });
                      }

                      continueUpdate();
                    }
                  );
                } else {
                  continueUpdate();
                }

                function continueUpdate() {
                  if (
                    additional_login &&
                    additional_login.toLowerCase() === "yes" &&
                    username !== currentCustomer.username
                  ) {
                    Customer.checkUsernameForUpdate(
                      customer_id,
                      username,
                      (err, exists) => {
                        if (err) {
                          console.error("Error checking username:", err);
                          return res.status(500).json({
                            status: false,
                            message: "Internal server error",
                            token: newToken,
                          });
                        }

                        if (exists) {
                          return res.status(400).json({
                            status: false,
                            message: `Username '${username}' already exists.`,
                            token: newToken,
                          });
                        }

                        updateCustomerRecord();
                      }
                    );
                  } else {
                    updateCustomerRecord();
                  }
                }

                function updateCustomerRecord() {
                  Customer.update(
                    customer_id,
                    {
                      admin_id,
                      name,
                      address,
                      profile_picture: currentCustomer.profile_picture,
                      emails_json: JSON.stringify(emails),
                      mobile,
                      role,
                      services:
                        typeof services === "string"
                          ? JSON.parse(services)
                          : services,
                      additional_login: additional_login_int,
                      username:
                        additional_login && additional_login.toLowerCase() === "yes"
                          ? username
                          : null,
                    },
                    (err, result) => {
                      if (err) {
                        console.error(
                          "Database error during customer update:",
                          err
                        );
                        return res.status(500).json({
                          status: false,
                          message: "Failed to update customer. Please try again.",
                          token: newToken,
                        });
                      }

                      if (result) {
                        const updatedFields = Object.keys(changes).map((field) => ({
                          field,
                          old_value: changes[field].old,
                          new_value: changes[field].new,
                        }));

                        Customer.updateCustomerMetaByCustomerId(
                          customer_id,
                          {
                            address,
                            escalation_manager_id,
                            billing_spoc_id,
                            billing_escalation_id,
                            authorized_detail_id,
                            gst_number,
                            tat_days,
                            agreement_date,
                            agreement_duration,
                            custom_template,
                            custom_address:
                              custom_template_string &&
                                custom_template_string.toLowerCase() === "yes"
                                ? custom_address
                                : null,
                            disclaimer_emails:
                              custom_template_string &&
                                custom_template_string.toLowerCase() === "yes"
                                ? disclaimer_emails
                                : null,
                            state,
                            state_code,
                            client_standard,
                            dedicated_point_of_contact,
                            first_level_matrix_name,
                            first_level_matrix_designation,
                            first_level_matrix_mobile,
                            first_level_matrix_email,
                            visible_fields: JSON.stringify(visible_fields) || 'null',
                            esc_manager_name,
                            esc_manager_email,
                            esc_manager_mobile,
                            esc_manager_desgn,
                            client_spoc_name,
                            client_spoc_email: JSON.stringify(client_spoc_email),
                            client_spoc_mobile,
                            client_spoc_desgn,
                            billing_spoc_name,
                            billing_spoc_email,
                            billing_spoc_mobile,
                            billing_spoc_desgn,
                            billing_escalation_name,
                            billing_escalation_email,
                            billing_escalation_mobile,
                            billing_escalation_desgn,
                            authorized_detail_name,
                            authorized_detail_email,
                            authorized_detail_mobile,
                            authorized_detail_desgn
                          },
                          (err, metaResult) => {
                            if (err) {
                              console.error(
                                "Database error during customer meta update:",
                                err
                              );
                              return res.status(500).json({
                                status: false,
                                message:
                                  "Failed to update customer meta. Please try again.",
                                token: newToken,
                              });
                            }

                            if (metaResult) {
                              const headBranchEmail = emails[0];
                              Branch.updateHeadBranchEmail(
                                customer_id,
                                name,
                                headBranchEmail,
                                (err, headBranchResult) => {
                                  if (err) {
                                    console.error(
                                      "Error updating head branch email:",
                                      err
                                    );
                                    return res.status(500).json({
                                      status: false,
                                      message:
                                        "Internal server error while updating head branch email.",
                                      token: newToken,
                                    });
                                  }
                                  return res.status(200).json({
                                    status: true,
                                    message: "Customer updated successfully.",
                                    token: newToken,
                                  });
                                }
                              );
                            }
                          }
                        );
                      }
                    }
                  );
                }
              }
            );
          });
        })
        .catch((err) => {
          console.error(err);
          return res.status(500).json({
            status: false,
            message: "An error occurred while checking email usage.",
          });
        });
    });
  });
};

// Controller to list all customers
exports.fetchBranchPassword = (req, res) => {
  const { admin_id, _token, branch_email } = req.query;

  let missingFields = [];
  if (!branch_email || branch_email === "") missingFields.push("Branch Email");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
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

    Customer.fetchBranchPasswordByEmail(branch_email, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ status: false, message: err.message, token: newToken });
      }

      if (!result) {
        return res.status(404).json({
          status: false,
          message: "Password not found",
          token: newToken,
        });
      }

      return res.json({
        status: true,
        message: "Password fetched successfully",
        password: result,
        token: newToken,
      });
    });
  });
};

exports.active = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { customer_id, admin_id, _token } = req.query;

  // Define required fields
  const requiredFields = {
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

  const action = "client_overview";

  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message,
      });
    }

    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      Customer.getCustomerById(customer_id, (err, currentCustomer) => {
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

        const changes = {};
        if (currentCustomer.status !== 1) {
          changes.status = { old: currentCustomer.status, new: 1 };
        }
        // Update the branch
        Customer.active(customer_id, (err, result) => {
          if (err) {
            console.error("Database error during customer status update:", err);
            AdminCommon.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Customer",
              "status",
              "0",
              JSON.stringify({ customer_id, ...changes }),
              err,
              () => { }
            );
            return res.status(500).json({
              status: false,
              message: "Failed to update customer status. Please try again.",
              token: newToken,
            });
          }

          AdminCommon.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Customer",
            "status",
            "1",
            JSON.stringify({ customer_id, ...changes }),
            null,
            () => { }
          );

          return res.status(200).json({
            status: true,
            message: "Customer status has been successfully updated to active.",
            token: newToken,
          });
        });
      });
    });
  });
};

exports.inactive = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { customer_id, admin_id, _token } = req.query;

  // Define required fields
  const requiredFields = {
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

  const action = "client_overview";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message,
      });
    }

    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      Customer.getCustomerById(customer_id, (err, currentCustomer) => {
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

        const changes = {};
        if (currentCustomer.status !== 0) {
          changes.status = { old: currentCustomer.status, new: 0 };
        }
        // Update the branch
        Customer.inactive(customer_id, (err, result) => {
          if (err) {
            console.error("Database error during customer status update:", err);
            AdminCommon.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Customer",
              "status",
              "0",
              JSON.stringify({ customer_id, ...changes }),
              err,
              () => { }
            );
            return res.status(500).json({
              status: false,
              message: "Failed to update customer status. Please try again.",
              token: newToken,
            });
          }

          AdminCommon.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Customer",
            "status",
            "1",
            JSON.stringify({ customer_id, ...changes }),
            null,
            () => { }
          );

          return res.status(200).json({
            status: true,
            message:
              "Customer status has been successfully updated to inactive.",
            token: newToken,
          });
        });
      });
    });
  });
};

exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, admin_id, _token } = req.query;

  // Validate required fields
  const missingFields = [];
  if (!id || id === "") missingFields.push("Customer ID");
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
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      // Check the status returned by the authorization function
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Validate admin token
    AdminCommon.isAdminTokenValid(
      _token,
      admin_id,
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

        // Fetch the current customer
        Customer.getCustomerById(id, (err, currentCustomer) => {
          if (err) {
            console.error("Database error during customer retrieval:", err);
            return res.status(500).json({
              status: false,
              message: err.message || "Failed to retrieve customer. Please try again.",
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

          // Delete the customer
          Customer.delete(id, (err, result) => {
            if (err) {
              console.error("Database error during customer deletion:", err);
              AdminCommon.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Customer",
                "Delete",
                "0",
                JSON.stringify({ id }),
                err,
                () => { }
              );
              return res.status(500).json({
                status: false,
                message: "Failed to delete customer. Please try again.",
                token: newToken,
              });
            }

            AdminCommon.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Customer",
              "Delete",
              "1",
              JSON.stringify({ id }),
              null,
              () => { }
            );

            return res.status(200).json({
              status: true,
              message: "Customer deleted successfully.",
              result,
              token: newToken,
            });
          });
        });
      }
    );
  });
};

exports.customerBasicInfoWithBranchAuth = (req, res) => {
  const { customer_id, sub_user_id, branch_id, branch_token } = req.query;

  let missingFields = [];
  if (!customer_id || customer_id === "") missingFields.push("Customer ID");
  if (!branch_id || branch_id === "") missingFields.push("Branch ID");
  if (!branch_token || branch_token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Verify admin token
  BranchCommon.isBranchTokenValid(
    branch_token,
    sub_user_id || "",
    branch_id,
    (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      Customer.infoByID(customer_id, (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        res.json({
          status: true,
          message: "Customer Info fetched successfully",
          customers: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    }
  );
};

exports.customerInfoWithBranchAuth = (req, res) => {
  const { customer_id, sub_user_id, branch_id, branch_token } = req.query;

  let missingFields = [];
  if (!customer_id || customer_id === "") missingFields.push("Customer ID");
  if (!branch_id || branch_id === "") missingFields.push("Branch ID");
  if (!branch_token || branch_token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Verify admin token
  BranchCommon.isBranchTokenValid(
    branch_token,
    sub_user_id || "",
    branch_id,
    (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      Customer.infoByID(customer_id, (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        res.json({
          status: true,
          message: "Customer Info fetched successfully",
          customers: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    }
  );
};
