const crypto = require("crypto");
const ClientMasterTrackerModel = require("../../models/admin/clientMasterTrackerModel");
const Customer = require("../../models/customer/customerModel");
const ClientApplication = require("../../models/customer/branch/clientApplicationModel");
const Branch = require("../../models/customer/branch/branchModel");
const AdminCommon = require("../../models/admin/commonModel");
const Admin = require("../../models/admin/adminModel");
const Vendor = require("../../models/admin/vendorModel");

const App = require("../../models/appModel");
const BranchCommon = require("../../models/customer/branch/commonModel");
const {
  finalReportMail,
} = require("../../mailer/admin/client-master-tracker/finalReportMail");
const {
  qcReportCheckMail,
} = require("../../mailer/admin/client-master-tracker/qcReportCheckMail");
const {
  readyForReport,
} = require("../../mailer/admin/client-master-tracker/readyForReport");
const Service = require("../../models/admin/serviceModel");
const fs = require("fs");
const path = require("path");
const { generatePDF } = require("../../utils/finalReportPdf");
const { upload, saveImage, saveImages } = require("../../utils/cloudImageSave");
const { getClientIpAddress } = require("../../utils/ipAddress");
const { getSurepassStatusList, getServicesWithPrefill,runSurepassService } = require("../../utils/external-tools/surePass");
const { generateValuePitchToken, addValuePitchCase, fetchValuePitchStatus, fetchValuePitchReportData, getValuePitchFromDB, saveValuePitchStatus, getValuePitchCheckinStatuses } = require("../../utils/external-tools/valuePitch");
const { runValuePitchReadyPoll } = require("../../cron-jobs/valuePitchReportPolling");

exports.vendorAllocationList = (req, res) => {
  const { admin_id, _token } = req.query;

  const missingFields = [];
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "admin_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        message: authResult.message,
      });
    }

    AdminCommon.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!tokenResult.status) {
        return res.status(401).json({ status: false, message: tokenResult.message });
      }

      const newToken = tokenResult.newToken;

      ClientMasterTrackerModel.vendorAllocationList((listErr, applications) => {
        if (listErr) {
          console.error("Database error:", listErr);
          return res.status(500).json({
            status: false,
            message: listErr.message || "Unable to fetch vendor allocation cases",
            token: newToken,
          });
        }

        return res.json({
          status: true,
          message: "Vendor allocation client cases fetched successfully",
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

exports.allocateVendor = (req, res) => {
  const { client_application_id, vendor_id, admin_id, _token } = req.body;
  const applicationId = client_application_id;

  const missingFields = [];
  if (!applicationId) missingFields.push("Client Application ID");
  if (!vendor_id) missingFields.push("Vendor ID");
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "admin_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        message: authResult.message,
      });
    }

    AdminCommon.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!tokenResult.status) {
        return res.status(401).json({ status: false, message: tokenResult.message });
      }

      const newToken = tokenResult.newToken;

      Vendor.findById(vendor_id, (vendorErr, vendor) => {
        if (vendorErr) {
          console.error("Vendor lookup error:", vendorErr);
          return res.status(500).json({
            status: false,
            message: vendorErr.message || "Unable to validate vendor",
            token: newToken,
          });
        }

        if (!vendor) {
          return res.status(404).json({
            status: false,
            message: "Vendor not found",
            token: newToken,
          });
        }

        ClientMasterTrackerModel.allocateVendor(applicationId, vendor, admin_id, (updateErr) => {
          if (updateErr) {
            console.error("Vendor allocation error:", updateErr);
            return res.status(500).json({
              status: false,
              message: updateErr.message || "Unable to allocate vendor",
              token: newToken,
            });
          }

          return res.json({
            status: true,
            message: "Vendor allocated successfully",
            data: {
              client_application_id: applicationId,
              vendor_id: vendor.id,
              vendor_name: vendor.name_of_organization,
              vendor_code: vendor.vendor_code,
            },
            token: newToken,
          });
        });
      });
    });
  });
};

exports.updateVendorCaseAccess = (req, res) => {
  const { client_application_id, enabled, admin_id, _token } = req.body;
  const missingFields = [];
  if (!client_application_id) missingFields.push("Client Application ID");
  if (enabled === undefined || enabled === null) missingFields.push("Enabled");
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  AdminCommon.isAdminAuthorizedForAction(admin_id, "admin_manager", (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({ status: false, message: authResult.message });
    }

    AdminCommon.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) return res.status(500).json({ status: false, message: err.message });
      if (!tokenResult.status) return res.status(401).json({ status: false, message: tokenResult.message });

      const newToken = tokenResult.newToken;
      ClientMasterTrackerModel.updateVendorCaseAccess(client_application_id, Number(enabled) === 1 || enabled === true, (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ status: false, message: updateErr.message, token: newToken });
        }

        res.json({
          status: true,
          message: Number(enabled) === 1 || enabled === true ? "Vendor case enabled successfully." : "Vendor case disabled successfully.",
          token: newToken,
        });
      });
    });
  });
};
// Controller to list all customers
exports.list = (req, res) => {
  const { admin_id, _token, from, to } = req.query;

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

  const action = "admin_manager";
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
          ClientMasterTrackerModel.list(from, to, (err, result) => {
            if (err) return resolve([]);
            resolve(result);
          })
        ),
        new Promise((resolve) =>
          ClientMasterTrackerModel.filterOptionsForCustomers(from, to, (err, result) => {
            if (err) return resolve([]);
            resolve(result);
          })
        ),
      ];

      Promise.all(dataPromises).then(([customers, filterOptionsForCustomers]) => {
        res.json({
          status: true,
          message: "Customers fetched successfully",
          data: {
            customers,
            filterOptions: filterOptionsForCustomers,
          },
          totalResults: {
            customers: customers.length,
            filterOptions: filterOptionsForCustomers.length,
          },
          token: newToken,
        });
      });
    });
  });
};
exports.listValuePitch  = (req, res) => {
  const { admin_id, _token, from, to } = req.query;

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

  const action = "admin_manager";
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
          ClientMasterTrackerModel.list(from, to, (err, result) => {
            if (err) return resolve([]);
            resolve(result);
          })
        ),
        new Promise((resolve) =>
          ClientMasterTrackerModel.filterOptionsForCustomers(from, to, (err, result) => {
            if (err) return resolve([]);
            resolve(result);
          })
        ),
      ];

      Promise.all(dataPromises).then(([customers, filterOptionsForCustomers]) => {
        const valuePitchCustomers = customers.filter(
    (c) => (c.valuepitch_application_count || 0) > 0
  );
        res.json({
          status: true,
          message: "Customers fetched successfully",
          data: {
            customers : valuePitchCustomers,
            filterOptions: filterOptionsForCustomers,
          },
          totalResults: {
            customers: valuePitchCustomers.length,
            filterOptions: filterOptionsForCustomers.length,
          },
          token: newToken,
        });
      });
    });
  });
};


exports.test = async (req, res) => {
  try {
    const client_application_id = 7436;
    const client_unique_id = "CL-9342";
    const application_id = "CL-9342-64";
    const branch_id = "171";
    const name = "TESTING ORG";

    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Generate the PDF
    const pdfTargetDirectory = `uploads/customers/${client_unique_id}/client-applications/${application_id}/final-reports`;

    const pdfFileName = `${name}_${formattedDate}.pdf`
      .replace(/\s+/g, "-")
      .toLowerCase();
    const pdfPath = await generatePDF(
      client_application_id,
      branch_id,
      pdfFileName,
      pdfTargetDirectory
    );
    // If successful, return the result
    res.json({
      status: true,
      message: "PDF generated successfully",
      pdfPath, // Include the path to the generated PDF in the response
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

  const action = "admin_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        err: result,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res
          .status(500)
          .json({ status: false, err, message: err.message });
      }

      if (!result.status) {
        return res
          .status(401)
          .json({ status: false, err: result, message: result.message });
      }

      const newToken = result.newToken;

      ClientMasterTrackerModel.listByCustomerID(
        customer_id,
        filter_status,
        (err, result) => {
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

  const action = "admin_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        err: result,
        message: result.message, // Return the message from the authorization function
      });
    }

    console.log(`Step - 1`);
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
        });
      }
      console.log(`Step - 2`);
      Customer.infoByID(
        parseInt(currentBranch.customer_id),
        (err, currentCustomer) => {
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
          console.log(`Step - 3`);

          // Verify admin token
          AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
              console.error("Error checking token validity:", err);
              return res
                .status(500)
                .json({ status: false, err, message: err.message });
            }

            if (!result.status) {
              return res
                .status(401)
                .json({ status: false, err: result, message: result.message });
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
            console.log(`Step - 5`);

            ClientMasterTrackerModel.applicationListByBranch(
              filter_status,
              branch_id,
              status,
              (err, result) => {
                if (err) {
                  console.error("Database error:", err);
                  return res.status(500).json({
                    status: false,
                    err,
                    message: err.message,
                    token: newToken,
                  });
                }
                console.log(`Step - 6`);

                ClientMasterTrackerModel.filterOptionsForApplicationListing(currentBranch.customer_id, branch_id, (err, filterOptions) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                      status: false,
                      message: "An error occurred while fetching Filter options data.",
                      error: err,
                    });
                  }

                  return res.json({
                    status: true,
                    message: "Branches tracker fetched successfully",
                    branchName: currentBranch.name,
                    customerName: currentCustomer.name,
                    customerEmails: currentCustomer.emails,
                    tatDays: currentCustomer.tat_days,
                    customers: result,
                    totalResults: result.length,
                    filterOptions,
                    token: newToken,
                  });
                });
              }
            );
          });
        }
      );
    });
  });
};
exports.applicationListByBranchValuePitch = (req, res) => {
  const { filter_status, branch_id, admin_id, _token, status } = req.query;

  let missingFields = [];
  if (!branch_id || branch_id === "" || branch_id === "undefined")
    missingFields.push("Branch ID");
  if (!admin_id || admin_id === "" || admin_id === "undefined")
    missingFields.push("Admin ID");
  if (!_token || _token === "" || _token === "undefined")
    missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "admin_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({ status: false, message: result.message });
    }

    Branch.getBranchById(branch_id, (err, currentBranch) => {
      if (err) {
        return res.status(500).json({
          status: false,
          message: "Failed to retrieve Branch. Please try again.",
        });
      }

      if (!currentBranch) {
        return res.status(404).json({ status: false, message: "Branch not found." });
      }

      Customer.infoByID(parseInt(currentBranch.customer_id), (err, currentCustomer) => {
        if (err) {
          return res.status(500).json({
            status: false,
            message: "Failed to retrieve Customer. Please try again.",
          });
        }

        if (!currentCustomer) {
          return res.status(404).json({ status: false, message: "Customer not found." });
        }

        AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
          if (err) {
            return res.status(500).json({ status: false, message: err.message });
          }

          if (!result.status) {
            return res.status(401).json({ status: false, message: result.message });
          }

          const newToken = result.newToken;

          const resolvedStatus =
            !status || status === "" || status === "undefined" ? null : status;

          ClientMasterTrackerModel.applicationListByBranch(
            filter_status,
            branch_id,
            resolvedStatus,
            async (err, applications) => {
              if (err) {
                return res.status(500).json({
                  status: false,
                  message: err.message,
                  token: newToken,
                });
              }

              // ── ValuePitch filter ──────────────────────────────
              const valuePitchApplications = [];

              for (const app of applications) {
                // service_ids field expected on each application row
                // adjust key name if different in your model
                const serviceIdsRaw = app.service_ids ?? app.services ?? null;

                if (!serviceIdsRaw) continue;

                const serviceIdList = String(serviceIdsRaw)
                  .split(",")
                  .map((id) => id.trim())
                  .filter(Boolean);

                const valuePitchServiceDetails = [];

                for (const sid of serviceIdList) {
                  const serviceData = await new Promise((resolve) => {
                    Service.getServiceById(sid, (err, data) => resolve(data || null));
                  });

                  if (!serviceData) continue;

                  const types = (serviceData.service_type ?? "")
                    .trim()
                    .toLowerCase()
                    .split(",")
                    .map((t) => t.trim());

                  if (types.includes("valuepitch")) {
                    valuePitchServiceDetails.push({
                      service_id: sid,
                      service_name: serviceData.title || serviceData.service_name || `Service ${sid}`,
                    });
                  }
                }

                if (valuePitchServiceDetails.length) {
                  const statusMap = await getValuePitchCheckinStatuses(
                    app.main_id || app.id,
                    valuePitchServiceDetails.map((service) => service.service_id)
                  );

                  const valuePitchServices = valuePitchServiceDetails.map((service) => {
                    const statusData = statusMap[String(service.service_id)] || null;
                    const reportReady = Boolean(statusData?.reportReady);
                    const responseReceived = Boolean(statusData?.responseReceived);

                    return {
                      ...service,
                      verifyId: statusData?.verifyId || null,
                      statusCode: statusData?.statusCode || null,
                      statusMsg: statusData?.statusMsg || null,
                      report: statusData?.report || null,
                      reportUrl: statusData?.reportUrl || null,
                      responseReceived,
                      reportReady,
                      status: reportReady
                        ? "report_ready"
                        : responseReceived
                          ? "response_pending"
                          : "not_submitted",
                      label: reportReady
                        ? "Report Ready"
                        : responseReceived
                          ? "Response Aaya - Report Pending"
                          : "Response Nahi Aaya",
                      lastCheckedAt: statusData?.lastCheckedAt || null
                    };
                  });

                  valuePitchApplications.push({
                    ...app,
                    valuePitchServices,
                    valuePitchCheckinStatus: valuePitchServices.every((service) => service.reportReady)
                      ? "all_ready"
                      : valuePitchServices.some((service) => service.responseReceived)
                        ? "partial_or_pending"
                        : "not_submitted",
                    valuePitchCheckinLabel: valuePitchServices
                      .map((service) => `${service.service_name}: ${service.label}`)
                      .join(" | ")
                  });
                }
              }
              // ───────────────────────────────────────────────────

              ClientMasterTrackerModel.filterOptionsForApplicationListing(
                currentBranch.customer_id,
                branch_id,
                (err, filterOptions) => {
                  if (err) {
                    return res.status(500).json({
                      status: false,
                      message: "An error occurred while fetching Filter options data.",
                      error: err,
                    });
                  }

                  return res.json({
                    status: true,
                    message: "ValuePitch applications fetched successfully",
                    branchName: currentBranch.name,
                    customerName: currentCustomer.name,
                    customerEmails: currentCustomer.emails,
                    tatDays: currentCustomer.tat_days,
                    customers: valuePitchApplications,
                    totalResults: valuePitchApplications.length,
                    filterOptions,
                    token: newToken,
                  });
                }
              );
            }
          );
        });
      });
    });
  });
};
exports.applicationByID = (req, res) => {
  const { application_id, branch_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !application_id ||
    application_id === "" ||
    application_id === undefined ||
    application_id === "undefined"
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

  const action = "admin_manager";
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

      ClientMasterTrackerModel.applicationByID(
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
              message: "Application not found 1",
              token: newToken,
            });
          }

          if (application.is_data_qc !== 1) {
            console.warn("Application Data QC is not done yet 3");
            return res.status(404).json({
              status: false,
              message: "Data QC for application data is pending.",
              token: newToken,
            });
          }

          ClientMasterTrackerModel.getCMTApplicationById(
            application_id,
            (err, CMTApplicationData) => {
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

                    Admin.list((err, admins) => {
                      if (err) {
                        console.error("Database error:", err);
                        return res.status(500).json({
                          status: false,
                          err,
                          message: err.message,
                          token: newToken,
                        });
                      }

                      if (!CMTApplicationData) {
                        return res.json({
                          status: true,
                          message: "Application fetched successfully 1",
                          application,
                          branchInfo: currentBranch,
                          customerInfo: currentCustomer,
                          admins,
                          token: newToken,
                        });
                      } else {
                        return res.json({
                          status: true,
                          message: "Application fetched successfully 2",
                          application,
                          CMTData: CMTApplicationData,
                          branchInfo: currentBranch,
                          customerInfo: currentCustomer,
                          admins,
                          token: newToken,
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
    });
  });
};

exports.applicationDelete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const { application_id, admin_id, _token } = req.query;

  // Validate required fields
  // Check for missing fields
  const requiredFields = { application_id, admin_id, _token };
  const missingFields = Object.keys(requiredFields)
    .filter((field) => !requiredFields[field])
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Check branch authorization
  const action = "admin_manager";
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
      // Fetch the current clientApplication
      ClientApplication.getClientApplicationById(
        application_id,
        (err, currentClientApplication) => {
          if (err) {
            console.error(
              "Database error during clientApplication retrieval:",
              err
            );
            return res.status(500).json({
              status: false,
              message:
                "Failed to retrieve ClientApplication. Please try again.",
              token: newToken,
            });
          }

          if (!currentClientApplication) {
            return res.status(404).json({
              status: false,
              message: "Client Aplication not found.",
              token: newToken,
            });
          }

          // Delete the clientApplication
          ClientApplication.delete(application_id, (err, result) => {
            if (err) {
              console.error(
                "Database error during clientApplication deletion:",
                err
              );
              AdminCommon.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Client Application",
                "Delete",
                "0",
                JSON.stringify({ application_id }),
                err,
                () => { }
              );
              return res.status(500).json({
                status: false,
                message:
                  err.message ?? "Failed to delete ClientApplication. Please try again.",
                token: newToken,
              });
            }

            AdminCommon.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Client Application",
              "Delete",
              "1",
              JSON.stringify({ application_id }),
              null,
              () => { }
            );

            res.status(200).json({
              status: true,
              message: "Client Application deleted successfully.",
              token: newToken,
            });
          });
        }
      );
    });
  });
};

