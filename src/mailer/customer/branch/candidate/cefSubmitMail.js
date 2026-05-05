const nodemailer = require("nodemailer");
const axios = require("axios");
const fs = require("fs/promises");
const path = require("path");
const mime = require("mime-types");
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

const createAttachmentsInfoTable = async (attachments_url) => {
  const urls = Array.isArray(attachments_url)
    ? attachments_url
    : typeof attachments_url === "string"
      ? attachments_url.split(",")
      : [];

  const attachments = [];

  const isRemoteUrl = (str) => /^https?:\/\//i.test(str);

  for (const url of urls) {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      console.warn(`Empty or invalid URL: "${url}"`);
      continue;
    }

    const sanitizedUrl = trimmedUrl.replace(/\\/g, "/");
    const filename = path.basename(sanitizedUrl);
    const filetype = mime.lookup(sanitizedUrl) || "application/octet-stream";
    let filesize = 0;

    if (isRemoteUrl(sanitizedUrl)) {
      // 🔎 HEAD request for remote file
      try {
        const response = await axios.head(sanitizedUrl);
        if (response.status >= 200 && response.status < 400) {
          filesize = parseInt(response.headers["content-length"] || "0", 10);
        } else {
          continue;
        }
      } catch (err) {
        continue;
      }
    } else {
      // 📂 Local file stat
      try {
        const stats = await fs.stat(sanitizedUrl);
        filesize = stats.size;
      } catch (err) {
        continue;
      }
    }

    attachments.push({
      filename,
      filetype,
      filesize,
      fileUrl: sanitizedUrl,
    });
  }

  if (!attachments.length) {
    console.log("No valid attachments found. Returning empty string.");
    return "";
  }

  let rowsHTML = "";
  attachments.forEach((attachment, index) => {
    rowsHTML += `
      <tr>
        <td style="border: 1px solid #ccc; padding: 8px;">${index + 1}</td>
        <td style="border: 1px solid #ccc; padding: 8px;">${attachment.filename}</td>
        <td style="border: 1px solid #ccc; padding: 8px;">${attachment.filetype}</td>
        <td style="border: 1px solid #ccc; padding: 8px;">${(attachment.filesize / 1024).toFixed(2)} KB</td>
        <td style="border: 1px solid #ccc; padding: 8px;">
          <a href="${attachment.fileUrl}" target="_blank" style="color: #ee8e1f; text-decoration: underline;">View</a>
        </td>
      </tr>
    `;
  });

  const tableHTML = `
    <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
      <thead>
        <tr style="background-color: #ee8e1f; color: #fff;">
          <th style="border: 1px solid #ccc; padding: 8px;">SL</th>
          <th style="border: 1px solid #ccc; padding: 8px;">File Name</th>
          <th style="border: 1px solid #ccc; padding: 8px;">File Type</th>
          <th style="border: 1px solid #ccc; padding: 8px;">File Size</th>
          <th style="border: 1px solid #ccc; padding: 8px;">File Link</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHTML}
      </tbody>
    </table>
  `;

  return tableHTML;
};

// Function to send email
async function cefSubmitMail(
  mailModule,
  action,
  candidate_applicant_name,
  customer_name,
  attachments_url,
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
    const attachments = await createAttachments(attachments_url);
    if (attachments.length === 0) {
      console.warn("No valid attachments to send.");
    }

    const attachments_table = await createAttachmentsInfoTable(attachments_url);

    // Replace placeholders in the email template
    let template = email.template
      .replace(/{{candidate_applicant_name}}/g, candidate_applicant_name)
      .replace(/{{customer_name}}/g, customer_name)
      .replace(/{{attachments_table}}/g, attachments_table);

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

    // Send email
    const mailOptions = {
      from: `"${smtp.title}" <${smtp.username}>`,
      to: toList,
      cc: ccList,
      subject: email.title,
      html: template,
      ...(attachments.length > 0 && { attachments }), // Only include attachments if present
    };

    // const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error.message);
  } finally {

  }
}

module.exports = { cefSubmitMail };
