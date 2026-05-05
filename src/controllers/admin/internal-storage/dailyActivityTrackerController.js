const DailyActivity = require("../../../models/admin/internal-storage/dailyActivityTrackerModel");
const Common = require("../../../models/admin/commonModel");
const Service = require("../../../models/admin/serviceModel");
const { getClientIpAddress } = require("../../../utils/ipAddress");

// Controller to create a new service
exports.create = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        bd_expert_name,
        date,
        client_organization_name,
        company_size,
        spoc_name,
        spoc_designation,
        contact_number,
        email,
        is_using_any_bgv_vendor,
        vendor_name,
        is_interested_in_using_our_services,
        reason_for_not_using_our_services,
        reason_for_using_our_services,
        callback_asked_at,
        is_prospect,
        comments,
        followup_date,
        followup_comments,
        remarks,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    const requiredFields = {
        admin_id: "Admin ID",
        _token: "Token",
    };

    for (let field in requiredFields) {
        if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === "")) {
            missingFields.push(requiredFields[field]);
        }
    }

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "internal_storage";
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
            DailyActivity.create(
                bd_expert_name,
                date,
                client_organization_name,
                company_size,
                spoc_name,
                spoc_designation,
                contact_number,
                email,
                is_using_any_bgv_vendor,
                vendor_name,
                is_interested_in_using_our_services,
                reason_for_not_using_our_services,
                reason_for_using_our_services,
                callback_asked_at,
                is_prospect,
                comments,
                followup_date,
                followup_comments,
                remarks,
                (err, result) => {
                    if (err) {
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Internal Storage/Buisness Development Activity",
                            "Create",
                            "0",
                            null,
                            err,
                            () => { }
                        );
                        console.error("Database error:", err);
                        return res.status(500).json({ status: false, message: err.message });
                    }
                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Internal Storage/Buisness Development Activity",
                        "Create",
                        "1",
                        `{id: ${result.insertId}}`,
                        null,
                        () => { }
                    );

                    res.json({
                        status: true,
                        message: "Vendor created successfully",
                        service: result,
                    });
                }
            );
        });
    });
};

