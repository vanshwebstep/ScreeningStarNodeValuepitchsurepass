const crypto = require("crypto");
const TrashedCustomer = require("../../../models/admin/trashed/customerModel");
const AdminCommon = require("../../../models/admin/commonModel");
const { getClientIpAddress } = require("../../../utils/ipAddress");

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

            TrashedCustomer.list((err, result) => {
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

exports.restore = (req, res) => {
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

    const action = "trash";
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
                TrashedCustomer.getCustomerById(id, (err, currentCustomer) => {
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

                    // Delete the customer
                    TrashedCustomer.restore(id, (err, result) => {
                        if (err) {
                            console.error("Database error during customer restoration:", err);
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
                                message: "Failed to restore customer. Please try again.",
                                token: newToken,
                            });
                        }

                        AdminCommon.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Customer",
                            "Restore",
                            "1",
                            JSON.stringify({ id }),
                            null,
                            () => { }
                        );

                        return res.status(200).json({
                            status: true,
                            message: "Customer restored successfully.",
                            result,
                            token: newToken,
                        });
                    });
                });
            }
        );
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

    const action = "trash";
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
                TrashedCustomer.getCustomerById(id, (err, currentCustomer) => {
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

                    // Delete the customer
                    TrashedCustomer.destroy(id, (err, result) => {
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