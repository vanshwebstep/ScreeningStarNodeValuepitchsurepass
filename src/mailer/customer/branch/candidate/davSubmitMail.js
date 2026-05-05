const nodemailer = require("nodemailer");
const path = require("path");
const { sequelize } = require("../../../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");

// Function to check if a file exists
const checkFileExists = async (url) => {
    try {
        const response = await fetch(url, { method: "HEAD" });
        return response.ok; // Returns true if the status is in the range 200-299
    } catch {
        return false; // Return false if there was an error (e.g., network issue)
    }
};

// Function to create attachments from URLs
const createAttachments = async (attachments_url) => {
    const urls = Array.isArray(attachments_url)
        ? attachments_url
        : typeof attachments_url === "string"
            ? attachments_url.split(",")
            : [];

    const attachments = [];

    for (const url of urls) {
        const trimmedUrl = url.trim();
        if (trimmedUrl) {
            const exists = await checkFileExists(trimmedUrl);
            if (exists) {
                const trimmedSenitizedUrl = trimmedUrl.replace(/\\/g, "/");
                const filename = path.basename(trimmedUrl); // Extract the filename from the URL
                attachments.push({
                    filename: filename,
                    path: trimmedSenitizedUrl,
                });
            } else {
                console.warn(`File does not exist: ${trimmedUrl}`); // Log warning for missing file
            }
        } else {
            console.warn(`Empty or invalid URL: ${url}`); // Log warning for invalid URL
        }
    }

    return attachments;
};

// Function to send email
async function davSubmitMail(
    mailModule,
    action,
    candidate_name,
    company_name,
    attachments_url,
    toArr,
    ccArr,
    bccArr
) {
    try {
        // Fetch email template
        const [emailRows] = await sequelize.query("SELECT * FROM emails WHERE module = ? AND action = ? AND status = 1", {
            replacements: [mailModule, action],
            type: QueryTypes.SELECT,
        });
        if (!emailRows || emailRows.length === 0) throw new Error("Email template not found");
        const email = emailRows;  // Assign the first (and only) element to email

        // Fetch SMTP credentials
        const [smtpRows] = await sequelize.query("SELECT * FROM smtp_credentials WHERE module = ? AND action = ? AND status = '1'", {
            replacements: [mailModule, action],
            type: QueryTypes.SELECT,
        });
        if (smtpRows.length === 0) throw new Error("SMTP credentials not found");
        const smtp = smtpRows;  // Assign the first (and only) element to smtp

        // Create transporter
        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure, // true for 465, false for other ports
            auth: {
                user: smtp.username,
                pass: smtp.password,
            },
        });

        // Create attachments
        const attachments = await createAttachments(attachments_url);
        if (attachments.length === 0) {
            console.warn("No valid attachments to send.");
        }

        // Replace placeholders in the email template
        let template = email.template
            .replace(/{{candidate_name}}/g, candidate_name)
            .replace(/{{company_name}}/g, company_name);

        // Prepare CC list
        const ccList = ccArr
            .map((entry) => {
                let emails = [];
                try {
                    if (Array.isArray(entry.email)) {
                        emails = entry.email;
                    } else if (typeof entry.email === "string") {
                        const cleanedEmail = entry.email
                            .trim()
                            .replace(/\\"/g, '"')
                            .replace(/^"|"$/g, "");

                        // Parse JSON if it's an array-like string
                        if (cleanedEmail.startsWith("[") && cleanedEmail.endsWith("]")) {
                            emails = JSON.parse(cleanedEmail);
                        } else {
                            emails = [cleanedEmail];
                        }
                    }
                } catch (e) {
                    console.error("Error parsing email JSON:", entry.email, e);
                    return ""; // Skip this entry if parsing fails
                }

                return emails
                    .filter((email) => email) // Filter out invalid emails
                    .map((email) => `"${entry.name}" <${email.trim()}>`) // Trim to remove whitespace
                    .join(", ");
            })
            .filter((cc) => cc !== "") // Remove any empty CCs from failed parses
            .join(", ");

        // Validate recipient email(s)
        if (!toArr || toArr.length === 0) {
            throw new Error("No recipient email provided");
        }

        // Prepare recipient list
        const toList = toArr
            .map((email) => `"${email.name}" <${email.email}>`)
            .join(", ");
        const bccList = (bccArr || [])
            .map((entry) => `"${entry.name}" <${entry.email}>`)
            .join(", ");

        // Send email
        const mailOptions = {
            from: `"${smtp.title}" <${smtp.username}>`,
            to: toList,
            cc: ccList,
            bcc: bccList,
            subject: email.title,
            html: template,
            ...(attachments.length > 0 && { attachments }), // Only include attachments if present
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info.response);
    } catch (error) {
        console.error("Error sending email:", error.message);
    } finally {

    }
}

module.exports = { davSubmitMail };
