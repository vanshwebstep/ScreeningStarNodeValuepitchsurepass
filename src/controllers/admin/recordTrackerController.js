const crypto = require("crypto");
const recordTrackerModel = require("../../models/admin/recordTrackerModel");
const AdminCommon = require("../../models/admin/commonModel");
const AppModel = require("../../models/appModel");
const Service = require("../../models/admin/serviceModel");

function calculateServiceStats(serviceNames, applications, services) {
  const serviceStats = {};
  const allServiceIds = [];
  const servicesToAllocate = [];

  applications.forEach((application) => {
    application.applications.forEach((app) => {
      const serviceIds = app.services.split(",");

      serviceIds.forEach((serviceId) => {
        const id = parseInt(serviceId, 10);
        allServiceIds.push(id);

        // Iterate through each group of services and find the matching service ID
        let serviceExists = false;
        let matchedService = null;
        services.forEach((group) => {
          const service = group.services.find((s) => s.serviceId === id);
          if (service) {
            serviceExists = true;
            matchedService = service;
          }
        });

        // Initialize the service stats if it doesn't exist
        if (!serviceStats[id]) {
          if (serviceExists) {
            serviceStats[id] = {
              serviceId: id,
              serviceTitle:
                serviceNames.find((service) => service.id === id)?.title ||
                matchedService.serviceTitle,
              price: parseFloat(matchedService.price),
              count: 0,
              totalCost: 0,
            };
          } else {
            servicesToAllocate.push(id);
            return; // Skip further processing for this ID
          }
        }

        // Safely increment the count for existing service stats
        serviceStats[id].count += 1;
      });
    });
  });

  // Calculate total cost for each service
  for (const id in serviceStats) {
    serviceStats[id].totalCost =
      serviceStats[id].count * serviceStats[id].price;
  }

  return { serviceStats, servicesToAllocate }; // Return servicesToAllocate as well
}

function calculateOverallCosts(serviceStats, cgst_percentage, sgst_percentage, igst_percentage) {
  let overallServiceAmount = 0;

  // Validate percentages (default to 0 if invalid)
  const cgst = parseFloat(cgst_percentage) || 0;
  const sgst = parseFloat(sgst_percentage) || 0;
  const igst = parseFloat(igst_percentage) || 0;

  // Calculate overall service amount
  for (const stat of Object.values(serviceStats)) {
    const totalCost = parseFloat(stat.totalCost) || 0; // Default to 0 if invalid
    overallServiceAmount += totalCost;
  }

  // Calculate tax amounts
  const cgstAmount = (overallServiceAmount * (cgst / 100)).toFixed(2);
  const sgstAmount = (overallServiceAmount * (sgst / 100)).toFixed(2);
  const igstAmount = (overallServiceAmount * (igst / 100)).toFixed(2);

  // Total tax and amount
  const totalTax = (parseFloat(cgstAmount) + parseFloat(sgstAmount) + parseFloat(igstAmount)).toFixed(2);
  const totalAmount = (overallServiceAmount + parseFloat(totalTax)).toFixed(2);

  // Return results
  return {
    overallServiceAmount: overallServiceAmount.toFixed(2),
    cgst: {
      percentage: cgst,
      tax: cgstAmount,
    },
    sgst: {
      percentage: sgst,
      tax: sgstAmount,
    },
    igst: {
      percentage: igst,
      tax: igstAmount,
    },
    totalTax,
    totalAmount,
  };
}


async function getServiceNames(serviceIds) {
  // Helper function to fetch a service by ID
  const fetchServiceById = (serviceId) => {
    return new Promise((resolve, reject) => {
      Service.getServiceById(serviceId, (err, service) => {
        if (err) return reject(err);
        resolve(service);
      });
    });
  };

  try {
    // Fetch all services concurrently using Promise.all
    const servicePromises = serviceIds.map(async (serviceId) => {
      const service = await fetchServiceById(serviceId);
      if (service && service.title) {
        return {
          id: service.id,
          title: service.title,
          shortCode: service.service_code,
          hsnCode: service.hsn_code,
        };
      }
      return null;
    });

    // Wait for all promises to resolve and filter out any null results
    const serviceNames = (await Promise.all(servicePromises)).filter(Boolean);
    return serviceNames;
  } catch (error) {
    console.error("Error fetching service data:", error);
    return [];
  }
}

