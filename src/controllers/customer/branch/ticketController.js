const crypto = require("crypto");
const Branch = require("../../../models/customer/branch/branchModel");
const BranchCommon = require("../../../models/customer/branch/commonModel");
const AdminCommon = require("../../../models/admin/commonModel");
const Admin = require("../../../models/admin/adminModel");
const Customer = require("../../../models/customer/customerModel");
const Ticket = require("../../../models/customer/branch/ticketModel");
const { getClientIpAddress } = require("../../../utils/ipAddress");

const {
  ticketRaised,
} = require("../../../mailer/customer/branch/ticket/ticketRaised");

const {
  ticketChat,
} = require("../../../mailer/customer/branch/ticket/ticketChat");

exports.list = (req, res) => {
  const { branch_id, sub_user_id, _token } = req.query;

  // Validate required fields
  const missingFields = [];
  if (!branch_id) missingFields.push("Branch ID");
  if (!_token) missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const branchID = Number(branch_id);
  const subUserID = sub_user_id ? Number(sub_user_id) : null;

  // Retrieve branch details
  Branch.getBranchById(branchID, (err, currentBranch) => {
    if (err) {
      console.error("Error retrieving branch:", err);
      return res.status(500).json({
        status: false,
        message: "Error retrieving branch details. Please try again later.",
      });
    }

    if (!currentBranch) {
      return res.status(404).json({
        status: false,
        message: "Branch not found.",
      });
    }

    // Check branch authorization
    const action = "client_manager";
    BranchCommon.isBranchAuthorizedForAction(branchID, action, (authResult) => {
      if (!authResult.status) {
        return res.status(403).json({
          status: false,
          message: authResult.message,
        });
      }

      // Validate branch token
      BranchCommon.isBranchTokenValid(
        _token,
        subUserID || null,
        branchID,
        (tokenErr, tokenResult) => {
          if (tokenErr) {
            console.error("Error validating token:", tokenErr);
            return res.status(500).json({
              status: false,
              message: "Token validation error. Please try again later.",
            });
          }

          if (!tokenResult.status) {
            return res.status(401).json({
              status: false,
              message: tokenResult.message,
            });
          }

          const newToken = tokenResult.newToken;

          Ticket.list(branch_id, (err, result) => {
            if (err) {
              console.error("Database error:", err);
              return res.status(500).json({
                status: false,
                message: err.message,
                token: newToken,
              });
            }

            res.json({
              status: true,
              message: "Tickets fetched successfully",
              branches: result,
              totalResults: result.length,
              token: newToken,
            });
          });
        }
      );
    });
  });
};

exports.view = (req, res) => {
  const { ticket_number, branch_id, sub_user_id, _token } = req.query;

  // Validate required fields
  const missingFields = [];
  if (!branch_id) missingFields.push("Branch ID");
  if (!_token) missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const branchID = Number(branch_id);
  const subUserID = sub_user_id ? Number(sub_user_id) : null;

  // Retrieve branch details
  Branch.getBranchById(branchID, (err, currentBranch) => {
    if (err) {
      console.error("Error retrieving branch:", err);
      return res.status(500).json({
        status: false,
        message: "Error retrieving branch details. Please try again later.",
      });
    }

    if (!currentBranch) {
      return res.status(404).json({
        status: false,
        message: "Branch not found.",
      });
    }

    // Check branch authorization
    const action = "client_manager";
    BranchCommon.isBranchAuthorizedForAction(branchID, action, (authResult) => {
      if (!authResult.status) {
        return res.status(403).json({
          status: false,
          message: authResult.message,
        });
      }

      // Validate branch token
      BranchCommon.isBranchTokenValid(
        _token,
        subUserID || null,
        branchID,
        (tokenErr, tokenResult) => {
          if (tokenErr) {
            console.error("Error validating token:", tokenErr);
            return res.status(500).json({
              status: false,
              message: "Token validation error. Please try again later.",
            });
          }

          if (!tokenResult.status) {
            return res.status(401).json({
              status: false,
              message: tokenResult.message,
            });
          }

          const newToken = tokenResult.newToken;

          Ticket.getTicketDataByTicketNumber(
            ticket_number,
            branch_id,
            (err, result) => {
              if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                  status: false,
                  message: err.message,
                  token: newToken,
                });
              }

              res.json({
                status: true,
                message: "Tickets fetched successfully",
                branches: result,
                totalResults: result.length,
                token: newToken,
              });
            }
          );
        }
      );
    });
  });
};

