const crypto = require("crypto");
const Branch = require("../../../models/customer/branch/branchModel");
const BranchCommon = require("../../../models/customer/branch/commonModel");
const AdminCommon = require("../../../models/admin/commonModel");
const Admin = require("../../../models/admin/adminModel");
const backgroundVerificationForm = require("../../../models/admin/json-form/backgroundVerificationForm");

const { getClientIpAddress } = require("../../../utils/ipAddress");

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

    const action = "developers";
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

            backgroundVerificationForm.list((err, result) => {
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
                    message: "Background Verification Service Forms fetched successfully",
                    data: result,
                    totalResults: result.length,
                    token: newToken,
                });
            });
        });
    });
};

exports.formByServiceId = (req, res) => {
    const { service_id, admin_id, _token } = req.query;

    // Validate required fields
    const missingFields = [];
    if (!service_id) missingFields.push("Service ID");
    if (!admin_id) missingFields.push("Admin ID");
    if (!_token) missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const adminID = Number(admin_id);

    const action = "developers";
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

            backgroundVerificationForm.formByServiceId(service_id, (err, result) => {
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
                    message: "Background Verification Service Forms fetched successfully",
                    data: result,
                    totalResults: result.length,
                    token: newToken,
                });
            });
        });
    });
};

exports.update = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        service_id,
        json,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    if (!service_id || service_id === "") missingFields.push("Service ID");
    if (!json || json === "") missingFields.push("JSON");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }
    const action = "developers";
    AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            // Check the status returned by the authorization function
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

            backgroundVerificationForm.formByServiceId(service_id, (err, currentService) => {
                if (err) {
                    console.error("Error fetching service data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                const changes = {};
                if (currentService.json !== json) {
                    changes.json = {
                        old: currentService.json,
                        new: json,
                    };
                }

                backgroundVerificationForm.update(
                    service_id,
                    json,
                    (err, result) => {
                        if (err) {
                            console.error("Database error:", err);
                            AdminCommon.adminActivityLog(
                                ipAddress,
                                ipType,
                                admin_id,
                                "Background Verification Service Form",
                                "Update",
                                "0",
                                JSON.stringify({ service_id, ...changes }),
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
                            "Background Verification Service Form",
                            "Update",
                            "1",
                            JSON.stringify({ service_id, ...changes }),
                            null,
                            () => { }
                        );

                        return res.json({
                            status: true,
                            message: "Report Form updated successfully",
                            service: result,
                            token: newToken,
                        });
                    }
                );
            });
        });
    });
};