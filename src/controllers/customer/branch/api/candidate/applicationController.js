const Candidate = require("../../../../../models/customer/branch/candidateApplicationModel");
const BranchCommon = require("../../../../../models/customer/branch/commonModel");
const Service = require("../../../../../models/admin/serviceModel");
const Customer = require("../../../../../models/customer/customerModel");
const AppModel = require("../../../../../models/appModel");
const Admin = require("../../../../../models/admin/adminModel");
const Branch = require("../../../../../models/customer/branch/branchModel");
const {
  createMailForCandidate,
} = require("../../../../../mailer/customer/branch/candidate/createMailForCandidate");

const {
  createMailForAcknowledgement,
} = require("../../../../../mailer/customer/branch/candidate/createMailForAcknowledgement");

const {
  davMail,
} = require("../../../../../mailer/customer/branch/candidate/davMail");

exports.create = (req, res) => {
  const {
    access_token,
    name,
    employee_id,
    mobile_number,
    email,
    services
  } = req.body;

  // Define required fields
  const requiredFields = {
    name,
    mobile_number,
    email
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

  Branch.getBranchAndCustomerByAccessToken(access_token, (err, result) => {
    if (err) {
      console.error("Error:", err);
      return res.status(500).json({
        status: false,
        message: "Internal server error. Please try again later.",
        error: err.message,
      });
    }

    if (!result.status) {
      // This means token was invalid or not found
      return res.status(401).json({
        status: false,
        message: result.message || "Invalid or expired access token.",
      });
    }

    const branch = result.data.branch;
    const customer = result.data.customer;

    const branch_id = branch.id;
    const customer_id = customer.id;

    const customerCode = customer.client_unique_id;

    Customer.getCustomerById(
      parseInt(customer_id),
      (err, currentCustomer) => {
        if (err) {
          console.error("Database error during customer retrieval:", err);
          return res.status(500).json({
            status: false,
            message: "Failed to retrieve Customer. Please try again.",
            token: access_token,
          });
        }

        if (!currentCustomer) {
          return res.status(404).json({
            status: false,
            message: "Customer not found.",
            token: access_token,
          });
        }
        const customerName = currentCustomer.name;
        Candidate.create(
          {
            branch_id,
            name,
            employee_id,
            mobile_number,
            email,
            services: services || null,
            customer_id,
          },
          (err, result) => {
            if (err) {
              console.error(
                "Database error during candidate application creation:",
                err
              );
              BranchCommon.branchActivityLog(
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
                token: access_token,
              });
            }

            BranchCommon.branchActivityLog(
              branch_id,
              "Candidate Application",
              "Create",
              "1",
              `{id: ${result.insertId}}`,
              null,
              () => { }
            );

            BranchCommon.getBranchandCustomerEmailsForNotification(
              branch_id,
              (emailError, emailData) => {
                if (emailError) {
                  console.error("Error fetching emails:", emailError);
                  return res.status(500).json({
                    status: false,
                    message: "Failed to retrieve email addresses.",
                    token: access_token,
                  });
                }

                Admin.filterAdmins({ status: "active", role: "admin" }, (err, adminResult) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                      status: false,
                      message: "Error retrieving admin details.",
                      token: access_token,
                    });
                  }

                  const adminMailArr = adminResult.map(admin => ({
                    name: admin.name,
                    email: admin.email
                  }));

                  const { branch, customer } = emailData;

                  // Prepare recipient and CC lists

                  const toArr = [{ name, email }];

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

                  const ccArr2 = uniqueEmails;
                  const ccArr = [
                    ...new Map(
                      [...ccArr1, ...ccArr2].map((item) => [
                        item.email,
                        item,
                      ])
                    ).values(),
                  ];

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
                            token: access_token,
                          });
                        }

                        const appHost = appInfo?.host || "https://api.screeningstar.co.in";
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
                              token: access_token,
                            });
                          }

                          const hasDigitalService = serviceEntry && serviceIds.includes(parseInt(serviceEntry.id, 10));
                          const digitalAddressID = hasDigitalService ? parseInt(serviceEntry.id, 10) : null;
                          const otherServiceIds = serviceIds.filter(id => id !== digitalAddressID);

                          const shouldSendDavOnly = hasDigitalService && otherServiceIds.length === 0;
                          const shouldSendBoth = hasDigitalService && otherServiceIds.length > 0;
                          const shouldSendCreateOnly = !hasDigitalService && otherServiceIds.length > 0;

                          const sendApplicationEmail = () => {
                            return createMailForCandidate(
                              "candidate application",
                              "create",
                              name,
                              currentCustomer.name,
                              bgv_href,
                              serviceNames,
                              toArr || [],
                              ccArr || []
                            )
                              .then(() => {
                                return res.status(201).json({
                                  status: true,
                                  message: "Candidate Application created successfully.",
                                  data: {
                                    candidate_application_id: result.insertId,
                                    message: "Use the generated application id in the BGV form creation payload.",
                                  },
                                  token: access_token,
                                  toArr: toArr || [],
                                  ccArr: ccArr || [],
                                });
                              })
                              .catch((emailError) => {
                                console.error("Error sending application creation email:", emailError);
                                return res.status(201).json({
                                  status: true,
                                  message: "Candidate Application created successfully.",
                                  candidate: result,
                                  token: access_token,
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
                              []
                            )
                              .then(() => {
                                if (shouldSendBoth || shouldSendCreateOnly) {
                                  return sendApplicationEmail();
                                } else {
                                  createMailForAcknowledgement(
                                    "candidate application",
                                    "create for acknowledgement",
                                    name,
                                    currentCustomer.name,
                                    result.insertId,
                                    bgv_href,
                                    serviceNames,
                                    ccArr || [],
                                    []
                                  )
                                    .then(() => {
                                    })
                                    .then(() => {
                                    })
                                    .catch((emailError) => {
                                      console.error(
                                        "Error sending application creation email:",
                                        emailError
                                      );
                                    })
                                    .finally(() => {
                                      return res.status(201).json({
                                        status: true,
                                        message: "Digital Address Verification Email sent successfully.",
                                        data: {
                                          candidate: result
                                        },
                                        token: access_token,
                                      });
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
                                    token: access_token,
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
                                token: access_token,
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
                        // ❌ Don't stop — just continue to next service
                        return fetchServiceNames(index + 1);
                      }

                      if (currentService?.title) {
                        serviceNames.push(`${currentService.title}: ${currentService.email_description}`);
                      }

                      // Continue to next service
                      fetchServiceNames(index + 1);
                    });
                  };

                  // Start fetching service names
                  fetchServiceNames();
                });
              }
            );
          }
        );
      }
    );
  });
  
};
exports.fetch_bgv_pdf = async (req, res) => {
    const { candidate_application_id, branch_id, customer_id } = req.query;

    // Validation
    const missingFields = [];
    if (!candidate_application_id || candidate_application_id === "undefined")
      missingFields.push("Candidate Application ID");
    if (!branch_id || branch_id === "undefined")
      missingFields.push("Branch ID");
    if (!customer_id || customer_id === "undefined")
      missingFields.push("Customer ID");

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    try {
      // Step 1: Application exist karti hai ya nahi
      Candidate.isApplicationExist(
        candidate_application_id,
        branch_id,
        customer_id,
        async (err, appResult) => {
          if (err) {
            return res.status(500).json({ status: false, message: err.message });
          }

          if (!appResult || !appResult.status) {
            return res.status(404).json({
              status: false,
              message: "Application does not exist.",
            });
          }

          // Step 2: Customer info fetch karo (client_unique_id chahiye path ke liye)
          Customer.getCustomerById(customer_id, async (err, currentCustomer) => {
            if (err || !currentCustomer) {
              return res.status(404).json({
                status: false,
                message: "Customer not found.",
              });
            }

            // Step 3: App info se imageHost lo
            AppModel.appInfo("backend", async (err, appInfo) => {
              if (err) {
                return res.status(500).json({
                  status: false,
                  message: "Failed to fetch app configuration.",
                });
              }

              const imageHost =
                (appInfo && appInfo.cloud_host) || "www.example.in";

              const client_unique_id = currentCustomer.client_unique_id;
              const name = appResult.data.name || "applicant";

              const today = new Date();
              const formattedDate = `${today.getFullYear()}-${String(
                today.getMonth() + 1
              ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

              const pdfFileName = `BGV Form-${name}_${formattedDate}.pdf`
                .replace(/\s+/g, "-")
                .toLowerCase();

              const targetDirectory = `uploads/customers/${client_unique_id}/candidate-applications/CD-${client_unique_id}-${candidate_application_id}/background-form-reports`;

              try {
                // Step 4: PDF regenerate karo (ya existing serve karo)
                const pdfPath = await candidateFormPDF(
                  candidate_application_id,
                  branch_id,
                  customer_id,
                  pdfFileName,
                  targetDirectory
                );

                if (!pdfPath) {
                  return res.status(500).json({
                    status: false,
                    message: "Failed to generate BGV form PDF.",
                  });
                }

                const pdfUrl = `${imageHost}/${pdfPath}`;

                return res.status(200).json({
                  status: true,
                  message: "BGV form PDF fetched successfully.",
                  data: {
                    candidate_application_id,
                    applicant_name: name,
                    bgv_form_pdf: pdfUrl,
                  },
                });
              } catch (pdfError) {
                console.error("PDF generation error:", pdfError);
                return res.status(500).json({
                  status: false,
                  message: "Error generating BGV form PDF.",
                });
              }
            });
          });
        }
      );
    } catch (error) {
      console.error("Unexpected error:", error);
      return res.status(500).json({
        status: false,
        message: "Something went wrong.",
      });
    }
  };