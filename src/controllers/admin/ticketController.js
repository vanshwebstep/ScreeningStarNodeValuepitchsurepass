const crypto = require("crypto");
const Branch = require("../../models/customer/branch/branchModel");
const BranchCommon = require("../../models/customer/branch/commonModel");
const AdminCommon = require("../../models/admin/commonModel");
const Admin = require("../../models/admin/adminModel");
const Customer = require("../../models/customer/customerModel");
const Ticket = require("../../models/admin/ticketModel");

const { ticketChat } = require("../../mailer/admin/ticket/ticketChat");
const { getClientIpAddress } = require("../../utils/ipAddress");

exports.list = (req, res) => {
  const { admin_id, _token } = req.query;

  // Validate required fields
  const missingFields = [];
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const adminID = Number(admin_id);

  const action = "tickets";
  AdminCommon.isAdminAuthorizedForAction(adminID, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }
    AdminCommon.isAdminTokenValid(_token, adminID, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json(err);
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      Ticket.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        return res.json({
          status: true,
          message: "Tickets fetched successfully",
          branches: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.view = (req, res) => {
  const { ticket_number, admin_id, _token } = req.query;

  // Validate required fields
  const missingFields = [];
  if (!admin_id) missingFields.push("Admin ID");
  if (!ticket_number) missingFields.push("Ticket Number");
  if (!_token) missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const adminID = Number(admin_id);

  const action = "tickets";
  AdminCommon.isAdminAuthorizedForAction(adminID, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }
    AdminCommon.isAdminTokenValid(_token, adminID, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json(err);
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      Ticket.getTicketDataByTicketNumber(ticket_number, (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        return res.json({
          status: true,
          message: "Tickets fetched successfully",
          branches: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.chat = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { ticket_number, admin_id, _token, message } = req.body;

  // Validate required fields
  const missingFields = [
    "admin_id",
    "_token",
    "ticket_number",
    "message",
  ].filter((field) => !req.body[field]);
  if (missingFields.length) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const adminID = Number(admin_id);

  Admin.findById(adminID, async (err, currentAdmin) => {
    if (err) {
      console.error("Error retrieving Admin:", err);
      return res.status(500).json({
        status: false,
        message: "Database error.",
        token: newToken,
      });
    }

    if (!currentAdmin) {
      return res.status(404).json({
        status: false,
        message: "Admin not found.",
        token: newToken,
      });
    }
    const action = "tickets";

    // Check admin authorization and token validity
    AdminCommon.isAdminAuthorizedForAction(adminID, action, (authResult) => {
      if (!authResult.status) {
        return res
          .status(403)
          .json({ status: false, message: authResult.message });
      }

      AdminCommon.isAdminTokenValid(_token, adminID, (err, tokenResult) => {
        if (err || !tokenResult.status) {
          return res.status(err ? 500 : 401).json({
            status: false,
            message: err
              ? "Error checking token validity"
              : tokenResult.message,
            token: tokenResult?.newToken,
          });
        }

        const newToken = tokenResult.newToken;

        // Create ticket
        Ticket.chat(
          { ticket_number, admin_id, adminID, message },
          (createErr, createResult) => {
            if (createErr) {
              console.error("Error creating ticket:", createErr);
              AdminCommon.adminActivityLog(
                ipAddress,
                ipType,
                adminID,
                "Ticket",
                "Create",
                "0",
                null,
                createErr.message,
                () => { }
              );
              return res.status(500).json({
                status: false,
                message: "Error creating ticket. Please try again later.",
                token: newToken,
              });
            }

            // Log successful activity
            AdminCommon.adminActivityLog(
              ipAddress,
              ipType,
              adminID,
              "Ticket",
              "Create",
              "0",
              `{ticket: ${ticket_number}}`,
              null,
              () => { }
            );

            // Prepare and send email notification
            const toArr = [
              {
                name: createResult.branch_name,
                email: createResult.branch_email,
              },
            ];

            const toCC = [
              { name: 'QC Team', email: 'qc@screeningstar.com' }
            ];

            ticketChat(
              "Ticket",
              "admin-chat",
              createResult.branch_name,
              createResult.customer_name,
              ticket_number,
              createResult.title,
              createResult.description,
              currentAdmin.name,
              message,
              createResult.created_at,
              toArr,
              toCC
            )
              .then(() =>
                res.status(201).json({
                  status: true,
                  message: `Message sent for ticket number ${ticket_number}`,
                  token: newToken,
                })
              )
              .catch((emailError) => {
                console.error("Error sending email:", emailError);
                AdminCommon.adminActivityLog(
                  ipAddress,
                  ipType,
                  adminID,
                  "Ticket",
                  "Create",
                  "0",
                  null,
                  emailError.message || "N/A",
                  () => { }
                );
                return res.status(500).json({
                  status: false,
                  message: "Message sent, but email notification failed.",
                  token: newToken,
                });
              });
          }
        );
      });
    });
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

// Controller to update a service
exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { ticket_number, remarks, status, admin_id, _token } = req.body;

  let missingFields = [];
  if (!ticket_number || ticket_number === "")
    missingFields.push("Ticket Number");
  if (!remarks || remarks === "") missingFields.push("Remarks");
  if (!status || status === "") missingFields.push("Status");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");
  const ticketStatus = status;
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const action = "tickets";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json(err);
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;
      Ticket.getTicketByTicketNumber(ticket_number, (err, currentTicket) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        if (!result) {
          return res.status(404).json({
            status: false,
            message: "Ticket not found",
            token: newToken,
          });
        }

        const changes = {};
        if (currentTicket.remarks !== remarks) {
          changes.remarks = {
            old: currentTicket.remarks,
            new: remarks,
          };
        }
        if (currentTicket.status !== ticketStatus) {
          changes.ticketStatus = {
            old: currentTicket.ticketStatus,
            new: ticketStatus,
          };
        }

        Ticket.update(ticket_number, remarks, ticketStatus, (err, result) => {
          if (err) {
            console.error("Database error:", err);
            AdminCommon.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Ticket",
              "Update",
              "0",
              JSON.stringify({ ticket_number, ...changes }),
              err,
              () => { }
            );
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          AdminCommon.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Ticket",
            "Update",
            "1",
            JSON.stringify({ ticket_number, ...changes }),
            null,
            () => { }
          );

          return res.json({
            status: true,
            message: "Ticket updated successfully",
            service: result,
            token: newToken,
          });
        });
      });
    });
  });
};

exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { ticket_number, admin_id, _token } = req.query;
  // Validate required fields
  const missingFields = [];
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");
  if (!ticket_number) missingFields.push("Ticket Number");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const adminID = Number(admin_id);

  const action = "tickets";
  AdminCommon.isAdminAuthorizedForAction(adminID, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }
    AdminCommon.isAdminTokenValid(_token, adminID, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json(err);
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      // Create a new ticket
      Ticket.delete(ticket_number, (err, result) => {
        if (err) {
          console.error("Database error during ticket deletion:", err);
          AdminCommon.adminActivityLog(
            ipAddress,
            ipType,
            adminID,
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

        AdminCommon.adminActivityLog(
          ipAddress,
          ipType,
          adminID,
          "Ticket",
          "Delete",
          "1",
          JSON.stringify({ ticket: ticket_number }),
          null,
          () => { }
        );

        return res.status(200).json({
          status: true,
          message: "Ticket deleted successfully.",
          token: newToken,
        });
      });
    });
  });
};