// Controller to bulkCreate a new service
exports.bulkCreate = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);
    const { data, admin_id, _token } = req.body;

    const requiredFields = {
        admin_id: "Admin ID",
        _token: "Token",
    };

    const missingFields = Object.keys(requiredFields).filter(field =>
        !req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === "")
    );

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.map(field => requiredFields[field]).join(", ")}`,
        });
    }

    const action = "internal_storage";

    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            return res.status(403).json({ status: false, message: result.message });
        }

        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Token validation error:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }

            const newToken = result.newToken;

            new Promise((resolve, reject) => {
                if (!Array.isArray(data) || data.length === 0) {
                    return reject("No data provided.");
                }

                const cleanedData = data.filter(entry => {
                    return Object.values(entry).some(value =>
                        typeof value === 'string' ? value.trim() !== "" : value !== undefined && value !== null
                    );
                });

                if (cleanedData.length === 0) {
                    return reject("All entries are empty or invalid.");
                }

                resolve(cleanedData);

            }).then(cleanedData => {
                // ✅ Extract Buisness Development Names to check for duplicates
                const BuisnessDevelopmentNames = cleanedData.map(entry => entry.bd_expert_name);

                // ✅ Call checkIfBuisnessDevelopmentExist
                DailyActivity.checkIfBuisnessDevelopmentExist(BuisnessDevelopmentNames, (error, checkResult) => {
                    if (error || !checkResult.status) {
                        return res.status(400).json({
                            status: false,
                            message: error.message || "Some Buisness Developments already exist.",
                            alreadyExists: error.alreadyExists || [],
                            token: newToken
                        });
                    }

                    // ✅ Proceed to insert after uniqueness check
                    const insertPromises = cleanedData.map(entry => {

                        // Function to check if the date is in DD-MM-YYYY format
                        const isValidDate = (date) => {
                            const regex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD format
                            return regex.test(date) && !isNaN(new Date(date).getTime());
                        };

                        return new Promise((resolveInsert, rejectInsert) => {
                            DailyActivity.create(
                                entry.bd_expert_name || "",
                                entry.date || "",
                                entry.client_organization_name || "",
                                entry.company_size || "",
                                entry.spoc_name || "",
                                entry.spoc_designation || "",
                                entry.contact_number || "",
                                entry.email || "",
                                entry.is_using_any_bgv_vendor || "",
                                entry.vendor_name || "",
                                entry.is_interested_in_using_our_services || "",
                                entry.reason_for_not_using_our_services || "",
                                entry.reason_for_using_our_services || "",
                                entry.callback_asked_at || "",
                                entry.is_prospect || "",
                                entry.comments || "",
                                entry.followup_date || "",
                                entry.followup_comments || "",
                                entry.remarks || "",
                                (err, result) => {
                                    if (err) {
                                        Common.adminActivityLog(
                                            ipAddress,
                                            ipType,
                                            admin_id,
                                            "Internal Storage/Buisness Development Activity",
                                            "Create",
                                            "0",
                                            null,
                                            err,
                                            () => { }
                                        );
                                        return rejectInsert(err);
                                    }

                                    Common.adminActivityLog(
                                        ipAddress,
                                        ipType,
                                        admin_id,
                                        "Internal Storage/Buisness Development Activity",
                                        "Create",
                                        "1",
                                        `{id: ${result.insertId}}`,
                                        null,
                                        () => { }
                                    );

                                    resolveInsert({
                                        message: "Buisness Development created successfully",
                                        entry: entry,
                                        id: result.insertId,
                                    });
                                }
                            );
                        });
                    });

                    Promise.all(insertPromises)
                        .then(results => {
                            return res.status(200).json({
                                status: true,
                                message: "Buisness Developments created successfully",
                                results: results,
                                token: newToken,
                            });
                        })
                        .catch(insertErr => {
                            console.error("Insertion error:", insertErr);
                            return res.status(400).json({
                                status: false,
                                message: insertErr.message || "Failed to insert Buisness Development.",
                                token: newToken,
                            });
                        });
                });

            }).catch(error => {
                console.error("Validation/cleaning error:", error);
                return res.status(400).json({
                    status: false,
                    message: typeof error === 'string' ? error : error.message || "Unknown error",
                    token: newToken,
                });
            });
        });
    });
};

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
    const action = "internal_storage";
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

            const dataPromises = [
                new Promise((resolve) =>
                    DailyActivity.list((err, result) => {
                        if (err) return resolve([]);
                        resolve(result);
                    })
                ),
                new Promise((resolve) =>
                    Service.list((err, result) => {
                        if (err) return resolve([]);
                        resolve(result);
                    })
                )
            ];

            Promise.all(dataPromises).then(
                ([
                    activies,
                    services
                ]) => {
                    res.json({
                        status: true,
                        message: "Universities fetched successfully",
                        data: {
                            activies,
                            services,
                        },
                        totalResults: {
                            admins: activies.length,
                            services: services.length
                        },
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
        id,
        bd_expert_name,
        date,
        client_organization_name,
        company_size,
        spoc_name,
        spoc_designation,
        contact_number,
        email,
        is_using_any_bgv_vendor,
        vendor_name,
        is_interested_in_using_our_services,
        reason_for_not_using_our_services,
        reason_for_using_our_services,
        callback_asked_at,
        is_prospect,
        comments,
        followup_date,
        followup_comments,
        remarks,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    const requiredFields = {
        id: "Vendor ID",
        admin_id: "Admin ID",
        _token: "Token",
    };

    for (let field in requiredFields) {
        if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === "")) {
            missingFields.push(requiredFields[field]);
        }
    }

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "internal_storage";
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

            DailyActivity.getById(id, (err, currentDailyActivity) => {
                if (err) {
                    console.error("Error fetching service data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                const changes = {
                    old: currentDailyActivity,
                    new: {
                        bd_expert_name,
                        date,
                        client_organization_name,
                        company_size,
                        spoc_name,
                        spoc_designation,
                        contact_number,
                        email,
                        is_using_any_bgv_vendor,
                        vendor_name,
                        is_interested_in_using_our_services,
                        reason_for_not_using_our_services,
                        reason_for_using_our_services,
                        callback_asked_at,
                        is_prospect,
                        comments,
                        followup_date,
                        followup_comments,
                        remarks,
                    },
                };

                DailyActivity.update(
                    id,
                    bd_expert_name,
                    date,
                    client_organization_name,
                    company_size,
                    spoc_name,
                    spoc_designation,
                    contact_number,
                    email,
                    is_using_any_bgv_vendor,
                    vendor_name,
                    is_interested_in_using_our_services,
                    reason_for_not_using_our_services,
                    reason_for_using_our_services,
                    callback_asked_at,
                    is_prospect,
                    comments,
                    followup_date,
                    followup_comments,
                    remarks,
                    (err, result) => {
                        if (err) {
                            console.error("Database error:", err);
                            Common.adminActivityLog(
                                ipAddress,
                                ipType,
                                admin_id,
                                "Internal Storage/Buisness Development Activity",
                                "Update",
                                "0",
                                JSON.stringify({ id, ...changes }),
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
                            "Internal Storage/Buisness Development Activity",
                            "Update",
                            "1",
                            JSON.stringify({ id, ...changes }),
                            null,
                            () => { }
                        );

                        return res.json({
                            status: true,
                            message: "Vendor updated successfully",
                            service: result,
                            token: newToken,
                        });
                    }
                );
            });
        });
    });
};

exports.delete = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const { id, admin_id, _token } = req.query;

    let missingFields = [];
    if (!id || id === "") missingFields.push("Vendor ID");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }
    const action = "internal_storage";
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

            DailyActivity.getById(id, (err, currentVendor) => {
                if (err) {
                    console.error("Error fetching service data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                DailyActivity.delete(id, (err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Internal Storage/Buisness Development Activity",
                            "Delete",
                            "0",
                            JSON.stringify({ id, ...currentVendor }),
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
                        "Internal Storage/Buisness Development Activity",
                        "Delete",
                        "1",
                        JSON.stringify(currentVendor),
                        null,
                        () => { }
                    );

                    return res.json({
                        status: true,
                        message: "Vendor deleted successfully",
                        token: newToken,
                    });
                });
            });
        });
    });
};