exports.applicationHighlight = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { application_id, highlight, admin_id, _token } = req.query;

  // Validate required fields
  const requiredFields = { application_id, highlight, admin_id, _token };
  const missingFields = Object.keys(requiredFields)
    .filter((field) => !requiredFields[field])
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Validate highlight field (must be 0 or 1)
  if (highlight !== "0" && highlight !== "1") {
    return res.status(400).json({
      status: false,
      message: "Invalid highlight value. It must be '0' or '1'.",
    });
  }

  // Check branch authorization
  const action = "admin_manager";
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
      // Fetch the current clientApplication
      ClientApplication.getClientApplicationById(
        application_id,
        (err, currentClientApplication) => {
          if (err) {
            console.error(
              "Database error during clientApplication retrieval:",
              err
            );
            return res.status(500).json({
              status: false,
              message:
                "Failed to retrieve ClientApplication. Please try again.",
              token: newToken,
            });
          }

          if (!currentClientApplication) {
            return res.status(404).json({
              status: false,
              message: "Client Application not found.",
              token: newToken,
            });
          }

          // Highlight or un-highlight the clientApplication
          ClientApplication.highlight(
            application_id,
            highlight,
            (err, result) => {
              if (err) {
                console.error(
                  "Database error during clientApplication highlighting:",
                  err
                );
                AdminCommon.adminActivityLog(
                  ipAddress,
                  ipType,
                  admin_id,
                  "Client Application",
                  "highlight",
                  "0",
                  JSON.stringify({ application_id }),
                  `Failed to update highlight status: ${err.message}`,
                  () => { }
                );
                return res.status(500).json({
                  status: false,
                  message:
                    "Failed to update highlighting of ClientApplication. Please try again.",
                  token: newToken,
                });
              }

              const actionMessage =
                highlight === "1"
                  ? "Highlighted the Client Application."
                  : "Un-highlighted the Client Application.";

              // Log the specific action in the activity log
              AdminCommon.adminActivityLog(
                ipAddress,
                ipType,
                admin_id,
                "Client Application",
                actionMessage,
                "1",
                JSON.stringify({ application_id }),
                null,
                () => { }
              );

              return res.status(200).json({
                status: true,
                message: `Client Application ${highlight === "1" ? "highlighted" : "un-highlighted"
                  } successfully.`,
                token: newToken,
              });
            }
          );
        }
      );
    });
  });
};

exports.annexureData = (req, res) => {
  const { application_id, db_table, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !application_id ||
    application_id === "" ||
    application_id === undefined ||
    application_id === "undefined"
  )
    missingFields.push("Application ID");
  if (
    !db_table ||
    db_table === "" ||
    db_table === undefined ||
    db_table === "undefined"
  )
    missingFields.push("DB Table");
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

  const modifiedDbTable = db_table.replace(/-/g, "_");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "admin_manager";
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

      ClientMasterTrackerModel.annexureData(
        application_id,
        modifiedDbTable,
        (err, annexureData) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({
              status: false,
              message: "An error occurred while fetching annexure data.",
              error: err,
              token: newToken,
            });
          }

          if (!annexureData) {
            return res.status(404).json({
              status: false,
              message: "Annexure Data not found.",
              token: newToken,
            });
          }

          res.status(200).json({
            status: true,
            message: "Application fetched successfully 4.",
            annexureData,
            token: newToken,
          });
        }
      );
    });
  });
};