// Controller to list all customers
exports.recordTracker = async (req, res) => {
  const { customer_id, from_month, to_month, from_year, to_year, admin_id, _token } = req.query; // Renamed for clarity

  // Check for missing required fields
  const missingFields = [];
  if (
    !customer_id ||
    customer_id === "" ||
    customer_id === undefined ||
    customer_id === "undefined"
  ) {
    missingFields.push("Customer ID");
  }

  if (!from_month || from_month === "" || from_month === undefined || from_month === "undefined") {
    missingFields.push("Invoice From Month");
  }

  if (!to_month || to_month === "" || to_month === undefined || to_month === "undefined") {
    missingFields.push("Invoice To Month");
  }

  if (!from_year || from_year === "" || from_year === undefined || from_year === "undefined") {
    missingFields.push("Invoice From Year");
  }

  if (!to_year || to_year === "" || to_year === undefined || to_year === "undefined") {
    missingFields.push("Invoice To Year");
  }

  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  ) {
    missingFields.push("Token");
  }

  // Return error response for any missing fields
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Action for admin authorization
  const actionPayload = "billing_dashboard";

  AdminCommon.isAdminAuthorizedForAction(
    admin_id,
    actionPayload,
    async (authResult) => {
      if (!authResult.status) {
        return res.status(403).json({
          status: false,
          message: authResult.message, // Message from the authorization function
        });
      }

      // Verify admin token
      AdminCommon.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
        if (err) {
          console.error("Error checking token validity:", err);
          return res.status(500).json({ status: false, message: err.message });
        }

        if (!tokenResult.status) {
          return res.status(401).json({
            status: false,
            message: tokenResult.message,
          });
        }

        const newToken = tokenResult.newToken;
        AppModel.companyInfo((err, companyInfo) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({
              status: false,
              message: err.message,
              token: newToken,
            });
          }

          const cgst_percentage = parseInt(companyInfo.cgst_percentage ?? 0, 10);
          const sgst_percentage = parseInt(companyInfo.sgst_percentage ?? 0, 10);
          const igst_percentage = parseInt(companyInfo.igst_percentage ?? 0, 10);

          // Fetch customer information and applications
          recordTrackerModel.recordTracker(
            customer_id,
            from_month,
            to_month,
            from_year,
            to_year,
            async (err, results) => {
              if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                  status: false,
                  message: err.message,
                  token: newToken,
                });
              }

              const services = JSON.parse(results.customerInfo.services);
              const customerServiceIds = services.flatMap((group) =>
                group.services.map((service) => service.serviceId)
              );

              const serviceNames = await getServiceNames(customerServiceIds);

              // Extract services and applications
              const applications = results.applicationsByBranch;

              // Calculate service statistics
              const { serviceStats, servicesToAllocate } =
                calculateServiceStats(serviceNames, applications, services);

              // Calculate overall costs with 9% as parameter
              const overallCosts = calculateOverallCosts(serviceStats, cgst_percentage, sgst_percentage, igst_percentage);

              // Convert serviceStats to an array for easy access
              const totalCostsArray = Object.values(serviceStats);

              // Log the results
              const finalArr = {
                serviceInfo: totalCostsArray,
                costInfo: overallCosts,
              };

              // Respond with the fetched customer data and applications
              return res.json({
                status: true,
                serviceNames,
                message: "Data fetched successfully.",
                finalArr,
                servicesToAllocate,
                customer: results.customerInfo, // Customer information
                applications: results.applicationsByBranch, // Client applications organized by branch
                totalApplications: results.applicationsByBranch.reduce(
                  (sum, branch) => sum + branch.applications.length,
                  0
                ),
                companyInfo,
                token: newToken,
              });
            }
          );
        });
      });
    }
  );
};

exports.list = (req, res) => {
  const { admin_id, _token, month, year, from_month, from_year, to_month, to_year } = req.query;

  let missingFields = [];

  if (!from_month || from_month === "" || from_month === undefined || from_month === "undefined") {
    missingFields.push("Invoice From_Month");
  }

  if (!from_year || from_year === "" || from_year === undefined || from_year === "undefined") {
    missingFields.push("Invoice From Year");
  }

  if (!to_month || to_month === "" || to_month === undefined || to_month === "undefined") {
    missingFields.push("Invoice To Month");
  }

  if (!to_year || to_year === "" || to_year === undefined || to_year === "undefined") {
    missingFields.push("Invoice To Year");
  }

  if (!admin_id || admin_id === "" || admin_id === undefined || admin_id === "undefined") {
    missingFields.push("Admin ID");
  }

  if (!_token || _token === "" || _token === undefined || _token === "undefined") {
    missingFields.push("Token");
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "billing_dashboard";
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
        return res.status(500).json({ status: false, message: err.message + ' 02' });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message + ' 03' });
      }

      const newToken = result.newToken;
      let filter_status;
      // Fetch customer list with filter status
      recordTrackerModel.list(from_month, from_year, to_month, to_year, (err, customerResults) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            err,
            message: err.message,
            token: newToken,
          });
        }

        // Respond with the fetched customer data
        return res.json({
          status: true,
          message: "Customers fetched successfully",
          customers: customerResults,
          totalResults: customerResults.length,
          token: newToken,
        });
      });
    });
  });
};