const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const { upload, saveImage, saveImages } = require("../utils/cloudImageSave");
const Common = require("../models/admin/commonModel");

/** Utility Functions **/

// Get file extension and determine image format
const getImageFormat = (url) => {
  const ext = url.split(".").pop().toLowerCase();
  return ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext.toUpperCase() : "PNG";
};

// Check if image URL is valid and reachable
const checkImageExists = async (url) => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    console.error(`Image check failed for ${url}:`, error.message);
    return false;
  }
};

// Validate image content and return metadata
const validateImage = async (url) => {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);
    const metadata = await sharp(buffer).metadata();

    return {
      src: url,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    };
  } catch (error) {
    console.error(`Image validation failed for ${url}:`, error.message);
    return null;
  }
};

// Convert an image to Base64 format
const fetchImageAsBase64 = async (imageUrl) => {
  try {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    return `data:image/png;base64,${Buffer.from(response.data).toString("base64")}`;
  } catch (error) {
    console.error(`Base64 conversion failed for ${imageUrl}:`, error.message);
    return null;
  }
};

// Get Base64 + MIME type
const fetchFileAsBase64 = async (fileUrl) => {
  try {
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const mime = response.headers["content-type"] || "application/octet-stream";
    const base64 = Buffer.from(response.data).toString("base64");
    return {
      base64: `data:${mime};base64,${base64}`,
      mime,
    };
  } catch (error) {
    console.error(`File base64 conversion failed:`, error.message);
    return null;
  }
};

// Normalize and split image URLs
const processImageUrls = (input) => {
  if (Array.isArray(input)) {
    return input.map(url => url.trim()).filter(Boolean);
  } else if (typeof input === "string") {
    return input.split(",").map(url => url.trim()).filter(Boolean);
  }
  return [];
};

/** Controllers **/

exports.imageUrlToBase = async (req, res) => {
  try {
    const { image_urls } = req.body;
    if (!image_urls) {
      return res.status(400).json({ error: "Missing 'image_urls' in request body." });
    }

    const imageUrlsArray = processImageUrls(image_urls);
    const base64Images = [];

    for (const imageUrl of imageUrlsArray) {
      if (!(await checkImageExists(imageUrl))) {
        console.warn(`File not found or inaccessible: ${imageUrl}`);
        continue;
      }

      const img = await validateImage(imageUrl);
      if (!img) {
        console.log(`img - `, img);
        console.warn(`Invalid image: ${imageUrl}`);
      }

      const fileData = await fetchFileAsBase64(imageUrl);
      if (!fileData) {
        console.error("Failed to convert file to base64:", imageUrl);
        continue;
      }

      const fileName = path.basename(imageUrl);

      // Add image format, width, and height to the response
      base64Images.push({
        url: imageUrl || img?.src,
        fileName,
        base64: fileData?.base64,
        type: img?.format,
        width: img?.width,
        height: img?.height,
      });
    }

    return res.status(200).json({ images: base64Images });
  } catch (error) {
    console.error("Failed to convert image URLs to Base64:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.uploadImage = (req, res) => {
  const targetDir = "uploads/rohit";
  fs.mkdir(targetDir, { recursive: true }, (err) => {
    if (err) {
      console.error("Failed to create directory:", err.message);
      return res.status(500).json({ status: false, message: "Directory creation failed." });
    }

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ status: false, message: "Upload failed.", error: err });
      }

      try {
        let savedPaths = [];

        if (req.files?.images) {
          savedPaths = await saveImages(req.files.images, targetDir);
        }

        if (req.files?.image?.length > 0) {
          const path = await saveImage(req.files.image[0], targetDir);
          savedPaths.push(path);
        }

        return res.status(201).json({
          status: true,
          message: savedPaths.length > 0 ? "Upload successful." : "No images uploaded.",
          data: savedPaths,
        });
      } catch (error) {
        console.error("Error saving uploaded image:", error.message);
        res.status(500).json({ status: false, message: "Image save error." });
      }
    });
  });
};

exports.test = (req, res) => {
  const action = "employee_credentials";
  Common.isAdminAuthorizedForAction(4, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        message: authResult.message,
        error: authResult,
      });
    }
    return res.status(200).json({ status: true, authResult });
  });
};