exports.customerFilterOption = (req, res) => {
  const { from, to } = req.query;

  ClientMasterTrackerModel.filterOptionsForCustomers(from, to, (err, filterOptions) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({
        status: false,
        message: "An error occurred while fetching Filter options data.",
        error: err,
      });
    }

    if (!filterOptions) {
      return res.status(404).json({
        status: false,
        message: "Filter options Data not found.",
      });
    }

    res.status(200).json({
      status: true,
      message: "Filter options fetched successfully.",
      filterOptions,
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

  const action = "admin_manager";
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

      ClientMasterTrackerModel.filterOptions((err, filterOptions) => {
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

  const action = "admin_manager";
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

      ClientMasterTrackerModel.filterOptionsForBranch(
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

exports.reportFormJsonByServiceID = (req, res) => {
  const { service_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !service_id ||
    service_id === "" ||
    service_id === undefined ||
    service_id === "undefined"
  )
    missingFields.push("Service ID");
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

  const action = "admin_manager";
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

      ClientMasterTrackerModel.reportFormJsonByServiceID(
        service_id,
        (err, reportFormJson) => {
          if (err) {
            console.error(newFunction(), err);
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          if (!reportFormJson) {
            return res.status(404).json({
              status: false,
              message: "Report form JSON not found",
              token: newToken,
            });
          }

          res.json({
            status: true,
            message: "Report form JSON fetched successfully",
            reportFormJson,
            token: newToken,
          });

          function newFunction() {
            return "Database error:";
          }
        }
      );
    });
  });
};
const screeningStarMap = {};
exports.generateReport = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    admin_id,
    _token,
    client_applicant_gender,
    client_applicant_name,
    client_organization_name,
    client_organization_code,
    branch_id,
    customer_id,
    application_id,
    data_qc,
    updated_json,
    annexure,
    send_mail,
  } = req.body;

  // Define required fields
  const requiredFields = {
    admin_id,
    _token,
    client_applicant_name,
    client_organization_name,
    client_organization_code,
    branch_id,
    customer_id,
    application_id,
    data_qc,
    updated_json,
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

  // Function to flatten JSON and separate annexure
  function flattenJsonWithAnnexure(jsonObj) {
    let result = {};
    let annexureResult = {};

    function recursiveFlatten(obj, isAnnexure = false) {
      for (let key in obj) {
        if (
          typeof obj[key] === "object" &&
          obj[key] !== null &&
          !Array.isArray(obj[key])
        ) {
          if (key === "annexure") {
            isAnnexure = true;
            annexureResult = {};
          }
          recursiveFlatten(obj[key], isAnnexure);
          if (isAnnexure && key !== "annexure") {
            if (typeof obj[key] === "object" && obj[key] !== null) {
              annexureResult[key] = obj[key];
            }
          }
        } else {
          if (!isAnnexure) {
            result[key] = obj[key];
          }
        }
      }
    }

    recursiveFlatten(jsonObj);
    return { mainJsonRaw: result, annexureRawJson: annexureResult };
  }

  const action = "admin_manager";

  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (AuthResult) => {
    if (!AuthResult.status) {
      return res.status(403).json({
        status: false,
        message: AuthResult.message,
      });
    }

    AdminCommon.isAdminTokenValid(_token, admin_id, (err, TokenResult) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!TokenResult.status) {
        return res
          .status(401)
          .json({ status: false, message: TokenResult.message });
      }

      const newToken = TokenResult.newToken;
      // Fetch the current clientApplication
      ClientApplication.getClientApplicationById(
        application_id,
        (err, currentClientApplication) => {
          if (err) {
            console.error(
              "Database error during clientApplication retrieval:",
              err
            );
            return res.status(500).json({
              status: false,
              message:
                "Failed to retrieve ClientApplication. Please try again.",
              token: newToken,
            });
          }

          if (!currentClientApplication) {
            return res.status(404).json({
              status: false,
              message: "Client Application not found.",
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

            if (parseInt(currentBranch.customer_id) !== parseInt(customer_id)) {
              return res.status(404).json({
                status: false,
                message: "Branch not found with customer match.",
                token: newToken,
              });
            }
            console.log(`Step 1`);
            Customer.getCustomerById(customer_id, (err, currentCustomer) => {
              if (err) {
                console.error("Database error during customer retrieval:", err);
                return res.status(500).json({
                  status: false,
                  message: "Failed to retrieve Customer. Please try again.",
                  token: newToken,
                });
              }
              console.log(`Step 2`);

              if (!currentCustomer) {
                return res.status(404).json({
                  status: false,
                  message: "Customer not found.",
                  token: newToken,
                });
              }

              Customer.checkUniqueIdForUpdate(
                customer_id,
                client_organization_code,
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

                  Customer.updateByData(
                    {
                      name: client_organization_name,
                      client_unique_id: client_organization_code
                    },
                    customer_id,
                    (err, customerUpdateByData) => {
                      console.log(`Step 4`);

                      if (err) {
                        console.error(
                          "Database error during CMT Application retrieval:",
                          err
                        );
                        return res.status(500).json({
                          status: false,
                          message:
                            "Failed to retrieve CMT Application. Please try again.",
                          token: newToken,
                        });
                      }
                      console.log(`Step 3`);

                      ClientMasterTrackerModel.getCMTApplicationById(
                        application_id,
                        (err, currentCMTApplication) => {
                          console.log(`Step 4`);

                          if (err) {
                            console.error(
                              "Database error during CMT Application retrieval:",
                              err
                            );
                            return res.status(500).json({
                              status: false,
                              message:
                                "Failed to retrieve CMT Application. Please try again.",
                              token: newToken,
                            });
                          }

                          ClientApplication.updateByData(
                            {
                              name: client_applicant_name,
                              gender: client_applicant_gender
                            },
                            application_id,
                            (err, applicationClientApplication) => {
                              console.log(`Step 4`);

                              if (err) {
                                console.error(
                                  "Database error during CMT Application retrieval:",
                                  err
                                );
                                return res.status(500).json({
                                  status: false,
                                  message:
                                    "Failed to retrieve CMT Application. Please try again.",
                                  token: newToken,
                                });
                              }

                              console.log(`Step 5`);

                              // Flatten the updated_json object and separate annexure
                              let { mainJsonRaw, annexureRawJson } =
                                flattenJsonWithAnnexure(updated_json);
                              console.log(`Step 6`);

                              // Array of keys you want to delete
                              const keysToDelete = [
                                "month_year",
                                "initiation_date",
                                "organization_name",
                                "verification_purpose",
                                "employee_id",
                                "client_code",
                                "applicant_name",
                                "contact_number",
                                "contact_number2",
                                "father_name",
                                "dob",
                                "gender",
                                "marital_status",
                                "address",
                                "landmark",
                                "residence_mobile_number",
                                "state",
                                "permanent_address",
                                "permanent_sender_name",
                                "permanent_receiver_name",
                                "permanent_landmark",
                                "permanent_pin_code",
                                "permanent_state",
                              ];

                              /*
                              // Remove keys in keysToDelete from mainJsonRaw
                              Object.keys(mainJsonRaw).forEach((key) => {
                                if (keysToDelete.includes(key)) {
                                  delete mainJsonRaw[key];
                                }
                              });
                              */

                              const mainJson = mainJsonRaw;
                              // Declare changes outside the conditional block
                              const changes = {};
                              let logStatus = "create";
                              if (
                                currentCMTApplication &&
                                Object.keys(currentCMTApplication).length > 0
                              ) {
                                console.log(`Step 7`);

                                logStatus = "update";
                                const compareAndAddChanges = (key, newValue) => {
                                  if (currentCMTApplication[key] !== newValue) {
                                    changes[key] = {
                                      old: currentCMTApplication[key],
                                      new: newValue,
                                    };
                                  }
                                };
                                console.log(`Step 8`);

                                // Compare and log changes
                                Object.keys(mainJson).forEach((key) =>
                                  compareAndAddChanges(key, mainJson[key])
                                );
                              }
                              console.log(`Step 9`);

                              ClientMasterTrackerModel.generateReport(
                                mainJson,
                                application_id,
                                branch_id,
                                customer_id,
                                async (err, cmtResult) => {
                                  console.log(`Step 10`);

                                  if (err) {
                                    console.error(
                                      "Database error during CMT application update:",
                                      err
                                    );
                                    console.log(`Step 11`);
                                    const logData =
                                      currentCMTApplication &&
                                        Object.keys(currentCMTApplication).length > 0
                                        ? JSON.stringify({ application_id, ...changes }) // changes is defined here
                                        : JSON.stringify(mainJson);

                                    AdminCommon.adminActivityLog(
                                      ipAddress,
                                      ipType,
                                      admin_id,
                                      "Client Master Tracker",
                                      logStatus,
                                      "0",
                                      logData,
                                      err,
                                      () => { }
                                    );
                                    console.log(`Step 12`);

                                    return res.status(500).json({
                                      status: false,
                                      message: err.message,
                                      token: newToken,
                                    });
                                  }
                                  console.log(`Step 13`);
                                  const logDataSuccess =
                                    currentCMTApplication &&
                                      Object.keys(currentCMTApplication).length > 0
                                      ? JSON.stringify({ application_id, ...changes }) // changes is defined here
                                      : JSON.stringify(mainJson);

                                  AdminCommon.adminActivityLog(
                                    ipAddress,
                                    ipType,
                                    admin_id,
                                    "Client Master Tracker",
                                    logStatus,
                                    "1",
                                    logDataSuccess,
                                    err,
                                    () => { }
                                  );
                                  console.log(`Step 14`);
                                  if (
                                    annexure &&
                                    typeof annexure === "object" &&
                                    Object.keys(annexure).length > 0
                                  ) {
                                    const annexurePromises = [];
                                    console.log(`Step 15`);
                                    for (let key in annexure) {
                                      const db_table = key ?? null;
                                      const modifiedDbTable = db_table
                                        .replace(/-/g, "_")
                                        .toLowerCase();

                                      let subJson = annexure[modifiedDbTable] ?? null;
                                      const serviceId = subJson['service_id'] ?? null;

                                      console.log("Step 7: Fetching service from DB...");

                                      if (!serviceId) {
                                        console.warn("Step 6: serviceId not found, skipping...");
                                        continue;
                                      }

                                      // ✅ Promisify
                                      const serviceData = await new Promise((resolve, reject) => {
                                        Service.getServiceById(serviceId, (err, data) => {
                                          if (err) return reject(err);
                                          resolve(data);
                                        });
                                      });

                                      console.log("Step 8: serviceData ->", serviceData);

                                      if (!serviceData) {
                                        console.warn(`Step 9: No service found for ID ${serviceId}`);
                                        continue;
                                      }

                                      const serviceType = serviceData.service_type?.trim().toLowerCase();
                                      console.log("Step 10: serviceType ->", serviceType);

                                      const types = serviceType.split(",").map(t => t.trim());

                                      const hasValuePitch = types.includes("valuepitch");
                                      const hasSurepass = types.includes("surepass");
                                      const hasManual = types.includes("manual");

                                      // ================== VALUEPITCH (HIGHEST PRIORITY) ==================
                                      if (hasValuePitch) {
                                        const annexurePromise = new Promise((resolve, reject) => {
                                          ClientMasterTrackerModel.getCMTAnnexureByApplicationId(
                                            application_id, modifiedDbTable,
                                            (err, currentCMTAnnexure) => {
                                              if (err) return reject(err);

                                              const cmt_id = logStatus === "update"
                                                ? currentCMTApplication.id
                                                : cmtResult.insertId;

                                              // Only save to DB, NO ValuePitch API call
                                              ClientMasterTrackerModel.createOrUpdateAnnexure(
                                                cmt_id, application_id, branch_id, customer_id,
                                                modifiedDbTable, subJson, types,
                                                (err, annexureResult) => {
                                                  if (err) return reject(err);
                                                  resolve(); // Done — no API call
                                                }
                                              );
                                            }
                                          );
                                        });

                                        annexurePromises.push(annexurePromise);
                                        continue;
                                      }
                                      // ================== SUREPASS ==================
                                      if (hasSurepass) {
                                        console.log("🔥 Running ONLY SUREPASS");
                                        console.log("🔥 Running ONLY MANUAL");

                                        console.log(`subJson before DB operation for key ${key}:`, subJson);

                                        if (!subJson) {
                                          console.log("Step 5: subJson is null/undefined, skipping...");
                                          continue;
                                        }
                                        const annexurePromise = new Promise((resolve, reject) => {
                                          ClientMasterTrackerModel.getCMTAnnexureByApplicationId(
                                            application_id,
                                            modifiedDbTable,
                                            (err, currentCMTAnnexure) => {

                                              if (err) {
                                                console.error(
                                                  "Database error during CMT Annexure retrieval:",
                                                  err
                                                );
                                                return reject(err);
                                              }

                                              let annexureLogStatus =
                                                currentCMTAnnexure &&
                                                  Object.keys(currentCMTAnnexure).length > 0
                                                  ? "update"
                                                  : "create";

                                              if (logStatus == "update") {
                                                cmt_id = currentCMTApplication.id;
                                              } else {
                                                cmt_id = cmtResult.insertId;
                                              }

                                              ClientMasterTrackerModel.createOrUpdateAnnexure(
                                                cmt_id,
                                                application_id,
                                                branch_id,
                                                customer_id,
                                                modifiedDbTable,
                                                subJson,
                                                types,
                                                (err, annexureResult) => {

                                                  if (err) {
                                                    console.error(
                                                      "Database error during CMT annexure create or update:",
                                                      err
                                                    );

                                                    const annexureLogData =
                                                      currentCMTAnnexure &&
                                                        Object.keys(currentCMTAnnexure).length > 0
                                                        ? JSON.stringify({
                                                          application_id,
                                                          ...changes,
                                                        })
                                                        : JSON.stringify(mainJson);

                                                    AdminCommon.adminActivityLog(
                                                      ipAddress,
                                                      ipType,
                                                      admin_id,
                                                      "Client Master Tracker",
                                                      annexureLogStatus,
                                                      "0",
                                                      annexureLogData,
                                                      err,
                                                      () => { }
                                                    );

                                                    return reject(err);
                                                  }

                                                  AdminCommon.adminActivityLog(
                                                    ipAddress,
                                                    ipType,
                                                    admin_id,
                                                    "Client Master Tracker",
                                                    annexureLogStatus,
                                                    "1",
                                                    logDataSuccess,
                                                    err,
                                                    () => { }
                                                  );

                                                  resolve();
                                                }
                                              );
                                            }
                                          );
                                        });
                                        annexurePromises.push(annexurePromise);

                                        continue; // 🚀 IMPORTANT
                                      }

                                      // ================== MANUAL (LOWEST PRIORITY) ==================
                                      if (hasManual) {
                                        console.log("🔥 Running ONLY MANUAL");

                                        console.log(`subJson before DB operation for key ${key}:`, subJson);

                                        if (!subJson) {
                                          console.log("Step 5: subJson is null/undefined, skipping...");
                                          continue;
                                        }

                                        const annexurePromise = new Promise((resolve, reject) => {
                                          ClientMasterTrackerModel.getCMTAnnexureByApplicationId(
                                            application_id,
                                            modifiedDbTable,
                                            (err, currentCMTAnnexure) => {

                                              if (err) {
                                                console.error(
                                                  "Database error during CMT Annexure retrieval:",
                                                  err
                                                );
                                                return reject(err);
                                              }

                                              let annexureLogStatus =
                                                currentCMTAnnexure &&
                                                  Object.keys(currentCMTAnnexure).length > 0
                                                  ? "update"
                                                  : "create";

                                              if (logStatus == "update") {
                                                cmt_id = currentCMTApplication.id;
                                              } else {
                                                cmt_id = cmtResult.insertId;
                                              }

                                              ClientMasterTrackerModel.createOrUpdateAnnexure(
                                                cmt_id,
                                                application_id,
                                                branch_id,
                                                customer_id,
                                                modifiedDbTable,
                                                subJson,
                                                types,
                                                (err, annexureResult) => {

                                                  if (err) {
                                                    console.error(
                                                      "Database error during CMT annexure create or update:",
                                                      err
                                                    );

                                                    const annexureLogData =
                                                      currentCMTAnnexure &&
                                                        Object.keys(currentCMTAnnexure).length > 0
                                                        ? JSON.stringify({
                                                          application_id,
                                                          ...changes,
                                                        })
                                                        : JSON.stringify(mainJson);

                                                    AdminCommon.adminActivityLog(
                                                      ipAddress,
                                                      ipType,
                                                      admin_id,
                                                      "Client Master Tracker",
                                                      annexureLogStatus,
                                                      "0",
                                                      annexureLogData,
                                                      err,
                                                      () => { }
                                                    );

                                                    return reject(err);
                                                  }

                                                  AdminCommon.adminActivityLog(
                                                    ipAddress,
                                                    ipType,
                                                    admin_id,
                                                    "Client Master Tracker",
                                                    annexureLogStatus,
                                                    "1",
                                                    logDataSuccess,
                                                    err,
                                                    () => { }
                                                  );

                                                  resolve();
                                                }
                                              );
                                            }
                                          );
                                        });

                                        annexurePromises.push(annexurePromise);
                                      }
                                    }
                                    console.log(`Step 16`);
                                    // Wait for all annexure operations to complete
                                    Promise.all(annexurePromises)
                                      .then(() => {
                                        console.log(`Step 17`);
                                        BranchCommon.getBranchandCustomerEmailsForNotification(
                                          branch_id,
                                          (emailError, emailData) => {
                                            console.log(`Step 18`);
                                            if (emailError) {
                                              console.error(
                                                "Error fetching emails:",
                                                emailError
                                              );
                                              return res.status(500).json({
                                                status: false,
                                                message: "Failed to retrieve email addresses.",
                                                token: newToken,
                                              });
                                            }
                                            console.log(`Step 19`);
                                            const { branch, customer } = emailData;

                                            const company_name = customer.name;

                                            const toQCTeam = [
                                              { name: 'QC Team', email: 'qc@screeningstar.com' }
                                            ];

                                            let emailList = [];
                                            try {
                                              emailList = JSON.parse(customer.emails);
                                              if (!Array.isArray(emailList)) throw new Error("Parsed value is not an array.");
                                            } catch (error) {
                                              console.error("Invalid JSON format in customer.emails:", error.message);
                                              return;
                                            }

                                            // Step 2: Prepare the mamin recipient (0 index) as "to"
                                            const toArr = emailList.length > 0
                                              ? [{ name: customer.name, email: emailList[0] }]
                                              : [];

                                            // Step 3: Prepare the rest as "cc"
                                            const ccArr = emailList.slice(1).map(email => ({
                                              name: customer.name,
                                              email,
                                            }));

                                            // Step 4: Merge into final recipients
                                            const finalCcEmails = [
                                              { name: 'Bgv Team', email: 'bgv@screeningstar.com' },
                                              { name: 'Manjunath', email: 'manjunath@screeningstar.com' },
                                              { name: 'QC Team', email: 'qc@screeningstar.com' },
                                              { name: 'Rohit Webstep', email: 'vanshwebstep@gmail.com' },
                                              ...ccArr,
                                            ];

                                            console.log(`Step 20`);
                                            ClientMasterTrackerModel.applicationByID(
                                              application_id,
                                              branch_id,
                                              (err, application) => {
                                                console.log(`Step 21`);

                                                if (err) {
                                                  console.error("Database error:", err);
                                                  return res.status(500).json({
                                                    status: false,
                                                    message: err.message,
                                                    token: newToken,
                                                  });
                                                }

                                                if (!application) {
                                                  return res.status(404).json({
                                                    status: false,
                                                    message: "Application not found 2",
                                                    token: newToken,
                                                  });
                                                }
                                                if (application.is_data_qc !== 1) {
                                                  console.warn(
                                                    "Application Data QC is not done yet 3"
                                                  );
                                                  return res.status(404).json({
                                                    status: false,
                                                    message:
                                                      "Data QC for application data is pending.",
                                                    token: newToken,
                                                  });
                                                }
                                                console.log(`Step 22`);

                                                ClientMasterTrackerModel.getCMTApplicationById(
                                                  application_id,
                                                  (err, CMTApplicationData) => {
                                                    console.log(`Step 23`);

                                                    if (err) {
                                                      console.error("Database error:", err);
                                                      return res.status(500).json({
                                                        status: false,
                                                        message: err.message,
                                                        token: newToken,
                                                      });
                                                    }
                                                    console.log(`Step 24`);

                                                    const case_initiated_date =
                                                      CMTApplicationData.initiation_date ||
                                                      "N/A";
                                                    const final_report_date =
                                                      CMTApplicationData.report_date || "N/A";
                                                    const report_type =
                                                      CMTApplicationData.report_type || "N/A";
                                                    ClientMasterTrackerModel.getAttachmentsByClientAppID(
                                                      application_id,
                                                      (err, attachments) => {
                                                        console.log(`Step 25`);

                                                        if (err) {
                                                          console.error("Database error:", err);
                                                          return res.status(500).json({
                                                            status: false,
                                                            message: "Database error occurred",
                                                            token: newToken
                                                          });
                                                        }
                                                        if (
                                                          !mainJson.overall_status ||
                                                          !mainJson.is_verify
                                                        ) {
                                                          ClientMasterTrackerModel.updateDataQC(
                                                            { application_id, data_qc },
                                                            (err, result) => {
                                                              if (err) {
                                                                console.error(
                                                                  "Error updating data QC:",
                                                                  err
                                                                );
                                                                return res.status(500).json({
                                                                  status: false,
                                                                  message:
                                                                    "An error occurred while updating data QC. Please try again.",
                                                                  token: newToken,
                                                                });
                                                              }
                                                              // If there are no annexures, send the response directly
                                                              return res.status(200).json({
                                                                status: true,
                                                                message: `CMT Application ${currentCMTApplication &&
                                                                  Object.keys(
                                                                    currentCMTApplication
                                                                  ).length > 0
                                                                  ? "updated"
                                                                  : "created"
                                                                  } successfully.`,
                                                                token: newToken,
                                                              });
                                                            }
                                                          );
                                                        }

                                                        ClientApplication.updateStatus(
                                                          mainJson.overall_status,
                                                          application_id,
                                                          (err, result) => {
                                                            console.log(`Step 26`);

                                                            if (err) {
                                                              console.error(
                                                                "Database error during client application status update:",
                                                                err
                                                              );
                                                              return res.status(500).json({
                                                                status: false,
                                                                message: err.message,
                                                                token: newToken,
                                                              });
                                                            }

                                                            ClientMasterTrackerModel.updateDataQC(
                                                              { application_id, data_qc },
                                                              async (err, result) => {
                                                                if (err) {
                                                                  console.error(
                                                                    "Error updating data QC:",
                                                                    err
                                                                  );
                                                                  return res.status(500).json({
                                                                    status: false,
                                                                    message:
                                                                      "An error occurred while updating data QC. Please try again.",
                                                                    token: newToken,
                                                                  });
                                                                }

                                                                if (data_qc == 0) {
                                                                  return res
                                                                    .status(200)
                                                                    .json({
                                                                      status: true,
                                                                      message: `CMT Application ${currentCMTApplication &&
                                                                        Object.keys(
                                                                          currentCMTApplication
                                                                        ).length > 0
                                                                        ? "updated"
                                                                        : "created"
                                                                        } successfully`,
                                                                      token: newToken,
                                                                    });
                                                                }
                                                                mainJson.is_verify =
                                                                  mainJson.is_verify &&
                                                                    mainJson.is_verify !== ""
                                                                    ? mainJson.is_verify
                                                                    : "no";
                                                                console.log(`Step 27`);
                                                                console.log(`Step 28`);

                                                                const status =
                                                                  mainJson.overall_status.toLowerCase();
                                                                const verified =
                                                                  mainJson.is_verify.toLowerCase();

                                                                const gender =
                                                                  mainJson.gender?.toLowerCase();
                                                                const marital_status =
                                                                  mainJson.marital_status?.toLowerCase();

                                                                let gender_title = "Mr.";

                                                                if (gender === "male") {
                                                                  gender_title = "Mr.";
                                                                } else if (
                                                                  gender === "female"
                                                                ) {
                                                                  gender_title =
                                                                    marital_status === "married"
                                                                      ? "Mrs."
                                                                      : "Ms.";
                                                                }

                                                                if (
                                                                  status === "completed" ||
                                                                  status === "complete"
                                                                ) {

                                                                  App.appInfo(
                                                                    "backend",
                                                                    async (err, appInfo) => {
                                                                      if (err) {
                                                                        console.error(
                                                                          "Database error:",
                                                                          err
                                                                        );
                                                                        return res
                                                                          .status(500)
                                                                          .json({
                                                                            status: false,
                                                                            err,
                                                                            message:
                                                                              err.message,
                                                                            token: newToken,
                                                                          });
                                                                      }

                                                                      let imageHost =
                                                                        "www.example.in";

                                                                      if (appInfo) {
                                                                        imageHost =
                                                                          appInfo.cloud_host ||
                                                                          "www.example.in";
                                                                      }
                                                                      console.log(`Step 29`);

                                                                      const pdfTargetDirectory = `uploads/customers/${currentCustomer.client_unique_id}/client-applications/${application.application_id}/final-reports`;
                                                                      const pdfFileName = `${application.application_id.toUpperCase()}-${application.name.replace(/\b\w/g, char => char.toUpperCase())}-${(application.employee_id?.trim() || "NA").toUpperCase()}-${report_type.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase())}.pdf`
                                                                        .replace(/\s+/g, "-")
                                                                        .toLowerCase();

                                                                      const pdfPath =
                                                                        await generatePDF(
                                                                          application_id,
                                                                          branch_id,
                                                                          pdfFileName,
                                                                          pdfTargetDirectory
                                                                        );
                                                                      let newAttachments = `${imageHost}/${pdfPath}`;

                                                                      if (verified === "yes") {
                                                                        console.log(`Step 30`);

                                                                        ClientMasterTrackerModel.updateReportCompletedStatus(
                                                                          {
                                                                            is_report_completed: 1,
                                                                            report_completed_at: new Date(), // or now() if it's a custom function returning Date
                                                                            application_id: application_id
                                                                          },
                                                                          async (err, result) => {
                                                                            if (err) {
                                                                              console.error(
                                                                                "Error updating data QC:",
                                                                                err
                                                                              );
                                                                              return res.status(500).json({
                                                                                status: false,
                                                                                message:
                                                                                  "An error occurred while updating data QC. Please try again.",
                                                                                token: newToken,
                                                                              });
                                                                            }
                                                                            if (send_mail == 0) {
                                                                              console.log(`Step 31`);

                                                                              return res
                                                                                .status(200)
                                                                                .json({
                                                                                  status: true,
                                                                                  message: `CMT Application ${currentCMTApplication &&
                                                                                    Object.keys(
                                                                                      currentCMTApplication
                                                                                    ).length > 0
                                                                                    ? "updated"
                                                                                    : "created"
                                                                                    } successfully`,
                                                                                  email_status: 1,
                                                                                  token: newToken,
                                                                                });
                                                                            }
                                                                            const today =
                                                                              new Date();
                                                                            const formattedDate = `${today.getFullYear()}-${String(
                                                                              today.getMonth() + 1
                                                                            ).padStart(
                                                                              2,
                                                                              "0"
                                                                            )}-${String(
                                                                              today.getDate()
                                                                            ).padStart(2, "0")}`;


                                                                            const toFinalReportEmails = [
                                                                              { name: 'Bgv Team', email: 'bgv@screeningstar.com' },
                                                                              { name: 'Manjunath', email: ' manjunath@screeningstar.com' }
                                                                            ];
                                                                            // Send email notification
                                                                            finalReportMail(
                                                                              "cmt",
                                                                              "final",
                                                                              company_name,
                                                                              gender_title,
                                                                              application.name,
                                                                              application.application_id,
                                                                              case_initiated_date,
                                                                              final_report_date,
                                                                              report_type,
                                                                              mainJson.overall_status,
                                                                              application.final_verification_status,
                                                                              newAttachments,
                                                                              toArr,
                                                                              finalCcEmails
                                                                            )
                                                                              .then(() => {
                                                                                console.log(
                                                                                  `Step 32`
                                                                                );

                                                                                return res
                                                                                  .status(200)
                                                                                  .json({
                                                                                    status: true,
                                                                                    message: `CMT Application ${currentCMTApplication &&
                                                                                      Object.keys(
                                                                                        currentCMTApplication
                                                                                      ).length > 0
                                                                                      ? "updated"
                                                                                      : "created"
                                                                                      } successfully and mail sent.`,
                                                                                    token: newToken,
                                                                                  });
                                                                              })
                                                                              .catch(
                                                                                (emailError) => {
                                                                                  console.error(
                                                                                    "Error sending email 1:",
                                                                                    emailError
                                                                                  );
                                                                                  console.log(
                                                                                    `Step 33`
                                                                                  );

                                                                                  return res
                                                                                    .status(200)
                                                                                    .json({
                                                                                      status: true,
                                                                                      message: `CMT Application ${currentCMTApplication &&
                                                                                        Object.keys(
                                                                                          currentCMTApplication
                                                                                        ).length > 0
                                                                                        ? "updated"
                                                                                        : "created"
                                                                                        } successfully but failed to send mail.`,
                                                                                      token:
                                                                                        newToken,
                                                                                    });
                                                                                }
                                                                              );
                                                                          });
                                                                      } else if (
                                                                        verified === "no"
                                                                      ) {
                                                                        console.log(`Step 34`);

                                                                        ClientMasterTrackerModel.updateReportCompletedStatus(
                                                                          {
                                                                            is_report_completed: 0,
                                                                            report_completed_at: null,
                                                                            application_id: application_id
                                                                          },
                                                                          async (err, result) => {
                                                                            if (err) {
                                                                              console.error(
                                                                                "Error updating data QC:",
                                                                                err
                                                                              );
                                                                              return res.status(500).json({
                                                                                status: false,
                                                                                message:
                                                                                  "An error occurred while updating data QC. Please try again.",
                                                                                token: newToken,
                                                                              });
                                                                            }
                                                                            if (send_mail == 0) {
                                                                              console.log(`Step 35`);

                                                                              return res
                                                                                .status(200)
                                                                                .json({
                                                                                  status: true,
                                                                                  message: `CMT Application ${currentCMTApplication &&
                                                                                    Object.keys(
                                                                                      currentCMTApplication
                                                                                    ).length > 0
                                                                                    ? "updated"
                                                                                    : "created"
                                                                                    } successfully`,
                                                                                  email_status: 2,
                                                                                  token: newToken,
                                                                                });
                                                                            }
                                                                            qcReportCheckMail(
                                                                              "cmt",
                                                                              "qc",
                                                                              gender_title,
                                                                              application.name,
                                                                              application.application_id,
                                                                              newAttachments,
                                                                              toQCTeam,
                                                                              []
                                                                            )
                                                                              .then(() => {
                                                                                console.log(`Step 36`);

                                                                                return res
                                                                                  .status(200)
                                                                                  .json({
                                                                                    status: true,
                                                                                    message: `CMT Application ${currentCMTApplication &&
                                                                                      Object.keys(
                                                                                        currentCMTApplication
                                                                                      ).length > 0
                                                                                      ? "updated"
                                                                                      : "created"
                                                                                      } successfully and mail sent.`,
                                                                                    token: newToken,
                                                                                  });
                                                                              })
                                                                              .catch((emailError) => {
                                                                                console.error(
                                                                                  "Error sending email 2:",
                                                                                  emailError
                                                                                );
                                                                                console.log(`Step 37`);

                                                                                return res
                                                                                  .status(200)
                                                                                  .json({
                                                                                    status: true,
                                                                                    message: `CMT Application ${currentCMTApplication &&
                                                                                      Object.keys(
                                                                                        currentCMTApplication
                                                                                      ).length > 0
                                                                                      ? "updated"
                                                                                      : "created"
                                                                                      } successfully but failed to send mail.`,
                                                                                    token: newToken,
                                                                                  });
                                                                              });
                                                                            console.log(`Step 38`);
                                                                          });
                                                                      } else {
                                                                        ClientMasterTrackerModel.updateReportCompletedStatus(
                                                                          {
                                                                            is_report_completed: 0,
                                                                            report_completed_at: null,
                                                                            application_id: application_id
                                                                          },
                                                                          async (err, result) => {
                                                                            if (err) {
                                                                              console.error(
                                                                                "Error updating data QC:",
                                                                                err
                                                                              );
                                                                              return res.status(500).json({
                                                                                status: false,
                                                                                message:
                                                                                  "An error occurred while updating data QC. Please try again.",
                                                                                token: newToken,
                                                                              });
                                                                            }
                                                                            console.log(`Step 39`);

                                                                            return res
                                                                              .status(200)
                                                                              .json({
                                                                                status: true,
                                                                                message: `CMT Application ${currentCMTApplication &&
                                                                                  Object.keys(
                                                                                    currentCMTApplication
                                                                                  ).length > 0
                                                                                  ? "updated"
                                                                                  : "created"
                                                                                  } successfully.`,
                                                                                token: newToken,
                                                                              });
                                                                          });

                                                                      }
                                                                    });
                                                                } else {
                                                                  ClientMasterTrackerModel.updateReportCompletedStatus(
                                                                    {
                                                                      is_report_completed: 0,
                                                                      report_completed_at: null,
                                                                      application_id: application_id
                                                                    },
                                                                    async (err, result) => {
                                                                      if (err) {
                                                                        console.error(
                                                                          "Error updating data QC:",
                                                                          err
                                                                        );
                                                                        return res.status(500).json({
                                                                          status: false,
                                                                          message:
                                                                            "An error occurred while updating data QC. Please try again.",
                                                                          token: newToken,
                                                                        });
                                                                      }
                                                                      console.log(`Step 40`);

                                                                      const completeStatusArr = [
                                                                        "completed",
                                                                        "completed_green",
                                                                        "completed_red",
                                                                        "completed_yellow",
                                                                        "completed_pink",
                                                                        "completed_orange",
                                                                      ];

                                                                      let allMatch = true;

                                                                      // Loop through the annexure object
                                                                      for (let key in annexure) {
                                                                        const db_table =
                                                                          key ?? null;
                                                                        const modifiedDbTable =
                                                                          db_table.replace(
                                                                            /-/g,
                                                                            "_"
                                                                          );
                                                                        const subJson =
                                                                          annexure[
                                                                          modifiedDbTable
                                                                          ] ?? null;

                                                                        if (subJson) {
                                                                          for (let prop in subJson) {
                                                                            if (
                                                                              prop.startsWith(
                                                                                "color_status"
                                                                              )
                                                                            ) {
                                                                              const colorStatusValue =
                                                                                typeof subJson[
                                                                                  prop
                                                                                ] === "string"
                                                                                  ? subJson[
                                                                                    prop
                                                                                  ].toLowerCase()
                                                                                  : null;

                                                                              if (
                                                                                !completeStatusArr.includes(
                                                                                  colorStatusValue
                                                                                )
                                                                              ) {
                                                                                allMatch = false;
                                                                                break;
                                                                              }
                                                                            }
                                                                          }
                                                                        } else {
                                                                          allMatch = false;
                                                                          break;
                                                                        }
                                                                      }
                                                                      console.log(`Step 41`);

                                                                      // Log the overall result
                                                                      if (allMatch) {
                                                                        console.log(`Step 42`);

                                                                        if (send_mail === 0 || mainJson.overall_status.toLowerCase() !== 'completed') {
                                                                          console.log(`Step 43`);

                                                                          return res
                                                                            .status(200)
                                                                            .json({
                                                                              status: true,
                                                                              message: `CMT Application ${currentCMTApplication &&
                                                                                Object.keys(
                                                                                  currentCMTApplication
                                                                                ).length > 0
                                                                                ? "updated"
                                                                                : "created"
                                                                                } successfully`,
                                                                              email_status: 2,
                                                                              token: newToken,
                                                                            });
                                                                        }
                                                                        const toReadyForReportEmails = [
                                                                          { name: 'BGV Team', email: 'bgv@screeningstar.com' },
                                                                          { name: 'Manjunath', email: ' manjunath@screeningstar.com' }
                                                                        ];

                                                                        const toReadyForReportCCEmails = [
                                                                          { name: 'QC Team', email: 'qc@screeningstar.com' }
                                                                        ];

                                                                        readyForReport(
                                                                          "cmt",
                                                                          "ready",
                                                                          application.application_id,
                                                                          application.name,
                                                                          mainJson.overall_status
                                                                            .length < 4
                                                                            ? mainJson.overall_status
                                                                              .toUpperCase()
                                                                              .replace(
                                                                                /[^a-zA-Z0-9]/g,
                                                                                " "
                                                                              )
                                                                            : mainJson.overall_status
                                                                              .replace(
                                                                                /[^a-zA-Z0-9\s]/g,
                                                                                " "
                                                                              )
                                                                              .replace(
                                                                                /\b\w/g,
                                                                                (char) =>
                                                                                  char.toUpperCase()
                                                                              ),
                                                                          toReadyForReportEmails,
                                                                          toReadyForReportCCEmails
                                                                        )
                                                                          .then(() => {
                                                                            console.log(`Step 44`);

                                                                            return res
                                                                              .status(200)
                                                                              .json({
                                                                                status: true,
                                                                                message: `CMT Application ${currentCMTApplication &&
                                                                                  Object.keys(
                                                                                    currentCMTApplication
                                                                                  ).length > 0
                                                                                  ? "updated"
                                                                                  : "created"
                                                                                  } successfully and mail sent.`,
                                                                                token: newToken,
                                                                              });
                                                                          })
                                                                          .catch((emailError) => {
                                                                            console.log(`Step 45`);

                                                                            console.error(
                                                                              "Error sending email 3:",
                                                                              emailError
                                                                            );

                                                                            return res
                                                                              .status(200)
                                                                              .json({
                                                                                status: true,
                                                                                message: `CMT Application ${currentCMTApplication &&
                                                                                  Object.keys(
                                                                                    currentCMTApplication
                                                                                  ).length > 0
                                                                                  ? "updated"
                                                                                  : "created"
                                                                                  } successfully but failed to send mail.`,
                                                                                token: newToken,
                                                                              });
                                                                          });
                                                                      } else {
                                                                        console.log(`Step 46`);

                                                                        return res
                                                                          .status(200)
                                                                          .json({
                                                                            status: true,
                                                                            message: `CMT Application ${currentCMTApplication &&
                                                                              Object.keys(
                                                                                currentCMTApplication
                                                                              ).length > 0
                                                                              ? "updated"
                                                                              : "created"
                                                                              } successfully.`,
                                                                            token: newToken,
                                                                          });
                                                                      }
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
                                              }
                                            );
                                          }
                                        );
                                      })
                                      .catch((error) => {
                                        return res.status(500).json({
                                          status: false,
                                          message: error,
                                          token: newToken,
                                        });
                                      });
                                  } else {
                                    ClientMasterTrackerModel.updateDataQC(
                                      { application_id, data_qc },
                                      (err, result) => {
                                        if (err) {
                                          console.error("Error updating data QC:", err);
                                          return res.status(500).json({
                                            status: false,
                                            message:
                                              "An error occurred while updating data QC. Please try again.",
                                            token: newToken,
                                          });
                                        }
                                        // If there are no annexures, send the response directly
                                        return res.status(200).json({
                                          status: true,
                                          message: `CMT Application ${currentCMTApplication &&
                                            Object.keys(currentCMTApplication).length > 0
                                            ? "updated"
                                            : "created"
                                            } successfully.`,
                                          token: newToken,
                                        });
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
            });
          });
        });
    });

  });
};
// ─────────────────────────────────────────────────────────────
// 1.  VALUEPITCH
// ─────────────────────────────────────────────────────────────
exports.submitValuePitch = (req, res) => {
  console.log("🚀 API HIT: submitValuePitch");

  const { ipAddress, ipType } = getClientIpAddress(req);
  console.log("🌐 IP Info:", { ipAddress, ipType });

  const {
    admin_id,
    _token,
    branch_id,
    customer_id,
    application_id,
    annexure,
    service_id,
    db_table,
  } = req.body;

  console.log("📥 Request Body:", req.body);

  // ── required field check ──────────────────────────────────
  const requiredFields = { admin_id, _token, branch_id, customer_id, application_id, annexure, service_id, db_table };
  const missingFields = Object.keys(requiredFields)
    .filter((f) => !requiredFields[f] || requiredFields[f] === "")
    .map((f) => f.replace(/_/g, " "));

  if (missingFields.length > 0) {
    console.log("❌ Missing Fields:", missingFields);
    return res.status(400).json({ status: false, message: `Missing required fields: ${missingFields.join(", ")}` });
  }

  const action = "admin_manager";

  console.log("🔐 Checking admin authorization...");
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (AuthResult) => {
    console.log("🔐 Auth Result:", AuthResult);

    if (!AuthResult.status) {
      console.log("❌ Unauthorized Admin");
      return res.status(403).json({ status: false, message: AuthResult.message });
    }

    console.log("🔑 Validating token...");
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, TokenResult) => {
      if (err) {
        console.error("❌ Token Error:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      console.log("🔑 Token Result:", TokenResult);

      if (!TokenResult.status) {
        console.log("❌ Invalid Token");
        return res.status(401).json({ status: false, message: TokenResult.message });
      }

      const newToken = TokenResult.newToken;

      const modifiedDbTable = db_table.replace(/-/g, "_").toLowerCase();
      console.log("📊 Modified DB Table:", modifiedDbTable);

      const subJson = annexure[modifiedDbTable] ?? annexure ?? null;
      console.log("📊 Extracted subJson:", subJson);

      if (!subJson) {
        console.log("❌ Annexure missing");
        return res.status(400).json({ status: false, message: "annexure data is missing or malformed.", token: newToken });
      }

      console.log("🔎 Fetching service...");
      Service.getServiceById(service_id, async (err, serviceData) => {
        if (err) {
          console.error("❌ Service Error:", err);
          return res.status(500).json({ status: false, message: err.message, token: newToken });
        }

        console.log("📦 Service Data:", serviceData);

        if (!serviceData) {
          console.log("❌ Service not found");
          return res.status(404).json({ status: false, message: `Service not found for ID ${service_id}`, token: newToken });
        }

        const serviceType = serviceData.service_type?.trim().toLowerCase() ?? "";
        const types = serviceType.split(",").map((t) => t.trim());

        console.log("📦 Service Types:", types);

        if (!types.includes("valuepitch")) {
          console.log("❌ Not a ValuePitch service");
          return res.status(400).json({ status: false, message: "This service is not of type 'valuepitch'.", token: newToken });
        }

        console.log("📄 Fetching CMT Application...");
        ClientMasterTrackerModel.getCMTApplicationById(application_id, async (err, currentCMTApplication) => {
          if (err) {
            console.error("❌ CMT Error:", err);
            return res.status(500).json({ status: false, message: err.message, token: newToken });
          }

          console.log("📄 CMT Application:", currentCMTApplication);

          console.log("📄 Fetching Client Application...");
          ClientApplication.getClientApplicationById(application_id, async (err, currentClientApplication) => {
            if (err) {
              console.error("❌ Client App Error:", err);
              return res.status(500).json({ status: false, message: err.message, token: newToken });
            }

            console.log("📄 Client Application:", currentClientApplication);

            if (!currentClientApplication) {
              console.log("❌ Client Application not found");
              return res.status(404).json({ status: false, message: "Client Application not found.", token: newToken });
            }

            try {
              console.log("📊 Fetching Annexure...");
              const currentCMTAnnexure = await new Promise((resolve, reject) => {
                ClientMasterTrackerModel.getCMTAnnexureByApplicationId(
                  application_id, modifiedDbTable,
                  (err, data) => err ? reject(err) : resolve(data)
                );
              });

              console.log("📊 Current Annexure:", currentCMTAnnexure);

              const logStatus = currentCMTApplication && Object.keys(currentCMTApplication).length > 0 ? "update" : "create";
              const cmt_id = logStatus === "update" ? currentCMTApplication.id : null;

              console.log("📊 Log Status:", logStatus, "CMT ID:", cmt_id);

              console.log("💾 Saving Annexure...");
              const annexureResult = await new Promise((resolve, reject) => {
                ClientMasterTrackerModel.createOrUpdateAnnexure(
                  cmt_id, application_id, branch_id, customer_id,
                  modifiedDbTable, subJson, types,
                  (err, result) => err ? reject(err) : resolve(result)
                );
              }); const {
                name_of_applicant,
                father_name,
                dob,
                applicantId,
                addresses
              } = req.body;

              console.log("💾 Annexure Saved:", annexureResult);

              console.log("🔐 Generating ValuePitch Token...");
              const valuePitchToken = await generateValuePitchToken();

              console.log("🔐 ValuePitch Token:", valuePitchToken);

              if (!valuePitchToken.status) {
                console.log("❌ Token generation failed");
                return res.status(500).json({ status: false, message: "Failed to generate ValuePitch token.", token: newToken });
              }

              console.log("📦 Building payload...");
              const tableSuffix = modifiedDbTable;

              const getValue = (keys) => {
                for (const key of keys) {
                  if (subJson[key]) return subJson[key];
                  if (subJson[`${key}_${tableSuffix}`]) return subJson[`${key}_${tableSuffix}`];
                }
                return null;
              };

              const payload = {
                name: name_of_applicant || getValue(["name", "name_of_the_applicant"]),
                applicantId: applicantId || getValue(["application_id"]),
                dob: dob || getValue(["dob"]),
                fatherName: father_name || getValue(["father_name"]),
                addresses: addresses || getValue(["addresses"]),

              };

              console.log("📦 Payload:", payload);

              console.log("🚀 Calling ValuePitch API...");
              const addCaseResult = await addValuePitchCase(payload);
              let savedValuePitchResponse = null;

              console.log("🚀 API Response:", addCaseResult);

              if (addCaseResult?.data?.verifyId) {
                savedValuePitchResponse = {
                  ...addCaseResult.data,
                  valuePitchStatus: addCaseResult.data,
                  valuePitchReport: null,
                  valuePitchLastCheckedAt: new Date().toISOString()
                };
                console.log("💾 Saving verifyId...");
                await saveValuePitchStatus({
                  service_id,
                  application_id: currentClientApplication.id,
                  verifyId: addCaseResult.data.verifyId,
                  response: savedValuePitchResponse,
                });

                setImmediate(() => {
                  runValuePitchReadyPoll().catch((pollError) => {
                    console.error("ValuePitch immediate polling failed:", pollError?.message || pollError);
                  });
                });
              }

              console.log("✅ SUCCESS");
              return res.status(200).json({
                status: true,
                message: "ValuePitch annexure submitted successfully.",
                verifyId: addCaseResult?.data?.verifyId ?? null,
                valuePitchStatus: savedValuePitchResponse?.valuePitchStatus || addCaseResult?.data || null,
                valuePitchReport: savedValuePitchResponse?.valuePitchReport || null,
                screeningstar_response: savedValuePitchResponse || addCaseResult?.data || null,
                token: newToken,
              });

            } catch (error) {
              console.error("🔥 FINAL ERROR:", error);
              return res.status(500).json({ status: false, message: error.message ?? "Internal server error", token: newToken });
            }
          });
        });
      });
    });
  });
};


// ─────────────────────────────────────────────────────────────
// 2.  SUREPASS
// ─────────────────────────────────────────────────────────────
exports.submitSurepass = async (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    admin_id,
    _token,
    branch_id,
    customer_id,
    application_id,
    annexure,
    service_id,
    db_table,
  } = req.body;

  const requiredFields = { admin_id, _token, branch_id, customer_id, application_id, annexure, service_id, db_table };
  const missingFields = Object.keys(requiredFields)
    .filter((f) => !requiredFields[f] || requiredFields[f] === "")
    .map((f) => f.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({ status: false, message: `Missing required fields: ${missingFields.join(", ")}` });
  }

  const action = "admin_manager";

  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (AuthResult) => {
    if (!AuthResult.status) return res.status(403).json({ status: false, message: AuthResult.message });

    AdminCommon.isAdminTokenValid(_token, admin_id, async (err, TokenResult) => {
      if (err) return res.status(500).json({ status: false, message: err.message });
      if (!TokenResult.status) return res.status(401).json({ status: false, message: TokenResult.message });

      const newToken = TokenResult.newToken;
      const modifiedDbTable = db_table.replace(/-/g, "_").toLowerCase();
      const subJson = annexure[modifiedDbTable] ?? annexure ?? null;

      console.log("📦 modifiedDbTable:", modifiedDbTable);
      console.log("📦 subJson extracted from annexure:", JSON.stringify(subJson, null, 2));

      if (!subJson) {
        return res.status(400).json({ status: false, message: "annexure data is missing or malformed.", token: newToken });
      }

      // ✅ _ se start hone wale generic tables skip karo
      if (modifiedDbTable.startsWith("_")) {
        console.log("⏭️ Skipping generic db_table:", modifiedDbTable);
        return res.status(200).json({
          status: true,
          message: "Generic table — Surepass API skipped.",
          token: newToken,
        });
      }

      Service.getServiceById(service_id, (err, serviceData) => {
        if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
        if (!serviceData) return res.status(404).json({ status: false, message: `Service not found for ID ${service_id}`, token: newToken });

        const serviceType = serviceData.service_type?.trim().toLowerCase() ?? "";
        const types = serviceType.split(",").map((t) => t.trim());

        if (!types.includes("surepass")) {
          return res.status(400).json({ status: false, message: "This service is not of type 'surepass'.", token: newToken });
        }

        ClientMasterTrackerModel.getCMTApplicationById(application_id, (err, currentCMTApplication) => {
          if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });

          const logStatus = currentCMTApplication && Object.keys(currentCMTApplication).length > 0 ? "update" : "create";
          const cmt_id = logStatus === "update" ? currentCMTApplication.id : null;

          ClientMasterTrackerModel.getCMTAnnexureByApplicationId(
            application_id, modifiedDbTable,
            async (err, currentCMTAnnexure) => {
              if (err) {
                console.error("DB error during CMT Annexure retrieval:", err);
                return res.status(500).json({ status: false, message: err.message, token: newToken });
              }

              const annexureLogStatus = currentCMTAnnexure && Object.keys(currentCMTAnnexure).length > 0 ? "update" : "create";

              ClientMasterTrackerModel.createOrUpdateAnnexure(
                cmt_id, application_id, branch_id, customer_id,
                modifiedDbTable, subJson, types,
                async (err, annexureResult) => {
                  if (err) {
                    console.error("DB error during CMT annexure create/update:", err);
                    AdminCommon.adminActivityLog(
                      ipAddress, ipType, admin_id,
                      "CMT Annexure - Surepass", annexureLogStatus, "0",
                      JSON.stringify({ application_id, db_table: modifiedDbTable }), err, () => { }
                    );
                    return res.status(500).json({ status: false, message: err.message, token: newToken });
                  }

                  AdminCommon.adminActivityLog(
                    ipAddress, ipType, admin_id,
                    "CMT Annexure - Surepass", annexureLogStatus, "1",
                    JSON.stringify({ application_id, db_table: modifiedDbTable }), null, () => { }
                  );

                  // ✅ Surepass API call
                  console.log("🚀 Calling runSurepassService...");
                  console.log("➡️ service_name:", modifiedDbTable);
                  console.log("➡️ service_id:", service_id);
                  console.log("➡️ application_id:", application_id);
                  console.log("➡️ raw_data (subJson):", JSON.stringify(subJson, null, 2));

                  // ✅ DB se latest data fetch karo taaki suffixed fields bhi milein
                  let enrichedSubJson = subJson;
                  try {
                    const dbRow = await new Promise((resolve, reject) => {
                      ClientMasterTrackerModel.getCMTAnnexureByApplicationId(
                        application_id, modifiedDbTable,
                        (err, data) => err ? reject(err) : resolve(data)
                      );
                    });

                    if (dbRow && Object.keys(dbRow).length > 0) {
                      enrichedSubJson = { ...subJson, ...dbRow };
                      console.log("✅ enrichedSubJson from DB:", JSON.stringify(enrichedSubJson, null, 2));
                    }
                  } catch (fetchErr) {
                    console.warn("⚠️ Could not fetch DB row for enrichment:", fetchErr.message);
                  }

                  try {
                    const surepassResult = await runSurepassService({
                      service_name: modifiedDbTable,
                      service_id,
                      application_id,
                      raw_data: enrichedSubJson  // ✅ DB se aaya fresh data
                    });

                    console.log("✅ Surepass Result:", JSON.stringify(surepassResult, null, 2));

                    if (!surepassResult.status) {
                      return res.status(200).json({
                        status: true,
                        message: "Annexure saved but Surepass API call failed.",
                        surepass_error: surepassResult.message || surepassResult.error || null,
                        token: newToken,
                      });
                    }

                    const refreshedSurepass = await getServicesWithPrefill({
                      service_ids: [service_id],
                      application_id
                    });
                    const screeningstarResponse = refreshedSurepass?.data?.[0] || null;

                    return res.status(200).json({
                      status: true,
                      message: "Surepass annexure saved and API called successfully.",
                      surepass_response: surepassResult?.data || null,
                      screeningstar_response: screeningstarResponse,
                      token: newToken,
                    });

                  } catch (surepassErr) {
                    console.error("❌ Surepass runService exception:", surepassErr);
                    return res.status(200).json({
                      status: true,
                      message: "Annexure saved but Surepass execution threw an error.",
                      surepass_error: surepassErr.message,
                      token: newToken,
                    });
                  }
                }
              );
            }
          );
        });
      });
    });
  });
};

// ─────────────────────────────────────────────────────────────
// 3.  MANUAL
// ─────────────────────────────────────────────────────────────
exports.submitManual = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    admin_id,
    _token,
    branch_id,
    customer_id,
    application_id,
    annexure,
    service_id,
    db_table,
  } = req.body;

  const requiredFields = { admin_id, _token, branch_id, customer_id, application_id, annexure, service_id, db_table };
  const missingFields = Object.keys(requiredFields)
    .filter((f) => !requiredFields[f] || requiredFields[f] === "")
    .map((f) => f.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({ status: false, message: `Missing required fields: ${missingFields.join(", ")}` });
  }

  const action = "admin_manager";

  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (AuthResult) => {
    if (!AuthResult.status) return res.status(403).json({ status: false, message: AuthResult.message });

    AdminCommon.isAdminTokenValid(_token, admin_id, (err, TokenResult) => {
      if (err) return res.status(500).json({ status: false, message: err.message });
      if (!TokenResult.status) return res.status(401).json({ status: false, message: TokenResult.message });

      const newToken = TokenResult.newToken;
      const modifiedDbTable = db_table.replace(/-/g, "_").toLowerCase();
      const subJson = annexure[modifiedDbTable] ?? annexure ?? null;

      if (!subJson) {
        return res.status(400).json({ status: false, message: "annexure data is missing or malformed.", token: newToken });
      }

      Service.getServiceById(service_id, (err, serviceData) => {
        if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
        if (!serviceData) return res.status(404).json({ status: false, message: `Service not found for ID ${service_id}`, token: newToken });

        const serviceType = serviceData.service_type?.trim().toLowerCase() ?? "";
        const types = serviceType.split(",").map((t) => t.trim());

        if (!types.includes("manual")) {
          return res.status(400).json({ status: false, message: "This service is not of type 'manual'.", token: newToken });
        }

        ClientMasterTrackerModel.getCMTApplicationById(application_id, (err, currentCMTApplication) => {
          if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });

          const logStatus = currentCMTApplication && Object.keys(currentCMTApplication).length > 0 ? "update" : "create";
          const cmt_id = logStatus === "update" ? currentCMTApplication.id : null;

          ClientMasterTrackerModel.getCMTAnnexureByApplicationId(
            application_id, modifiedDbTable,
            (err, currentCMTAnnexure) => {
              if (err) {
                console.error("DB error during CMT Annexure retrieval:", err);
                return res.status(500).json({ status: false, message: err.message, token: newToken });
              }

              const annexureLogStatus = currentCMTAnnexure && Object.keys(currentCMTAnnexure).length > 0 ? "update" : "create";

              ClientMasterTrackerModel.createOrUpdateAnnexure(
                cmt_id, application_id, branch_id, customer_id,
                modifiedDbTable, subJson, types,
                (err, annexureResult) => {
                  if (err) {
                    console.error("DB error during CMT annexure create/update:", err);
                    AdminCommon.adminActivityLog(
                      ipAddress, ipType, admin_id,
                      "CMT Annexure - Manual", annexureLogStatus, "0",
                      JSON.stringify({ application_id, db_table: modifiedDbTable }), err, () => { }
                    );
                    return res.status(500).json({ status: false, message: err.message, token: newToken });
                  }

                  AdminCommon.adminActivityLog(
                    ipAddress, ipType, admin_id,
                    "CMT Annexure - Manual", annexureLogStatus, "1",
                    JSON.stringify({ application_id, db_table: modifiedDbTable }), null, () => { }
                  );

                  return res.status(200).json({
                    status: true,
                    message: "Manual annexure saved successfully.",
                    token: newToken,
                  });
                }
              );
            }
          );
        });
      });
    });
  });
};
// {
//   "admin_id": "...",
//   "_token": "...",
//   "branch_id": "...",
//   "customer_id": "...",
//   "application_id": "...",
//   "service_id": "...",
//   "db_table": "online_court_records_ca",
//   "annexure": {
//     "online_court_records_ca": { ...subJson data... }
//   }
// }
exports.customerBasicInfoWithAdminAuth = (req, res) => {
  const { customer_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !customer_id ||
    customer_id === "" ||
    customer_id === undefined ||
    customer_id === "undefined"
  )
    missingFields.push("Customer ID");
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

  const action = "admin_manager";
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
          token: newToken,
        });
      });
    });
  });
};

exports.annexureDataByServiceIdofApplication = (req, res) => {
  const { service_id, application_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !service_id ||
    service_id === "" ||
    service_id === undefined ||
    service_id === "undefined"
  ) {
    missingFields.push("Service ID");
  }

  if (
    !application_id ||
    application_id === "" ||
    application_id === undefined ||
    application_id === "undefined"
  ) {
    missingFields.push("Application ID");
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

  const action = "admin_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
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

      ClientMasterTrackerModel.reportFormJsonByServiceID(
        service_id,
        (err, reportFormJson) => {
          if (err) {
            console.error("Error fetching report form JSON:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          if (!reportFormJson) {
            return res.status(404).json({
              status: false,
              message: "Report form JSON not found",
              token: newToken,
            });
          }

          const parsedData = JSON.parse(reportFormJson.json);
          const db_table = parsedData.db_table;
          const heading = parsedData.heading;
          const modifiedDbTable = db_table.replace(/-/g, "_");

          ClientMasterTrackerModel.annexureData(
            application_id,
            modifiedDbTable,
            (err, annexureData) => {
              if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                  status: false,
                  message: "An error occurred while fetching annexure data.",
                  error: err,
                  token: newToken,
                });
              }

              if (!annexureData) {
                return res.status(404).json({
                  status: false,
                  message: "Annexure Data not found.",
                  token: newToken,
                });
              }

              res.status(200).json({
                status: true,
                message: "Application fetched successfully 5.",
                annexureData,
                heading,
                token: newToken,
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
      console.error("Multer error:", err);
      return res.status(400).json({
        status: false,
        message: "Error uploading file.",
      });
    }

    const {
      admin_id: adminId,
      branch_id: branchId,
      _token: token,
      customer_code: customerCode,
      application_id: appId,
      application_code: appCode,
      db_table: dbTable,
      db_column: dbColumn,
      send_mail: sendMail,
      email_status: emailStatus,
    } = req.body;

    // Validate required fields and collect missing ones
    const requiredFields = {
      adminId,
      branchId,
      token,
      customerCode,
      appCode,
      appId,
      dbTable,
      dbColumn,
    };

    const cleanDBColumn = dbColumn.replace("[", "").replace("]", "");
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

    if (sendMail == 1 && !emailStatus) {
      console.warn("Email status required when sending mail");
      return res.status(400).json({
        status: false,
        message: "The field 'emailStatus' is required when sending an email.",
      });
    }

    const action = "admin_manager";
    AdminCommon.isAdminAuthorizedForAction(adminId, action, (result) => {
      if (!result.status) {
        return res.status(403).json({
          status: false,
          message: result.message, // Return the message from the authorization function
        });
      }

      // Verify admin token
      AdminCommon.isAdminTokenValid(token, adminId, async (err, result) => {
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
          const targetDirectory = `uploads/customer/${customerCode}/application/${appCode}/${dbTable}`;
          // Create the target directory for uploads
          await fs.promises.mkdir(targetDirectory, { recursive: true });

          let savedImagePaths = [];

          if (req.files.images && req.files.images.length > 0) {
            const uploadedImages = await saveImages(
              req.files.images,
              targetDirectory
            );
            uploadedImages.forEach((imagePath) => {
              savedImagePaths.push(`${imageHost}/${imagePath}`);
            });
          }

          // Process single file upload
          if (req.files.image && req.files.image.length > 0) {
            const uploadedImage = await saveImage(
              req.files.image[0],
              targetDirectory
            );
            savedImagePaths.push(`${imageHost}/${uploadedImage}`);
          }

          const modifiedDbTable = dbTable.replace(/-/g, "_").toLowerCase();
          const cleanDBColumnForQry = cleanDBColumn
            .replace(/-/g, "_")
            .toLowerCase();

          // Call the model to upload images
          ClientMasterTrackerModel.upload(
            appId,
            modifiedDbTable,
            cleanDBColumnForQry,
            savedImagePaths,
            (success, result) => {
              if (!success) {
                console.error(
                  "Upload failed:",
                  result || "An error occurred while saving the image."
                );
                return res.status(500).json({
                  status: false,
                  message:
                    result || "An error occurred while saving the image.",
                  token: newToken,
                  savedImagePaths,
                });
              }

              // Handle sending email notifications if required
              if (sendMail == 1) {
                BranchCommon.getBranchandCustomerEmailsForNotification(
                  branchId,
                  (emailError, emailData) => {
                    if (emailError) {
                      console.error("Error fetching emails:", emailError);
                      return res.status(500).json({
                        status: false,
                        message: "Failed to retrieve email addresses.",
                        token: newToken,
                        savedImagePaths,
                      });
                    }

                    const { branch, customer } = emailData;
                    const companyName = customer.name;

                    // Prepare recipient and CC lists
                    const toArr = [{ name: branch.name, email: branch.email }];
                    const ccArr = JSON.parse(customer.emails).map((email) => ({
                      name: customer.name,
                      email: email.trim(),
                    }));

                    ClientMasterTrackerModel.applicationByID(
                      appId,
                      branchId,
                      (err, application) => {
                        if (err) {
                          console.error("Database error:", err);
                          return res.status(500).json({
                            status: false,
                            message: err.message,
                            token: newToken,
                            savedImagePaths,
                          });
                        }

                        if (!application) {
                          console.warn("Application not found 3");
                          return res.status(404).json({
                            status: false,
                            message: "Application not found 3",
                            token: newToken,
                            savedImagePaths,
                          });
                        }

                        if (application.is_data_qc !== 1) {
                          console.warn("Application Data QC is not done yet 3");
                          return res.status(404).json({
                            status: false,
                            message: "Data QC for application data is pending.",
                            token: newToken,
                            savedImagePaths,
                          });
                        }

                        ClientMasterTrackerModel.getAttachmentsByClientAppID(
                          appId,
                          (err, attachments) => {
                            if (err) {
                              console.error(
                                "Database error while fetching attachments:",
                                err
                              );
                              return res.status(500).json({
                                status: false,
                                message: "Database error occurred",
                                token: newToken,
                                savedImagePaths,
                              });
                            }

                            ClientMasterTrackerModel.getCMTApplicationById(
                              appId,
                              async (err, CMTApplicationData) => {
                                if (err) {
                                  console.error("Database error:", err);
                                  return res.status(500).json({
                                    status: false,
                                    message: err.message,
                                    token: newToken,
                                  });
                                }

                                const case_initiated_date =
                                  CMTApplicationData.initiation_date || "N/A";
                                const final_report_date =
                                  CMTApplicationData.report_date || "N/A";
                                const report_type =
                                  CMTApplicationData.report_type || "N/A";
                                const overall_status =
                                  CMTApplicationData.overall_status || "N/A";

                                const gender =
                                  application.gender?.toLowerCase();
                                const maritalStatus =
                                  application.marital_status?.toLowerCase();

                                let genderTitle = "Mr.";
                                if (gender === "male") {
                                  genderTitle = "Mr.";
                                } else if (gender === "female") {
                                  genderTitle =
                                    maritalStatus === "married"
                                      ? "Mrs."
                                      : "Ms.";
                                }

                                const today = new Date();
                                const formattedDate = `${today.getFullYear()}-${String(
                                  today.getMonth() + 1
                                ).padStart(2, "0")}-${String(
                                  today.getDate()
                                ).padStart(2, "0")}`;
                                const pdfTargetDirectory = `uploads/customers/${customerCode}/client-applications/${application.application_id}/final-reports`;
                                const pdfFileName =
                                  `${application.application_id}-${application.name}-${(application.employee_id?.trim() || "NA")}-${(report_type.replace(/_/g, " ").toUpperCase())}.pdf`
                                    .replace(/\s+/g, "-")
                                    .toLowerCase();

                                const pdfPath = await generatePDF(
                                  appId,
                                  branchId,
                                  pdfFileName,
                                  pdfTargetDirectory
                                );
                                attachments +=
                                  (attachments ? "," : "") +
                                  `${imageHost}/${pdfPath}`;

                                // Prepare and send email based on application status
                                // Final report email
                                if (emailStatus == 1) {
                                  const toFinalReportEmails = [
                                    { name: 'Bgv Team', email: 'bgv@screeningstar.com' },
                                    { name: 'Manjunath', email: ' manjunath@screeningstar.com' }
                                  ];

                                  const toFinalReportCCEmails = [
                                    { name: 'QC Team', email: 'qc@screeningstar.com' }
                                  ];
                                  finalReportMail(
                                    "cmt",
                                    "final",
                                    companyName,
                                    genderTitle,
                                    application.name,
                                    application.application_id,
                                    case_initiated_date,
                                    final_report_date,
                                    report_type,
                                    overall_status,
                                    application.final_verification_status,
                                    attachments,
                                    toFinalReportEmails,
                                    toFinalReportCCEmails
                                  )
                                    .then(() => {
                                      return res.status(200).json({
                                        status: true,
                                        message: "CMT Final Report mail sent.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    })
                                    .catch((emailError) => {
                                      console.error(
                                        "Error sending email for final report:",
                                        emailError
                                      );
                                      return res.status(200).json({
                                        status: true,
                                        message: "Failed to send CMT mail.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    });
                                }
                                // QC report email
                                else if (emailStatus == 2) {
                                  const toQCTeam = [
                                    { name: 'QC Team', email: 'qc@screeningstar.com' }
                                  ];
                                  qcReportCheckMail(
                                    "cmt",
                                    "qc",
                                    genderTitle,
                                    application.name,
                                    application.application_id,
                                    attachments,
                                    toQCTeam,
                                    []
                                  )
                                    .then(() => {
                                      return res.status(200).json({
                                        status: true,
                                        message:
                                          "CMT Quality Check Report mail sent.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    })
                                    .catch((emailError) => {
                                      console.error(
                                        "Error sending email for QC report:",
                                        emailError
                                      );
                                      return res.status(200).json({
                                        status: true,
                                        message: "Failed to send CMT mail.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    });
                                }
                                // Handling for other statuses
                                else if (emailStatus == 3) {

                                  const toReadyForReportEmails = [
                                    { name: 'BGV Team', email: 'bgv@screeningstar.com' },
                                    { name: 'Manjunath', email: ' manjunath@screeningstar.com' }
                                  ];
                                  const toReadyForReportCCEmails = [
                                    { name: 'QC Team', email: 'qc@screeningstar.com' }
                                  ];

                                  readyForReport(
                                    "cmt",
                                    "ready",
                                    application.application_id,
                                    toReadyForReportEmails,
                                    toReadyForReportCCEmails
                                  )
                                    .then(() => {
                                      return res.status(200).json({
                                        status: true,
                                        message: "Ready for Report mail sent.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    })
                                    .catch((emailError) => {
                                      console.error(
                                        "Error sending email for report:",
                                        emailError
                                      );
                                      return res.status(200).json({
                                        status: true,
                                        message: "Failed to send CMT mail.",
                                        token: newToken,
                                        savedImagePaths,
                                      });
                                    });
                                }
                                // Handle unknown email status
                                else {
                                  return res.status(200).json({
                                    status: true,
                                    message: "Images uploaded successfully.",
                                    token: newToken,
                                    savedImagePaths,
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
              } else {
                return res.status(200).json({
                  status: true,
                  message: "Images uploaded successfully.",
                  token: newToken,
                  savedImagePaths,
                });
              }
            }
          );
        });
      });
    });
  });
};

/*
exports.annexureDataByServiceIds = (req, res) => {
  const { service_ids, report_download, application_id, admin_id, _token } =
    req.query;

  let missingFields = [];
  if (
    !service_ids ||
    service_ids === "" ||
    service_ids === undefined ||
    service_ids === "undefined"
  ) {
    missingFields.push("Service ID");
  }

  if (
    !application_id ||
    application_id === "" ||
    application_id === undefined ||
    application_id === "undefined"
  ) {
    missingFields.push("Application ID");
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

  const action = "admin_manager";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message,
      });
    }
    Admin.fetchAllowedServiceIds(
      admin_id,
      async (err, allowedServiceIdsResult) => {
        if (err) {
          console.error("Error retrieving Admin:", err);
          return res.status(500).json({
            status: false,
            message: "Database error.",
          });
        }
        const allowedServiceIds = allowedServiceIdsResult.finalServiceIds;
        const addressServicesPermission =
          allowedServiceIdsResult.addressServicesPermission;

        // Verify admin token
        AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
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

          // Split service_id into an array
          const rawServiceIds = service_ids.split(",").map((id) => id.trim());
          // Check if allowedServiceIds is not null
          let serviceIds;
          if (allowedServiceIds && allowedServiceIds.length > 0) {
            // Filter serviceIds based on allowedServiceIds if it's not null
            serviceIds = rawServiceIds.filter(
              (serviceId) => allowedServiceIds.includes(Number(serviceId)) // Convert string to number
            );
          } else {
            // If allowedServiceIds is null, just pass serviceIds as raw
            serviceIds = rawServiceIds;
          }

          const annexureResults = [];
          let pendingRequests = serviceIds.length;

          if (pendingRequests === 0) {
            // No service IDs provided, return immediately.
            return res.status(200).json({
              status: true,
              message: "No service IDs to process.",
              results: annexureResults,
              addressServicesPermission,
              token: newToken,
            });
          }

          serviceIds.forEach((id) => {
            ClientMasterTrackerModel.reportFormJsonByServiceID(
              id,
              (err, reportFormJson) => {
                if (err) {
                  console.error(
                    `Error fetching report form JSON for service ID ${id}:`,
                    err
                  );
                  annexureResults.push({
                    service_id: id,
                    serviceStatus: false,
                    message: err.message,
                  });
                  finalizeRequest();
                  return;
                }

                if (!reportFormJson) {
                  console.warn(
                    `Report form JSON not found for service ID ${id}`
                  );
                  annexureResults.push({
                    service_id: id,
                    serviceStatus: false,
                    message: "Report form JSON not found",
                  });
                  finalizeRequest();
                  return;
                }

                const parsedData = JSON.parse(reportFormJson.json);
                const db_table = parsedData.db_table.replace(/-/g, "_");
                const heading = parsedData.heading;

                ClientMasterTrackerModel.annexureData(
                  application_id,
                  db_table,
                  (err, annexureData) => {
                    if (err) {
                      console.error(
                        `Error fetching annexure data for service ID ${id}:`,
                        err
                      );
                      annexureResults.push({
                        service_id: id,
                        annexureStatus: false,
                        annexureData: null,
                        serviceStatus: true,
                        reportFormJson,
                        message:
                          "An error occurred while fetching annexure data.",
                        error: err,
                      });
                    } else if (!annexureData) {
                      console.warn(
                        `Annexure data not found for service ID ${id}`
                      );
                      annexureResults.push({
                        service_id: id,
                        annexureStatus: false,
                        annexureData: null,
                        serviceStatus: true,
                        reportFormJson,
                        message: "Annexure Data not found.",
                      });
                    } else {
                      annexureResults.push({
                        service_id: id,
                        annexureStatus: true,
                        serviceStatus: true,
                        reportFormJson,
                        annexureData,
                        heading,
                      });
                    }
                    finalizeRequest();
                  }
                );
              }
            );
          });

          function finalizeRequest() {
            pendingRequests -= 1;
            if (pendingRequests === 0) {
              if (report_download == 1 || report_download == "1") {
                ClientMasterTrackerModel.updateReportDownloadStatus(
                  application_id,
                  (err) => {
                    if (err) {
                      return res.status(500).json({
                        message: "Error updating report download status",
                        error: err,
                        token: newToken,
                      });
                    }

                    return res.status(200).json({
                      status: true,
                      message: "Applications fetched successfully.",
                      results: annexureResults,
                      addressServicesPermission,
                      token: newToken,
                    });
                  }
                );
              } else {
                return res.status(200).json({
                  status: true,
                  message: "Applications fetched successfully.",
                  results: annexureResults,
                  addressServicesPermission,
                  token: newToken,
                });
              }
            }
          }
        });
      }
    );
  });
};
*/

exports.annexureDataByServiceIds = (req, res) => {
  const { service_ids, report_download, application_id, admin_id, _token } = req.query;

  if (!service_ids || !application_id || !admin_id || !_token) {
    return res.status(400).json({ status: false, message: "Missing required fields" });
  }

  AdminCommon.isAdminAuthorizedForAction(admin_id, "admin_manager", (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({ status: false, message: authResult.message });
    }

    Admin.fetchAllowedServiceIds(admin_id, async (err, allowedServiceIdsResult) => {
      if (err) return res.status(500).json({ status: false });

      const { finalServiceIds } = allowedServiceIdsResult;

      AdminCommon.isAdminTokenValid(_token, admin_id, async (err, tokenResult) => {
        if (err || !tokenResult.status) {
          return res.status(401).json({ status: false });
        }

        const rawServiceIds = service_ids.split(",").map(id => id.trim());

        const serviceIds = finalServiceIds?.length
          ? rawServiceIds.filter(id => finalServiceIds.includes(Number(id)))
          : rawServiceIds;

        const annexureResults = [];

        for (const serviceId of serviceIds) {

          const currentService = await new Promise((resolve) => {
            Service.getServiceById(serviceId, (err, data) => {
              resolve(data || null);
            });
          });

          const serviceTypeRaw = currentService?.service_type?.trim().toLowerCase() || "";
          const types = serviceTypeRaw.split(",").map(t => t.trim());

          const hasValuePitch = types.includes("valuepitch");
          const hasSurepass = types.includes("surepass");
          const hasManual = types.includes("manual");

          console.log("📊 Service Type:", serviceTypeRaw);

          // ================== FETCH FORM DATA ==================
          const result = await new Promise((resolve) => {
            ClientMasterTrackerModel.reportFormJsonWithannexureData(
              application_id,
              serviceId,
              (err, data) => {
                if (err) return resolve({ err });
                resolve({ data });
              }
            );
          });

          let screeningStarData = null;
          let valuePitchStatusData = null;
          let valuePitchReportData = null;

          // ================== VALUEPITCH ==================
          if (hasValuePitch) {
            console.log("🔥 VALUEPITCH FLOW");

            screeningStarData = await getValuePitchFromDB(serviceId, application_id);

            if (
              screeningStarData &&
              screeningStarData.status !== false &&
              screeningStarData.verifyId
            ) {
              console.log("⚡ Calling ValuePitch APIs");

              const [statusRes, reportRes] = await Promise.all([
                fetchValuePitchStatus({
                  verifyId: screeningStarData.verifyId,
                  service_id: serviceId,
                  application_id
                }),
                fetchValuePitchReportData({
                  verifyId: screeningStarData.verifyId,
                  service_id: serviceId,
                  application_id
                })
              ]);
              console.log("✅ ValuePitch API calls completed", screeningStarData);
              console.log("✅ ValuePitch Status Response:", statusRes);
              console.log("✅ ValuePitch Report Response:", reportRes);
              valuePitchStatusData = statusRes?.data || null;
              valuePitchReportData = reportRes?.data || null;

              await saveValuePitchStatus({
                service_id: serviceId,
                application_id,
                verifyId: screeningStarData.verifyId,
                response: {
                  ...screeningStarData,
                  ...(valuePitchStatusData || {}),
                  valuePitchStatus: valuePitchStatusData,
                  valuePitchReport: valuePitchReportData,
                  valuePitchLastCheckedAt: new Date().toISOString()
                }
              });

              screeningStarData = await getValuePitchFromDB(serviceId, application_id);
            } else {
              console.log("⛔ Skipping ValuePitch API call");
            }
          }

          // ================== SUREPASS ==================
          else if (hasSurepass) {
            console.log("🔥 SUREPASS FLOW");

            try {
              const surepassResult = await getServicesWithPrefill({
                service_ids: [serviceId],   // 👈 single service ke liye call
                application_id
              });

              if (surepassResult?.status && surepassResult.data?.length) {
                const sp = surepassResult.data[0];

                screeningStarData = {
                  ...sp,
                  service_id: sp.service_id,
                  status: sp.status,
                  is_prefilled: sp.is_prefilled,
                  request_json: sp.request_json,
                  response_json: sp.response_json,
                  surepass_status_label: sp.surepass_status_label,
                  surepass_result_rows: sp.surepass_result_rows
                };
              } else {
                screeningStarData = {
                  service_id: serviceId,
                  status: "data_not_found"
                };
              }

            } catch (err) {
              console.error("❌ Surepass Error:", err);

              screeningStarData = {
                service_id: serviceId,
                status: "error",
                message: err.message
              };
            }
          }

          // ================== MANUAL ==================
          else if (hasManual) {
            console.log("🔥 MANUAL FLOW");
            screeningStarData = null;
          }
          else {

            console.log("🔥 MANUAL FLOW");
            screeningStarData = null;

          }

          // ================== FINAL RESPONSE ==================
          if (result.err) {
            annexureResults.push({
              service_id: serviceId,
              service_type: serviceTypeRaw,
              screeningstar_response: screeningStarData,
              verifyId: screeningStarData?.verifyId || null,
              serviceStatus: false,
              valuePitchStatus: valuePitchStatusData,
              valuePitchReport: valuePitchReportData,
              message: result.err.message
            });
          } else {
            const { reportFormJson, annexureData } = result.data;

            annexureResults.push({
              service_id: serviceId,
              service_type: serviceTypeRaw,
              screeningstar_response: screeningStarData,
              verifyId: screeningStarData?.verifyId || null,
              serviceStatus: true,
              annexureStatus: true,
              valuePitchStatus: valuePitchStatusData,
              valuePitchReport: valuePitchReportData,
              reportFormJson,
              annexureData
            });
          }
        }

        return res.status(200).json({
          status: true,
          results: annexureResults,
          token: tokenResult.newToken
        });
      });
    });
  });
};

exports.valuePitchStatus = (req, res) => {
  const { admin_id, _token, verifyId, service_id, application_id } = req.query;

  if (!admin_id || !_token || !verifyId) {
    return res.status(400).json({
      status: false,
      message: "Missing required fields",
    });
  }

  AdminCommon.isAdminAuthorizedForAction(admin_id, "admin_manager", (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({ status: false, message: authResult.message });
    }

    AdminCommon.isAdminTokenValid(_token, admin_id, async (err, tokenResult) => {
      if (err || !tokenResult.status) {
        return res.status(401).json({ status: false, message: tokenResult?.message });
      }

      try {
        const result = await fetchValuePitchStatus({
          verifyId,
          service_id,
          application_id
        });

        return res.status(200).json({
          status: true,
          data: result.data,
          token: tokenResult.newToken
        });

      } catch (error) {
        return res.status(500).json({
          status: false,
          message: "Internal server error"
        });
      }
    });
  });
};
exports.valuePitchReportData = (req, res) => {
  const { admin_id, _token, verifyId, service_id, application_id } = req.query;

  if (!admin_id || !_token || !verifyId) {
    return res.status(400).json({
      status: false,
      message: "Missing required fields",
    });
  }

  AdminCommon.isAdminAuthorizedForAction(admin_id, "admin_manager", (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({ status: false, message: authResult.message });
    }

    AdminCommon.isAdminTokenValid(_token, admin_id, async (err, tokenResult) => {
      if (err || !tokenResult.status) {
        return res.status(401).json({ status: false, message: tokenResult?.message });
      }

      try {
        const result = await fetchValuePitchReportData({
          verifyId,
          service_id,
          application_id
        });

        return res.status(200).json({
          status: true,
          data: result.data,
          token: tokenResult.newToken
        });

      } catch (error) {
        return res.status(500).json({
          status: false,
          message: "Internal server error"
        });
      }
    });
  });
};
exports.surePassData = (req, res) => {
  const { admin_id, _token, service_ids, application_id } = req.query;

  // ✅ Common validation helper
  const requiredFields = { admin_id, _token, service_ids, application_id };

  for (const [key, value] of Object.entries(requiredFields)) {
    if (!value || value === "undefined" || value === "null") {
      return res.status(400).json({
        status: false,
        message: `Missing or invalid ${key}`,
      });
    }
  }

  // ✅ Convert service_ids to array safely
  let parsedServiceIds = [];

  try {
    if (typeof service_ids === "string") {
      if (service_ids.startsWith("[")) {
        parsedServiceIds = JSON.parse(service_ids);
      } else {
        parsedServiceIds = service_ids.split(",");
      }
    } else if (Array.isArray(service_ids)) {
      parsedServiceIds = service_ids;
    }

    // 🔥 ✅ CLEANING FIX (YAHI PAR LAGANA HAI)
    parsedServiceIds = parsedServiceIds
      .map(id => id.replace(/"/g, "").trim())
      .filter(Boolean);
    // remove empty values

  } catch (e) {
    return res.status(400).json({
      status: false,
      message: "Invalid format for service_ids"
    });
  }

  if (!parsedServiceIds.length) {
    return res.status(400).json({
      status: false,
      message: "service_ids cannot be empty"
    });
  }

  // 🔐 Authorization check
  AdminCommon.isAdminAuthorizedForAction(admin_id, "admin_manager", (authResult) => {
    if (!authResult?.status) {
      return res.status(403).json({
        status: false,
        message: authResult?.message || "Unauthorized access"
      });
    }

    // 🔐 Token validation
    AdminCommon.isAdminTokenValid(_token, admin_id, async (err, tokenResult) => {
      if (err || !tokenResult?.status) {
        return res.status(401).json({
          status: false,
          message: tokenResult?.message || "Invalid token"
        });
      }

      try {
        console.log("📥 surePassData API hit");
        console.log("➡️ Admin:", admin_id);
        console.log("➡️ Services:", parsedServiceIds);
        console.log("➡️ Application:", application_id);

        const result = await getServicesWithPrefill({
          service_ids: parsedServiceIds,
          application_id
        });

        // ✅ safe fallback
        if (!result || typeof result !== "object") {
          throw new Error("Invalid service response");
        }

        if (!result.status) {
          return res.status(200).json({
            status: false,
            message: result.message || "No data found",
            data: [],
            token: tokenResult.newToken
          });
        }

        return res.status(200).json({
          status: true,
          message: "Data fetched successfully",
          data: result.data || [],
          token: tokenResult.newToken
        });

      } catch (error) {
        console.error("❌ surePassData ERROR:", error);

        return res.status(500).json({
          status: false,
          message: "Internal server error",
          error: error.message
        });
      }
    });
  });
};




