const fs = require("fs");
const path = require("path");
const multer = require("multer");
const ftp = require("basic-ftp");
const App = require("../models/appModel");
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

// Multer setup
const upload = multer({
  storage,
  limits: { fileSize: 512 * 1024 * 1024 }, // 512 MB limit
  fileFilter,
});
// Function to save a single image and upload it to FTP
const saveImage = async (file, targetDir, fileNameSlug = '') => {
  return new Promise((resolve, reject) => {
    if (file) {
      const originalPath = path.join("uploads", file.filename); // Original file path

      const newFileName = fileNameSlug
        ? `${fileNameSlug}-${file.filename}`
        : file.filename;

      const newPath = path.join(targetDir, newFileName); // New file path

      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true }); // Create directory if it doesn't exist
      }

      // Move the file to the new directory
      fs.rename(originalPath, newPath, async (err) => {
        if (err) {
          console.error("Error renaming file:", err);
          return reject(err); // Reject on error
        }

        // Upload the image to FTP after saving locally
        try {
          await uploadToFtp(newPath); // FTP upload after saving locally
          fs.unlinkSync(newPath);
          resolve(newPath); // Return the new file path
        } catch (err) {
          console.error("Error uploading to FTP:", err);
          reject(err); // Reject if FTP upload fails
        }
      });
    } else {
      reject(new Error("No file provided for saving."));
    }
  });
};

const saveZip = async (file, targetDir) => {
  return new Promise((resolve, reject) => {
    if (file) {
      const originalPath = path.join("uploads", file.filename); // Original file path
      const newPath = path.join(targetDir, file.filename); // New file path

      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true }); // Create directory if it doesn't exist
      }

      // Move the file to the new directory
      fs.rename(originalPath, newPath, async (err) => {
        if (err) {
          console.error("Error renaming file:", err);
          return reject(err); // Reject on error
        }

        // Upload the image to FTP after saving locally
        try {
          await uploadToFtp(newPath); // FTP upload after saving locally
          fs.unlinkSync(newPath);
          resolve(newPath); // Return the new file path
        } catch (err) {
          console.error("Error uploading to FTP:", err);
          reject(err); // Reject if FTP upload fails
        }
      });
    } else {
      reject(new Error("No file provided for saving."));
    }
  });
};

// Function to upload an image to Hostinger via FTP
const uploadToFtp = async (filePath) => {
  const client = new ftp.Client();
  client.ftp.verbose = true; // Enable verbose logging for FTP connection
  client.ftp.timeout = 300000;

  try {
    // Connect to FTP server using previously fetched app information
    await client.access({
      host: cloudImageFTPHost,
      user: cloudImageFTPUser,
      password: cloudImageFTPPassword,
      secure: cloudImageFTPSecure,
    });

    const targetDir = path.dirname(filePath); // Get the directory path (e.g., "uploads/rohit")
    const filename = path.basename(filePath); // Get the filename (e.g., "1734421514518_5912.png")

    const dirs = targetDir.split(path.sep);
    for (const dir of dirs) {
      await client.ensureDir(dir); // Ensure each directory exists
    }

    // Upload the image file to Hostinger's public_html folder
    await client.uploadFrom(filePath, filename);
  } catch (err) {
    console.error("FTP upload failed:", err);
    throw err; // Rethrow the error
  } finally {
    client.close(); // Close the FTP connection
  }
};

// Function to save multiple images and upload them to FTP
const saveImages = async (files, targetDir, fileNameSlug = '') => {
  const savedImagePaths = [];
  for (const file of files) {
    const savedImagePath = await saveImage(file, targetDir, fileNameSlug); // Save and upload each file
    savedImagePaths.push(savedImagePath);
  }
  return savedImagePaths; // Return an array of saved image paths
};

const savePdf = async (doc, pdfFileName, targetDir) => {
  // Create the target directory on the FTP server first
  const dirs = targetDir.split(path.sep); // Split targetDir into directory parts
  const client = new ftp.Client();
  client.ftp.verbose = true; // Enable verbose logging for FTP connection
  client.ftp.timeout = 300000;

  try {
    // Connect to FTP server using previously fetched app information
    await client.access({
      host: cloudImageFTPHost,
      user: cloudImageFTPUser,
      password: cloudImageFTPPassword,
      secure: cloudImageFTPSecure,
    });

    // Ensure the directories exist on the FTP server
    for (const dir of dirs) {
      await client.ensureDir(dir); // Ensure each directory exists on FTP
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true }); // Create directory if it doesn't exist
    }

    // Create a temporary path to save the PDF file locally
    const pdfPath = path.join(targetDir, pdfFileName);

    // Save the document (PDF) to a temporary local path
    await doc.save(pdfPath); // You can adjust this to directly generate the file

    // Upload the file directly to the FTP server
    await client.uploadFrom(pdfPath, pdfFileName);

    // After successful upload, remove the local file
    fs.unlinkSync(pdfPath); // Delete the temporary local file
    return pdfPath;
  } catch (err) {
    console.error("Error during FTP upload:", err);
    throw err; // Rethrow the error if upload fails
  } finally {
    client.close(); // Close the FTP connection
  }
};

