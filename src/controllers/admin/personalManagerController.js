const Admin = require("../../models/admin/adminModel");
const App = require("../../models/appModel");
const PersonalManager = require("../../models/admin/personalManagerModel");
const UserHistory = require("../../models/admin/userHistoryModel");

const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

const {
    createMail,
} = require("../../mailer/admin/personal-manager/createMail");
const {
    responseMail,
} = require("../../mailer/admin/personal-manager/responseMail");

const fs = require("fs");
const path = require("path");
const { upload, saveImage, saveImages } = require("../../utils/cloudImageSave");

exports.create = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        ticket_date,
        employee_name,
        employee_id,
        from_date,
        to_date,
        purpose_of_leave,
        remarks,
        admin_id,
        _token,
        photo,
    } = req.body;

    let missingFields = [];
    if (!ticket_date || ticket_date === "") missingFields.push("Ticket Date");
    if (!employee_name || employee_name === "")
        missingFields.push("Employee Name");
    if (!employee_id || employee_id === "") missingFields.push("Employee ID");
    if (!from_date || from_date === "") missingFields.push("From Date");
    if (!to_date || to_date === "") missingFields.push("To Date");
    if (!purpose_of_leave || purpose_of_leave === "")
        missingFields.push("Purpose of Leave");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const photoUrl = photo ? photo : null;
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

        PersonalManager.create(
            {
                ticket_date,
                employee_name,
                employee_id,
                from_date,
                to_date,
                purpose_of_leave,
                remarks,
                admin_id,
                photo: photoUrl,
            },
            (err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Personal Manager",
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
                    "Personal Manager",
                    "Create",
                    "1",
                    `{id: ${result.insertId}}`,
                    null,
                    () => { }
                );

                PersonalManager.findById(
                    result.insertId,
                    async (err, currentPersonalManager) => {
                        if (err) {
                            console.error("Error retrieving Personal Manager:", err);
                            return res.status(500).json({
                                status: false,
                                message:
                                    "An internal server error occurred while retrieving the personal manager details. Please try again later.",
                            });
                        }

                        if (!currentPersonalManager) {
                            return res.status(404).json({
                                status: false,
                                message:
                                    "The requested leave record could not be found. Please verify the Personal Manager ID and try again.",
                            });
                        }

                        const toArr = [
                            {
                                name: "Manjunath",
                                email: "manjunath@screeningstar.com",
                            },
                            {
                                name: "HR",
                                email: "hr@screeningstar.com",
                            },
                        ];

                        const toCC = [
                            { name: "QC Team", email: "qc@screeningstar.com" },
                            // { name: "Rohit Webstep", email: "rohitwebstep@gmail.com" },
                        ];

                        // const toCC = [
                        //     {
                        //         name: 'Manjunath',
                        //         email: 'manjunath@screeningstar.com',
                        //     },{
                        //         name: 'HR',
                        //         email: 'hr@screeningstar.com',
                        //     }
                        // ];
                        // Send an email notification
                        createMail(
                            "personal manager",
                            "create",
                            currentPersonalManager.photo,
                            currentPersonalManager.ticket_date,
                            currentPersonalManager.employee_name,
                            currentPersonalManager.employee_id,
                            currentPersonalManager.from_date,
                            currentPersonalManager.to_date,
                            currentPersonalManager.purpose_of_leave,
                            currentPersonalManager.remarks,
                            toArr,
                            toCC
                        )
                            .then(() => {
                                return res.status(201).json({
                                    status: true,
                                    message: "Admin created and email sent successfully.",
                                    token: newToken,
                                });
                            })
                            .catch((emailError) => {
                                console.error("Error sending email:", emailError);
                                return res.status(201).json({
                                    status: true,
                                    message:
                                        "Admin created successfully, but email sending failed.",
                                    token: newToken,
                                });
                            });
                    }
                );
            }
        );
    });
    /*
  });
  */
};

