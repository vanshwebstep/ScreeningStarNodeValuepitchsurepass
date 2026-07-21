const nodemailer = require("nodemailer");
const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");

const getSmtp = async (mailModule, action) => {
  if (mailModule && action) {
    const moduleRows = await sequelize.query(
      "SELECT * FROM smtp_credentials WHERE module = ? AND action = ? AND status = '1' ORDER BY id ASC LIMIT 1",
      { replacements: [mailModule, action], type: QueryTypes.SELECT }
    );
    if (moduleRows[0]) return moduleRows[0];
  }

  const rows = await sequelize.query(
    "SELECT * FROM smtp_credentials WHERE status = '1' ORDER BY id ASC LIMIT 1",
    { type: QueryTypes.SELECT }
  );
  return rows[0] || null;
};

const sendVendorWelcomeMail = async ({ vendorName, email, password, loginUrl }) => {
  const smtp = await getSmtp();
  if (!smtp) throw new Error("SMTP credentials not found");

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port),
    secure: smtp.secure === true || smtp.secure === 1 || smtp.secure === "1" || smtp.secure === "true",
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
  });

  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.5;">
      <h2 style="color:#073d88; margin-bottom: 10px;">Welcome to ScreeningStar Vendor Portal</h2>
      <p>Hello ${vendorName || "Vendor"},</p>
      <p>You have been added as a vendor with ScreeningStar.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="font-weight:bold; border:1px solid #ddd;">Login URL</td><td style="border:1px solid #ddd;"><a href="${loginUrl}">${loginUrl}</a></td></tr>
        <tr><td style="font-weight:bold; border:1px solid #ddd;">Email</td><td style="border:1px solid #ddd;">${email}</td></tr>
        <tr><td style="font-weight:bold; border:1px solid #ddd;">Password</td><td style="border:1px solid #ddd;">${password}</td></tr>
      </table>
      <p>Please use the above details to login to your vendor dashboard.</p>
      <p>Regards,<br/>ScreeningStar Team</p>
    </div>
  `;

  return transporter.sendMail({
    from: `"${smtp.title || "ScreeningStar"}" <${smtp.username}>`,
    to: `"${vendorName || "Vendor"}" <${email}>`,
    subject: "ScreeningStar Vendor Login Details",
    html,
  });
};

const sendVendorResetPasswordMail = async ({ vendorName, email, resetLink }) => {
  const smtp = await getSmtp("branch auth", "forget-password");
  if (!smtp) throw new Error("SMTP credentials not found");
console.log("SMTP credentials:", smtp);
console.log("SMTP vendorName:", vendorName);
console.log("SMTP email:", email);
console.log("SMTP resetLink:", resetLink);

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port),
    secure: smtp.secure === true || smtp.secure === 1 || smtp.secure === "1" || smtp.secure === "true",
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
  });

  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.5;">
      <h2 style="color:#073d88; margin-bottom: 10px;">Reset Your ScreeningStar Vendor Password</h2>
      <p>Hello ${vendorName || "Vendor"},</p>
      <p>We received a request to reset your vendor portal password.</p>
      <p><a href="${resetLink}" style="display:inline-block; background:#2c81ba; color:#fff; padding:10px 16px; text-decoration:none; border-radius:4px;">Reset Password</a></p>
      <p>If the button does not work, open this link in your browser:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>This link will expire in 2 hours.</p>
      <p>Regards,<br/>ScreeningStar Team</p>
    </div>
  `;
console.log("SMTP transporter:", transporter);
  return transporter.sendMail({
    from: `"${smtp.title}" <${smtp.username}>`,
    to: `"${vendorName || "Vendor"}" <${email}>`,
    subject: "ScreeningStar Vendor Password Reset",
    html,
  });
};


const display = (value) => {
  if (value === null || value === undefined || value === "") return "NIL";
  return value;
};

const formatDate = (value) => {
  if (!value) return "NIL";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "NIL";
  return date.toLocaleDateString("en-GB").replace(/\//g, "-");
};

const detailRows = (rows) => rows.map(([label, value]) => (
  `<tr><td style="font-weight:bold; border:1px solid #ddd;">${label}</td><td style="border:1px solid #ddd;">${display(value)}</td></tr>`
)).join("");

const parseRecipients = (value) => String(value || "")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);

