const Candidate = require("../../../../models/customer/branch/candidateApplicationModel");
const BranchCommon = require("../../../../models/customer/branch/commonModel");
const Branch = require("../../../../models/customer/branch/branchModel");
const Service = require("../../../../models/admin/serviceModel");
const Customer = require("../../../../models/customer/customerModel");
const AppModel = require("../../../../models/appModel");
const { getClientIpAddress } = require("../../../../utils/ipAddress");

const {
  createMail,
} = require("../../../../mailer/customer/branch/candidate/createMail");

const {
  bulkCreateMail,
} = require("../../../../mailer/customer/branch/candidate/bulkCreateMail");

const {
  davMail,
} = require("../../../../mailer/customer/branch/candidate/davMail");

exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    sub_user_id,
    branch_id,
    _token,
    customer_id,
    name,
    employee_id,
    mobile_number,
    email,
    services,
    package,
  } = req.body;

  // Define required fields
  const requiredFields = {
    branch_id,
    _token,
    customer_id,
    name,
    mobile_number,
    email,
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

  /*
  Candidate.isEmailUsedBefore(email, branch_id, (err, emailUsed) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Internal Server Error: Unable to check email.",
        error: err,
      });
    }

    if (emailUsed) {
      return res.status(409).json({
        status: false,
        message: "Conflict: The email address has already been used.",
      });
    }
    */
  const action = "candidate_manager";
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
      (err, result) => {
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

        Customer.getActiveCustomerById(
          customer_id,
          async (err, currentCustomer) => {
            if (err) {
              console.error("Database error during customer retrieval:", err);
              return res.status(500).json({
                status: false,
                message: "Failed to retrieve customer. Please try again.",
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
            Candidate.checkUniqueEmpId(employee_id, (err, exists) => {
              if (err) {
                console.error("Error checking unique ID:", err);
                return res
                  .status(500)
                  .json({ status: false, message: err.message, token: newToken });
              }

              if (exists) {
                return res.status(400).json({
                  status: false,
                  message: `Candidate Employee ID '${employee_id}' already exists.`,
                  token: newToken,
                });
              }
                */

            Candidate.create(
              {
                sub_user_id,
                branch_id,
                name,
                employee_id,
                mobile_number,
                email,
                services: services || "",
                package: package || "",
                customer_id,
              },
              (err, result) => {
                if (err) {
                  console.error(
                    "Database error during candidate application creation:",
                    err
                  );
                  BranchCommon.branchActivityLog(
                    ipAddress,
                    ipType,
                    branch_id,
                    "Candidate Application",
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

                BranchCommon.branchActivityLog(
                  ipAddress,
                  ipType,
                  branch_id,
                  "Candidate Application",
                  "Create",
                  "1",
                  `{id: ${result.insertId}}`,
                  null,
                  () => { }
                );

                Customer.getDedicatedPointOfContact(
                  customer_id,
                  (err, dedicatedClientSpocEmails) => {
                    if (err) {
                      console.error("Error getting dedicted client spoc emails:", err);
                      return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                      });
                    }

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

                        // Prepare recipient and CC lists

                        let toArr = [{ name, email }];
                        let ccArr = [{ name: 'QC Team', email: 'qc@screeningstar.com' }, { name: 'BGV Team', email: 'Bgv@screeningstar.com' }];

                        // Append parsed customer emails to existing ccArr
                        const newEmails = JSON.parse(customer.emails).map((email) => ({
                          name: customer.name,
                          email: email.trim(),
                        }));

                        ccArr.push(...newEmails);

                        // If valid emails are found, push them into the toArr
                        if (dedicatedClientSpocEmails && dedicatedClientSpocEmails.length > 0) {
                          dedicatedClientSpocEmails.forEach(email => {
                            toArr.push({ name: "Dedicated Client Spoc", email: email });
                          });
                        }

                        /*
                      const toArr = [
                        { name: branch.name, email: branch.email },
                        { name, email },
                      ];
                      ccArr = JSON.parse(customer.emails).map((email) => ({
                        name: customer.name,
                        email: email.trim(),
                      }));
                      */

                        const serviceIds = services
                          ? services
                            .split(",")
                            .map((id) => parseInt(id.trim(), 10))
                            .filter(Number.isInteger)
                          : [];

                        const serviceNames = [];

                        // Function to fetch service names recursively
                        const fetchServiceNames = (index = 0) => {
                          if (index >= serviceIds.length) {
                            // All service names fetched, now get app info
                            return AppModel.appInfo("frontend", (err, appInfo) => {
                              if (err) {
                                console.error("Database error:", err);
                                return res.status(500).json({
                                  status: false,
                                  message: err.message,
                                  token: newToken,
                                });
                              }

                              const appHost = appInfo?.host || "www.screeningstar.in";
                              const base64_app_id = btoa(result.insertId);
                              const base64_branch_id = btoa(branch_id);
                              const base64_customer_id = btoa(customer_id);

                              const base64_link_with_ids = `YXBwX2lk=${base64_app_id}&YnJhbmNoX2lk=${base64_branch_id}&Y3VzdG9tZXJfaWQ==${base64_customer_id}`;

                              const dav_href = `${appHost}/digital-form?${base64_link_with_ids}`;
                              const bgv_href = `${appHost}/background-form?${base64_link_with_ids}`;

                              // Fetch digital address service entry
                              return Service.digitlAddressService((err, serviceEntry) => {
                                if (err) {
                                  console.error("Database error:", err);
                                  return res.status(500).json({
                                    status: false,
                                    message: err.message,
                                    token: newToken,
                                  });
                                }

                                const hasDigitalService = serviceEntry && serviceIds.includes(parseInt(serviceEntry.id, 10));
                                const digitalAddressID = hasDigitalService ? parseInt(serviceEntry.id, 10) : null;
                                const otherServiceIds = serviceIds.filter(id => id !== digitalAddressID);

                                const shouldSendDavOnly = hasDigitalService && otherServiceIds.length === 0;
                                const shouldSendBoth = hasDigitalService && otherServiceIds.length > 0;
                                const shouldSendCreateOnly = !hasDigitalService && otherServiceIds.length > 0;

                                const sendApplicationEmail = () => {
                                  return createMail(
                                    "candidate application",
                                    "create",
                                    name,
                                    currentCustomer.name,
                                    result.insertId,
                                    bgv_href,
                                    serviceNames,
                                    toArr || [],
                                    ccArr || []
                                  )
                                    .then(() => {
                                      return res.status(201).json({
                                        status: true,
                                        message: "Online Background Verification Form generated successfully.",
                                        data: {
                                          candidate: result,
                                          package,
                                        },
                                        token: newToken,
                                        toArr: toArr || [],
                                        ccArr: ccArr || [],
                                      });
                                    })
                                    .catch((emailError) => {
                                      console.error("Error sending application creation email:", emailError);
                                      return res.status(201).json({
                                        status: true,
                                        message: "Online Background Verification Form generated successfully.",
                                        candidate: result,
                                        token: newToken,
                                      });
                                    });
                                };

                                if (hasDigitalService) {
                                  return davMail(
                                    "candidate application",
                                    "dav",
                                    name,
                                    customer.name,
                                    dav_href,
                                    [{ name: name, email: email.trim() }],
                                    [{ name: "QC Team", email: "qc@screeningstar.com" }, { name: 'BGV Team', email: 'Bgv@screeningstar.com' }]
                                  )
                                    .then(() => {
                                      if (shouldSendBoth || shouldSendCreateOnly) {
                                        return sendApplicationEmail();
                                      } else {
                                        return res.status(201).json({
                                          status: true,
                                          message: "Digital Address Verification Email sent successfully.",
                                          data: {
                                            candidate: result,
                                            package,
                                          },
                                          token: newToken,
                                        });
                                      }
                                    })
                                    .catch((emailError) => {
                                      console.error("Error sending digital address email:", emailError);

                                      // Attempt to still send application email if applicable
                                      if (shouldSendBoth || shouldSendCreateOnly) {
                                        return sendApplicationEmail();
                                      } else {
                                        return res.status(201).json({
                                          status: true,
                                          message: "Online Background Verification Form generated successfully (digital address email failed).",
                                          candidate: result,
                                          token: newToken,
                                        });
                                      }
                                    });
                                } else {
                                  // Only application email needs to be sent
                                  if (shouldSendBoth || shouldSendCreateOnly) {
                                    return sendApplicationEmail();
                                  } else {
                                    // If no email is to be sent at all (edge case)
                                    return res.status(201).json({
                                      status: true,
                                      message: "Candidate created but no applicable service email to send.",
                                      candidate: result,
                                      token: newToken,
                                    });
                                  }
                                }
                              });
                            });
                          }

                          const id = serviceIds[index];

                          Service.getServiceRequiredDocumentsByServiceId(id, (err, currentService) => {
                            if (err) {
                              console.error("Error fetching service data:", err);
                              return res.status(500).json({
                                status: false,
                                message: err.message,
                                token: newToken,
                              });
                            }

                            if (currentService?.title) {
                              serviceNames.push(`${currentService.title}: ${currentService.description}`);
                            }

                            // Continue to next service
                            fetchServiceNames(index + 1);
                          });
                        };

                        // Start fetching service names
                        fetchServiceNames();
                      }
                    );
                  });
              }
            );
          });
      });
  }
  );
  /*
});
});
*/
};

