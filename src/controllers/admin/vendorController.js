const Admin = require("../../models/admin/adminModel");
const App = require("../../models/appModel");
const Vendor = require("../../models/admin/vendorModel");

const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

exports.create = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        name,
        address,
        state,
        coverage,
        services,
        pricing,
        date_of_agreement,
        status,
        remarks,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    if (!name || name === "") missingFields.push("Name");
    if (!address || address === "") missingFields.push("Address");
    if (!state || state === "") missingFields.push("State");
    if (!coverage || coverage === "") missingFields.push("Coverage");
    if (!services || services === "") missingFields.push("Services");
    if (!pricing || pricing === "") missingFields.push("Pricing");
    if (!date_of_agreement || date_of_agreement === "") missingFields.push("Date Of Agreement");
    if (!status || status === "") missingFields.push("Status");
    if (!remarks || remarks === "") missingFields.push("Remarks");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const statusInt =
        parseInt(status, 10) === 0 || parseInt(status, 10) === 1
            ? parseInt(status, 10)
            : 1;

    const action = "vendor_management";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            // Check the status returned by the authorization function
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }

        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }

            const newToken = result.newToken;

            Vendor.create(
                {
                    name,
                    address,
                    state,
                    coverage,
                    services,
                    pricing,
                    date_of_agreement,
                    status: statusInt,
                    remarks,
                    admin_id,
                },
                (err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Vendor",
                            "Create",
                            "0",
                            null,
                            err,
                            () => { }
                        );
                        return res
                            .status(500)
                            .json({ status: false, message: err.message, token: newToken });
                    }

                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Vendor",
                        "Create",
                        "1",
                        `{id: ${result.insertId}}`,
                        null,
                        () => { }
                    );

                    res.json({
                        status: true,
                        message: "Vendor created successfully",
                        result,
                        token: newToken,
                    });
                }
            );
        });
    });
};

exports.update = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        vendor_id,
        name,
        address,
        state,
        coverage,
        services,
        pricing,
        date_of_agreement,
        status,
        remarks,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    if (!vendor_id || vendor_id === "") missingFields.push("Vendor ID");
    if (!name || name === "") missingFields.push("Name");
    if (!address || address === "") missingFields.push("Address");
    if (!state || state === "") missingFields.push("State");
    if (!coverage || coverage === "") missingFields.push("Coverage");
    if (!services || services === "") missingFields.push("Services");
    if (!pricing || pricing === "") missingFields.push("Pricing");
    if (!date_of_agreement || date_of_agreement === "") missingFields.push("Date Of Agreement");
    if (!status || status === "") missingFields.push("Status");
    if (!remarks || remarks === "") missingFields.push("Remarks");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const statusInt =
        parseInt(status, 10) === 0 || parseInt(status, 10) === 1
            ? parseInt(status, 10)
            : 1;

    const action = "vendor_management";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            // Check the status returned by the authorization function
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }

        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }

            const newToken = result.newToken;

            Vendor.update(
                vendor_id,
                {
                    name,
                    address,
                    state,
                    coverage,
                    services,
                    pricing,
                    date_of_agreement,
                    status: statusInt,
                    remarks,
                    admin_id,
                },
                (err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Vendor",
                            "Update",
                            "0",
                            null,
                            err,
                            () => { }
                        );
                        return res
                            .status(500)
                            .json({ status: false, message: err.message, token: newToken });
                    }

                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Vendor",
                        "Update",
                        "1",
                        `{id: ${result.insertId}}`,
                        null,
                        () => { }
                    );

                    res.json({
                        status: true,
                        message: "Vendor updated successfully",
                        result,
                        token: newToken,
                    });
                }
            );
        });
    });
};

// Controller to list all services
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
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }
        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }

            const newToken = result.newToken;

            Vendor.list((err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res
                        .status(500)
                        .json({ status: false, message: err.message, token: newToken });
                }

                res.json({
                    status: true,
                    message: "Vendor fetched successfully",
                    services: result,
                    totalResults: result.length,
                    token: newToken,
                });
            });
        });
    });
};

exports.delete = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);
    const { vendor_id, admin_id, _token } = req.query;

    // Validate required fields
    const missingFields = [];
    if (!vendor_id) missingFields.push("Vendor ID");
    if (!admin_id) missingFields.push("Admin ID");
    if (!_token) missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "vendor_management";
    // Check if the admin is authorized to perform the action
    Common.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
        if (!authResult.status) {
            return res.status(403).json({
                status: false,
                err: authResult,
                message: authResult.message, // Return the message from the authorization check
            });
        }

        // Validate the admin's token
        Common.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res
                    .status(500)
                    .json({ status: false, message: "Internal server error" });
            }

            if (!tokenResult.status) {
                return res.status(401).json({
                    status: false,
                    err: tokenResult,
                    message: tokenResult.message,
                });
            }

            const newToken = tokenResult.newToken;
            Vendor.delete(vendor_id, (err, result) => {
                if (err) {
                    console.error("Database error during Admin deletion:", err);
                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Vendor",
                        "Delete",
                        "0",
                        JSON.stringify({ vendor_id }),
                        err,
                        () => { }
                    );
                    return res.status(500).json({
                        status: false,
                        message: "Failed to delete Vendor. Please try again.",
                        token: newToken,
                    });
                }

                Common.adminActivityLog(
                    ipAddress,
                    ipType,
                    admin_id,
                    "Vendor",
                    "Delete",
                    "1",
                    JSON.stringify({ vendor_id }),
                    null,
                    () => { }
                );

                res.status(200).json({
                    status: true,
                    message: "Vendor deleted successfully.",
                    token: newToken,
                });
            });
        });
    });
};
