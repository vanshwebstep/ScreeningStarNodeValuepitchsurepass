const nodemailer = require("nodemailer");
const { sequelize } = require("../../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");

// Function to send email
async function TeamManagementSubmitMail(
    mailModule,
    action,
    customer_name,
    candidate_name,
    application_id,
    toArr,
    toCC
) {
    try {
        // Fetch email template
        const [emailRows] = await sequelize.query("SELECT * FROM emails WHERE module = ? AND action = ? AND status = 1", {
            replacements: [mailModule, action],
            type: QueryTypes.SELECT,
        });
        if (emailRows.length === 0) throw new Error("Email template not found");
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

        // Replace placeholders in the email template
        let template = email.template
            .replace(/{{company_name}}/g, customer_name)
            .replace(/{{candidate_name}}/g, candidate_name)
            .replace(/{{application_id}}/g, application_id);

        // Prepare recipient list based on whether the branch is a head branch
        console.log('toArr', toArr)
        const recipientList = toArr.map(
            (customer) => `"${customer.name}" <${customer.email}>`
        );

        // Prepare CC list
        const ccList = toCC
            .map((entry) => {
                let emails = [];
                try {
                    if (Array.isArray(entry.email)) {
                        emails = entry.email;
                    } else if (typeof entry.email === "string") {
                        let cleanedEmail = entry.email
                            .trim()
                            .replace(/\\"/g, '"')
                            .replace(/^"|"$/g, "");

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

        console.log('recipientList', recipientList);
        console.log("CC List:", ccList);

        let emailTitle = email.title.replace(/{{application_id}}/g, application_id);
        // Send email to the prepared recipient list
        const info = await transporter.sendMail({
            from: `"${smtp.title}" <${smtp.username}>`,
            to: recipientList.join(", "), // Join the recipient list into a string
            cc: ccList,
            subject: emailTitle,
            html: template,
        });

        console.log("Email sent successfully:", info.response);
    } catch (error) {
        console.error("Error sending email:", error.message);
    } finally {

    }
}

module.exports = { TeamManagementSubmitMail };
