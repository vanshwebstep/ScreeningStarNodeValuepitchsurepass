const crypto = require("crypto");
const Vendor = require("../../models/admin/vendorModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");
const { sendVendorWelcomeMail } = require("../../mailer/admin/vendor-management/welcomeMail");

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
  const { admin_id, _token } = req.query;
  const miss = missing(req.query, { admin_id: "Admin ID", _token: "Token" });
  if (miss.length) return res.status(400).json({ status: false, message: `Missing required fields: ${miss.join(", ")}` });

  validateAdmin(admin_id, _token, "client_overview", res, (newToken) => {
    Vendor.list((err, vendors) => {
      if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
      res.json({ status: true, message: "Vendor fetched successfully.", vendors, totalResults: vendors.length, token: newToken });
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
