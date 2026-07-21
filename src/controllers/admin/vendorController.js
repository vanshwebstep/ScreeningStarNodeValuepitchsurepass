const crypto = require("crypto");
const Vendor = require("../../models/admin/vendorModel");
const Common = require("../../models/admin/commonModel");
const { upload, saveImage } = require("../../utils/cloudImageSave");
const { getClientIpAddress } = require("../../utils/ipAddress");
const { sendVendorWelcomeMail, sendVendorResetPasswordMail, sendVendorAcceptedMail, sendVendorCompletedMail } = require("../../mailer/admin/vendor-management/welcomeMail");

const required = {
  name_of_organization: "Name of Organization",
  vendor_code: "Vendor Code",
  registered_address: "Registered Address",
  state: "State",
  pin_code: "Pin Code",
  tat: "TAT",
  agreement_date: "Agreement Date",
  email_id: "Email ID",
  password: "Password",
  services: "Services",
  vendor_spoc: "Vendor Spoc",
  escalation_manager: "Escalation Manager",
  authorized_details: "Authorized Details",
  admin_id: "Admin ID",
  _token: "Token",
};

const missing = (body, fields) => Object.entries(fields)
  .filter(([key]) => body[key] === undefined || body[key] === null || String(body[key]).trim() === "")
  .map(([, label]) => label);

const parseJson = (value, fallback) => {
  try {
    if (value === null || value === undefined || value === "") return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};

const generateToken = () => crypto.randomBytes(32).toString("hex");
const getTokenExpiry = () => new Date(Date.now() + 120 * 60 * 1000);

const frontendBaseUrl = (req) => (
  process.env.VENDOR_FRONTEND_URL ||
  process.env.FRONTEND_URL ||
  process.env.APP_FRONTEND_URL ||
  `${req.protocol}://${req.get("host")}`.replace(":5000", ":3000")
).replace(/\/$/, "");

const vendorLoginUrl = (req, email) => `${frontendBaseUrl(req)}/vendor-login?email=${encodeURIComponent(email)}`;

const sanitizeVendor = (vendor) => {
  if (!vendor) return vendor;
  const { password, login_token, token_expiry, ...safeVendor } = vendor;
  return safeVendor;
};

const duplicateMessage = (error) => {
  const fields = error?.fields || error?.parent?.sqlMessage || error?.original?.sqlMessage || error?.message || "";
  const text = typeof fields === "string" ? fields.toLowerCase() : JSON.stringify(fields).toLowerCase();
  if (text.includes("email") || text.includes("email_id")) return "Vendor Email ID already exists.";
  if (text.includes("code") || text.includes("vendor_code")) return "Vendor Code already exists.";
  if (error?.name === "SequelizeUniqueConstraintError") return "Vendor Code or Email ID already exists.";
  return null;
};

const validateAdmin = (admin_id, _token, action, res, next) => {
  Common.isAdminAuthorizedForAction(admin_id, action, (auth) => {
    if (!auth.status) return res.status(403).json({ status: false, message: auth.message });
    Common.isAdminTokenValid(_token, admin_id, (err, token) => {
      if (err) return res.status(500).json({ status: false, message: err.message });
      if (!token.status) return res.status(401).json({ status: false, message: token.message });
      next(token.newToken);
    });
  });
};

const normalizeBody = (body) => ({
  ...body,
  email_id: String(body.email_id || "").trim().toLowerCase(),
  services: parseJson(body.services, []),
  vendor_spoc: parseJson(body.vendor_spoc, {}),
  escalation_manager: parseJson(body.escalation_manager, {}),
  authorized_details: parseJson(body.authorized_details, {}),
});


const validateVendorSession = (vendor_id, _token, res, next) => {
  const miss = missing({ vendor_id, _token }, { vendor_id: "Vendor ID", _token: "Token" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  Vendor.findById(vendor_id, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor) return res.status(404).json({ status: false, message: "Vendor not found." });
    if (String(vendor.login_token || "") !== String(_token || "")) {
      return res.status(401).json({ status: false, message: "Invalid or expired token." });
    }
    if (vendor.token_expiry && new Date(vendor.token_expiry) < new Date()) {
      return res.status(401).json({ status: false, message: "Token expired." });
    }
    next(vendor);
  });
};
const checkVendorUniqueness = (body, ignoreId, newToken, res, next) => {
  Vendor.isVendorCodeUsed(body.vendor_code, ignoreId, (codeErr, codeUsed) => {
    if (codeErr) return res.status(500).json({ status: false, message: codeErr.message, token: newToken });
    if (codeUsed) return res.status(409).json({ status: false, message: "Vendor Code already exists.", token: newToken });

    Vendor.isEmailUsed(body.email_id, ignoreId, (emailErr, emailUsed) => {
      if (emailErr) return res.status(500).json({ status: false, message: emailErr.message, token: newToken });
      if (emailUsed) return res.status(409).json({ status: false, message: "Vendor Email ID already exists.", token: newToken });
      next();
    });
  });
};

exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const miss = missing(req.body, required);
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  const body = normalizeBody(req.body);
  validateAdmin(body.admin_id, body._token, "client_overview", res, (newToken) => {
    checkVendorUniqueness(body, null, newToken, res, () => {
      Vendor.create(body, (err, result) => {
        if (err) {
          const duplicate = duplicateMessage(err);
          Common.adminActivityLog(ipAddress, ipType, body.admin_id, "Vendor", "Create", "0", null, err, () => {});
          return res.status(duplicate ? 409 : 500).json({ status: false, message: duplicate || err.message, token: newToken });
        }

        const loginUrl = vendorLoginUrl(req, body.email_id);
        sendVendorWelcomeMail({
          vendorName: body.name_of_organization,
          email: body.email_id,
          password: body.password,
          loginUrl,
        }).catch((mailErr) => console.error("Vendor welcome mail failed:", mailErr.message));

        Common.adminActivityLog(ipAddress, ipType, body.admin_id, "Vendor", "Create", "1", JSON.stringify(result), null, () => {});
        res.status(201).json({ status: true, message: "Vendor created successfully.", result, loginUrl, token: newToken });
      });
    });
  });
};

exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const miss = missing(req.body, { vendor_id: "Vendor ID", ...required });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  const body = normalizeBody(req.body);
  validateAdmin(body.admin_id, body._token, "client_overview", res, (newToken) => {
    Vendor.findById(body.vendor_id, (findErr, current) => {
      if (findErr) return res.status(500).json({ status: false, message: findErr.message, token: newToken });
      if (!current) return res.status(404).json({ status: false, message: "Vendor not found.", token: newToken });

      checkVendorUniqueness(body, body.vendor_id, newToken, res, () => {
        Vendor.update(body.vendor_id, body, (err, result) => {
          if (err) {
            const duplicate = duplicateMessage(err);
            Common.adminActivityLog(ipAddress, ipType, body.admin_id, "Vendor", "Update", "0", JSON.stringify({ id: body.vendor_id }), err, () => {});
            return res.status(duplicate ? 409 : 500).json({ status: false, message: duplicate || err.message, token: newToken });
          }
          Common.adminActivityLog(ipAddress, ipType, body.admin_id, "Vendor", "Update", "1", JSON.stringify({ id: body.vendor_id }), null, () => {});
          res.json({ status: true, message: "Vendor updated successfully.", result, token: newToken });
        });
      });
    });
  });
};

exports.list = (req, res) => {
  const { admin_id, _token, status } = req.query;
  const miss = missing(req.query, { admin_id: "Admin ID", _token: "Token" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  validateAdmin(admin_id, _token, "client_overview", res, (newToken) => {
    Vendor.list(status || "all", (err, vendors) => {
      if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
      res.json({ status: true, message: "Vendor fetched successfully.", vendors, totalResults: vendors.length, token: newToken });
    });
  });
};


exports.detail = (req, res) => {
  const { vendor_id, admin_id, _token } = req.query;
  const miss = missing(req.query, { vendor_id: "Vendor ID", admin_id: "Admin ID", _token: "Token" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  validateAdmin(admin_id, _token, "client_overview", res, (newToken) => {
    Vendor.findById(vendor_id, (err, vendor) => {
      if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
      if (!vendor) return res.status(404).json({ status: false, message: "Vendor not found.", token: newToken });
      res.json({ status: true, message: "Vendor fetched successfully.", vendor, token: newToken });
    });
  });
};

exports.updateStatus = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const { vendor_id, vendor_status, admin_id, _token } = req.body;
  const miss = missing(req.body, { vendor_id: "Vendor ID", vendor_status: "Vendor Status", admin_id: "Admin ID", _token: "Token" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  validateAdmin(admin_id, _token, "client_overview", res, (newToken) => {
    Vendor.updateStatus(vendor_id, Number(vendor_status) === 1 ? 1 : 0, (err, result) => {
      if (err) {
        Common.adminActivityLog(ipAddress, ipType, admin_id, "Vendor", "Status Update", "0", JSON.stringify({ vendor_id, vendor_status }), err, () => {});
        return res.status(500).json({ status: false, message: err.message, token: newToken });
      }
      Common.adminActivityLog(ipAddress, ipType, admin_id, "Vendor", "Status Update", "1", JSON.stringify({ vendor_id, vendor_status }), null, () => {});
      res.json({ status: true, message: Number(vendor_status) === 1 ? "Vendor unblocked successfully." : "Vendor Blocked successfully.", result, token: newToken });
    });
  });
};
exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const { vendor_id, admin_id, _token } = req.query;
  const miss = missing(req.query, { vendor_id: "Vendor ID", admin_id: "Admin ID", _token: "Token" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  validateAdmin(admin_id, _token, "client_overview", res, (newToken) => {
    Vendor.delete(vendor_id, (err) => {
      if (err) {
        Common.adminActivityLog(ipAddress, ipType, admin_id, "Vendor", "Delete", "0", JSON.stringify({ vendor_id }), err, () => {});
        return res.status(500).json({ status: false, message: err.message, token: newToken });
      }
      Common.adminActivityLog(ipAddress, ipType, admin_id, "Vendor", "Delete", "1", JSON.stringify({ vendor_id }), null, () => {});
      res.json({ status: true, message: "Vendor deleted successfully.", token: newToken });
    });
  });
};

exports.login = (req, res) => {
  const { email, username, password } = req.body;
  const loginEmail = String(email || username || "").trim().toLowerCase();
  const miss = missing({ email: loginEmail, password }, { email: "Email", password: "Password" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  Vendor.findByEmail(loginEmail, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor) return res.status(404).json({ status: false, message: "Vendor not found." });
    if (Number(vendor.status) === 0) return res.status(403).json({ status: false, message: "Vendor account is inactive." });
    if (String(vendor.password) !== String(password)) return res.status(401).json({ status: false, message: "Invalid login credentials." });

    const token = generateToken();
    const tokenExpiry = getTokenExpiry();
    Vendor.updateLoginToken(vendor.id, token, tokenExpiry, (tokenErr) => {
      if (tokenErr) return res.status(500).json({ status: false, message: tokenErr.message });
      res.json({ status: true, message: "Login successful.", token, vendorData: sanitizeVendor({ ...vendor, login_token: token, token_expiry: tokenExpiry }) });
    });
  });
};

exports.forgotPasswordRequest = (req, res) => {
  const { email } = req.body;
  const loginEmail = String(email || "").trim().toLowerCase();
  const miss = missing({ email: loginEmail }, { email: "Email" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  Vendor.findByEmail(loginEmail, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor) return res.status(404).json({ status: false, message: "Vendor not found with the provided email." });
    if (Number(vendor.status) === 0) return res.status(403).json({ status: false, message: "Vendor account is inactive." });

    const token = generateToken();
    const tokenExpiry = getTokenExpiry();
    Vendor.updateLoginToken(vendor.id, token, tokenExpiry, (tokenErr) => {
      if (tokenErr) return res.status(500).json({ status: false, message: tokenErr.message });

      const resetLink = `${frontendBaseUrl(req)}/vendor/reset-password?email=${encodeURIComponent(vendor.email_id)}&token=${token}`;
      sendVendorResetPasswordMail({
        vendorName: vendor.name_of_organization,
        email: vendor.email_id,
        resetLink,
      })
        .then(() => res.json({ status: true, message: `A password reset email has been successfully sent to ${vendor.email_id}.` }))
        .catch((mailErr) => {
          console.error("Vendor reset password mail failed:", mailErr.message);
          if (process.env.NODE_ENV !== "production") {
            return res.json({
              status: true,
              message: "Password reset link generated, but email delivery failed. Use the reset link below for local testing.",
              resetLink,
              mailError: mailErr.message,
            });
          }
          res.status(500).json({ status: false, message: "Failed to send password reset email. Please try again later." });
        });
    });
  });
};

exports.forgotPassword = (req, res) => {
  const { email, password_token, new_password } = req.body;
  const loginEmail = String(email || "").trim().toLowerCase();
  const resetToken = String(password_token || "").trim();
  const newPassword = String(new_password || "").trim();
  const miss = missing(
    { email: loginEmail, password_token: resetToken, new_password: newPassword },
    { email: "Email", password_token: "Password Token", new_password: "New Password" }
  );
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  Vendor.findByEmail(loginEmail, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor) return res.status(404).json({ status: false, message: "Vendor not found with the provided email." });
    if (Number(vendor.status) === 0) return res.status(403).json({ status: false, message: "Vendor account is inactive." });
    if (!vendor.login_token || vendor.login_token !== resetToken) return res.status(401).json({ status: false, message: "Invalid password reset token." });
    if (vendor.token_expiry && new Date(vendor.token_expiry) < new Date()) {
      return res.status(401).json({ status: false, message: "Password reset token has expired. Please request a new one." });
    }

    Vendor.updatePassword(vendor.id, newPassword, (passwordErr) => {
      if (passwordErr) return res.status(500).json({ status: false, message: passwordErr.message });
      res.json({ status: true, message: "Password updated successfully." });
    });
  });
};

exports.updatePassword = (req, res) => {
  const { vendor_id, _token } = req.body;
  const newPassword = String(req.body.new_password || "").trim();
  const miss = missing(
    { vendor_id, _token, new_password: newPassword },
    { vendor_id: "Vendor ID", _token: "Token", new_password: "New Password" }
  );
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  validateVendorSession(vendor_id, _token, res, () => {
    Vendor.updateDashboardPassword(vendor_id, newPassword, (err) => {
      if (err) return res.status(500).json({ status: false, message: err.message });
      res.json({ status: true, message: "Password updated successfully.", token: _token });
    });
  });
};

exports.verifyLogin = (req, res) => {
  const { vendor_id, _token } = req.body;
  const miss = missing(req.body, { vendor_id: "Vendor ID", _token: "Token" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  Vendor.findById(vendor_id, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor) return res.status(404).json({ status: false, message: "Vendor not found." });
    if (vendor.login_token !== _token) return res.status(401).json({ status: false, message: "Invalid or expired token." });
    if (vendor.token_expiry && new Date(vendor.token_expiry) < new Date()) return res.status(401).json({ status: false, message: "Token expired." });
    res.json({ status: true, message: "Login verified successful", token: _token, vendorData: sanitizeVendor(vendor) });
  });
};

exports.caseList = (req, res) => {
  const { vendor_id, _token, status } = req.query;
  validateVendorSession(vendor_id, _token, res, () => {
    Vendor.listCases(vendor_id, status || "assigned", (err, cases) => {
      if (err) return res.status(500).json({ status: false, message: err.message });
      res.json({ status: true, message: "Vendor cases fetched successfully.", cases, totalResults: cases.length, token: _token });
    });
  });
};

exports.acceptCase = (req, res) => {
  const { vendor_id, _token, client_application_id } = req.body;
  const miss = missing(req.body, { client_application_id: "Client Application ID" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  validateVendorSession(vendor_id, _token, res, (vendor) => {
    Vendor.acceptCase(vendor_id, client_application_id, (err, result) => {
      if (err) return res.status(500).json({ status: false, message: err.message });
      const affectedRows = Array.isArray(result) ? Number(result[1] || 0) : 0;
      if (affectedRows === 0) {
        return res.status(400).json({ status: false, message: "Unable to accept this case, or case is disabled." });
      }

      Vendor.findCaseForMail(client_application_id, vendor_id, (caseErr, caseInfo) => {
        if (caseErr) {
          console.error("Vendor accepted mail case lookup failed:", caseErr.message);
        } else {
          sendVendorAcceptedMail({
            vendorName: vendor.name_of_organization,
            caseInfo: caseInfo || { application_id: client_application_id },
            recipients: [caseInfo?.allocated_admin_email].filter(Boolean),
          }).catch((mailErr) => console.error("Vendor accepted mail failed:", mailErr.message));
        }
      });

      res.json({ status: true, message: "Case accepted successfully.", token: _token });
    });
  });
};

exports.uploadCaseReport = (req, res) => {
  const { vendor_id, _token, client_application_id } = req.body;
  const miss = missing(req.body, { client_application_id: "Client Application ID" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  validateVendorSession(vendor_id, _token, res, async (vendor) => {
    try {
      const file = req.files?.image?.[0] || req.files?.pdf?.[0];
      if (!file) return res.status(400).json({ status: false, message: "Report file is required." });

      const safeVendorCode = String(vendor.vendor_code || vendor.id).replace(/[^a-zA-Z0-9_-]/g, "-");
      const targetDir = `uploads/vendors/${safeVendorCode}/client-applications/${client_application_id}/reports`;
      const reportPath = await saveImage(file, targetDir, "vendor-report");

      Vendor.saveCaseReport(vendor_id, client_application_id, reportPath, (err) => {
        if (err) return res.status(500).json({ status: false, message: err.message });
        res.json({ status: true, message: "Report uploaded successfully.", report_path: reportPath, token: _token });
      });
    } catch (error) {
      res.status(500).json({ status: false, message: error.message || "Unable to upload report." });
    }
  });
};

exports.updateCaseVerifiedDate = (req, res) => {
  const { vendor_id, _token, client_application_id, verified_date } = req.body;
  const miss = missing(req.body, { client_application_id: "Client Application ID" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  validateVendorSession(vendor_id, _token, res, () => {
    Vendor.updateVerifiedDate(vendor_id, client_application_id, verified_date, (err) => {
      if (err) return res.status(500).json({ status: false, message: err.message });
      res.json({ status: true, message: "Verified date updated successfully.", token: _token });
    });
  });
};

exports.completeCase = (req, res) => {
  const { vendor_id, _token, client_application_id } = req.body;
  const miss = missing(req.body, { client_application_id: "Client Application ID" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  validateVendorSession(vendor_id, _token, res, (vendor) => {
    Vendor.completeCase(vendor_id, client_application_id, (err, result) => {
      if (err) return res.status(500).json({ status: false, message: err.message });
      const affectedRows = Array.isArray(result) ? Number(result[1] || 0) : 0;
      if (affectedRows === 0) {
        return res.status(400).json({ status: false, message: "Upload report and select verified date before completing this case, or case is disabled." });
      }

      Vendor.findCaseForMail(client_application_id, vendor_id, (caseErr, caseInfo) => {
        if (caseErr) {
          console.error("Vendor completion mail case lookup failed:", caseErr.message);
        } else {
          sendVendorCompletedMail({
            vendorName: vendor.name_of_organization,
            caseInfo: caseInfo || { application_id: client_application_id },
            recipients: [caseInfo?.allocated_admin_email].filter(Boolean),
          }).catch((mailErr) => console.error("Vendor completion mail failed:", mailErr.message));
        }
      });

      res.json({ status: true, message: "Case completed successfully.", token: _token });
    });
  });
};
