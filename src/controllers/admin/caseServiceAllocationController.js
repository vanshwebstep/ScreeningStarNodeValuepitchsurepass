const { CaseServiceAllocation, writeCandidateFieldValue, VERIFICATION_STATUS_VALUES } = require("../../models/admin/caseServiceAllocationModel");
const VendorCorrection = require("../../models/admin/vendorCorrectionModel");
const AdminCommon = require("../../models/admin/commonModel");
const Vendor = require("../../models/admin/vendorModel");
const { saveImage } = require("../../utils/cloudImageSave");
const { getClientIpAddress } = require("../../utils/ipAddress");
const { sendVendorAssignedMail, sendVendorBulkAssignedMail, sendVendorAttachmentMail } = require("../../mailer/admin/vendor-management/welcomeMail");

const vendorLoginUrl = (email) => `https://dev-screeningstar.netlify.app/vendor-login?email=${encodeURIComponent(email)}`;

const authorizeAdmin = (admin_id, _token, res, next) => {
  AdminCommon.isAdminAuthorizedForAction(admin_id, "admin_manager", (auth) => {
    if (!auth.status) return res.status(403).json({ status: false, message: auth.message });
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, token) => {
      if (err) return res.status(500).json({ status: false, message: err.message });
      if (!token.status) return res.status(401).json({ status: false, message: token.message });
      next(token.newToken);
    });
  });
};

// ── Admin: list ──────────────────────────────────────────────────────────────
exports.list = (req, res) => {
  const { admin_id, _token } = req.query;
  if (!admin_id || !_token) return res.status(400).json({ status: false, message: "Missing required fields: Admin ID, Token" });

  authorizeAdmin(admin_id, _token, res, (newToken) => {
    CaseServiceAllocation.listForAdmin((err, allocations) => {
      if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
      res.json({ status: true, message: "Service-wise vendor allocation list fetched.", data: { allocations }, token: newToken });
    });
  });
};

// ── Admin: allocate single service-row ────────────────────────────────────────
exports.allocate = (req, res) => {
  const { allocation_id, vendor_id, admin_id, _token } = req.body;
  if (!allocation_id || !vendor_id || !admin_id || !_token) {
    return res.status(400).json({ status: false, message: "Missing required fields: Allocation ID, Vendor ID, Admin ID, Token" });
  }

  authorizeAdmin(admin_id, _token, res, (newToken) => {
    Vendor.findById(vendor_id, (vendorErr, vendor) => {
      if (vendorErr) return res.status(500).json({ status: false, message: vendorErr.message, token: newToken });
      if (!vendor) return res.status(404).json({ status: false, message: "Vendor not found", token: newToken });

      CaseServiceAllocation.allocate(allocation_id, vendor, admin_id, (err) => {
        if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });

        CaseServiceAllocation.findForMail(allocation_id, vendor.id, (mailErr, caseInfo) => {
          if (mailErr) {
            console.error("Vendor assignment mail case lookup failed:", mailErr.message);
          } else {
            sendVendorAssignedMail({
              vendorName: vendor.name_of_organization,
              email: vendor.email_id,
              caseInfo: caseInfo || { application_id: allocation_id },
              loginUrl: vendorLoginUrl(vendor.email_id),
            }).catch((mailSendErr) => console.error("Vendor assignment mail failed:", mailSendErr.message));
          }
        });

        res.json({ status: true, message: "Vendor allocated to service successfully.", token: newToken });
      });
    });
  });
};
// ── Admin: bulk allocate ──────────────────────────────────────────────────────
exports.allocateBulk = (req, res) => {
  const { allocation_ids, vendor_id, admin_id, _token } = req.body;
  const ids = Array.isArray(allocation_ids) ? allocation_ids : [];
  if (!ids.length || !vendor_id || !admin_id || !_token) {
    return res.status(400).json({ status: false, message: "Missing required fields: Allocation IDs, Vendor ID, Admin ID, Token" });
  }

  authorizeAdmin(admin_id, _token, res, (newToken) => {
    Vendor.findById(vendor_id, (vendorErr, vendor) => {
      if (vendorErr) return res.status(500).json({ status: false, message: vendorErr.message, token: newToken });
      if (!vendor) return res.status(404).json({ status: false, message: "Vendor not found", token: newToken });

      CaseServiceAllocation.allocateBulk(ids, vendor, admin_id, (err, result) => {
        if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
        const affected = Array.isArray(result) ? Number(result[1] || 0) : 0;
        if (!affected) return res.status(400).json({ status: false, message: "No selected services were allocated.", token: newToken });

        Promise.all(ids.map((id) => new Promise((resolve) => {
          CaseServiceAllocation.findForMail(id, vendor.id, (mailErr, caseInfo) => {
            resolve(mailErr ? { application_id: id } : (caseInfo || { application_id: id }));
          });
        }))).then((cases) => sendVendorBulkAssignedMail({
          vendorName: vendor.name_of_organization,
          email: vendor.email_id,
          cases,
          loginUrl: vendorLoginUrl(vendor.email_id),
        })).catch((mailErr) => console.error("Bulk vendor assignment mail failed:", mailErr.message));

        res.json({ status: true, message: `${affected} service(s) allocated successfully.`, token: newToken });
      });
    });
  });
};