// Function to delete a folder from the FTP server
const deleteFolder = async (folderPath) => {
  console.log(`Attempting to delete folder at path: ${folderPath}`);
  const client = new ftp.Client();
  client.ftp.verbose = true; // Enables verbose logging of FTP commands
  client.ftp.timeout = 300000;

  try {
    console.log("🖥 Connecting to FTP server...");
    await client.access({
      host: cloudImageFTPHost,
      user: cloudImageFTPUser,
      password: cloudImageFTPPassword,
      secure: cloudImageFTPSecure,
    });
    console.log(`✅ Connected to FTP server as user: ${cloudImageFTPUser}`);

    // Recursively check if the folder exists by traversing subdirectories
    const checkFolderExists = async (currentPath) => {
      // Extract the folder name from the path
      const folderName = currentPath.split("/").pop();
      const filteredFolderNameArr = currentPath.split("/").filter(name => name);

      // Remove the last folder and join the rest
      const updatedFolderPath = filteredFolderNameArr.slice(0, -1).join("/");

      // ✅ List root directories to check if the folderPath exists
      const rootDirs = await client.list(updatedFolderPath);
      // Check if the folder exists in the current directory
      const folder = rootDirs.find(dir => dir.name === folderName && dir.type === 2); // type 2 is a directory
      if (folder) {
        console.log(`✅ Found folder: ${folderName} in path: ${updatedFolderPath}`);
        return true;
      } else {
        console.log(`❌ Folder: ${folderName} not found in path: ${updatedFolderPath}`);
        return false;
      }
    };

    const folderExists = await checkFolderExists(folderPath);

    if (!folderExists) {
      console.error(`❌ Folder does not exist: ${folderPath}`);
      throw new Error(`Folder not found: ${folderPath}`);
    }

    console.log(`✅ Folder found: ${folderPath}`);

    // 🔹 Change to the parent directory before deletion
    const parentDir = path.dirname(folderPath);
    await client.cd(parentDir);
    console.log(`📁 Navigated to parent directory: ${parentDir}`);

    // 🔥 Delete the folder itself
    console.log(`🗑 Deleting folder: ${folderPath}`);
    await client.removeDir(folderPath);
    console.log(`✅ Deleted folder: ${folderPath}`);

  } catch (err) {
    // console.error("❌ Error during FTP folder deletion:", err);
    throw err;
  } finally {
    console.log("🔒 Closing FTP client connection...");
    client.close();
  }
};

const saveBase64ImageAndUpload = async (
  base64Data,
  targetDir,
  fileNameSlug = ''
) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!base64Data) {
        return reject(new Error("Base64 data is required"));
      }

      // 🔍 Extract mime & data
      const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        return reject(new Error("Invalid base64 format"));
      }

      const mimeType = matches[1];
      const extension = mimeType.split("/")[1];
      const buffer = Buffer.from(matches[2], "base64");

      // 🏷 Generate filename
      const timestamp = Date.now();
      const randomNumber = Math.floor(Math.random() * 10000);
      const fileName = fileNameSlug
        ? `${fileNameSlug}-${timestamp}_${randomNumber}.${extension}`
        : `${timestamp}_${randomNumber}.${extension}`;

      // 📁 Ensure local target dir exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const localPath = path.join(targetDir, fileName);

      // 💾 Save file locally
      fs.writeFileSync(localPath, buffer);

      // 🚀 Upload to FTP
      await uploadToFtp(localPath);

      // 🧹 Remove local file
      fs.unlinkSync(localPath);

      resolve(localPath);
    } catch (err) {
      console.error("Base64 upload failed:", err);
      reject(err);
    }
  });
};
const saveImageFromUrlAndUpload = async (imageUrl, targetDir, fileNameSlug = "") => {
  try {
    console.log("⬇️ Fetching image from URL:", imageUrl);

    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    console.log("📦 Response received. Status:", response.status);

    const buffer = Buffer.from(response.data, "binary");

    const mimeType = response.headers["content-type"];
    console.log("🧾 MIME Type:", mimeType);

    const extension = mimeType?.split("/")[1] || "jpg";

    const timestamp = Date.now();
    const randomNumber = Math.floor(Math.random() * 10000);

    const fileName = fileNameSlug
      ? `${fileNameSlug}-${timestamp}_${randomNumber}.${extension}`
      : `${timestamp}_${randomNumber}.${extension}`;

    if (!fs.existsSync(targetDir)) {
      console.log("📁 Creating directory:", targetDir);
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const localPath = path.join(targetDir, fileName);

    console.log("💾 Saving file locally:", localPath);
    fs.writeFileSync(localPath, buffer);

    console.log("🚀 Uploading to FTP...");
    await uploadToFtp(localPath);

    console.log("🧹 Deleting local file...");
    fs.unlinkSync(localPath);

    console.log("✅ Upload complete:", localPath);

    return localPath;

  } catch (err) {
    console.error("🚨 URL image upload failed:", err.message);
    throw err;
  }
};
// Exporting the upload middleware and saving functions
module.exports = {
  upload: upload.fields([
    { name: "pdf", maxCount: 5 },
    { name: "images", maxCount: 100 },
    { name: "image", maxCount: 1 },
    { name: "zip", maxCount: 5 },
  ]),
  saveZip,
  saveImage,
  saveImages,
  savePdf,
  deleteFolder,
  saveBase64ImageAndUpload,
  saveImageFromUrlAndUpload
};
