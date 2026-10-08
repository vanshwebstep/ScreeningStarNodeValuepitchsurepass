const nodemailer = require("nodemailer");
const { sequelize } = require("../../../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");

// Function to generate HTML table from service details
const generateTable = (services) => {
  // If services is not an object or is empty, return a default message
  if (typeof services !== 'object' || Object.keys(services).length === 0) {
    console.log("No services found or services is empty.");
    return `<tr>
              <td colspan="3" style="text-align: center;">No instructions available for the selected services.</td>
            </tr>`;
  }

  // Map through services to generate table rows
  let rows = Object.keys(services)
    .map((key, index) => {
      const service = services[key];

      // Determine the status class and status text
      const statusClass = service.is_submitted ? "status-filled" : "status-unfilled";
      const statusText = service.is_submitted ? "✔ Filled" : "✘ Not Filled";

      // Return the table row for the service
      return `<tr>
                <td>${service.heading}</td> <!-- Service Name -->
                <td class="${statusClass}">${statusText}</td> <!-- Status -->
              </tr>`;
    })
    .join(""); // Join all rows into a single string

  return rows; // Return the generated table rows
};

// Function to send email
async function reminderMail(
  mailModule,
  action,
  candidate_name,
  customer_name,
  branch_name,
  bgv_href,
  dav_href,
  serviceData,
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

    // Generate the HTML table from service details
    const table_rows = generateTable(serviceData);

    // Check if the bgvHref and davHref are present and create links accordingly
    const bgvLinkButton = bgv_href ? `<a href="${bgv_href}" target="_blank">BGV Link</a>` : '';
    const davLinkButton = dav_href ? `<a href="${dav_href}" target="_blank">DAV Link</a>` : '';  // Updated link text to be DAV Link instead of BGV Link

    // Replace placeholders in the email template
    let template = email.template
      .replace(/{{candidate_name}}/g, candidate_name)
      .replace(/{{customer_name}}/g, customer_name)
      .replace(/{{branch_name}}/g, branch_name)
      .replace(/{{table_rows}}/g, table_rows)
      .replace(/{{bgvLinkButton}}/g, bgvLinkButton)
      .replace(/{{davLinkButton}}/g, davLinkButton);

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
      throw new Error(
        "Failed to prepare recipient list due to invalid recipient data"
      );
    }

    const toEmails = toArr.map((email) => email.email.trim().toLowerCase());

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
        // Filter out CC emails that are already in the toList
        return emails
          .filter(
            (email) => email && !toEmails.includes(email.trim().toLowerCase()) // Check against toEmails
          )
          .map((email) => `"${entry.name}" <${email.trim()}>`) // Ensure valid and trimmed emails
          .join(", ");
      })
      .filter((cc) => cc !== "") // Remove any empty CCs from failed parses
      .join(", ");

    // Send email
    const info = await transporter.sendMail({
      from: `"${smtp.title}" <${smtp.username}>`,
      to: toList, // Main recipient list
      cc: ccList, // CC recipient list
      bcc: '',
      subject: email.title,
      html: template,
    });

    console.log("Email sent successfully:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  } finally {
     // Ensure the connection is released
  }
}

module.exports = { reminderMail };