// ── Admin: enable/disable a service row ──────────────────────────────────────
exports.updateCaseAccess = (req, res) => {
  const { allocation_id, enabled, admin_id, _token } = req.body;
  if (!allocation_id || enabled === undefined || !admin_id || !_token) {
    return res.status(400).json({ status: false, message: "Missing required fields: Allocation ID, Enabled, Admin ID, Token" });
  }
  authorizeAdmin(admin_id, _token, res, (newToken) => {
    CaseServiceAllocation.updateCaseAccess(allocation_id, Number(enabled) === 1, (err) => {
      if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
      res.json({ status: true, message: "Access updated.", token: newToken });
    });
  });
};
exports.updateVerificationStatus = (req, res) => {
  const { allocation_id, verification_status, admin_id, _token } = req.body;
  if (!allocation_id || !verification_status || !admin_id || !_token) {
    return res.status(400).json({ status: false, message: "Missing required fields: Allocation ID, Verification Status, Admin ID, Token" });
  }
  if (!VERIFICATION_STATUS_VALUES.includes(verification_status)) {
    return res.status(400).json({ status: false, message: "Invalid verification status." });
  }
  authorizeAdmin(admin_id, _token, res, (newToken) => {
    CaseServiceAllocation.updateVerificationStatus(allocation_id, verification_status, null, (err, result) => {
      if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
      const affected = Array.isArray(result) ? Number(result[1] || 0) : 0;
      if (!affected) return res.status(400).json({ status: false, message: "Unable to update — case is disabled or not found.", token: newToken });
      res.json({ status: true, message: "Verification status updated.", token: newToken });
    });
  });
};

// ── Admin: attachment upload before allocation ───────────────────────────────
exports.uploadAttachment = async (req, res) => {
  const { allocation_id, admin_id, _token } = req.body;
  if (!allocation_id || !admin_id || !_token) {
    return res.status(400).json({ status: false, message: "Missing required fields: Allocation ID, Admin ID, Token" });
  }

  authorizeAdmin(admin_id, _token, res, async (newToken) => {
    try {
      const file = req.files?.attachment?.[0] || req.files?.image?.[0];
      if (!file) return res.status(400).json({ status: false, message: "Attachment file is required.", token: newToken });

      const targetDir = `uploads/case-service-allocations/${allocation_id}/attachments`;
      const attachmentPath = await saveImage(file, targetDir, "attachment");

      CaseServiceAllocation.saveAttachment(allocation_id, attachmentPath, admin_id, (err) => {
        if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });

        CaseServiceAllocation.findById(allocation_id, (findErr, allocation) => {
          if (!findErr && allocation && allocation.vendor_id) {
            Vendor.findById(allocation.vendor_id, (vendorErr, vendor) => {
              if (vendorErr || !vendor) return;
              CaseServiceAllocation.findForMail(allocation_id, vendor.id, (mailErr, caseInfo) => {
                if (mailErr || !caseInfo || !caseInfo.attachment_url) return;
                sendVendorAttachmentMail({
                  vendorName: vendor.name_of_organization,
                  email: vendor.email_id,
                  caseInfo,
                  loginUrl: vendorLoginUrl(vendor.email_id),
                }).catch((mailSendErr) => console.error("Vendor attachment mail failed:", mailSendErr.message));
              });
            });
          }
        });

        res.json({ status: true, message: "Attachment uploaded successfully.", attachment_path: attachmentPath, token: newToken });
      });
    } catch (error) {
      res.status(500).json({ status: false, message: error.message || "Unable to upload attachment.", token: newToken });
    }
  });
};