exports.bulkCreate = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    sub_user_id,
    branch_id,
    _token,
    customer_id,
    applications,
    services,
    package,
  } = req.body;

  // Define required fields
  const requiredFields = { branch_id, _token, customer_id, applications };

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

        // Get SPoC ID
        const emptyValues = [];
        const updatedApplications = applications.filter((app) => {
          // Check if all specified fields are empty
          const allFieldsEmpty =
            !app.applicant_full_name?.trim() &&
            !app.mobile_number?.trim() &&
            !app.email_id?.trim() &&
            !app.employee_id?.trim();

          // If all fields are empty, exclude this application
          if (allFieldsEmpty) {
            return false;
          }

          // Check if any of the required fields are missing and track missing fields
          const missingFields = [];
          if (!("applicant_full_name" in app))
            missingFields.push("Applicant Full Name");
          if (!("mobile_number" in app)) missingFields.push("Mobile Number");
          if (!("email_id" in app)) missingFields.push("Email ID");
          if (!("employee_id" in app)) missingFields.push("Employee ID");

          if (missingFields.length > 0) {
            emptyValues.push(
              `${app.applicant_full_name || "Unnamed applicant"
              } (missing fields: ${missingFields.join(", ")})`
            );
            return false; // Exclude applications with missing fields
          }

          // Check if any of the fields are empty and track those applicants
          const emptyFields = [];
          if (!app.applicant_full_name?.trim())
            emptyFields.push("Applicant Full Name");
          if (!app.mobile_number?.trim()) emptyFields.push("Mobile Number");
          if (!app.email_id?.trim()) emptyFields.push("Email ID");
          if (!app.employee_id?.trim()) emptyFields.push("Employee ID");

          if (emptyFields.length > 0) {
            emptyValues.push(
              `${app.applicant_full_name || "Unnamed applicant"
              } (empty fields: ${emptyFields.join(", ")})`
            );
          }

          // Include the application if it has at least one non-empty field
          return true;
        });

        console.log("Applications with issues:", emptyValues);

        if (emptyValues.length > 0) {
          return res.status(400).json({
            status: false,
            message: `Details are not complete for the following applicants: ${emptyValues.join(
              ", "
            )}`,
            token: newToken,
          });
        }

        // Check for duplicate employee IDs
        const employeeIds = updatedApplications.map((app) => app.employee_id);
        const emailIds = updatedApplications.map((app) => app.email_id);

        const employeeIdChecks = employeeIds.map((employee_id) => {
          return new Promise((resolve, reject) => {
            Candidate.checkUniqueEmpId(employee_id, (err, exists) => {
              if (err) {
                reject(err);
              } else if (exists) {
                reject({ type: "employee_id", value: employee_id });
              } else {
                resolve(employee_id); // Pass the unique employee ID to resolve
              }
            });
          });
        });

        const emailIdChecks = emailIds.map((email_id) => {
          return new Promise((resolve, reject) => {
            Candidate.isEmailUsedBefore(email_id, branch_id, (err, exists) => {
              if (err) {
                reject(err);
              } else if (exists) {
                reject({ type: "email_id", value: email_id });
              } else {
                resolve(email_id); // Pass the unique email ID to resolve
              }
            });
          });
        });

        // Handle employee ID and email ID uniqueness checks
        Promise.allSettled([...employeeIdChecks, ...emailIdChecks])
          .then((results) => {
            const rejectedResults = results.filter(
              (result) => result.status === "rejected"
            );

            const alreadyUsedEmployeeIds = rejectedResults
              .filter((result) => result.reason.type === "employee_id")
              .map((result) => result.reason.value);

            const alreadyUsedEmailIds = rejectedResults
              .filter((result) => result.reason.type === "email_id")
              .map((result) => result.reason.value);

            if (
              alreadyUsedEmployeeIds.length > 0 ||
              alreadyUsedEmailIds.length > 0
            ) {
              return res.status(400).json({
                status: false,
                message: `Employee IDs - "${alreadyUsedEmployeeIds.join(
                  ", "
                )}" and Email IDs - "${alreadyUsedEmailIds.join(
                  ", "
                )}" already used.`,
                token: newToken,
              });
            }

            // Proceed with creating candidate applications if all IDs are unique
            const applicationPromises = updatedApplications.map((app) => {
              return new Promise((resolve, reject) => {
                Candidate.create(
                  {
                    name: app.applicant_full_name,
                    employee_id: app.employee_id,
                    mobile_number: app.mobile_number,
                    email: app.email_id,
                    branch_id,
                    services,
                    packages: package,
                    customer_id,
                  },
                  (err, result) => {
                    if (err) {
                      reject(
                        new Error(
                          "Failed to create candidate application. Please try again."
                        )
                      );
                    } else {
                      // Log the activity
                      BranchCommon.branchActivityLog(
                        ipAddress,
                        ipType,
                        branch_id,
                        "Candidate Application",
                        "Create",
                        "1",
                        `{id: ${result.insertId}}`,
                        null,
                        () => { }
                      );
                      app.insertId = result.insertId;
                      resolve(app);
                    }
                  }
                );
              });
            });

            Promise.all(applicationPromises)
              .then(() => {
                // Send notification emails once all applications are created
                sendNotificationEmails(
                  branch_id,
                  customer_id,
                  services,
                  updatedApplications,
                  newToken,
                  res
                );
              })
              .catch((error) => {
                console.error(
                  "Error during candidate application creation:",
                  error
                );
                return res.status(400).json({
                  status: false,
                  message:
                    error.message ||
                    "Failed to create one or more candidate applications.",
                  token: newToken,
                });
              });
          })
          .catch((error) => {
            console.error("Error during uniqueness checks:", error);
            return res.status(400).json({
              status: false,
              message:
                error.message || "Error occurred during uniqueness checks.",
              token: newToken,
            });
          });
      }
    );
  });
};

