const ClientApplication = require("../../../../../models/customer/branch/clientApplicationModel");
const BranchCommon = require("../../../../../models/customer/branch/commonModel");
const Branch = require("../../../../../models/customer/branch/branchModel");
const Service = require("../../../../../models/admin/serviceModel");
const Customer = require("../../../../../models/customer/customerModel");
const AppModel = require("../../../../../models/appModel");
const Admin = require("../../../../../models/admin/adminModel");
const ClientSpoc = require("../../../../../models/admin/clientSpocModel");
const {
    createMail,
} = require("../../../../../mailer/customer/branch/client/createMail");


const { getClientIpAddress } = require("../../../../../utils/ipAddress");

const fs = require("fs");
const path = require("path");
const {
    upload,
    saveImage,
    saveImages,
    saveBase64ImageAndUpload,
    saveImageFromUrlAndUpload,
} = require("../../../../../utils/cloudImageSave");

exports.create = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        access_token,
        name,
        employee_id,
        client_spoc_name,
        location,
        services,
        photo,
        attach_documents,
        package,
        send_mail,
        case_id,
        gender,
        check_id,
        batch_no,
        sub_client,
        ticket_id,
        generate_report_type,
        is_priority,
    } = req.body;

    // Define required fields



    const requiredFields = {
        access_token,
        name,
        generate_report_type
    };

    const isPriority = ["1", 1, "Yes", "yes"].includes(String(is_priority).trim())
        ? 1
        : 0;

    // Check for missing fields
    const missingFields = Object.keys(requiredFields)
        .filter((field) => !requiredFields[field] || requiredFields[field] === "")
        .map((field) => field.replace(/_/g, " "));

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }
    const action = "client_manager";
    Branch.getBranchAndCustomerByAccessToken(access_token, (err, result) => {
        if (err) {
            console.error("Error:", err);
            return res.status(500).json({
                status: false,
                message: "Internal server error. Please try again later.",
                error: err.message,
            });
        }

        if (!result.status) {
            // This means token was invalid or not found
            return res.status(401).json({
                status: false,
                message: result.message || "Invalid or expired access token.",
            });
        }

        const branch = result.data.branch;
        const customer = result.data.customer;

        const branch_id = branch.id;
        const customer_id = customer.id;

        const customerCode = customer.client_unique_id;

        // Check branch authorization
        BranchCommon.isBranchAuthorizedForAction(branch_id, action, (result) => {
            if (!result.status) {
                return res.status(403).json({
                    status: false,
                    message: result.message,
                });
            }

            // Check if employee ID is unique
            ClientApplication.checkUniqueEmpId(employee_id, async (err, exists) => {
                if (err) {
                    console.error("Error checking unique ID:", err);
                    return res
                        .status(500)
                        .json({ status: false, message: err.message, token: access_token });
                }

                if (exists) {
                    return res.status(400).json({
                        status: false,
                        message: `Client Employee ID '${employee_id}' already exists.`,
                        token: access_token,
                    });
                }

                // Create client application
                ClientApplication.create(
                    {
                        name,
                        generate_report_type,
                        employee_id,
                        client_spoc_name,
                        location,
                        branch_id,
                        services,
                        packages: package,
                        customer_id,
                        is_priority: isPriority,
                        case_id,
                        check_id,
                        batch_no,
                        sub_client,
                        ticket_id,
                        gender
                    },
                    (err, result) => {
                        if (err) {
                            console.error(
                                "Database error during client application creation:",
                                err
                            );
                            BranchCommon.branchActivityLog(
                                ipAddress,
                                ipType,
                                branch_id,
                                "Client Application",
                                "Create",
                                "0",
                                null,
                                err,
                                () => { }
                            );
                        }

                        console.log(`result - `, result);
                        const client_application_id = result.results.insertId;
                        const client_application_code = result.new_application_id;

                        AppModel.appInfo("backend", async (err, appInfo) => {
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

                            let savedPhotoPath = null;
                            let savedAttachDocsPaths = [];
                            if (photo) {
                                const photoTargetDirectory = `uploads/customer/${customerCode}/application/${result.new_application_id}/photo`;

                                // console.log("📸 Incoming photo:", photo?.substring(0, 50)); // preview only

                                try {
                                    if (photo.startsWith("data:")) {
                                        console.log("✅ Detected BASE64 image");

                                        const savedPath = await saveBase64ImageAndUpload(
                                            photo,
                                            photoTargetDirectory,
                                            employee_id
                                        );

                                        // console.log("📁 Base64 uploaded path:", savedPath);

                                        savedPhotoPath = `${imageHost}/${savedPath}`;

                                    } else if (photo.startsWith("http")) {
                                        // console.log("🌐 Detected IMAGE URL:", photo);

                                        const savedPath = await saveImageFromUrlAndUpload(
                                            photo,
                                            photoTargetDirectory,
                                            employee_id
                                        );

                                        // console.log("📁 URL uploaded path:", savedPath);

                                        savedPhotoPath = `${imageHost}/${savedPath}`;

                                    } else {
                                        console.log("❌ Unsupported format:", photo);
                                    }

                                } catch (err) {
                                    console.error("🚨 Photo upload failed:", err.message);
                                }
                            }
                            // console.log("🎯 Final savedPhotoPath:", savedPhotoPath);
                            if (attach_documents && attach_documents.length > 0) {
                                const attachDocumentsTargetDirectory = `uploads/customer/${customerCode}/application/${result.new_application_id}/document`;

                                console.log("📎 Total documents received:", attach_documents.length);

                                for (let i = 0; i < attach_documents.length; i++) {
                                    const doc = attach_documents[i];

                                    console.log(`\n📄 Processing document [${i + 1}]`);
                                    console.log("🔍 Preview:", doc?.substring(0, 50));

                                    try {
                                        let savedPath = null;

                                        if (doc.startsWith("data:")) {
                                            console.log("✅ Detected BASE64 document");

                                            savedPath = await saveBase64ImageAndUpload(
                                                doc,
                                                attachDocumentsTargetDirectory
                                            );

                                            console.log("📁 Base64 saved:", savedPath);

                                        } else if (doc.startsWith("http")) {
                                            console.log("🌐 Detected URL document:", doc);

                                            savedPath = await saveImageFromUrlAndUpload(
                                                doc,
                                                attachDocumentsTargetDirectory
                                            );

                                            console.log("📁 URL saved:", savedPath);

                                        } else {
                                            console.log("❌ Unsupported document format");
                                            continue; // skip this file
                                        }

                                        savedAttachDocsPaths.push(`${imageHost}/${savedPath}`);

                                    } catch (err) {
                                        console.error(`🚨 Failed document [${i + 1}]:`, err.message);
                                    }
                                }
                            }
                            console.log("🎯 Final attach docs:", savedAttachDocsPaths);
                            ClientApplication.updateByData(
                                {
                                    photo: savedPhotoPath,
                                    attach_documents: savedAttachDocsPaths.join(",")
                                },
                                client_application_id,
                                (err, updateResult) => {
                                    if (err) {
                                        console.error(
                                            "Database error during client application update:",
                                            err
                                        );
                                        BranchCommon.branchActivityLog(
                                            ipAddress,
                                            ipType,
                                            branch_id,
                                            "Client Application",
                                            "Update",
                                            "0",
                                            JSON.stringify({ client_application_id }),
                                            err,
                                            () => { }
                                        );
                                        return res.status(500).json({
                                            status: false,
                                            message: err.message,
                                            token: newToken,
                                        });
                                    }

                                    BranchCommon.branchActivityLog(
                                        ipAddress,
                                        ipType,
                                        branch_id,
                                        "Client Application",
                                        "Update",
                                        "1",
                                        JSON.stringify({ client_application_id }),
                                        null,
                                        () => { }
                                    );

                                    BranchCommon.branchActivityLog(
                                        ipAddress,
                                        ipType,
                                        branch_id,
                                        "Client Application",
                                        "Create",
                                        "1",
                                        `{id: ${result.insertId}}`,
                                        null,
                                        () => { }
                                    );

                                    if (send_mail == 0) {
                                        return res.status(201).json({
                                            status: true,
                                            message: "Client application created successfully.",
                                            token: access_token,
                                            result,
                                        });
                                    }

                                    let newAttachedDocsString = "";

                                    Branch.getClientUniqueIDByBranchId(
                                        branch_id,
                                        (err, clientCode) => {
                                            if (err) {
                                                console.error("Error checking unique ID:", err);
                                                return res.status(500).json({
                                                    status: false,
                                                    message: err.message,
                                                    token: access_token,
                                                });
                                            }

                                            // Check if the unique ID exists
                                            if (!clientCode) {
                                                return res.status(400).json({
                                                    status: false,
                                                    message: `Customer Unique ID not Found`,
                                                    token: access_token,
                                                });
                                            }

                                            Branch.getClientNameByBranchId(
                                                branch_id,
                                                (err, clientName) => {
                                                    if (err) {
                                                        console.error("Error checking client name:", err);
                                                        return res.status(500).json({
                                                            status: false,
                                                            message: err.message,
                                                            token: access_token,
                                                        });
                                                    }

                                                    // Check if the client name exists
                                                    if (!clientName) {
                                                        return res.status(400).json({
                                                            status: false,
                                                            message: "Customer Unique ID not found",
                                                            token: access_token,
                                                        });
                                                    }

                                                    const serviceIds =
                                                        typeof services === "string" && services.trim() !== ""
                                                            ? services.split(",").map((id) => id.trim())
                                                            : services;

                                                    const serviceNames = [];

                                                    // Function to fetch service names
                                                    const fetchServiceNames = (index = 0) => {
                                                        if (index >= serviceIds.length) {
                                                            AppModel.appInfo(
                                                                "frontend",
                                                                async (err, appInfo) => {
                                                                    if (err) {
                                                                        console.error("Database error:", err);
                                                                        return res.status(500).json({
                                                                            status: false,
                                                                            message:
                                                                                "An error occurred while retrieving application information. Please try again.",
                                                                        });
                                                                    }

                                                                    if (!appInfo) {
                                                                        console.error(
                                                                            "Database error during app info retrieval:",
                                                                            err
                                                                        );
                                                                        return reject(
                                                                            new Error(
                                                                                "Information of the application not found."
                                                                            )
                                                                        );
                                                                    }

                                                                    BranchCommon.getBranchandCustomerEmailsForNotification(
                                                                        branch_id,
                                                                        (emailError, emailData) => {
                                                                            if (emailError) {
                                                                                console.error(
                                                                                    "Error fetching emails:",
                                                                                    emailError
                                                                                );
                                                                                return res.status(500).json({
                                                                                    status: false,
                                                                                    message:
                                                                                        "Failed to retrieve email addresses.",
                                                                                    token: access_token,
                                                                                });
                                                                            }

                                                                            const { branch, customer } = emailData;
                                                                            Admin.list((err, adminResult) => {
                                                                                if (err) {
                                                                                    console.error("Database error:", err);
                                                                                    return res.status(500).json({
                                                                                        status: false,
                                                                                        message:
                                                                                            "Error retrieving admin details.",
                                                                                        token: access_token,
                                                                                    });
                                                                                }

                                                                                // Extract admin emails into adminList
                                                                                const adminList = adminResult.map(
                                                                                    (admin) => ({
                                                                                        name: admin.name,
                                                                                        email: admin.email,
                                                                                    })
                                                                                );
                                                                                const toNewArr = [
                                                                                    { name: 'BGV Team', email: 'bgv@screeningstar.com' },
                                                                                ];

                                                                                const toNewCC = [
                                                                                    { name: 'QC Team', email: 'qc@screeningstar.com' },
                                                                                    // { name: 'Rohit Webstep', email: 'rohitwebstep@gmail.com' },
                                                                                ];
                                                                                const ccArr1 = customer.emails
                                                                                    .split(",")
                                                                                    .map((email) => ({
                                                                                        name: customer.name,
                                                                                        email: email.trim(),
                                                                                    }));

                                                                                const toArr = [
                                                                                    ...ccArr1,
                                                                                    ...adminList.map((admin) => ({
                                                                                        name: admin.name,
                                                                                        email: admin.email,
                                                                                    })),
                                                                                ];
                                                                                const appHost =
                                                                                    appInfo.host || "www.example.com";
                                                                                const appName =
                                                                                    appInfo.name || "Example Company";
                                                                                // Once all services have been processed, send email notification
                                                                                createMail(
                                                                                    "client application",
                                                                                    "create",
                                                                                    name,
                                                                                    result.new_application_id,
                                                                                    clientName,
                                                                                    clientCode,
                                                                                    serviceNames,
                                                                                    newAttachedDocsString,
                                                                                    appHost,
                                                                                    toNewArr,
                                                                                    toNewCC
                                                                                )
                                                                                    .then(() => {
                                                                                        return res.status(201).json({
                                                                                            status: true,
                                                                                            client_application_id: result.results.insertId,
                                                                                            message:
                                                                                                "Client application created successfully and email sent.",
                                                                                            token: access_token,
                                                                                        });
                                                                                    })
                                                                                    .catch((emailError) => {
                                                                                        console.error(
                                                                                            "Error sending email:",
                                                                                            emailError
                                                                                        );
                                                                                        return res.status(201).json({
                                                                                            status: true,
                                                                                            message:
                                                                                                "Client application created successfully, but failed to send email.",
                                                                                            client: result,
                                                                                            token: access_token,
                                                                                        });
                                                                                    });
                                                                            });
                                                                        }
                                                                    );
                                                                }
                                                            );
                                                            return;
                                                        }

                                                        const id = serviceIds[index];

                                                        Service.getServiceById(id, (err, currentService) => {
                                                            if (err) {
                                                                console.error(
                                                                    "Error fetching service data:",
                                                                    err
                                                                );
                                                                return res.status(500).json({
                                                                    status: false,
                                                                    message: err.message,
                                                                    token: access_token,
                                                                });
                                                            }

                                                            // Skip invalid services and continue to the next index
                                                            if (!currentService || !currentService.title) {
                                                                return fetchServiceNames(index + 1);
                                                            }

                                                            // Add the current service name to the array
                                                            serviceNames.push(currentService.title);

                                                            // Recursively fetch the next service
                                                            fetchServiceNames(index + 1);
                                                        });
                                                    };

                                                    // Start fetching service names
                                                    fetchServiceNames();
                                                }
                                            );
                                        }
                                    );
                                }
                            );


                        });


                    });
            });
        });
    });
};

exports.upload = async (req, res) => {
    try {
        // full body
        console.log("Request Body:", req.body);

        // example: if base64 is sent like { file: "base64string..." }
        const { file } = req.body;

        console.log("Base64 File:", file);

        const targetDir = "uploads/base64-images";
        const fileNameSlug = "image";

        const savedPath = await saveBase64ImageAndUpload(
            file,
            targetDir,
            fileNameSlug
        );

        res.status(200).json({
            success: true,
            savedPath,
            message: "Base64 received successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};
