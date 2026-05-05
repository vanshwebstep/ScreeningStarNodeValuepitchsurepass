const nodemailer = require("nodemailer");
const { sequelize } = require("../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");

// Function to generate an HTML table from branch details
const generateTable = (branches, password) => {
  let table =
    '<table border="1" cellpadding="10" cellspacing="0" style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;"><thead>';
  table +=
    `<tr style="background-color: #ffeedf; color: #d35400;">
      <th style="padding: 12px; border: 1px solid #f0cfa1; text-align: center;">SL No</th>
      <th style="padding: 12px; border: 1px solid #f0cfa1; text-align: center;">Organization Name</th>
      <th style="padding: 12px; border: 1px solid #f0cfa1; text-align: center;">Username</th>
      <th style="padding: 12px; border: 1px solid #f0cfa1; text-align: center;">Password</th>
    </tr></thead><tbody>`;

  branches.forEach((branch, index) => {
    table += `<tr>
                <td style="padding: 12px; border: 1px solid #f0cfa1; text-align: center;">${index + 1}</td>
                <td style="padding: 12px; border: 1px solid #f0cfa1; text-align: center;">${branch.name}</td>
                <td style="padding: 12px; border: 1px solid #f0cfa1; text-align: center;">
                  <span style="text-decoration: none; color: inherit; text-align: center;">${branch.email}</span>
                </td>
                <td style="padding: 12px; border: 1px solid #f0cfa1;">${password}</td>
              </tr>`;
  });

  table += "</tbody></table>";
  return table;
};

// Function to send email
async function createMail(
  mailModule,
  action,
  client_name,
  branches,
  password,
  is_head,
  customerData,
  toCC,
  appCustomerLoginHost = "www.example.com"
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

    // Generate the HTML table from branch details
    const table = generateTable(branches, password);
    console.log(`client_name - `, client_name);
    // Replace placeholders in the email template
    let template = email.template
      .replace(/{{name}}/g, client_name)
      .replace(/{{table}}/g, table)
      .replace(/{{appCustomerLoginHost}}/g, appCustomerLoginHost);

    // Prepare recipient list based on whether the branch is a head branch
    let recipientList;
    if (is_head === 1) {
      // Include all customers in the recipient list for head branches
      recipientList = customerData.map(
        (customer) => `"${customer.name}" <${customer.email}>`
      );
    } else {
      // If not a head branch, only include the specific branches
      recipientList = branches.map(
        (branch) => `"${branch.name}" <${branch.email}>`
      );
    }

    // Send email to the prepared recipient list
    const info = await transporter.sendMail({
      from: `"${smtp.title}" <${smtp.username}>`,
      to: recipientList.join(", "), // Join the recipient list into a string
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