// Function to send email notifications
function sendNotificationEmails(
  branch_id,
  customer_id,
  services,
  updatedApplications,
  newToken,
  res
) {
  // Fetch unique client ID based on branch ID
  Branch.getClientUniqueIDByBranchId(branch_id, (err, clientCode) => {
    if (err) {
      console.error("Error checking unique ID:", err);
      return res.status(500).json({
        status: false,
        message: err.message,
        token: newToken,
      });
    }

    if (!clientCode) {
      return res.status(400).json({
        status: false,
        message: "Customer Unique ID not Found",
        token: newToken,
      });
    }

    // Fetch client name based on branch ID
    Branch.getClientNameByBranchId(branch_id, (err, clientName) => {
      if (err) {
        console.error("Error checking candidate name:", err);
        return res.status(500).json({
          status: false,
          message: err.message,
          token: newToken,
        });
      }

      if (!clientName) {
        return res.status(400).json({
          status: false,
          message: "Customer Unique ID not found",
          token: newToken,
        });
      }

      Customer.getActiveCustomerById(
        customer_id,
        async (err, currentCustomer) => {
          if (err) {
            console.error("Database error during customer retrieval:", err);
            return res.status(500).json({
              status: false,
              message: "Failed to retrieve customer. Please try again.",
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
          Customer.getDedicatedPointOfContact(
            customer_id,
            (err, dedicatedClientSpocEmails) => {
              if (err) {
                console.error("Error getting dedicted client spoc emails:", err);
                return res.status(500).json({
                  status: false,
                  message: err.message,
                  token: newToken,
                });
              }

              // Fetch emails for notification
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
                  let toArr = [{ name: branch.name, email: branch.email }];

                  // If valid emails are found, push them into the toArr
                  if (dedicatedClientSpocEmails && dedicatedClientSpocEmails.length > 0) {
                    dedicatedClientSpocEmails.forEach(email => {
                      toArr.push({ name: "Dedicated Client Spoc", email: email });
                    });
                  }

                  const ccArr = JSON.parse(customer.emails).map((email) => ({
                    name: customer.name,
                    email: email.trim(),
                  }));

                  const finalEmailCC = [
                    { name: 'QC Team', email: 'qc@screeningstar.com' },
                    { name: 'BGV Team', email: 'Bgv@screeningstar.com' },
                    ...ccArr
                  ]

                  const serviceIds =
                    typeof services === "string" && services.trim() !== ""
                      ? services.split(",").map((id) => id.trim())
                      : [];

                  const serviceNames = [];

                  // Recursively fetch service names
                  const fetchServiceNames = (index = 0) => {
                    if (index >= serviceIds.length) {
                      sendBulkCreateMail(); // Proceed to sending bulk email once all services are processed
                      return;
                    }

                    const id = serviceIds[index];

                    Service.getServiceRequiredDocumentsByServiceId(
                      id,
                      (err, currentService) => {
                        if (err) {
                          console.error("Error fetching service data:", err);
                          return res.status(500).json({
                            status: false,
                            message: err.message,
                            token: newToken,
                          });
                        }

                        if (!currentService || !currentService.title) {
                          // Skip invalid services and continue to the next service
                          return fetchServiceNames(index + 1);
                        }

                        // Add the service name and description to the serviceNames array
                        serviceNames.push(
                          `${currentService.title}: ${currentService.description}`
                        );
                        fetchServiceNames(index + 1); // Recursively fetch next service
                      }
                    );
                  };

                  // Send email after fetching all services
                  const sendBulkCreateMail = () => {
                    bulkCreateMail(
                      "candidate application",
                      "bulk-create",
                      updatedApplications,
                      branch.name,
                      customer.name,
                      serviceNames,
                      "",
                      toArr,
                      finalEmailCC
                    )
                      .then(() => {
                        AppModel.appInfo("frontend", (err, appInfo) => {
                          if (err) {
                            console.error("Database error:", err);
                            return res.status(500).json({
                              status: false,
                              message: err.message,
                              token: newToken,
                            });
                          }

                          if (appInfo) {

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

                                let createMailCCArr = [{ name: 'QC Team', email: 'qc@screeningstar.com' }, { name: 'BGV Team', email: 'Bgv@screeningstar.com' }];

                                // Append parsed customer emails to existing createMailCCArr
                                const newEmails = JSON.parse(customer.emails).map((email) => ({
                                  name: customer.name,
                                  email: email.trim(),
                                }));

                                createMailCCArr.push(...newEmails);

                                Customer.getDedicatedPointOfContact(
                                  customer_id,
                                  (err, dedicatedClientSpocEmails) => {
                                    if (err) {
                                      console.error("Error getting dedicted client spoc emails:", err);
                                      return res.status(500).json({
                                        status: false,
                                        message: err.message,
                                        token: newToken,
                                      });
                                    }

                                    const appHost = appInfo.host || "www.screeningstar.in";

                                    // Initialize counters for tracking email success/failure
                                    let processedApplications = 0;
                                    let failedApplications = 0;
                                    let responseSent = false; // Flag to track if the response is already sent

                                    updatedApplications.forEach((app) => {
                                      const base64_app_id = btoa(app.insertId);
                                      const base64_branch_id = btoa(branch_id);
                                      const base64_customer_id = btoa(customer_id);
                                      const base64_link_with_ids = `YXBwX2lk=${base64_app_id}&YnJhbmNoX2lk=${base64_branch_id}&Y3VzdG9tZXJfaWQ=${base64_customer_id}`;

                                      const dav_href = `${appHost}/digital-form?${base64_link_with_ids}`;
                                      const bgv_href = `${appHost}/background-form?${base64_link_with_ids}`;

                                      let createMailToArr = [
                                        { name: app.applicant_full_name, email: app.email_id },
                                      ];

                                      // If valid emails are found, push them into the toArr
                                      if (dedicatedClientSpocEmails && dedicatedClientSpocEmails.length > 0) {
                                        dedicatedClientSpocEmails.forEach(email => {
                                          createMailToArr.push({ name: "Dedicated Client Spoc", email: email });
                                        });
                                      }

                                      // Fetch and process digital address service for DAV mail
                                      Service.digitlAddressService((err, serviceEntry) => {
                                        if (err) {
                                          console.error("Database error:", err);
                                          return res.status(500).json({
                                            status: false,
                                            message: err.message,
                                            token: newToken,
                                          });
                                        }

                                        if (serviceEntry) {
                                          const digitalAddressID = parseInt(
                                            serviceEntry.id,
                                            10
                                          );
                                          if (serviceIds.includes(digitalAddressID)) {
                                            const toCC = [
                                              { name: 'QC Team', email: 'qc@screeningstar.com' },
                                              { name: 'BGV Team', email: 'Bgv@screeningstar.com' }
                                            ];

                                            davMail(
                                              "candidate application",
                                              "dav",
                                              app.applicant_full_name,
                                              customer.name,
                                              dav_href,
                                              [
                                                {
                                                  name: app.applicant_full_name,
                                                  email: app.email_id.trim(),
                                                },
                                              ],
                                              toCC
                                            )
                                              .then(() => {
                                                console.log(
                                                  "Digital address verification mail sent."
                                                );
                                              })
                                              .catch((emailError) => {
                                                console.error(
                                                  "Error sending digital address email:",
                                                  emailError
                                                );
                                                failedApplications++;
                                              });
                                          }
                                        }

                                        // Send application creation email
                                        createMail(
                                          "candidate application",
                                          "create",
                                          app.applicant_full_name,
                                          currentCustomer.name,
                                          app.insertId,
                                          bgv_href,
                                          serviceNames,
                                          createMailToArr || [],
                                          createMailCCArr || []
                                        )
                                          .then(() => {
                                            processedApplications++;
                                          })
                                          .catch((emailError) => {
                                            console.error(
                                              "Error sending application creation email:",
                                              emailError
                                            );
                                            failedApplications++;
                                          })
                                          .finally(() => {
                                            processedApplications++;

                                            // After processing each application, check if all are processed
                                            if (
                                              processedApplications + failedApplications ===
                                              updatedApplications.length &&
                                              !responseSent
                                            ) {
                                              responseSent = true; // Ensure the response is only sent once

                                              if (failedApplications > 0) {
                                                return res.status(201).json({
                                                  status: false,
                                                  message:
                                                    "Some emails failed to send. Candidate applications created successfully.",
                                                  token: newToken,
                                                });
                                              } else {
                                                return res.status(201).json({
                                                  status: true,
                                                  message:
                                                    "Candidate applications created successfully and emails sent.",
                                                  token: newToken,
                                                });
                                              }
                                            }
                                          });
                                      });
                                    });

                                  });
                              });
                          }
                        });
                      })
                      .catch((emailError) => {
                        console.error("Error sending email (controller):", emailError);
                        return res.status(500).json({
                          status: false,
                          message: "Failed to send email.",
                          token: newToken,
                        });
                      });
                  };

                  fetchServiceNames(); // Start fetching services
                }
              );
            });
        });
    });
  });
}