exports.chat = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { ticket_number, branch_id, sub_user_id, _token, message } = req.body;

  // Validate required fields
  const missingFields = [];
  if (!branch_id) missingFields.push("Branch ID");
  if (!_token) missingFields.push("Token");
  if (!ticket_number) missingFields.push("Ticket Number");
  if (!message) missingFields.push("Message");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const branchID = Number(branch_id);
  const subUserID = sub_user_id ? Number(sub_user_id) : null;

  // Retrieve branch details
  Branch.getBranchById(branchID, (err, currentBranch) => {
    if (err) {
      console.error("Error retrieving branch:", err);
      return res.status(500).json({
        status: false,
        message: "Error retrieving branch details. Please try again later.",
      });
    }

    if (!currentBranch) {
      return res.status(404).json({
        status: false,
        message: "Branch not found.",
      });
    }

    // Retrieve customer details
    Customer.getCustomerById(
      parseInt(currentBranch.customer_id),
      (err, currentCustomer) => {
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

        // Check branch authorization
        const action = "client_manager";
        BranchCommon.isBranchAuthorizedForAction(
          branchID,
          action,
          (authResult) => {
            if (!authResult.status) {
              return res.status(403).json({
                status: false,
                message: authResult.message,
              });
            }

            // Validate branch token
            BranchCommon.isBranchTokenValid(
              _token,
              subUserID || null,
              branchID,
              (tokenErr, tokenResult) => {
                if (tokenErr) {
                  console.error("Error validating token:", tokenErr);
                  return res.status(500).json({
                    status: false,
                    message: "Token validation error. Please try again later.",
                  });
                }

                if (!tokenResult.status) {
                  return res.status(401).json({
                    status: false,
                    message: tokenResult.message,
                  });
                }

                const newToken = tokenResult.newToken;

                // Create a new ticket
                Ticket.chat(
                  {
                    ticket_number,
                    branch_id: currentBranch.id,
                    customer_id: currentBranch.customer_id,
                    message,
                  },
                  (createErr, createResult) => {
                    if (createErr) {
                      console.error("Error creating ticket:", createErr);

                      // Log the failed activity
                      BranchCommon.branchActivityLog(
                        ipAddress,
                        ipType,
                        branchID,
                        "Ticket",
                        "Create",
                        "0",
                        null,
                        createErr.message,
                        () => { }
                      );

                      return res.status(500).json({
                        status: false,
                        message:
                          "Error creating ticket. Please try again later.",
                        token: newToken,
                      });
                    }

                    // Log the successful activity
                    BranchCommon.branchActivityLog(
                      ipAddress,
                      ipType,
                      branchID,
                      "Ticket",
                      "Reply",
                      "1",
                      `{ticket: ${ticket_number}}`,
                      null,
                      () => { }
                    );

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
                      const toArr = adminResult.map((admin) => ({
                        name: admin.name,
                        email: admin.email,
                      }));

                      const toCC = [
                        { name: 'QC Team', email: 'qc@screeningstar.com' }
                      ];

                      // Notify admins about the raised ticket
                      ticketChat(
                        "Ticket",
                        "branch-chat",
                        currentBranch.name,
                        currentCustomer.name,
                        ticket_number,
                        createResult.title,
                        createResult.description,
                        message,
                        createResult.created_at,
                        toArr,
                        toCC
                      )
                        .then(() => {
                          return res.status(201).json({
                            status: true,
                            message: `Message has been sent for ticket number ${ticket_number}`,
                            token: newToken,
                          });
                        })
                        .catch((emailError) => {
                          console.error("Error sending email:", emailError);
                          BranchCommon.branchActivityLog(
                            ipAddress,
                            ipType,
                            branchID,
                            "Ticket",
                            "chat",
                            "0",
                            emailError.message || "N/A",
                            () => { }
                          );
                          return res.status(500).json({
                            status: false,
                            message:
                              "Failed to send message for ticket number, but email notification was unsuccessful.",
                            token: newToken,
                          });
                        });
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
};

exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { branch_id, sub_user_id, _token, title, description } = req.body;

  // Validate required fields
  const missingFields = [];
  if (!branch_id) missingFields.push("Branch ID");
  if (!_token) missingFields.push("Token");
  if (!title) missingFields.push("Title");
  if (!description) missingFields.push("Description");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const branchID = Number(branch_id);
  const subUserID = sub_user_id ? Number(sub_user_id) : null;

  // Retrieve branch details
  Branch.getBranchById(branchID, (err, currentBranch) => {
    if (err) {
      console.error("Error retrieving branch:", err);
      return res.status(500).json({
        status: false,
        message: "Error retrieving branch details. Please try again later.",
      });
    }

    if (!currentBranch) {
      return res.status(404).json({
        status: false,
        message: "Branch not found.",
      });
    }

    // Retrieve customer details
    Customer.getCustomerById(
      parseInt(currentBranch.customer_id),
      (err, currentCustomer) => {
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

        // Check branch authorization
        const action = "client_manager";
        BranchCommon.isBranchAuthorizedForAction(
          branchID,
          action,
          (authResult) => {
            if (!authResult.status) {
              return res.status(403).json({
                status: false,
                message: authResult.message,
              });
            }

            // Validate branch token
            BranchCommon.isBranchTokenValid(
              _token,
              subUserID || null,
              branchID,
              (tokenErr, tokenResult) => {
                if (tokenErr) {
                  console.error("Error validating token:", tokenErr);
                  return res.status(500).json({
                    status: false,
                    message: "Token validation error. Please try again later.",
                  });
                }

                if (!tokenResult.status) {
                  return res.status(401).json({
                    status: false,
                    message: tokenResult.message,
                  });
                }

                const newToken = tokenResult.newToken;

                // Create a new ticket
                Ticket.create(
                  {
                    branch_id: currentBranch.id,
                    customer_id: currentBranch.customer_id,
                    title,
                    description,
                  },
                  (createErr, createResult) => {
                    if (createErr) {
                      console.error("Error creating ticket:", createErr);

                      // Log the failed activity
                      BranchCommon.branchActivityLog(
                        ipAddress,
                        ipType,
                        branchID,
                        "Ticket",
                        "Create",
                        "0",
                        null,
                        createErr.message,
                        () => { }
                      );

                      return res.status(500).json({
                        status: false,
                        message:
                          "Error creating ticket. Please try again later.",
                        token: newToken,
                      });
                    }

                    // Log the successful activity
                    BranchCommon.branchActivityLog(
                      ipAddress,
                      ipType,
                      branchID,
                      "Ticket",
                      "Create",
                      "1",
                      `{ticket: ${createResult.ticketNumber}}`,
                      null,
                      () => { }
                    );

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
                      const ccArr = [
                        { name: 'BGV Team', email: 'bgv@screeningstar.com' },
                        { name: 'QC Team', email: 'qc@screeningstar.com' }
                      ];
                      // Extract admin emails
                      const toArr = adminResult.map((admin) => ({
                        name: admin.name,
                        email: admin.email,
                      }));

                      // Notify admins about the raised ticket
                      ticketRaised(
                        "Ticket",
                        "raised",
                        currentBranch.name,
                        currentCustomer.name,
                        createResult.ticketNumber,
                        title,
                        description,
                        ccArr
                      )
                        .then(() => {
                          return res.status(201).json({
                            status: true,
                            message: `Your ticket number is ${createResult.ticketNumber}`,
                            token: newToken,
                          });
                        })
                        .catch((emailError) => {
                          console.error("Error sending email:", emailError);
                          BranchCommon.branchActivityLog(
                            ipAddress,
                            ipType,
                            branchID,
                            "Ticket",
                            "Create",
                            "0",
                            emailError.message || "N/A",
                            () => { }
                          );
                          return res.status(500).json({
                            status: true,
                            message:
                              "Failed to generate ticket but email notification was unsuccessful.",
                            token: newToken,
                          });
                        });
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
};

exports.upload = (req, res) => {
  const { sub_user_id, branch_id, _token } = req.query;

  // Validate required fields
  const missingFields = [];
  if (!branch_id) missingFields.push("Branch ID");
  if (!_token) missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Verify the branch token
  BranchCommon.isBranchTokenValid(
    _token,
    sub_user_id || "",
    branch_id,
    (tokenErr, tokenResult) => {
      if (tokenErr) {
        console.error("Error checking token validity:", tokenErr);
        return res.status(500).json({
          status: false,
          message: tokenErr,
        });
      }

      if (!tokenResult.status) {
        return res.status(401).json({
          status: false,
          message: tokenResult.message,
        });
      }

      const newToken = tokenResult.newToken;

      // Step 3: Fetch client applications from database
      Branch.index(branch_id, (dbErr, clientApplications) => {
        if (dbErr) {
          console.error("Database error:", dbErr);
          return res.status(500).json({
            status: false,
            message: "An error occurred while fetching client applications.",
            token: newToken,
          });
        }

        // Calculate total application count
        const totalApplicationCount = clientApplications
          ? Object.values(clientApplications).reduce((total, statusGroup) => {
            return total + statusGroup.applicationCount;
          }, 0)
          : 0;

        return res.status(200).json({
          status: true,
          message: "Client applications fetched successfully.",
          clientApplications,
          totalApplicationCount,
          token: newToken,
        });
      });
    }
  );
};

exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { ticket_number, branch_id, sub_user_id, _token } = req.query;
  // Validate required fields
  const missingFields = [];
  if (!branch_id) missingFields.push("Branch ID");
  if (!_token) missingFields.push("Token");
  if (!ticket_number) missingFields.push("Ticket Number");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const branchID = Number(branch_id);
  const subUserID = sub_user_id ? Number(sub_user_id) : null;

  // Retrieve branch details
  Branch.getBranchById(branchID, (err, currentBranch) => {
    if (err) {
      console.error("Error retrieving branch:", err);
      return res.status(500).json({
        status: false,
        message: "Error retrieving branch details. Please try again later.",
      });
    }

    if (!currentBranch) {
      return res.status(404).json({
        status: false,
        message: "Branch not found.",
      });
    }

    // Retrieve customer details
    Customer.getCustomerById(
      parseInt(currentBranch.customer_id),
      (err, currentCustomer) => {
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

        // Check branch authorization
        const action = "client_manager";
        BranchCommon.isBranchAuthorizedForAction(
          branchID,
          action,
          (authResult) => {
            if (!authResult.status) {
              return res.status(403).json({
                status: false,
                message: authResult.message,
              });
            }

            // Validate branch token
            BranchCommon.isBranchTokenValid(
              _token,
              subUserID || null,
              branchID,
              (tokenErr, tokenResult) => {
                if (tokenErr) {
                  console.error("Error validating token:", tokenErr);
                  return res.status(500).json({
                    status: false,
                    message: "Token validation error. Please try again later.",
                  });
                }

                if (!tokenResult.status) {
                  return res.status(401).json({
                    status: false,
                    message: tokenResult.message,
                  });
                }

                const newToken = tokenResult.newToken;

                // Create a new ticket
                Ticket.delete(ticket_number, branch_id, (err, result) => {
                  if (err) {
                    console.error(
                      "Database error during ticket deletion:",
                      err
                    );
                    BranchCommon.branchActivityLog(
                      ipAddress,
                      ipType,
                      branch_id,
                      "Ticket",
                      "Delete",
                      "0",
                      JSON.stringify({ ticket: ticket_number }),
                      err,
                      () => { }
                    );
                    return res.status(500).json({
                      status: false,
                      message: "Failed to delete ticket. Please try again.",
                      token: newToken,
                    });
                  }

                  BranchCommon.branchActivityLog(
                    ipAddress,
                    ipType,
                    branch_id,
                    "Ticket",
                    "Delete",
                    "1",
                    JSON.stringify({ ticket: ticket_number }),
                    null,
                    () => { }
                  );

                  res.status(200).json({
                    status: true,
                    message: "Ticket deleted successfully.",
                    token: newToken,
                  });
                });
              }
            );
          }
        );
      }
    );
  });
};
