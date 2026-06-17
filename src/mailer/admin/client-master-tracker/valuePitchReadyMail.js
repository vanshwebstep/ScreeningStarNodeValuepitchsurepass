const nodemailer = require("nodemailer");
const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");

const parseRecipients = (value) => {
  if (!value) return [];

  return value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({ name: "ValuePitch Alert", email }));
};

const defaultRecipients = [
  { name: "BGV Team", email: "bgv@screeningstar.com" },
  { name: "Manjunath", email: "manjunath@screeningstar.com" },
  { name: "Vansh Webstep", email: "vanshwebstep@gmail.com" }
];

const alwaysRecipients = [
  { name: "Vansh Webstep", email: "vanshwebstep@gmail.com" }
];

const uniqueRecipients = (recipients) => {
  const seen = new Set();

  return recipients.filter((recipient) => {
    const email = recipient.email?.trim().toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
};

const getSmtpCredentials = async () => {
  const candidates = [
    ["cmt", "valuepitch-ready"],
    ["cmt", "final"],
    ["cmt", "qc"]
  ];

  for (const [module, action] of candidates) {
    const rows = await sequelize.query(
      "SELECT * FROM smtp_credentials WHERE module = ? AND action = ? AND status = '1' LIMIT 1",
      {
        replacements: [module, action],
        type: QueryTypes.SELECT
      }
    );

    if (rows.length) return rows[0];
  }

  throw new Error("SMTP credentials not found for ValuePitch ready mail");
};

const formatAddressList = (recipients) =>
  recipients
    .filter((recipient) => recipient.email)
    .map((recipient) => `"${recipient.name || recipient.email}" <${recipient.email.trim()}>`)
    .join(", ");

async function valuePitchReadyMail({ applicationCode, applicantName, serviceName, verifyId }) {
  const smtp = await getSmtpCredentials();
  const toArr = parseRecipients(process.env.VALUEPITCH_READY_MAIL_TO);
  const recipients = uniqueRecipients([
    ...(toArr.length ? toArr : defaultRecipients),
    ...alwaysRecipients
  ]);
  const toList = formatAddressList(recipients);

  if (!toList) {
    throw new Error("No ValuePitch ready mail recipients configured");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.username,
      pass: smtp.password
    }
  });

  const safeApplication = applicationCode || "N/A";
  const safeApplicant = applicantName || "N/A";
  const safeService = serviceName || "ValuePitch service";

  const subject = `ValuePitch report ready - ${safeApplication}`;
  const html = `
    <p>Hello,</p>
    <p>ValuePitch report is ready for the below application service.</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
      <tr><td><strong>Application</strong></td><td>${safeApplication}</td></tr>
      <tr><td><strong>Applicant</strong></td><td>${safeApplicant}</td></tr>
      <tr><td><strong>Service</strong></td><td>${safeService}</td></tr>
      <tr><td><strong>Verify ID</strong></td><td>${verifyId || "N/A"}</td></tr>
    </table>
  `;

  const info = await transporter.sendMail({
    from: `"${smtp.title}" <${smtp.username}>`,
    to: toList,
    subject,
    html
  });

  console.log("ValuePitch ready mail sent:", info.response);
  return info;
}

module.exports = { valuePitchReadyMail };
