const nodemailer = require("nodemailer");
const { sequelize } = require("../../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");

// Function to send email
async function createMail(
    mailModule,
    action,
    photo,
    ticket_date,
    employee_name,
    employee_id,
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

        let profile_picture_tr = "";
        if (photo) {
            photo = photo.replace(/\\/g, "/");
            profile_picture_tr = `<tr>
        <td><strong>Profile</strong></td>
        <td><img src="${photo}" alt="Profile Picture"></td>
    </tr>`;
        }

        console.log(`Photo: ${photo}, Ticket Date: ${ticket_date}, Name: ${employee_name}, ID: ${employee_id}, From: ${from_date}, To: ${to_date}, Purpose: ${purpose_of_leave}, Remarks: ${remarks}`);

        // Convert YYYY-MM-DD to DD-MM-YYYY
        function formatDate(dateStr) {
            const [year, month, day] = dateStr.split('-');
            return `${day}-${month}-${year}`;
        }

        // Format the date fields
        let formatted_to_date = formatDate(to_date);
        let formatted_from_date = formatDate(from_date);
        let formatted_ticket_date = formatDate(ticket_date);

        // Replace placeholders in the email template
        let template = email.template
            .replace(/{{ticket_date}}/g, formatted_ticket_date)
            .replace(/{{photo_tr}}/g, profile_picture_tr)
            .replace(/{{employee_name}}/g, employee_name)
            .replace(/{{employee_id}}/g, employee_id)
            .replace(/{{from_date}}/g, formatted_from_date)
            .replace(/{{to_date}}/g, formatted_to_date)
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
            subject: email.title,
            html: template,
        });

        console.log("Email sent successfully:", info.response);
    } catch (error) {
        console.error("Error sending email:", error.message);
    } finally {

    }
}

module.exports = { createMail };
