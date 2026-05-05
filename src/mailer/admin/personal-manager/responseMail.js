const nodemailer = require("nodemailer");
const { sequelize } = require("../../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");

// Function to send email
async function responseMail(
    module,
    action,
    employee_name,
    leave_status,
    from_date,
    to_date,
    purpose_of_leave,
    remarks,
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

        let leave_status_class = 'status-rejected';
        if (leave_status == 'ACCEPTED') {
            leave_status_class = 'status-accepted';
        }

        // Replace placeholders in the email template
        let template = email.template
            .replace(/{{employee_name}}/g, employee_name)
            .replace(/{{leave_status_class}}/g, leave_status_class)
            .replace(/{{leave_status}}/g, leave_status)
            .replace(/{{from_date}}/g, from_date)
            .replace(/{{to_date}}/g, to_date)
            .replace(/{{purpose_of_leave}}/g, purpose_of_leave)
            .replace(/{{remarks}}/g, remarks);

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

        // Validate recipient email(s)
        if (!toArr || toArr.length === 0) {
            throw new Error("No recipient email provided");
        }

        // Prepare recipient list
        const toList = toArr
            .map((email) => `"${email.name}" <${email.email}>`)
            .join(", ");

        // Debugging: Log the email lists
        console.log("Recipient List:", toList);
        console.log("CC List:", ccList);

        // Send email to the prepared recipient list
        const info = await transporter.sendMail({
            from: `"${smtp.title}" <${smtp.username}>`,
            to: toList, // Join the recipient list into a string
            cc: ccList,
            subject: email.title.replace(/{{leave_status}}/g, leave_status),
            html: template,
        });

        console.log("Email sent successfully:", info.response);
    } catch (error) {
        console.error("Error sending email:", error.message);
    } finally {
        if (connection) {
            // Ensure the connection is released
        }
    }
}

module.exports = { responseMail };
