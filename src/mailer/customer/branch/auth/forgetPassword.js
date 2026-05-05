const nodemailer = require("nodemailer");
const { sequelize } = require("../../../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");

// Function to send password reset email
async function forgetPassword(mailModule, action, branch_name, reset_link, toArr, ccArr) {

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
      .replace(/{{branch_name}}/g, branch_name)
      .replace(/{{reset_link}}/g, reset_link);

    // Validate recipient email(s)
    if (!Array.isArray(toArr) || toArr.length === 0) {
      throw new Error("No recipient email provided");
    }

    // Prepare recipient list
    const toList = toArr
      .map((recipient) => {
        if (recipient && recipient.name && recipient.email) {
          return `"${recipient.name}" <${recipient.email.trim()}>`;
        }
        console.warn("Invalid recipient object:", recipient);
        return null;
      })
      .filter(Boolean)
      .join(", ");

    // Prepare CC list
    const ccList = ccArr
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

        // Remove emails that are already in the toList
        return emails
          .filter(
            (email) => email && !toArr.includes(email.trim().toLowerCase()) // Check against toArr
          )
          .map((email) => `"${entry.name}" <${email.trim()}>`) // Format valid emails
          .join(", ");
      })
      .filter((cc) => cc !== "") // Remove any empty CC entries
      .join(", ");


    if (!toList) {
      throw new Error("Failed to prepare recipient list due to invalid recipient data");
    }

    // Send email
    const info = await transporter.sendMail({
      from: `"${smtp.title}" <${smtp.username}>`,
      to: toList,
      cc: ccList, // CC recipient list
      // bcc: `"Rohit Webstep" <rohitwebstep@gmail.com>`,
      subject: email.title,
      html: template,
    });

    console.log("Password reset email sent successfully:", info.response);
  } catch (error) {
    console.error("Error sending password reset email:", error);
  } finally {
    // Ensure the connection is released
  }
}

module.exports = { forgetPassword };
