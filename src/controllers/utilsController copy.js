const fs = require("fs");
const path = require("path");
const { upload, saveImage, saveImages } = require("../utils/cloudImageSave");
const Common = require("../models/admin/commonModel");
const axios = require("axios");
const sharp = require("sharp");

exports.imageUrlToBase = async (req, res) => {
  const getImageFormat = (url) => {
    const ext = url.split(".").pop().toLowerCase();
    if (ext === "png") return "PNG";
    if (ext === "jpg" || ext === "jpeg") return "JPEG";
    if (ext === "webp") return "WEBP";
    return "PNG"; // Default to PNG if not recognized
  };

  async function checkImageExists(url) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return response.ok; // Returns true if HTTP status is 200-299
    } catch (error) {
      console.error(`Error checking image existence at ${url}:`, error);
      return false;
    }
  }

  async function validateImage(url) {
    try {
      const response = await axios.get(url, { responseType: "arraybuffer" });
      if (response.status !== 200) {
        console.warn(
          `Image fetch failed for URL: ${url} with status: ${response.status}`
        );
        return null;
      }

      if (!response.data) {
        console.warn(`No data found in the response for URL: ${url}`);
        return null;
      }

      const buffer = Buffer.from(response.data);
      const metadata = await sharp(buffer).metadata();

      if (!metadata) {
        console.warn(`Unable to fetch metadata for image from URL: ${url}`);
        return null;
      }

      return {
        src: url,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
      };
    } catch (error) {
      console.error(`Error validating image from ${url}:`, error);
      return null;
    }
  }

  async function fetchImageAsBase64(imageUrl) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      return `data:image/png;base64,${Buffer.from(
        response.data,
        "binary"
      ).toString("base64")}`;
    } catch (error) {
      console.error("Error fetching or converting image:", error.message);
      return null;
    }
  }

  async function processImageUrls(image_urls) {
    if (Array.isArray(image_urls)) {
      return image_urls.map(url => url.trim()).filter(url => url); // Trim and remove empty values
    } else if (typeof image_urls === 'string') {
      return image_urls.split(",").map(url => url.trim()).filter(url => url);
    }
    return []; // Return an empty array for invalid input
  };

  try {
    // Expecting a comma-separated string of image URLs in req.body.image_urls
    const { image_urls } = req.body;

    if (!image_urls) {
      return res.status(400).send("Missing image URLs");
    }

    // Split the comma-separated string into an array of image URLs
    const imageUrlsArray = await processImageUrls(image_urls);

    const base64Images = [];

    for (const imageUrl of imageUrlsArray) {
      const imageFormat = getImageFormat(imageUrl);

      if (!(await checkImageExists(imageUrl))) {
        continue;
      }

      const img = await validateImage(imageUrl);
      if (!img) {
        console.log(`img - `, img);
        console.warn(`Invalid image: ${imageUrl}`);
        continue;
      }

      const base64Image = await fetchImageAsBase64(img.src);
      if (!base64Image) {
        console.error("Failed to convert image to base64:", imageUrl);
        continue;
      }

      // Add image format, width, and height to the response
      base64Images.push({
        imageUrl: img.src,
        base64: base64Image,
        type: img.format, // Image format (e.g., PNG, JPEG)
        width: img.width, // Image width
        height: img.height, // Image height
      });
    }

    res.status(200).json({ images: base64Images });
  } catch (error) {
    console.error("Error processing images:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.uploadImage = (req, res) => {
  // Define the target directory to move files to
  const targetDir = "uploads/rohit"; // Specify your target directory here
  fs.mkdir(targetDir, { recursive: true }, (err) => {
    if (err) {
      console.error("Error creating directory:", err);
      return res.status(500).json({
        status: false,
        message: "Error creating directory.",
      });
    }
    // Use multer to handle the upload
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          status: false,
          message: "Error uploading file.",
          err,
        });
      }

      try {
        let savedImagePaths = [];

        // Check if multiple files are uploaded under the "images" field
        if (req.files.images) {
          savedImagePaths = await saveImages(req.files.images, targetDir); // Pass targetDir to saveImages
        }

        // Check if a single file is uploaded under the "image" field
        if (req.files.image && req.files.image.length > 0) {
          const savedImagePath = await saveImage(req.files.image[0], targetDir); // Pass targetDir to saveImage
          savedImagePaths.push(savedImagePath);
        }

        // Return success response
        return res.status(201).json({
          status: true,
          message:
            savedImagePaths.length > 0
              ? "Image(s) saved successfully"
              : "No images uploaded",
          data: savedImagePaths,
        });
      } catch (error) {
        console.error("Error saving image:", error);
        return res.status(500).json({
          status: false,
          message: "An error occurred while saving the image",
        });
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
        err: authResult,
        message: authResult.message, // Return the message from the authorization check
      });
    }
    res.status(200).json({ authResult });
  });
}