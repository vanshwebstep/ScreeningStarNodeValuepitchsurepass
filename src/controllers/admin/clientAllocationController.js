const Admin = require("../../models/admin/adminModel");
const CaseAllocation = require("../../models/admin/caseAllocationModel");
const ClientApplication = require("../../models/customer/branch/clientApplicationModel");

const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to list all Billing SPOCs
exports.applications = (req, res) => {

    const {
        admin_id,
        _token,
    } = req.query;

    let missingFields = [];
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "case_allocation";
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
            CaseAllocation.applicationForCaseAllocation((err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                        status: false,
                        error: err,
                        message: err.message || "An error occurred while fetching applications",
                        token: newToken
                    });
                }

                const { applications, services } = result;

                return res.json({
                    status: true,
                    message: "Applications and services fetched successfully",
                    data: {
                        applications,
                        services,
                    },
                    totalResults: {
                        applications: applications.length,
                        services: services.length,
                    },
                    token: newToken
                });
            });
        });
    });
};

exports.create = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        application_id,
        service_ids,
        employee_id,
        name,
        month_year,
        created_at,
        dob,
        gender,
        contact_number,
        contact_number2,
        father_name,
        spouse_name,
        permanent_address,
        deadline_date,
        report_date,
        delay_reason,
        color_code,
        vendor_name,
        case_aging,
        remarks,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    if (!application_id || application_id === "") missingFields.push("Reference ID");
    if (!service_ids || service_ids === "") missingFields.push("Service IDs");
    if (!color_code || color_code === "") missingFields.push("Color Code");
    if (!vendor_name || vendor_name === "") missingFields.push("Vendor Name");
    if (!case_aging || case_aging === "") missingFields.push("Case Aging");
    if (!remarks || remarks === "") missingFields.push("Remarks");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "case_allocation";
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

            CaseAllocation.create(
                {
                    application_id,
                    service_ids,
                    employee_id,
                    name,
                    month_year,
                    created_at,
                    dob,
                    gender,
                    contact_number,
                    contact_number2,
                    father_name,
                    spouse_name,
                    permanent_address,
                    deadline_date,
                    report_date,
                    delay_reason,
                    color_code,
                    vendor_name,
                    case_aging,
                    remarks,
                    admin_id
                },
                (err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Service",
                            "Case Allocation",
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
                        "Case Allocation",
                        "Create",
                        "1",
                        `{id: ${result.insertId}}`,
                        null,
                        () => { }
                    );

                    res.json({
                        status: true,
                        message: "Case Allocation created successfully",
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

    const action = "case_allocation";

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
                const applicationReffIds = cleanedData.map(entry => entry.application_id);

                // ✅ Call checkIfBuisnessDevelopmentExist
                ClientApplication.checkIfApplicationExist(applicationReffIds, (error, checkResult) => {
                    if (error || !checkResult.status) {
                        return res.status(400).json({
                            status: false,
                            message: error.message || "Some Buisness Developments already exist.",
                            alreadyExists: error.alreadyExists || [],
                            token: newToken
                        });
                    }

                    const validReffIds = checkResult.validReffIds;

                    let cleanedDataWithValidReffIds = cleanedData.filter(entry => validReffIds.includes(entry.application_id));

                    // ✅ Proceed to insert after uniqueness check
                    const insertPromises = cleanedDataWithValidReffIds.map(entry => {
                        return new Promise((resolveInsert, rejectInsert) => {
                            CaseAllocation.create(
                                {
                                    application_id: entry.application_id,
                                    service_ids: entry.service_ids,
                                    employee_id: entry.employee_id,
                                    name: entry.name,
                                    month_year: entry.month_year,
                                    created_at: entry.created_at,
                                    dob: entry.dob,
                                    gender: entry.gender,
                                    contact_number: entry.contact_number,
                                    contact_number2: entry.contact_number2,
                                    father_name: entry.father_name,
                                    spouse_name: entry.spouse_name,
                                    permanent_address: entry.permanent_address,
                                    deadline_date: entry.deadline_date,
                                    report_date: entry.report_date,
                                    delay_reason: entry.delay_reason,
                                    color_code: entry.color_code,
                                    vendor_name: entry.vendor_name,
                                    case_aging: entry.case_aging,
                                    remarks: entry.remarks,
                                    admin_id: admin_id,
                                },
                                (err, result) => {
                                    if (err) {
                                        Common.adminActivityLog(
                                            ipAddress,
                                            ipType,
                                            admin_id,
                                            "Case Allocation",
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
                                        "Case Allocation",
                                        "Create",
                                        "1",
                                        `{id: ${result.insertId}}`,
                                        null,
                                        () => { }
                                    );

                                    resolveInsert({
                                        message: "Case Allocation imported successfully",
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
                                message: "Case Allocation imported successfully",
                                results: results,
                                token: newToken,
                            });
                        })
                        .catch(insertErr => {
                            console.error("Insertion error:", insertErr);
                            return res.status(400).json({
                                status: false,
                                message: insertErr.message || "Failed to insert Case Allocation.",
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

exports.update = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        id,
        application_id,
        service_ids,
        employee_id,
        name,
        month_year,
        created_at,
        dob,
        gender,
        contact_number,
        contact_number2,
        father_name,
        spouse_name,
        permanent_address,
        deadline_date,
        report_date,
        delay_reason,
        color_code,
        vendor_name,
        case_aging,
        remarks,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    if (!id || id === "") missingFields.push("Client Allowcation ID");
    if (!application_id || application_id === "") missingFields.push("Reference ID");
    if (!service_ids || service_ids === "") missingFields.push("Service IDs");
    if (!color_code || color_code === "") missingFields.push("Color Code");
    if (!vendor_name || vendor_name === "") missingFields.push("Vendor Name");
    if (!case_aging || case_aging === "") missingFields.push("Case Aging");
    if (!remarks || remarks === "") missingFields.push("Remarks");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "case_allocation";
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

            CaseAllocation.getById(id, (err, currentClientAllowcation) => {
                if (err) {
                    console.error("Error fetching Client Allowcation data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                CaseAllocation.update(
                    id,
                    {
                        application_id,
                        service_ids,
                        employee_id,
                        name,
                        month_year,
                        created_at,
                        dob,
                        gender,
                        contact_number,
                        contact_number2,
                        father_name,
                        spouse_name,
                        permanent_address,
                        deadline_date,
                        report_date,
                        delay_reason,
                        color_code,
                        vendor_name,
                        case_aging,
                        remarks,
                        admin_id
                    },
                    (err, result) => {
                        if (err) {
                            console.error("Database error:", err);
                            Common.adminActivityLog(
                                ipAddress,
                                ipType,
                                admin_id,
                                "Service",
                                "Case Allocation",
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
                            "Case Allocation",
                            "Create",
                            "1",
                            `{id: ${result.insertId}}`,
                            null,
                            () => { }
                        );

                        res.json({
                            status: true,
                            message: "Case Allocation created successfully",
                            token: newToken,
                        });
                    }
                );
            });
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
    const action = "case_allocation";
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


            CaseAllocation.list((err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res
                        .status(500)
                        .json({ status: false, message: err.message, token: newToken });
                }

                const { caseAllocations, services } = result;

                CaseAllocation.applicationForCaseAllocation((err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        return res.status(500).json({
                            status: false,
                            error: err,
                            message: err.message || "An error occurred while fetching applications",
                            token: newToken
                        });
                    }

                    const { applications } = result;
                    return res.json({
                        status: true,
                        message: "Case allocations and services fetched successfully",
                        data: {
                            caseAllocations,
                            services,
                            applications
                        },
                        totalResults: {
                            caseAllocations: caseAllocations.length,
                            services: services.length,
                            applications: applications.length
                        },
                    });
                });
            });
        });
    });
};

exports.delete = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const { id, admin_id, _token } = req.query;

    let missingFields = [];
    if (!id || id === "") missingFields.push("Service ID");
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

            CaseAllocation.getById(id, (err, currentClientAllowcation) => {
                if (err) {
                    console.error("Error fetching Client Allowcation data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                CaseAllocation.delete(id, (err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "CaseAllocation",
                            "Delete",
                            "0",
                            JSON.stringify({ id, ...currentClientAllowcation }),
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
                        "CaseAllocation",
                        "Delete",
                        "1",
                        JSON.stringify(currentClientAllowcation),
                        null,
                        () => { }
                    );

                    return res.json({
                        status: true,
                        message: "Allocation deleted successfully",
                        token: newToken,
                    });
                });
            });
        });
    });
};