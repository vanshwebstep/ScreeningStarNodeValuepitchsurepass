const University = require("../../../models/admin/internal-storage/universityModel");
const Common = require("../../../models/admin/commonModel");
const Service = require("../../../models/admin/serviceModel");
const { getClientIpAddress } = require("../../../utils/ipAddress");

// Controller to create a new service
exports.create = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        university_name,
        university_address,
        contact_name,
        designation,
        mobile_number,
        email_id,
        scope_of_services,
        pricing,
        turnaround_time,
        standard_process,
        verification_link,
        remark,
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

            const newToken = result.newToken;

            University.create(
                university_name,
                university_address,
                contact_name,
                designation,
                mobile_number,
                email_id,
                scope_of_services,
                pricing,
                turnaround_time,
                standard_process,
                verification_link,
                remark,
                (err, result) => {
                    if (err) {
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Internal Storage/University",
                            "Create",
                            "0",
                            null,
                            err,
                            () => { }
                        );
                        console.error("Database error:", err);
                        return res.status(500).json({ status: false, message: err.message, token: newToken, });
                    }
                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Internal Storage/University",
                        "Create",
                        "1",
                        `{id: ${result.insertId}}`,
                        null,
                        () => { }
                    );

                    res.json({
                        status: true,
                        message: "University created successfully",
                        service: result,
                        token: newToken,
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
                // ✅ Extract university names to check for duplicates
                const universityNames = cleanedData.map(entry => entry.university_name);

                // ✅ Call checkIfUniversitiesExist
                University.checkIfUniversitiesExist(universityNames, (error, checkResult) => {
                    if (error || !checkResult.status) {
                        return res.status(400).json({
                            status: false,
                            message: error.message || "Some universities already exist.",
                            alreadyExists: error.alreadyExists || [],
                            token: newToken
                        });
                    }

                    // ✅ Proceed to insert after uniqueness check
                    const insertPromises = cleanedData.map(entry => {
                        return new Promise((resolveInsert, rejectInsert) => {
                            University.create(
                                entry.university_name || "",
                                entry.university_address || "",
                                entry.contact_name || "",
                                entry.designation || "",
                                entry.mobile_number || "",
                                entry.email_id || "",
                                entry.scope_of_services || "",
                                entry.pricing || "",
                                entry.turnaround_time || "",
                                entry.standard_process || "",
                                entry.verification_link || "",
                                entry.remark || "",
                                (err, result) => {
                                    if (err) {
                                        Common.adminActivityLog(
                                            ipAddress,
                                            ipType,
                                            admin_id,
                                            "Internal Storage/University",
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
                                        "Internal Storage/University",
                                        "Create",
                                        "1",
                                        `{id: ${result.insertId}}`,
                                        null,
                                        () => { }
                                    );

                                    resolveInsert({
                                        message: "University created successfully",
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
                                message: "Universities created successfully",
                                results: results,
                                token: newToken,
                            });
                        })
                        .catch(insertErr => {
                            console.error("Insertion error:", insertErr);
                            return res.status(400).json({
                                status: false,
                                message: insertErr.message || "Failed to insert universities.",
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
                    University.list((err, result) => {
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
                    universities,
                    services
                ]) => {
                    res.json({
                        status: true,
                        message: "Universities fetched successfully",
                        data: {
                            universities,
                            services,
                        },
                        totalResults: {
                            admins: universities.length,
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
        university_name,
        university_address,
        contact_name,
        designation,
        mobile_number,
        email_id,
        scope_of_services,
        pricing,
        turnaround_time,
        standard_process,
        verification_link,
        remark,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    const requiredFields = {
        id: "University ID",
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

            University.getById(id, (err, currentUniversity) => {
                if (err) {
                    console.error("Error fetching service data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                const changes = {
                    old: currentUniversity.title,
                    new: {
                        university_name,
                        university_address,
                        contact_name,
                        designation,
                        mobile_number,
                        email_id,
                        scope_of_services,
                        pricing,
                        turnaround_time,
                        standard_process,
                        verification_link,
                        remark,
                    },
                };

                University.update(
                    id,
                    university_name,
                    university_address,
                    contact_name,
                    designation,
                    mobile_number,
                    email_id,
                    scope_of_services,
                    pricing,
                    turnaround_time,
                    standard_process,
                    verification_link,
                    remark,
                    (err, result) => {
                        if (err) {
                            console.error("Database error:", err);
                            Common.adminActivityLog(
                                ipAddress,
                                ipType,
                                admin_id,
                                "Internal Storage/University",
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
                            "Internal Storage/University",
                            "Update",
                            "1",
                            JSON.stringify({ id, ...changes }),
                            null,
                            () => { }
                        );

                        return res.json({
                            status: true,
                            message: "University updated successfully",
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
    if (!id || id === "") missingFields.push("University ID");
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

            University.getById(id, (err, currentUniversity) => {
                if (err) {
                    console.error("Error fetching service data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                University.delete(id, (err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Internal Storage/University",
                            "Delete",
                            "0",
                            JSON.stringify({ id, ...currentUniversity }),
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
                        "Internal Storage/University",
                        "Delete",
                        "1",
                        JSON.stringify(currentUniversity),
                        null,
                        () => { }
                    );

                    return res.json({
                        status: true,
                        message: "University deleted successfully",
                        token: newToken,
                    });
                });
            });
        });
    });
};
