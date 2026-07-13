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

module.exports = { sendVendorWelcomeMail, sendVendorResetPasswordMail };

