const express = require("express");
const router = express.Router();
const generateInvoiceController = require("../../controllers/admin/generateInvoiceController");
const csa = require("../../controllers/admin/caseServiceAllocationController");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const ftp = require("basic-ftp");
const App = require("../../models/appModel");
const axios = require("axios");

// Fetch app information (database query) once
let cloudImageFTPHost,
  cloudImageFTPUser,
  cloudImageFTPPassword,
  cloudImageFTPSecure;

App.appInfo("backend", (err, appInfo) => {
  if (err) {
    console.error("Database error:", err);
    return;
  }

  cloudImageFTPHost = appInfo.cloud_ftp_host;
  cloudImageFTPUser = appInfo.cloud_ftp_user;
  cloudImageFTPPassword = appInfo.cloud_ftp_password;
  cloudImageFTPSecure = appInfo.cloud_ftp_secure;
  // Check if any FTP details are missing and handle the error
  if (!cloudImageFTPHost || !cloudImageFTPUser || !cloudImageFTPPassword) {
    console.error("FTP configuration missing required details.");
    return;
  }
  // Set cloudImageFTPSecure based on its value (0 = false, anything else = true)
  cloudImageFTPSecure = cloudImageFTPSecure === 0 ? false : true;
});

// Set up multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads"; // Original upload directory
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true }); // Create directory if it doesn't exist
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomNumber = Math.floor(Math.random() * 10000); // Random number
    const extension = path.extname(file.originalname); // Get the file extension
    const filename = `${timestamp}_${randomNumber}${extension}`; // Create filename
    cb(null, filename); // Return the filename
  },
});

const fileFilter = (req, file, cb) => {
  const allowedFileTypes = [
    "application/pdf", // PDF files
    "image/jpeg", // JPEG images
    "image/png", // PNG images
    "image/gif", // GIF images
    "image/bmp", // BMP images
    "image/tiff", // TIFF images
    "image/webp", // WebP images
    "image/svg+xml", // SVG images
    "image/x-icon", // ICO files
    "image/heic", // HEIC images
    "image/heif", // HEIF images
    "image/apng", // APNG images
    "application/zip", // ZIP files
    "application/x-zip-compressed",
    "application/vnd.ms-excel", // Excel files (.xls)
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // Excel files (.xlsx)
    "text/csv", // CSV files
    "application/msword", // Word files (.doc)
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // Word files (.docx)
  ];
  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true); // Accept the file
  } else {
    console.log(`file.mimetype - `, file.mimetype);
    cb(
      new Error(
        "Invalid file type. Allowed file types are: PDF, images (JPEG, PNG, GIF, BMP, TIFF, WebP, SVG, ICO, HEIC, HEIF, APNG), ZIP, Excel files (.xls, .xlsx), CSV files, and Word documents (.doc, .docx)."
      )
    );
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 512 * 1024 * 1024 }, // 512 MB limit
  fileFilter,
});
router.get("/list", csa.list);
router.post("/allocate", csa.allocate);
router.post("/allocate-bulk", csa.allocateBulk);
router.post("/case-access", csa.updateCaseAccess);
router.post("/attachment", upload.fields([{ name: "attachment" }]), csa.uploadAttachment);
router.post("/correction/review", csa.reviewCorrection);
router.post("/upload-access", csa.updateUploadAccess);
router.post("/verification-status", csa.updateVerificationStatus);
// router.post("/remarks-access", csa.updateRemarksAccess);
module.exports = router;
