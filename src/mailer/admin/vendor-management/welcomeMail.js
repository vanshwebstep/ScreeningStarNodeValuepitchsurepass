const nodemailer = require("nodemailer");
const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");

const getSmtp = async () => {
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

module.exports = { sendVendorWelcomeMail };