exports.update = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        personal_manager_id,
        ticket_date,
        employee_name,
        employee_id,
        from_date,
        to_date,
        purpose_of_leave,
        remarks,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    if (!personal_manager_id || personal_manager_id === "")
        missingFields.push("Personal Manager ID");
    if (!ticket_date || ticket_date === "") missingFields.push("Ticket Date");
    if (!employee_name || employee_name === "")
        missingFields.push("Employee Name");
    if (!employee_id || employee_id === "") missingFields.push("Employee ID");
    if (!from_date || from_date === "") missingFields.push("From Date");
    if (!to_date || to_date === "") missingFields.push("To Date");
    if (!purpose_of_leave || purpose_of_leave === "")
        missingFields.push("Purpose of Leave");
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

        PersonalManager.update(
            personal_manager_id,
            {
                ticket_date,
                employee_name,
                employee_id,
                from_date,
                to_date,
                purpose_of_leave,
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
                        "Personal Manager",
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
                    "Personal Manager",
                    "Update",
                    "1",
                    `{id: ${result.insertId}}`,
                    null,
                    () => { }
                );

                res.json({
                    status: true,
                    message: "Personal Manager updated successfully",
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

exports.response = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);
    const { personal_manager_id, status, admin_id, _token } = req.body;

    // Validate required fields
    let missingFields = [];
    if (!personal_manager_id) missingFields.push("Personal Manager ID");
    if (!status) missingFields.push("Status");
    if (!admin_id) missingFields.push("Administrator ID");
    if (!_token) missingFields.push("Authentication Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `The following required fields are missing: ${missingFields.join(
                ", "
            )}. Please provide all necessary details.`,
        });
    }

    // Validate status (must be 1 or 2)
    if (status !== 1 && status !== 2) {
        return res.status(400).json({
            status: false,
            message:
                "The provided status is invalid. Please ensure the status is either 1 (Approved) or 2 (Rejected).",
        });
    }

    const action = "personal_manager";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            return res.status(403).json({
                status: false,
                message: `Access denied`,
            });
        }

        PersonalManager.findById(
            personal_manager_id,
            async (err, currentPersonalManager) => {
                if (err) {
                    console.error("Error retrieving Personal Manager:", err);
                    return res.status(500).json({
                        status: false,
                        message:
                            "An internal server error occurred while retrieving the personal manager details. Please try again later.",
                    });
                }

                if (!currentPersonalManager) {
                    return res.status(404).json({
                        status: false,
                        message:
                            "The requested leave record could not be found. Please verify the Personal Manager ID and try again.",
                    });
                }

                const leaveDate = new Date(currentPersonalManager.from_date);
                const currentDate = new Date();

                /*
                // Compare leave date with current date
                if (leaveDate <= currentDate) {
                    return res.status(400).json({
                        status: false,
                        message:
                            "This leave request is no longer available for response as the specified leave date has already passed or is today.",
                    });
                }
                */

                Common.isAdminTokenValid(_token, admin_id, (err, result) => {
                    if (err) {
                        console.error("Error verifying authentication token:", err);
                        return res.status(500).json({
                            status: false,
                            message:
                                "An error occurred while validating the authentication token. Please try again.",
                        });
                    }

                    if (!result.status) {
                        return res.status(401).json({
                            status: false,
                            message: `Authentication failed`,
                        });
                    }

                    const newToken = result.newToken;

                    PersonalManager.response(
                        personal_manager_id,
                        status,
                        (err, result) => {
                            if (err) {
                                console.error("Database error:", err);
                                Common.adminActivityLog(
                                    ipAddress,
                                    ipType,
                                    admin_id,
                                    "Personal Manager",
                                    "Response",
                                    "0",
                                    null,
                                    err,
                                    () => { }
                                );

                                return res.status(500).json({
                                    status: false,
                                    message:
                                        "An error occurred while saving the response. Please try again later.",
                                    token: newToken,
                                });
                            }

                            Common.adminActivityLog(
                                ipAddress,
                                ipType,
                                admin_id,
                                "Personal Manager",
                                "Response",
                                "1",
                                `{id: ${result.insertId}}`,
                                null,
                                () => { }
                            );

                            Admin.findById(
                                currentPersonalManager.admin_id,
                                async (err, currentAdmin) => {
                                    if (err) {
                                        console.error("Error retrieving Admin:", err);
                                        return res.status(500).json({
                                            status: false,
                                            message: "Database error.",
                                            token: newToken,
                                        });
                                    }

                                    if (!currentAdmin) {
                                        return res.status(404).json({
                                            status: false,
                                            message: "Admin not found.",
                                            token: newToken,
                                        });
                                    }

                                    const toArr = [
                                        {
                                            name: currentAdmin.name,
                                            email: currentAdmin.email,
                                        },
                                    ];

                                    // Determine the status message based on the status
                                    let statusMessage = "";
                                    if (status === 1) {
                                        statusMessage = "ACCEPTED";
                                    } else {
                                        statusMessage = "REJECTED";
                                    }

                                    const toEmails = [
                                        { name: "BGV Team", email: "bgv@screeningstar.com" },
                                        {
                                            name: "Manjunath",
                                            email: " manjunath@screeningstar.com",
                                        },
                                    ];

                                    const toCC = [
                                        { name: "QC Team", email: "qc@screeningstar.com" },
                                    ];

                                    // Send an email notification
                                    responseMail(
                                        "personal manager",
                                        "response",
                                        currentPersonalManager.employee_name,
                                        statusMessage,
                                        currentPersonalManager.from_date,
                                        currentPersonalManager.to_date,
                                        currentPersonalManager.purpose_of_leave,
                                        currentPersonalManager.remarks,
                                        toEmails,
                                        toCC
                                    )
                                        .then(() => {
                                            return res.status(201).json({
                                                status: true,
                                                message:
                                                    "Response to the personal manager leave request has been successfully recorded.",
                                                token: newToken,
                                            });
                                        })
                                        .catch((emailError) => {
                                            console.error("Error sending email:", emailError);
                                            return res.status(201).json({
                                                status: true,
                                                message:
                                                    "Response to the personal manager leave request has been successfully recorded.",
                                                token: newToken,
                                            });
                                        });
                                }
                            );
                        }
                    );
                });
            }
        );
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
    const action = "personal_manager";
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

            PersonalManager.list((err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res
                        .status(500)
                        .json({ status: false, message: err.message, token: newToken });
                }

                res.json({
                    status: true,
                    message: "Personal Manager fetched successfully",
                    services: result,
                    totalResults: result.length,
                    token: newToken,
                });
            });
        });
    });
};

exports.attendanceIndex = (req, res) => {
    const { admin_id, _token, from, to } = req.query;

    // Step 1: Validate required fields
    let missingFields = [];
    if (!admin_id || admin_id.trim() === "") missingFields.push("Admin ID");
    if (!_token || _token.trim() === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    // Step 2: Parse from and to values
    const parseMonthYear = (str) => {
        if (!str || !/^\d{2}\/\d{4}$/.test(str)) return null;
        const [monthStr, yearStr] = str.split("/");
        const month = parseInt(monthStr, 10);
        const year = parseInt(yearStr, 10);
        if (isNaN(month) || isNaN(year)) return null;
        return { month, year };
    };

    const now = new Date();

    const fromParsed = parseMonthYear(from) || {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
    };

    const toParsed = parseMonthYear(to) || {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
    };

    const { month: fromMonth, year: fromYear } = fromParsed;
    const { month: toMonth, year: toYear } = toParsed;

    const action = "user_history";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            return res.status(403).json({
                status: false,
                err: result,
                message: result.message,
            });
        }

        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({
                    status: false,
                    err: result,
                    message: result.message,
                });
            }

            const newToken = result.newToken;

            UserHistory.attendanceIndex(fromMonth, fromYear, toMonth, toYear, (err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                        status: false,
                        err,
                        message: err.message,
                        token: newToken,
                    });
                }

                return res.json({
                    status: true,
                    message: "Admins History fetched successfully",
                    data: {
                        attendance_records: result.attendance_records,
                        leave_summary: result.leave_summary,
                    },
                    totalResults: {
                        attendance_records: result.attendance_records.length,
                        leave_summary: result.leave_summary.length,
                    },
                    token: newToken,
                    fromMonth,
                    fromYear,
                    toMonth,
                    toYear,
                });
            });
        });
    });
};

exports.myList = (req, res) => {
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
    /*
      const action = "client_overview";
      Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
          if (!result.status) {
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

        PersonalManager.myList(admin_id, (err, result) => {
            if (err) {
                console.error("Database error:", err);
                return res
                    .status(500)
                    .json({ status: false, message: err.message, token: newToken });
            }

            res.json({
                status: true,
                message: "Personal Manager fetched successfully",
                services: result,
                totalResults: result.length,
                token: newToken,
            });
        });
    });
    /*
  });
  */
};

exports.upload = async (req, res) => {
    try {
        // Handle file upload using Multer
        upload(req, res, async (err) => {
            if (err) {
                return res
                    .status(400)
                    .json({ status: false, message: "Error uploading file." });
            }

            // Destructure required fields from request body
            const { admin_id: adminId, _token: token, id, send_mail } = req.body;

            // Validate required fields
            const requiredFields = { adminId, token, id };

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

            const sendMail =
                parseInt(send_mail, 10) === 0 || parseInt(send_mail, 10) === 1
                    ? parseInt(send_mail, 10)
                    : 1;

            PersonalManager.findById(id, async (err, currentPersonalManager) => {
                if (err) {
                    console.error("Error retrieving Admin:", err);
                    return res.status(500).json({
                        status: false,
                        message: "Database error.",
                    });
                }

                if (!currentPersonalManager) {
                    return res.status(404).json({
                        status: false,
                        message: "Admin not found.",
                    });
                }

                const action = "admin_access";
                // Check authorization
                /*
                        Common.isAdminAuthorizedForAction(
                            adminId,
                            action,
                            async (authResult) => {
                                if (!authResult.status) {
                                    return res.status(403).json({
                                        status: false,
                                        err: authResult,
                                        message: authResult.message,
                                    });
                                }
                                    */

                // Validate token
                Common.isAdminTokenValid(token, adminId, async (err, tokenResult) => {
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
                    const targetDirectory = `uploads/personal-manager`;

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
                        PersonalManager.upload(id, savedImagePaths, (success, result) => {
                            if (!success) {
                                return res.status(500).json({
                                    status: false,
                                    message: result || "Error occurred while saving images.",
                                    token: newToken,
                                    savedImagePaths,
                                });
                            }
                            if (result && result.affectedRows > 0) {
                                console.log("sendMail is exist", sendMail);
                                if (sendMail === 1) {
                                    const newAttachedDocsString = savedImagePaths
                                        .map((doc) => `${doc.trim()}`)
                                        .join(",");

                                    const toArr = [
                                        {
                                            name: "Manjunath",
                                            email: "manjunath@screeningstar.com",
                                        },
                                        {
                                            name: "HR",
                                            email: "hr@screeningstar.com",
                                        },
                                    ];

                                    const toCC = [
                                        { name: "QC Team", email: "qc@screeningstar.com" },
                                    ];

                                    // const toCC = [
                                    //     {
                                    //         name: 'Manjunath',
                                    //         email: 'manjunath@screeningstar.com',
                                    //     },{
                                    //         name: 'HR',
                                    //         email: 'hr@screeningstar.com',
                                    //     }
                                    // ];
                                    // Send an email notification
                                    createMail(
                                        "personal manager",
                                        "create",
                                        currentPersonalManager.photo,
                                        currentPersonalManager.ticket_date,
                                        currentPersonalManager.employee_name,
                                        currentPersonalManager.employee_id,
                                        currentPersonalManager.from_date,
                                        currentPersonalManager.to_date,
                                        currentPersonalManager.purpose_of_leave,
                                        currentPersonalManager.remarks,
                                        toArr,
                                        toCC
                                    )
                                        .then(() => {
                                            return res.status(201).json({
                                                status: true,
                                                message: "Admin created and email sent successfully.",
                                                token: newToken,
                                            });
                                        })
                                        .catch((emailError) => {
                                            console.error("Error sending email:", emailError);
                                            return res.status(201).json({
                                                status: true,
                                                message:
                                                    "Admin created successfully, but email sending failed.",
                                                token: newToken,
                                            });
                                        });
                                } else {
                                    return res.status(201).json({
                                        status: true,
                                        message: "Admin created and email sent successfully.",
                                        token: newToken,
                                    });
                                }
                            } else {
                                return res.status(400).json({
                                    status: false,
                                    message: "No changes were made. Check Admin ID.",
                                    token: newToken,
                                });
                            }
                        });
                    });
                });
                /*
                    }
                );
                */
            });
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return res
            .status(500)
            .json({ status: false, message: "Unexpected server error." });
    }
};

exports.delete = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);
    const { personal_manager_id, admin_id, _token } = req.query;

    // Validate required fields
    const missingFields = [];
    if (!personal_manager_id) missingFields.push("Personal Manager ID");
    if (!admin_id) missingFields.push("Admin ID");
    if (!_token) missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "personal_manager";
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
            PersonalManager.delete(personal_manager_id, (err, result) => {
                if (err) {
                    console.error("Database error during Admin deletion:", err);
                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Personal Manager",
                        "Delete",
                        "0",
                        JSON.stringify({ personal_manager_id }),
                        err,
                        () => { }
                    );
                    return res.status(500).json({
                        status: false,
                        message: "Failed to delete Personal Manager. Please try again.",
                        token: newToken,
                    });
                }

                Common.adminActivityLog(
                    ipAddress,
                    ipType,
                    admin_id,
                    "Personal Manager",
                    "Delete",
                    "1",
                    JSON.stringify({ personal_manager_id }),
                    null,
                    () => { }
                );

                res.status(200).json({
                    status: true,
                    message: "Personal Manager deleted successfully.",
                    token: newToken,
                });
            });
        });
    });
};