// ── Admin: review a correction request (approve/reject/edit&save) ───────────
exports.reviewCorrection = (req, res) => {
  const { request_id, action, final_value, admin_id, _token } = req.body;
  // action: "approve" | "reject" | "edit"
  if (!request_id || !action || !admin_id || !_token) {
    return res.status(400).json({ status: false, message: "Missing required fields: Request ID, Action, Admin ID, Token" });
  }
  if (!["approve", "reject", "edit"].includes(action)) {
    return res.status(400).json({ status: false, message: "Invalid action. Use approve, reject, or edit." });
  }
  if (action === "edit" && (final_value === undefined || final_value === null || String(final_value).trim() === "")) {
    return res.status(400).json({ status: false, message: "final_value is required for edit action." });
  }

  authorizeAdmin(admin_id, _token, res, (newToken) => {
    VendorCorrection.findById(request_id, (findErr, request) => {
      if (findErr) return res.status(500).json({ status: false, message: findErr.message, token: newToken });
      if (!request) return res.status(404).json({ status: false, message: "Correction request not found.", token: newToken });
      if (request.status !== "pending") return res.status(409).json({ status: false, message: "This request has already been reviewed.", token: newToken });

      const applyFinalValue = async (valueToApply) => {
        try {
          await writeCandidateFieldValue(request.client_application_id, request.field_name, valueToApply);
        } catch (writeErr) {
          throw writeErr;
        }
      };

      if (action === "reject") {
        return VendorCorrection.review(request_id, { status: "rejected", admin_final_value: null, reviewed_by: admin_id }, (err) => {
          if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
          res.json({ status: true, message: "Correction request rejected. Original value kept.", token: newToken });
        });
      }

      const valueToApply = action === "edit" ? final_value : request.proposed_value;

      applyFinalValue(valueToApply)
        .then(() => {
          VendorCorrection.review(request_id, { status: "approved", admin_final_value: valueToApply, reviewed_by: admin_id }, (err) => {
            if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
            res.json({ status: true, message: "Correction approved and applied.", final_value: valueToApply, token: newToken });
          });
        })
        .catch((writeErr) => res.status(500).json({ status: false, message: writeErr.message, token: newToken }));
    });
  });
};

// ── Vendor: list service filter options ──────────────────────────────────────
exports.vendorServiceOptions = (req, res) => {
  const { vendor_id, _token } = req.query;
  Vendor.findById(vendor_id, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor || vendor.login_token !== _token) return res.status(401).json({ status: false, message: "Invalid or expired token." });
    CaseServiceAllocation.listVendorServices(vendor_id, (err2, services) => {
      if (err2) return res.status(500).json({ status: false, message: err2.message });
      res.json({ status: true, services, token: _token });
    });
  });
};

// ── Vendor: list cases (service-wise, filterable) ────────────────────────────
exports.vendorCaseList = (req, res) => {
  const { vendor_id, _token, status, service_id } = req.query;
  Vendor.findById(vendor_id, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor || vendor.login_token !== _token) return res.status(401).json({ status: false, message: "Invalid or expired token." });
    CaseServiceAllocation.listForVendor(vendor_id, status, service_id, (err2, cases) => {
      if (err2) return res.status(500).json({ status: false, message: err2.message });
      res.json({ status: true, cases, totalResults: cases.length, token: _token });
    });
  });
};

// ── Vendor: accept / upload / verify / complete (per service allocation) ────
exports.vendorAcceptCase = (req, res) => {
  const { vendor_id, _token, allocation_id } = req.body;
  Vendor.findById(vendor_id, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor || vendor.login_token !== _token) return res.status(401).json({ status: false, message: "Invalid or expired token." });
    CaseServiceAllocation.acceptCase(vendor_id, allocation_id, (err2, result) => {
      if (err2) return res.status(500).json({ status: false, message: err2.message });
      const affected = Array.isArray(result) ? Number(result[1] || 0) : 0;
      if (!affected) return res.status(400).json({ status: false, message: "Unable to accept — case disabled or not yours." });
      res.json({ status: true, message: "Case accepted successfully.", token: _token });
    });
  });
};

exports.vendorUploadReport = (req, res) => {
  const { vendor_id, _token, allocation_id } = req.body;
  Vendor.findById(vendor_id, async (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor || vendor.login_token !== _token) return res.status(401).json({ status: false, message: "Invalid or expired token." });
    try {
      const file = req.files?.image?.[0] || req.files?.pdf?.[0];
      if (!file) return res.status(400).json({ status: false, message: "Report file is required." });
      const safeVendorCode = String(vendor.vendor_code || vendor.id).replace(/[^a-zA-Z0-9_-]/g, "-");
      const targetDir = `uploads/vendors/${safeVendorCode}/service-allocations/${allocation_id}/reports`;
      const reportPath = await saveImage(file, targetDir, "vendor-report");
      CaseServiceAllocation.saveReport(vendor_id, allocation_id, reportPath, (err2, result) => {
        if (err2) return res.status(500).json({ status: false, message: err2.message });
        const affected = Array.isArray(result) ? Number(result[1] || 0) : 0;
        if (!affected) {
          return res.status(403).json({ status: false, message: "Upload access disabled. Contact admin to re-enable." });
        }
        res.json({ status: true, message: "Report uploaded successfully.", report_path: reportPath, token: _token });
      });
    } catch (error) {
      res.status(500).json({ status: false, message: error.message || "Unable to upload report." });
    }
  });
};

