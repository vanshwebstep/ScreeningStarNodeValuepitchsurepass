const nodemailer = require("nodemailer");
const path = require("path");
const { sequelize } = require("../../../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");

// Function to generate HTML table from service details
const generateTable = (services) => {
  if (!Array.isArray(services) || services.length === 0) {
    return `<tr>
              <td colspan="3" style="text-align: center;">No instructions available for the selected services.</td>
            </tr>`;
  }

  let rows = services.map((service, index) => {
    const [title, description] = service.split(":"); // Split the service into title and description
    return `<tr>
              <td>${index + 1}</td> <!-- Serial number -->
              <td>${title}</td> <!-- Title -->
              <td>${description.trim()}</td> <!-- Description -->
            </tr>`;
  }).join("");

  return rows;
};

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
async function createMail(
  mailModule,
  action,
  name,
  company_name,
  application_id,
  href,
  services,
  toArr,
  ccArr
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

    // Create attachments
    const attachments = await createAttachments('https://screeningstar.in/attachments/candidate_dropbox/mail/document_checklist.pdf');
    if (attachments.length === 0) {
      console.warn("No valid attachments to send.");
    }

    // Generate the HTML table from service details
    const table_rows = generateTable(services);

    // Replace placeholders in the email template
    let template = email.template
      .replace(/{{candidate_name}}/g, name)
      .replace(/{{company_name}}/g, company_name)
      .replace(/{{table_rows}}/g, table_rows)
      .replace(/{{form_href}}/g, href);

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

        return emails
          .filter((email) => email) // Filter out invalid emails
          .map((email) => `"${entry.name}" <${email.trim()}>`) // Ensure valid and trimmed emails
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
      .map((recipient) => {
        if (recipient && recipient.name && recipient.email) {
          return `"${recipient.name}" <${recipient.email.trim()}>`;
        }
        console.warn("Invalid recipient object:", recipient);
        return null;
      })
      .filter(Boolean)
      .join(", ");

    if (!toList) {
      throw new Error("Failed to prepare recipient list due to invalid recipient data");
    }

    console.log(`toList - `, toList);
    console.log(`ccList - `, ccList);

    // Send email
    const info = await transporter.sendMail({
      from: `"${smtp.title}" <${smtp.username}>`,
      to: toList, // Main recipient list
      cc: ccList, // CC recipient list
      subject: email.title,
      html: template,
      ...(attachments.length > 0 && { attachments }),
    });

    console.log("Email sent successfully:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  } finally {
    // Ensure the connection is released
  }
}

module.exports = { createMail };
