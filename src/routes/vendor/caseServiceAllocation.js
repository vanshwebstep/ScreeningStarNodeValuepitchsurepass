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
  if (!cloudImageFTPHost || !cloudImageFTPUser || !cloudImageFTPPassword) {
    console.error("FTP configuration missing required details.");
    return;
  }
  cloudImageFTPSecure = cloudImageFTPSecure === 0 ? false : true;
});

// Set up multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomNumber = Math.floor(Math.random() * 10000);
    const extension = path.extname(file.originalname);
    const filename = `${timestamp}_${randomNumber}${extension}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedFileTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/webp",
    "image/svg+xml",
    "image/x-icon",
    "image/heic",
    "image/heif",
    "image/apng",
    "application/zip",
    "application/x-zip-compressed",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
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
  limits: { fileSize: 512 * 1024 * 1024 },
  fileFilter,
});

// Vendor routes

router.get("/service-options", csa.vendorServiceOptions);
router.get("/cases", csa.vendorCaseList);
router.post("/accept", csa.vendorAcceptCase);
router.post("/upload-report", upload.fields([{ name: "image" }]), csa.vendorUploadReport);
router.post("/verified-date", csa.vendorUpdateVerifiedDate);
router.post("/verification-status", csa.vendorUpdateVerificationStatus);
router.post("/complete", csa.vendorCompleteCase);
router.post("/remarks", csa.vendorSaveRemarks);

module.exports = router;