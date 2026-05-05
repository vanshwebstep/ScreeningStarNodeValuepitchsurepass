const crypto = require("crypto");
const Acknowledgement = require("../../models/admin/acknowledgementModel");
const Customer = require("../../models/customer/customerModel");
const AdminCommon = require("../../models/admin/commonModel");
const Service = require("../../models/admin/serviceModel");

const {
  acknowledgementMail,
} = require("../../mailer/customer/acknowledgementMail");

const { getClientIpAddress } = require("../../utils/ipAddress");
// Helper function to fetch service names in series
const getServiceNames = async (serviceIds) => {
  let serviceNames = [];

  for (let i = 0; i < serviceIds.length; i++) {
    try {
      const currentService = await new Promise((resolve, reject) => {
        Service.getServiceById(serviceIds[i], (err, service) => {
          if (err) return reject(err);
          resolve(service);
        });
      });

      if (currentService && currentService.title) {
        serviceNames.push(currentService.title);
      }
    } catch (error) {
      console.error("Error fetching service data:", error);
    }
  }

  return serviceNames;
};

// Controller to list all customers
exports.list = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const { admin_id, _token } = req.query;

  let missingFields = [];
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      ipAddress,
      ipType,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "acknowledgement";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        err: authResult,
        message: authResult.message,
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res
          .status(500)
          .json({ status: false, err, message: err.message });
      }

      if (!tokenResult.status) {
        return res.status(401).json({
          status: false,
          err: tokenResult,
          message: tokenResult.message,
        });
      }

      const newToken = tokenResult.newToken;

      // Fetch customers from Acknowledgement model
      Acknowledgement.list((err, customers) => {
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
          message: "Customers fetched successfully",
          customers: customers,
          totalResults: customers ? customers.length : 0,
          token: newToken,
        });
      });
    });
  });
};

exports.sendNotification = async (req, res) => {
  const { admin_id, _token, customer_id } = req.body;

  // Check for missing fields
  const requiredFields = { admin_id, _token, customer_id };
  const missingFields = Object.keys(requiredFields)
    .filter((field) => !requiredFields[field])
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "acknowledgement";
  // Check admin authorization
  AdminCommon.isAdminAuthorizedForAction(
    admin_id,
    action,
    async (authResult) => {
      if (!authResult.status) {
        return res.status(403).json({
          status: false,
          err: authResult,
          message: authResult.message,
        });
      }

      // Verify admin token
      AdminCommon.isAdminTokenValid(
        _token,
        admin_id,
        async (err, tokenResult) => {
          if (err) {
            console.error("Error checking token validity:", err);
            return res
              .status(500)
              .json({ status: false, err, message: err.message });
          }

          if (!tokenResult.status) {
            return res.status(401).json({
              status: false,
              err: tokenResult,
              message: tokenResult.message,
            });
          }

          const newToken = tokenResult.newToken;

          // Fetch the specific customer
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

              // Fetch acknowledgements for the customer
              Acknowledgement.listByCustomerID(
                customer_id,
                async (err, customers) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                      status: false,
                      message: err.message,
                      token: newToken,
                    });
                  }

                  // Ensure customers is in the correct format
                  if (!Array.isArray(customers.data)) {
                    return res.status(500).json({
                      status: false,
                      message: "Invalid data format.",
                      token: newToken,
                    });
                  }

                  // Process each customer
                  for (const customer of customers.data) {
                    for (const branch of customer.branches) {
                      for (const application of branch.applications) {
                        const serviceIds =
                          typeof application.services === "string" &&
                            application.services.trim() !== ""
                            ? application.services
                              .split(",")
                              .map((id) => id.trim())
                            : [];

                        // Fetch and log service names in series
                        const serviceNames = await getServiceNames(serviceIds);
                        application.serviceNames = serviceNames.join(", ");
                      }
                    }
                  }
                  if (customers.data.length > 0) {
                    for (const customer of customers.data) {
                      // Loop through the branches
                      for (const branch of customer.branches) {
                        let emailApplicationArr;
                        let ccArr;
                        if (branch.is_head !== 1) {
                          emailApplicationArr = branch.applications;
                          ccArr = [];
                        } else {
                          emailApplicationArr = customers.data;
                          ccArr = JSON.parse(currentCustomer.emails).map(
                            (email) => ({
                              name: currentCustomer.name,
                              email: email.trim(),
                            })
                          );
                        }

                        const extraCC = [
                          { name: 'BGV Team', email: 'bgv@screeningstar.com' },
                          { name: 'QC Team', email: 'qc@screeningstar.com' },
                          { name: 'Manjunath', email: 'manjunath@screeningstar.com' },
                        ]

                        const mergedCC = [...ccArr, ...extraCC];
                        const toArr = [
                          { name: branch.name, email: branch.email },
                        ];

                        acknowledgementMail(
                          "acknowledgement",
                          "email",
                          branch.is_head,
                          customer.name.trim(),
                          customer.client_unique_id,
                          emailApplicationArr,
                          toArr,
                          mergedCC
                        )
                          .then(() => { })
                          .catch((emailError) => {
                            console.error("Error sending email:", emailError);

                            return res.status(200).json({
                              status: true,
                              message: `failed to send mail.`,
                              token: newToken,
                            });
                          });
                      }
                    }
                  }
                  // Send response
                  if (customers.data.length > 0) {
                    let applicationIds = [];

                    customers.data.forEach((customer) => {
                      customer.branches.forEach((branch) => {
                        branch.applications.forEach((application) => {
                          applicationIds.push(application.id);
                        });
                      });
                    });

                    // Join the IDs into a comma-separated string
                    const applicationIdsString = applicationIds.join(",");
                    Acknowledgement.updateAckByCustomerID(
                      applicationIdsString,
                      customer_id,
                      (err, affectedRows) => {
                        if (err) {
                          return res.status(500).json({
                            message: "Error updating acknowledgment status",
                            error: err,
                          });
                        }

                        return res.json({
                          status: true,
                          message: "Acknowledgement sent Successfully",
                          customers: customers.data,
                          totalResults: customers.data.length,
                          token: newToken,
                        });
                      }
                    );
                  } else {
                    return res.json({
                      status: false,
                      message: "No applications for acknowledgement",
                      token: newToken,
                    });
                  }
                }
              );
            }
          );
        }
      );
    }
  );
};