const uniqueRecipients = (...groups) => {
  const seen = new Set();
  return groups.flat().filter((email) => {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const sendVendorAssignedMail = async ({ vendorName, email, caseInfo = {}, loginUrl }) => {
  const smtp = await getSmtp();
  if (!smtp) throw new Error("SMTP credentials not found");

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port),
    secure: smtp.secure === true || smtp.secure === 1 || smtp.secure === "1" || smtp.secure === "true",
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
  });

  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.5;">
      <h2 style="color:#073d88; margin-bottom: 10px;">New Application Assigned</h2>
      <p>Hello ${vendorName || "Vendor"},</p>
      <p>A new application has been assigned to you on ScreeningStar Vendor Portal.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse; margin: 16px 0;">
        ${detailRows([
          ["Reference ID", caseInfo.application_id],
          ["Applicant Name", caseInfo.name],
          ["Client Name", caseInfo.customer_name],
          ["Branch", caseInfo.branch_name],
          ["Services", caseInfo.service_names],
          ["Initiation Date", formatDate(caseInfo.initiation_date || caseInfo.created_at)],
          ["Deadline Date", formatDate(caseInfo.deadline_date)],
          ["Login URL", loginUrl ? `<a href="${loginUrl}">${loginUrl}</a>` : "NIL"],
        ])}
      </table>
      <p>Please login to your vendor dashboard and proceed with the assigned case.</p>
      <p>Regards,<br/>ScreeningStar Team</p>
    </div>
  `;

  return transporter.sendMail({
    from: `"${smtp.title || "ScreeningStar"}" <${smtp.username}>`,
    to: `"${vendorName || "Vendor"}" <${email}>`,
    subject: `ScreeningStar Case Assigned - ${display(caseInfo.application_id)}`,
    html,
  });
};

const caseRows = (cases = []) => cases.map((caseInfo, index) => `
  <tr>
    <td style="border:1px solid #ddd;">${index + 1}</td>
    <td style="border:1px solid #ddd;">${display(caseInfo.application_id)}</td>
    <td style="border:1px solid #ddd;">${display(caseInfo.name)}</td>
    <td style="border:1px solid #ddd;">${display(caseInfo.customer_name)}</td>
    <td style="border:1px solid #ddd;">${display(caseInfo.branch_name)}</td>
    <td style="border:1px solid #ddd;">${display(caseInfo.service_names)}</td>
    <td style="border:1px solid #ddd;">${formatDate(caseInfo.initiation_date || caseInfo.created_at)}</td>
    <td style="border:1px solid #ddd;">${formatDate(caseInfo.deadline_date)}</td>
  </tr>
`).join("");

const sendVendorBulkAssignedMail = async ({ vendorName, email, cases = [], loginUrl }) => {
  const smtp = await getSmtp();
  if (!smtp) throw new Error("SMTP credentials not found");

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port),
    secure: smtp.secure === true || smtp.secure === 1 || smtp.secure === "1" || smtp.secure === "true",
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
  });

  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.5;">
      <h2 style="color:#073d88; margin-bottom: 10px;">New Applications Assigned</h2>
      <p>Hello ${vendorName || "Vendor"},</p>
      <p>${cases.length} applications have been assigned to you on ScreeningStar Vendor Portal.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse; margin: 16px 0; width:100%;">
        <thead>
          <tr>
            <th style="border:1px solid #ddd; text-align:left;">Sno.</th>
            <th style="border:1px solid #ddd; text-align:left;">Reference ID</th>
            <th style="border:1px solid #ddd; text-align:left;">Applicant Name</th>
            <th style="border:1px solid #ddd; text-align:left;">Client Name</th>
            <th style="border:1px solid #ddd; text-align:left;">Branch</th>
            <th style="border:1px solid #ddd; text-align:left;">Services</th>
            <th style="border:1px solid #ddd; text-align:left;">Initiation Date</th>
            <th style="border:1px solid #ddd; text-align:left;">Deadline Date</th>
          </tr>
        </thead>
        <tbody>${caseRows(cases)}</tbody>
      </table>
      ${loginUrl ? `<p><a href="${loginUrl}">${loginUrl}</a></p>` : ""}
      <p>Please login to your vendor dashboard and proceed with the assigned cases.</p>
      <p>Regards,<br/>ScreeningStar Team</p>
    </div>
  `;

  return transporter.sendMail({
    from: `"${smtp.title || "ScreeningStar"}" <${smtp.username}>`,
    to: `"${vendorName || "Vendor"}" <${email}>`,
    subject: `ScreeningStar Cases Assigned - ${cases.length} Cases`,
    html,
  });
};
const sendVendorAcceptedMail = async ({ vendorName, caseInfo = {}, recipients = [] }) => {
  const smtp = await getSmtp();
  if (!smtp) throw new Error("SMTP credentials not found");

  const toRecipients = uniqueRecipients(
    parseRecipients(process.env.VENDOR_ACCEPTED_NOTIFY_EMAILS),
    parseRecipients(process.env.VENDOR_COMPLETION_NOTIFY_EMAILS),
    recipients,
    [smtp.username]
  );
  if (!toRecipients.length) throw new Error("No accepted mail recipient configured");

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port),
    secure: smtp.secure === true || smtp.secure === 1 || smtp.secure === "1" || smtp.secure === "true",
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
  });

  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.5;">
      <h2 style="color:#073d88; margin-bottom: 10px;">Vendor Case Accepted</h2>
      <p>Hello ScreeningStar Team,</p>
      <p>${vendorName || "Vendor"} has accepted the assigned application on ScreeningStar Vendor Portal.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse; margin: 16px 0;">
        ${detailRows([
          ["Vendor", vendorName],
          ["Vendor Code", caseInfo.vendor_code],
          ["Reference ID", caseInfo.application_id],
          ["Applicant Name", caseInfo.name],
          ["Client Name", caseInfo.customer_name],
          ["Branch", caseInfo.branch_name],
          ["Services", caseInfo.service_names],
          ["Accepted Date", formatDate(caseInfo.vendor_accepted_at || new Date())],
          ["Initiation Date", formatDate(caseInfo.initiation_date || caseInfo.created_at)],
          ["Deadline Date", formatDate(caseInfo.deadline_date)],
        ])}
      </table>
      <p>Regards,<br/>ScreeningStar Team</p>
    </div>
  `;

  return transporter.sendMail({
    from: `"${smtp.title || "ScreeningStar"}" <${smtp.username}>`,
    to: toRecipients.join(","),
    subject: `Vendor Case Accepted - ${display(caseInfo.application_id)}`,
    html,
  });
};
const sendVendorCompletedMail = async ({ vendorName, caseInfo = {}, recipients = [] }) => {
  const smtp = await getSmtp();
  if (!smtp) throw new Error("SMTP credentials not found");

  const toRecipients = uniqueRecipients(
    parseRecipients(process.env.VENDOR_COMPLETION_NOTIFY_EMAILS),
    recipients,
    [smtp.username]
  );
  if (!toRecipients.length) throw new Error("No completion mail recipient configured");

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port),
    secure: smtp.secure === true || smtp.secure === 1 || smtp.secure === "1" || smtp.secure === "true",
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
  });

  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.5;">
      <h2 style="color:#073d88; margin-bottom: 10px;">Vendor Case Completed</h2>
      <p>Hello ScreeningStar Team,</p>
      <p>${vendorName || "Vendor"} has completed the assigned application on ScreeningStar Vendor Portal.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse; margin: 16px 0;">
        ${detailRows([
          ["Vendor", vendorName],
          ["Vendor Code", caseInfo.vendor_code],
          ["Reference ID", caseInfo.application_id],
          ["Applicant Name", caseInfo.name],
          ["Client Name", caseInfo.customer_name],
          ["Branch", caseInfo.branch_name],
          ["Services", caseInfo.service_names],
          ["Accepted Date", formatDate(caseInfo.vendor_accepted_at)],
          ["Verified Date", formatDate(caseInfo.vendor_verified_date)],
          ["Report Uploaded At", formatDate(caseInfo.vendor_report_uploaded_at)],
        ])}
      </table>
      <p>Please review the uploaded vendor report in admin panel.</p>
      <p>Regards,<br/>ScreeningStar Team</p>
    </div>
  `;

  return transporter.sendMail({
    from: `"${smtp.title || "ScreeningStar"}" <${smtp.username}>`,
    to: toRecipients.join(","),
    subject: `Vendor Case Completed - ${display(caseInfo.application_id)}`,
    html,
  });
};

module.exports = { sendVendorWelcomeMail, sendVendorResetPasswordMail, sendVendorAssignedMail, sendVendorBulkAssignedMail, sendVendorAcceptedMail, sendVendorCompletedMail };
