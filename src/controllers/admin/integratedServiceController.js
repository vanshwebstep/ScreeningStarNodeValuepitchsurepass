const IntegratedService = require("../../models/admin/integratedServiceModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to create a new integratedService
exports.create = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        type,
        export_format,
        data,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    if (!type || type === "") missingFields.push("Type");
    if (!data || data === "") missingFields.push("Data");
    if (!export_format || export_format === "") missingFields.push("Export Format");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "integrated_service";
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

            IntegratedService.create(type, data, export_format, admin_id, (err, result) => {
                if (err) {
                    console.error("Database error:", err);

                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "IntegratedService",
                        "Create",
                        "0",
                        null,
                        err.message,
                        () => { }
                    );

                    return res.status(500).json({
                        status: false,
                        message: "Failed to create Integration Service. Please try again later.",
                        error: err.message, // optional: remove in production
                        token: newToken,
                    });
                }

                Common.adminActivityLog(
                    ipAddress,
                    ipType,
                    admin_id,
                    "IntegratedService",
                    "Create",
                    "1",
                    JSON.stringify({ id: result[0] }), // Sequelize INSERT returns [insertId]
                    null,
                    () => { }
                );

                return res.status(201).json({
                    status: true,
                    message: "Integration Service has been created successfully.",
                    integratedService: {
                        id: result[0],
                        type,
                        data,
                        export_format
                    },
                    token: newToken,
                });
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
    const action = "integrated_service";
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

            IntegratedService.list((err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res
                        .status(500)
                        .json({ status: false, message: err.message, token: newToken });
                }

                res.json({
                    status: true,
                    message: "IntegratedServices fetched successfully",
                    services: result,
                    totalResults: result.length,
                    token: newToken,
                });
            });
        });
    });
};

exports.getIntegratedServiceById = (req, res) => {
    const { id, admin_id, _token } = req.query;
    let missingFields = [];
    if (!id || id === "") missingFields.push("IntegratedService ID");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }
    const action = "integrated_service";
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

            IntegratedService.getIntegratedServiceById(id, (err, currentIntegratedService) => {
                if (err) {
                    console.error("Error fetching integratedService data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                if (!currentIntegratedService) {
                    return res.status(404).json({
                        status: false,
                        message: "IntegratedService not found",
                        token: newToken,
                    });
                }

                res.json({
                    status: true,
                    message: "IntegratedService retrieved successfully",
                    integratedService: currentIntegratedService,
                    token: newToken,
                });
            });
        });
    });
};

// Controller to update a integratedService
exports.update = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        id,
        type,
        data,
        export_format,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    if (!id || id === "") missingFields.push("IntegratedService ID");
    if (!data || data === "") missingFields.push("Data");
    if (!export_format || export_format === "") missingFields.push("Export Format");
    if (!type || type === "") missingFields.push("Type");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }
    const action = "integrated_service";
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

            IntegratedService.getIntegratedServiceById(id, (err, currentIntegratedService) => {
                if (err) {
                    console.error("Error fetching integratedService data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                const changes = {};
                if (currentIntegratedService.data !== data) {
                    changes.data = {
                        old: currentIntegratedService.data,
                        new: data,
                    };
                }

                if (currentIntegratedService.export_format !== export_format) {
                    changes.export_format = {
                        old: currentIntegratedService.export_format,
                        new: export_format,
                    };
                }

                IntegratedService.update(
                    id,
                    type,
                    data,
                    export_format,
                    (err, result) => {
                        if (err) {
                            console.error("Database error:", err);
                            Common.adminActivityLog(
                                ipAddress,
                                ipType,
                                admin_id,
                                "IntegratedService",
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
                            "IntegratedService",
                            "Update",
                            "1",
                            JSON.stringify({ id, ...changes }),
                            null,
                            () => { }
                        );

                        return res.json({
                            status: true,
                            message: "IntegratedService updated successfully",
                            token: newToken,
                        });
                    }
                );
            });
        });
    });
};

// Controller to delete a integratedService
exports.delete = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const { id, admin_id, _token } = req.query;

    let missingFields = [];
    if (!id || id === "") missingFields.push("IntegratedService ID");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }
    const action = "integrated_service";
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

            IntegratedService.getIntegratedServiceById(id, (err, currentIntegratedService) => {
                if (err) {
                    console.error("Error fetching integratedService data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                IntegratedService.delete(id, (err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "IntegratedService",
                            "Delete",
                            "0",
                            JSON.stringify({ id, ...currentIntegratedService }),
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
                        "IntegratedService",
                        "Delete",
                        "1",
                        JSON.stringify(currentIntegratedService),
                        null,
                        () => { }
                    );

                    return res.json({
                        status: true,
                        message: "IntegratedService deleted successfully",
                        token: newToken,
                    });
                });
            });
        });
    });
};