exports.sendAutoNotification = async (req, res) => {
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

  const action = "acknowledgement";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        err: authResult,
        message: authResult.message,
      });
    }

    AdminCommon.isAdminTokenValid(
      _token,
      admin_id,
      async (err, tokenResult) => {
        if (err) {
          console.error("Error checking token validity:", err);
          return res
            .status(500)
            .json({ status: false, err, message: err.message });
        }

        if (!tokenResult.status) {
          return res.status(401).json({
            status: false,
            err: tokenResult,
            message: tokenResult.message,
          });
        }

        const newToken = tokenResult.newToken;
        Acknowledgement.list((err, customers) => {
          if (err) {
            console.error("Database error fetching customers:", err);
            return res.status(500).json({
              status: false,
              err,
              message: err.message,
              token: newToken,
            });
          }

          if (customers && customers.data.length > 0) {
            let customersProcessed = 0;

            // Use Promise.all to handle async processing in the loop
            Promise.all(
              customers.data.map(async (customer) => {
                const customer_id = customer.id;
                const currentCustomer = await new Promise((resolve, reject) => {
                  Customer.getActiveCustomerById(
                    customer_id,
                    (err, currentCustomer) => {
                      if (err) {
                        console.error(
                          "Database error during customer retrieval:",
                          err
                        );
                        reject(err);
                      }
                      resolve(currentCustomer);
                    }
                  );
                });

                if (!currentCustomer) {
                  customersProcessed++;
                  return;
                }

                const customers = await new Promise((resolve, reject) => {
                  Acknowledgement.listByCustomerID(
                    customer_id,
                    (err, customers) => {
                      if (err) {
                        console.error(
                          "Database error fetching acknowledgements:",
                          err
                        );
                        reject(err);
                      }
                      resolve(customers);
                    }
                  );
                });

                if (!Array.isArray(customers.data)) {
                  console.error("Invalid data format received for customers.");
                  return res.status(500).json({
                    status: false,
                    message: "Invalid data format.",
                    token: newToken,
                  });
                }

                const applicationIds = [];
                for (let customer of customers.data) {
                  for (let branch of customer.branches) {
                    for (let application of branch.applications) {
                      applicationIds.push(application.id);
                      const serviceIds =
                        typeof application.services === "string" &&
                          application.services.trim() !== ""
                          ? application.services
                            .split(",")
                            .map((id) => id.trim())
                          : [];
                      try {
                        const serviceNames = await getServiceNames(serviceIds);
                        application.serviceNames = serviceNames.join(", ");
                      } catch (error) {
                        console.error("Error fetching service names:", error);
                      }

                      let emailApplicationArr;
                      let ccArr;

                      if (branch.is_head !== 1) {
                        emailApplicationArr = branch.applications;
                        ccArr = [];
                      } else {
                        emailApplicationArr = customers.data;
                        ccArr = JSON.parse(currentCustomer.emails).map(
                          (email) => ({
                            name: currentCustomer.name,
                            email: email.trim(),
                          })
                        );
                      }

                      const toArr = [
                        { name: branch.name, email: branch.email },
                      ];

                      const extraCC = [
                        { name: 'BGV Team', email: 'bgv@screeningstar.com' },
                        { name: 'QC Team', email: 'qc@screeningstar.com' },
                        { name: 'Manjunath', email: 'manjunath@screeningstar.com' },
                      ]

                      const mergedCC = [...ccArr, ...extraCC];

                      acknowledgementMail(
                        "acknowledgement",
                        "email",
                        branch.is_head,
                        customer.name.trim(),
                        customer.client_unique_id,
                        emailApplicationArr,
                        toArr,
                        mergedCC
                      )
                        .then(() => {
                          console.log(
                            "Acknowledgment email sent successfully."
                          );
                        })
                        .catch((emailError) => {
                          console.error("Error sending email:", emailError);
                          return res.status(200).json({
                            status: true,
                            message: `Failed to send mail.`,
                            token: newToken,
                          });
                        });

                      const applicationIdsString = applicationIds.join(",");
                      Acknowledgement.updateAckByCustomerID(
                        applicationIdsString,
                        customer_id,
                        (err, affectedRows) => {
                          if (err) {
                            console.error(
                              "Error updating acknowledgment status:",
                              err
                            );
                            return res.status(500).json({
                              message: "Error updating acknowledgment status",
                              error: err,
                              token: newToken,
                            });
                          }

                          customersProcessed++;
                          if (customersProcessed === customers.data.length) {
                            return res.json({
                              status: true,
                              message: "Acknowledgement sent Successfully",
                              customers: customers,
                              totalResults: customers.length,
                              token: newToken,
                            });
                          }
                        }
                      );
                    }
                  }
                }
              })
            ).catch((err) => {
              console.error("Error processing customers:", err);
              return res.status(500).json({
                status: false,
                message: "Error processing customers.",
                token: newToken,
              });
            });
          } else {
            return res.json({
              status: true,
              message: "No customers found.",
              customers: [],
              totalResults: 0,
              token: newToken,
            });
          }
        });
      }
    );
  });
};
