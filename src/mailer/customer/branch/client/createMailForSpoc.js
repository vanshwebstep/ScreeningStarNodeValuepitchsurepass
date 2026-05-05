const nodemailer = require("nodemailer");
const { sequelize } = require("../../../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");

// Function to generate HTML table from service details
const generateTable = (services) => {
  if (!Array.isArray(services) || services.length === 0) {
    return `No services available.`;
  }

  let rows = services.map((service) => service).join(", "); // Join services with a comma separator
  return `${rows}`;
};

const generateDocs = (docs) => {
  // Split the input string into an array of document names
  const docsArr = docs.split(",").map((doc) => doc.trim());

  // Check if the docsArr array is valid
  if (!Array.isArray(docsArr) || docsArr.length === 0) {
    return "<p>No documents available</p>";
  }

  let links = "";

  // Generate <a> tags for each document
  docsArr.forEach((doc, index) => {
    links += `<a href="${doc}"><span>Doc ${index + 1}</span></a> `;
  });

  return links.trim(); // Remove any trailing spaces
};

// Function to send email
async function createMailForSpoc(
  mailModule,
  action,
  name,
  spoc_name,
  application_id,
  company_name,
  client_code,
  services,
  docs,
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
    const table = generateTable(services);
    let docsHTML = "";
    if (docs && docs.length > 0) {
      docsHTML = generateDocs(docs);
    }

    // Replace placeholders in the email template
    let template = email.template;
    template = template
      .replace(/{{company_name}}/g, company_name)
      .replace(/{{spoc_name}}/g, spoc_name)
      .replace(/{{client_name}}/g, name)
      .replace(/{{application_id}}/g, application_id)
      .replace(/{{client_code}}/g, client_code)
      .replace(/{{services}}/g, table);

    // If docsHTML has content, replace its placeholder
    if (docsHTML) {
      template = template.replace(/{{docs}}/g, docsHTML);
    } else {
      // If there are no documents, remove the placeholder from the template
      template = template.replace(/{{docs}}/g, "");
    }

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

    // Debugging: Log the email lists
    console.log("Recipient List:", toList);
    console.log("CC List:", ccList);

    // Send email
    // const info = await transporter.sendMail({
    //   from: `"${smtp.title}" <${smtp.username}>`,
    //   to: toList, // Main recipient list
    //   cc: ccList, // CC recipient list
    //   subject: email.title,
    //   html: template,
    // });

    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  } finally {
     // Ensure the connection is released
  }
}

module.exports = { createMailForSpoc };
