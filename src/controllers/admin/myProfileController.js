const crypto = require("crypto");
const AdminCommon = require("../../models/admin/commonModel");
const App = require("../../models/appModel");
const Admin = require("../../models/admin/adminModel");

const { getClientIpAddress } = require("../../utils/ipAddress");

const fs = require("fs");
const path = require("path");
const { upload, saveImage, saveImages } = require("../../utils/cloudImageSave");

exports.index = (req, res) => {
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

    AdminCommon.isAdminTokenValid(_token, adminID, (err, result) => {
        if (err) {
            console.error("Error checking token validity:", err);
            return res.status(500).json(err);
        }

        if (!result.status) {
            return res.status(401).json({ status: false, message: result.message });
        }

        const newToken = result.newToken;

        Admin.findById(adminID, (err, result) => {
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
                message: "Generate Report Service Forms fetched successfully",
                data: result,
                totalResults: result.length,
                token: newToken,
            });
        });
    });
};

exports.update = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        name,
        email,
        mobile,
        admin_id,
        _token,
    } = req.body;

    const requiredFields = [
        { field: 'name', name: 'Name' },
        { field: 'email', name: 'Email' },
        { field: 'mobile', name: 'Mobile' },
        { field: 'admin_id', name: 'Admin ID' },
        { field: '_token', name: 'Token' }
    ];

    let missingFields = [];

    requiredFields.forEach(({ field, name }) => {
        if (!req.body[field] || req.body[field] === "") {
            missingFields.push(name);
        }
    });

    // Handle missing fields (e.g., return an error response)
    if (missingFields.length > 0) {
        return res.status(400).json({
            error: `Missing fields: ${missingFields.join(', ')}`
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

        Admin.findById(admin_id, (err, currentadmin) => {
            if (err) {
                console.error("Error fetching service data:", err);
                return res.status(500).json({
                    status: false,
                    message: err.message,
                    token: newToken,
                });
            }

            const changes = {};
            if (currentadmin.name !== name) {
                changes.name = {
                    old: currentadmin.name,
                    new: name,
                };
            }
            if (currentadmin.email !== email) {
                changes.email = {
                    old: currentadmin.email,
                    new: email,
                };
            }

            if (currentadmin.mobile !== mobile) {
                changes.mobile = {
                    old: currentadmin.mobile,
                    new: mobile,
                };
            }

            Admin.updateMyProfile(
                {
                    name,
                    email,
                    mobile,
                    id: admin_id,
                }, (err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        AdminCommon.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Service",
                            "Update",
                            "0",
                            JSON.stringify({ admin_id, ...changes }),
                            err.message,
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
                        "Service",
                        "Update",
                        "1",
                        JSON.stringify({ admin_id, ...changes }),
                        null,
                        () => { }
                    );

                    const { otp, two_factor_enabled, otp_expiry, login_token, token_expiry, ...adminDataWithoutToken } = result;

                    return res.json({
                        status: true,
                        message: "Service updated successfully",
                        adminData: adminDataWithoutToken,
                        token: newToken,
                    });
                }
            );
        });
    });
};

exports.upload = async (req, res) => {
    try {
        // Handle file upload using Multer
        upload(req, res, async (err) => {
            if (err) {
                console.log(`err - `, err);
                return res
                    .status(400)
                    .json({ status: false, message: "Error uploading file." });
            }

            // Destructure required fields from request body
            const {
                admin_id: adminId,
                _token: token,
            } = req.body;

            // Validate required fields
            const requiredFields = { adminId, token };

            const missingFields = Object.keys(requiredFields)
                .filter(
                    (field) =>
                        !requiredFields[field] ||
                        requiredFields[field] === "" ||
                        requiredFields[field] === "undefined"
                )
                .map((field) => field.replace(/_/g, " "));

            if (missingFields.length > 0) {
                return res.status(400).json({
                    status: false,
                    message: `Missing required fields: ${missingFields.join(", ")}`,
                });
            }

            Admin.findById(adminId, async (err, currentAdmin) => {
                if (err) {
                    console.error("Error retrieving Admin:", err);
                    return res.status(500).json({
                        status: false,
                        message: "Database error.",
                    });
                }

                if (!currentAdmin) {
                    return res.status(404).json({
                        status: false,
                        message: "Admin not found.",
                    });
                }

                AdminCommon.isAdminTokenValid(
                    token,
                    adminId,
                    async (err, tokenResult) => {
                        if (err) {
                            console.error("Token validation error:", err);
                            return res
                                .status(500)
                                .json({ status: false, message: "Internal server error." });
                        }

                        if (!tokenResult.status) {
                            return res.status(401).json({
                                status: false,
                                err: tokenResult,
                                message: tokenResult.message,
                            });
                        }

                        const newToken = tokenResult.newToken;
                        const targetDirectory = `uploads/admins/${currentAdmin.emp_id}/profile`;

                        // Create directory for uploads
                        await fs.promises.mkdir(targetDirectory, { recursive: true });

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

                            const savedImagePaths = [];

                            // Process multiple file uploads
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

                            // Save images and update Admin
                            Admin.upload(adminId, savedImagePaths, (success, result) => {
                                if (!success) {
                                    return res.status(500).json({
                                        status: false,
                                        message:
                                            result || "Error occurred while saving images.",
                                        token: newToken,
                                        savedImagePaths,
                                    });
                                }
                                if (result) {

                                    return res.status(201).json({
                                        status: true,
                                        message:
                                            "Admin profile picture uploaded successfully.",
                                        token: newToken,
                                        savedImagePaths,
                                    });

                                } else {
                                    return res.status(400).json({
                                        status: false,
                                        message: "No changes were made. Check Admin ID.",
                                        token: newToken,
                                    });
                                }
                            });
                        });
                    }
                );
            });
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return res
            .status(500)
            .json({ status: false, message: "Unexpected server error.", token: newToken, });
    }
};