exports.vendorUpdateVerifiedDate = (req, res) => {
  const { vendor_id, _token, allocation_id, verified_date } = req.body;
  Vendor.findById(vendor_id, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor || vendor.login_token !== _token) return res.status(401).json({ status: false, message: "Invalid or expired token." });
    CaseServiceAllocation.updateVerifiedDate(vendor_id, allocation_id, verified_date, (err2) => {
      if (err2) return res.status(500).json({ status: false, message: err2.message });
      res.json({ status: true, message: "Verified date updated.", token: _token });
    });
  });
};
exports.vendorUpdateVerificationStatus = (req, res) => {
  const { vendor_id, _token, allocation_id, verification_status } = req.body;
  if (!allocation_id || !verification_status) {
    return res.status(400).json({ status: false, message: "Missing required fields: Allocation ID, Verification Status." });
  }
  if (!VERIFICATION_STATUS_VALUES.includes(verification_status)) {
    return res.status(400).json({ status: false, message: "Invalid verification status. Use the Complete action to mark a case as completed." });
  }
  Vendor.findById(vendor_id, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor || vendor.login_token !== _token) return res.status(401).json({ status: false, message: "Invalid or expired token." });
    CaseServiceAllocation.updateVerificationStatus(allocation_id, verification_status, vendor_id, (err2, result) => {
      if (err2) return res.status(500).json({ status: false, message: err2.message });
      const affected = Array.isArray(result) ? Number(result[1] || 0) : 0;
      if (!affected) return res.status(400).json({ status: false, message: "Unable to update — case is disabled or not yours." });
      res.json({ status: true, message: "Verification status updated.", token: _token });
    });
  });
};

exports.vendorCompleteCase = (req, res) => {
  const { vendor_id, _token, allocation_id } = req.body;
  Vendor.findById(vendor_id, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor || vendor.login_token !== _token) return res.status(401).json({ status: false, message: "Invalid or expired token." });
    CaseServiceAllocation.completeCase(vendor_id, allocation_id, (err2, result) => {
      if (err2) return res.status(500).json({ status: false, message: err2.message });
      const affected = Array.isArray(result) ? Number(result[1] || 0) : 0;
      if (!affected) return res.status(400).json({ status: false, message: "Upload report and select verified date first." });
      res.json({ status: true, message: "Case completed successfully.", token: _token });
    });
  });
};

// ── Vendor: raise correction request ─────────────────────────────────────────
exports.vendorRequestCorrection = (req, res) => {
  const { vendor_id, _token, allocation_id, field_name, old_value, proposed_value } = req.body;
  if (!allocation_id || !field_name || !proposed_value) {
    return res.status(400).json({ status: false, message: "Missing required fields: Allocation ID, Field Name, Proposed Value." });
  }
  if (!VendorCorrection.isFieldAllowed(field_name)) {
    return res.status(400).json({ status: false, message: "This field cannot be corrected via this flow." });
  }

  Vendor.findById(vendor_id, (err, vendor) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (!vendor || vendor.login_token !== _token) return res.status(401).json({ status: false, message: "Invalid or expired token." });

    CaseServiceAllocation.findById(allocation_id, (findErr, allocation) => {
      if (findErr) return res.status(500).json({ status: false, message: findErr.message });
      if (!allocation || Number(allocation.vendor_id) !== Number(vendor_id)) {
        return res.status(404).json({ status: false, message: "Allocation not found for this vendor." });
      }
      VendorCorrection.create(
        {
          case_service_allocation_id: allocation_id,
          client_application_id: allocation.client_application_id,
          vendor_id,
          field_name,
          old_value,
          proposed_value,
        },
        (createErr) => {
          if (createErr) return res.status(500).json({ status: false, message: createErr.message });
          res.json({ status: true, message: "Correction request submitted. Admin will review it.", token: _token });
        }
      );
    });
  });
};

exports.updateUploadAccess = (req, res) => {
  const { allocation_id, enabled, admin_id, _token } = req.body;
  if (!allocation_id || enabled === undefined || !admin_id || !_token) {
    return res.status(400).json({ status: false, message: "Missing required fields: Allocation ID, Enabled, Admin ID, Token" });
  }
  authorizeAdmin(admin_id, _token, res, (newToken) => {
    CaseServiceAllocation.updateUploadAccess(allocation_id, Number(enabled) === 1, (err) => {
      if (err) return res.status(500).json({ status: false, message: err.message, token: newToken });
      res.json({ status: true, message: "Upload access updated.", token: newToken });
    });
  });
};