// Controller to list all candidateApplications
exports.list = (req, res) => {
  const { sub_user_id, branch_id, _token } = req.query;

  let missingFields = [];
  if (!branch_id) missingFields.push("Branch ID");
  if (!_token) missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "candidate_manager";
  BranchCommon.isBranchAuthorizedForAction(branch_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify branch token
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

        Candidate.list(branch_id, (err, result) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({
              status: false,
              message:
                "An error occurred while fetching candidate applications.",
              token: newToken,
            });
          }

          res.json({
            status: true,
            message: "Candidate applications fetched successfully.",
            candidateApplications: result,
            totalResults: result.length,
            token: newToken,
          });
        });
      }
    );
  });
};

exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    sub_user_id,
    branch_id,
    candidate_application_id,
    _token,
    name,
    employee_id,
    mobile_number,
    email,
    services,
    package,
  } = req.body;

  // Define required fields
  const requiredFields = {
    branch_id,
    candidate_application_id,
    _token,
    name,
    mobile_number,
    email,
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
        // Fetch the current candidateApplication
        Candidate.getCandidateApplicationById(
          candidate_application_id,
          (err, currentCandidateApplication) => {
            if (err) {
              console.error(
                "Database error during candidateApplication retrieval:",
                err
              );
              return res.status(500).json({
                status: false,
                message: "Failed to retrieve Candidate. Please try again.",
                token: newToken,
              });
            }

            if (!currentCandidateApplication) {
              return res.status(404).json({
                status: false,
                message: "Candidate Aplication not found.",
                token: newToken,
              });
            }

            const changes = {};
            if (currentCandidateApplication.name !== name) {
              changes.name = {
                old: currentCandidateApplication.name,
                new: name,
              };
            }
            if (currentCandidateApplication.email !== email) {
              changes.email = {
                old: currentCandidateApplication.email,
                new: email,
              };
            }
            if (currentCandidateApplication.employee_id !== employee_id) {
              changes.employee_id = {
                old: currentCandidateApplication.employee_id,
                new: employee_id,
              };
            }
            if (currentCandidateApplication.mobile_number !== mobile_number) {
              changes.mobile_number = {
                old: currentCandidateApplication.mobile_number,
                new: mobile_number,
              };
            }
            if (
              services !== "" &&
              currentCandidateApplication.services !== services
            ) {
              changes.services = {
                old: currentCandidateApplication.services,
                new: services,
              };
            }
            if (
              package !== "" &&
              currentCandidateApplication.package !== package
            ) {
              changes.package = {
                old: currentCandidateApplication.package,
                new: package,
              };
            }

            /*
            Candidate.checkUniqueEmpIdByCandidateApplicationID(
              employee_id,
              candidate_application_id,
              (err, exists) => {
                if (err) {
                  console.error("Error checking unique ID:", err);
                  return res.status(500).json({
                    status: false,
                    message: err.message,
                    token: newToken,
                  });
                }

                if (
                  exists &&
                  exists.candidate_application_id !== candidate_application_id
                ) {
                  return res.status(400).json({
                    status: false,
                    message: `Candidate Employee ID '${employee_id}' already exists.`,
                    token: newToken,
                  });
                }
                  */

            Candidate.update(
              {
                name,
                employee_id,
                mobile_number,
                email,
                services: services || "",
                package: package || "",
              },
              candidate_application_id,
              (err, result) => {
                if (err) {
                  console.error(
                    "Database error during candidate application update:",
                    err
                  );
                  BranchCommon.branchActivityLog(
                    ipAddress,
                    ipType,
                    branch_id,
                    "Candidate Application",
                    "Update",
                    "0",
                    JSON.stringify({
                      candidate_application_id,
                      ...changes,
                    }),
                    err,
                    () => { }
                  );
                  return res.status(500).json({
                    status: false,
                    message: err.message,
                    token: newToken,
                  });
                }

                BranchCommon.branchActivityLog(
                  ipAddress,
                  ipType,
                  branch_id,
                  "Candidate Application",
                  "Update",
                  "1",
                  JSON.stringify({ candidate_application_id, ...changes }),
                  null,
                  () => { }
                );

                res.status(200).json({
                  status: true,
                  message: "Candidate application updated successfully.",
                  package: result,
                  token: newToken,
                });
              }
            );
          }
        );
      }
    );
  }
  );
  /*
});
*/
};

exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, sub_user_id, branch_id, _token } = req.query;

  // Validate required fields
  const missingFields = [];
  if (!id) missingFields.push("Candidate Application ID");
  if (!branch_id) missingFields.push("Branch ID");
  if (!_token) missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "candidate_manager";
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

        // Fetch the current candidateApplication
        Candidate.getCandidateApplicationById(
          id,
          (err, currentCandidateApplication) => {
            if (err) {
              console.error(
                "Database error during candidateApplication retrieval:",
                err
              );
              return res.status(500).json({
                status: false,
                message: "Failed to retrieve Candidate. Please try again.",
                token: newToken,
              });
            }

            if (!currentCandidateApplication) {
              return res.status(404).json({
                status: false,
                message: "Candidate Aplication not found.",
                token: newToken,
              });
            }

            // Delete the candidateApplication
            Candidate.delete(id, (err, result) => {
              if (err) {
                console.error(
                  "Database error during candidateApplication deletion:",
                  err
                );
                BranchCommon.branchActivityLog(
                  ipAddress,
                  ipType,
                  branch_id,
                  "Candidate Application",
                  "Delete",
                  "0",
                  JSON.stringify({ id }),
                  err,
                  () => { }
                );
                return res.status(500).json({
                  status: false,
                  message: "Failed to delete Candidate. Please try again.",
                  token: newToken,
                });
              }

              BranchCommon.branchActivityLog(
                ipAddress,
                ipType,
                branch_id,
                "Candidate Application",
                "Delete",
                "1",
                JSON.stringify({ id }),
                null,
                () => { }
              );

              res.status(200).json({
                status: true,
                message: "Candidate Application deleted successfully.",
                result,
                token: newToken,
              });
            });
          }
        );
      }
    );
  });
};

exports.createCandidateAppListings = (req, res) => {
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
            Candidate.list(branch_id, (err, result) => {
              if (err) return resolve([]);
              resolve(result);
            })
          ),
        ];

        Promise.all(dataPromises).then(([customer, candidateApplications]) => {
          res.json({
            status: true,
            message: "Listings fetched successfully",
            data: {
              customer,
              candidateApplications,
            },
            totalResults: {
              customer: customer.length,
              candidateApplications: candidateApplications.length,
            },
            token: newToken,
          });
        });
      }
    );
  });
};
