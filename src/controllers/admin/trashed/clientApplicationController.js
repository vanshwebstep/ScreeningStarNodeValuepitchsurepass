const crypto = require("crypto");
const TrashedClientMasterTrackerModel = require("../../../models/admin/trashed/clientApplicationModel");
const Customer = require("../../../models/customer/customerModel");
const ClientApplication = require("../../../models/customer/branch/clientApplicationModel");
const Branch = require("../../../models/customer/branch/branchModel");
const AdminCommon = require("../../../models/admin/commonModel");
const { getClientIpAddress } = require("../../../utils/ipAddress");

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

    const action = "trash";
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
                    TrashedClientMasterTrackerModel.list(filter_status, (err, result) => {
                        if (err) return resolve([]);
                        resolve(result);
                    })
                ),
                new Promise((resolve) =>
                    TrashedClientMasterTrackerModel.filterOptionsForCustomers((err, result) => {
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

    const action = "trash";
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

            TrashedClientMasterTrackerModel.filterOptions((err, filterOptions) => {
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

    const action = "trash";
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

            TrashedClientMasterTrackerModel.filterOptionsForBranch(
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

    const action = "trash";
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

            TrashedClientMasterTrackerModel.listByCustomerID(
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

exports.customerFilterOption = (req, res) => {

    TrashedClientMasterTrackerModel.filterOptionsForCustomers((err, filterOptions) => {
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

    const action = "trash";
    AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            return res.status(403).json({
                status: false,
                err: result,
                message: result.message, // Return the message from the authorization function
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
                });
            }

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

                        TrashedClientMasterTrackerModel.applicationListByBranch(
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

                                TrashedClientMasterTrackerModel.filterOptionsForApplicationListing(currentBranch.customer_id, branch_id, (err, filterOptions) => {
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
    const action = "trash";
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
            TrashedClientMasterTrackerModel.getClientApplicationById(
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
                    ClientApplication.destroy(application_id, (err, result) => {
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

exports.applicationRestore = (req, res) => {
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
    const action = "trash";
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
            TrashedClientMasterTrackerModel.getClientApplicationById(
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

                    // Restore the clientApplication
                    ClientApplication.restore(application_id, (err, result) => {
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
                                "Restore",
                                "0",
                                JSON.stringify({ application_id }),
                                err,
                                () => { }
                            );
                            return res.status(500).json({
                                status: false,
                                message:
                                    err.message ?? "Failed to restore ClientApplication. Please try again.",
                                token: newToken,
                            });
                        }

                        AdminCommon.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Client Application",
                            "Restore",
                            "1",
                            JSON.stringify({ application_id }),
                            null,
                            () => { }
                        );

                        res.status(200).json({
                            status: true,
                            message: "Client Application restored successfully.",
                            token: newToken,
                        });
                    });
                }
            );
        });
    });
};