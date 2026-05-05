const nodemailer = require("nodemailer");
const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

// Function to generate an HTML table from branch details
const generateTable = (customers) => {
  let table = "";
  let serialNumber = 1;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  customers.forEach((customer) => {
    if (customer.branches && Array.isArray(customer.branches)) {
      customer.branches.forEach((branch) => {
        if (branch.applications && Array.isArray(branch.applications)) {
          branch.applications.forEach((application) => {
            const formattedDate = formatDate(application.application_created_at);
            table += `<tr>
                        <td style='border:1px solid black;'>${serialNumber++}</td>
                        <td style='border:1px solid black;'>${application.application_id}</td>
                        <td style='border:1px solid black;'>${formattedDate}</td>
                        <td style='border:1px solid black;'>${application.application_name ?? "-"}</td>
                        <td style='border:1px solid black;'>${application.days_out_of_tat}</td>
                      </tr>`;
          });
        }
      });
    }
  });

  return table;
};

async function tatDelayMail(mailModule, action, applications, toArr = [], ccArr = []) {
  try {
    // console.log("📩 Preparing to send TAT delay mail...");

    // Fetch email template
    const [email] = await sequelize.query(
      "SELECT * FROM emails WHERE module = ? AND action = ? AND status = 1",
      {
        replacements: [mailModule, action],
        type: QueryTypes.SELECT,
      }
    );
    if (!email) throw new Error("Email template not found");

    // Fetch SMTP credentials
    const [smtp] = await sequelize.query(
      "SELECT * FROM smtp_credentials WHERE module = ? AND action = ? AND status = '1'",
      {
        replacements: [mailModule, action],
        type: QueryTypes.SELECT,
      }
    );
    if (!smtp) throw new Error("SMTP credentials not found");

    // Setup mail transporter
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure, // true for 465
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
    });

    // Generate HTML table
    const table = generateTable(applications);

    // Replace placeholders
    let template = email.template.replace(/{{table_rows}}/g, table);

    // Prepare TO recipients (parsed from applications)
    const extractedToArr = applications.flatMap((customer) => {
      try {
        const emails = JSON.parse(customer.customer_emails);
        return emails.map((email) => ({
          name: customer.customer_name,
          email: email.trim(),
        }));
      } catch (e) {
        console.error("⚠️ Failed to parse customer_emails for:", customer.customer_name, e);
        return [];
      }
    });


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
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const toList = toArr
      .map((recipient) => {
        let name = recipient.name;
        let email = recipient.email;

        // If 'name' is actually an email, swap them
        if (isValidEmail(recipient.name) && !isValidEmail(recipient.email)) {
          email = recipient.name;
          name = recipient.email;
        }

        if (isValidEmail(email)) {
          return `"${name}" <${email.trim()}>`;
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

    // Send the email
    const info = await transporter.sendMail({
      from: `"${smtp.title}" <${smtp.username}>`,
      to: toList,
      cc: ccList,
      subject: email.title,
      html: template,
    });

    console.log("✅ Email sent successfully:", info.response);
  } catch (error) {
    console.error("❌ Error sending TAT delay mail:", error.message);
  }
}

module.exports = { tatDelayMail };
