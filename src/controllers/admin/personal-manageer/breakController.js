const Admin = require("../../../models/admin/adminModel");
const App = require("../../../models/appModel");
const Break = require("../../../models/admin/personal-manager/breakModel");
const UserHistory = require("../../../models/admin/userHistoryModel");

const Common = require("../../../models/admin/commonModel");
const { getClientIpAddress } = require("../../../utils/ipAddress");

exports.create = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        type,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    if (!type || type === "") missingFields.push("Break Type");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    /*
    const action = "personal_manager";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            // Check the status returned by the authorization function
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }
            */

    Common.isAdminTokenValid(_token, admin_id, (err, result) => {
        if (err) {
            console.error("Error checking token validity:", err);
            return res.status(500).json(err);
        }

        if (!result.status) {
            return res.status(401).json({ status: false, message: result.message });
        }

        const newToken = result.newToken;

        Break.create(
            {
                type: type.toLowerCase(),
                admin_id,
            },
            (err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Break",
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
                    "Break",
                    "Create",
                    "1",
                    `{id: ${result.insertId}}`,
                    null,
                    () => { }
                );

                res.json({
                    status: true,
                    message: `${type} done`,
                    result,
                    token: newToken,
                });
            }
        );
    });
    /*
});
*/
};


exports.view = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

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

    /*
    const action = "personal_manager";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            // Check the status returned by the authorization function
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }
            */

    Common.isAdminTokenValid(_token, admin_id, (err, result) => {
        if (err) {
            console.error("Error checking token validity:", err);
            return res.status(500).json(err);
        }

        if (!result.status) {
            return res.status(401).json({ status: false, message: result.message });
        }

        const newToken = result.newToken;

        Break.view(admin_id, (err, result) => {
            if (err) {
                console.error("Database error:", err);

                return res.status(500).json({
                    status: false,
                    message: err.message,
                    token: newToken
                });
            }

            res.json({
                status: true,
                result,
                token: newToken
            });
        });

    });
    /*
});
*/
};
