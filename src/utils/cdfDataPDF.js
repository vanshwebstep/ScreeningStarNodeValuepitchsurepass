const { jsPDF } = require("jspdf");
require("jspdf-autotable");
const CEF = require("../models/customer/branch/cefModel");
const Candidate = require("../models/customer/branch/candidateApplicationModel");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const {
  upload,
  saveImage,
  saveImages,
  savePdf,
} = require("../utils/cloudImageSave");

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
    // Step 2: Check if the image fetch was successful
    if (response.status !== 200) {
      console.warn(
        `Image fetch failed for URL: ${url} with status: ${response.status}`
      );
      return null;
    }

    // Step 3: Check if the response data is valid
    if (!response.data) {
      console.warn(`No data found in the response for URL: ${url}`);
      return null;
    }

    // Step 4: Convert the response data to a Buffer
    const buffer = Buffer.from(response.data);

    // Step 5: Extract image metadata using Sharp
    const metadata = await sharp(buffer).metadata();

    // Step 6: Check if metadata is valid
    if (!metadata) {
      console.warn(`Unable to fetch metadata for image from URL: ${url}`);
      return null;
    }

    // Step 7: Return the image URL, width, and height in an object
    return { src: url, width: metadata.width, height: metadata.height };
  } catch (error) {
    // Step 8: Catch and log any errors
    console.error(`Error validating image from ${url}:`, error);
    return null;
  }
}

function scaleImage(img, maxWidth, maxHeight) {
  const imgWidth = img.width;
  const imgHeight = img.height;

  let width = imgWidth;
  let height = imgHeight;

  // Scale image to fit within maxWidth and maxHeight
  if (imgWidth > maxWidth) {
    width = maxWidth;
    height = (imgHeight * maxWidth) / imgWidth;
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = (imgWidth * maxHeight) / imgHeight;
  }

  return { width, height };
}

async function fetchImageAsBase64(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    return `data:image/png;base64,${Buffer.from(
      response.data,
      "binary"
    ).toString("base64")}`;
  } catch (error) {
    console.error("Error fetching or converting image:", error.message);
    // throw new Error("Failed to fetch image");
    return null;
  }
}

function addFooter(doc) {
  const footerHeight = 15;
  const pageHeight = doc.internal.pageSize.height;
  const footerYPosition = pageHeight - footerHeight + 10;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 10;
  const availableWidth = pageWidth - 2 * margin;
  const centerX = pageWidth / 2;

  // Footer text and page number
  const footerText =
    "Plot No. 19/4 2, IndiQube Alpha, 1st Floor, Outer Ring Road, Panathur Junction, Kadubeesanahalli, Marathahalli, Bangalore-560103 | www.screeningstar.com";
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7);
  doc.text(footerText, centerX, footerYPosition - 3, {
    align: "center",
  });

  const pageCount = doc.internal.getNumberOfPages();
  const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
  const pageNumberText = `Page ${currentPage} / ${pageCount}`;
  const pageNumberWidth = doc.getTextWidth(pageNumberText);
  const pageNumberX = pageWidth - margin - pageNumberWidth;

  // Page number on the right
  doc.text(pageNumberText, pageNumberX, footerYPosition);
}

module.exports = {
  cdfDataPDF: async (
    candidate_application_id,
    branch_id,
    customer_id,
    pdfFileName,
    targetDirectory
  ) => {
    return new Promise((resolve, reject) => {
      Candidate.isApplicationExist(
        candidate_application_id,
        branch_id,
        customer_id,
        async (err, currentCandidateApplication) => {
          if (err) {
            console.error("Database error:", err);
            return reject(
              new Error(
                "An error occurred while checking application existence."
              )
            );
          }

          if (currentCandidateApplication) {
            CEF.getCEFApplicationById(
              candidate_application_id,
              branch_id,
              customer_id,
              async (err, currentCEFApplication) => {
                if (err) {
                  console.error(
                    "Database error during CEF application retrieval:",
                    err
                  );
                  return reject(
                    new Error(
                      "Failed to retrieve CEF Application. Please try again."
                    )
                  );
                }

                if (
                  currentCEFApplication &&
                  Object.keys(currentCEFApplication).length > 0
                ) {
                  const currentCustomer = {
                    name: "INDIVIDUAL",
                  };

                  const doc = new jsPDF({ compress: true });
                  doc.setTextColor(0, 0, 0); // Set global text color to black

                  // Title centered
                  doc.setFont("helvetica", "bold");
                  doc.autoTable({
                    head: [["EMPLOYEE BACKGROUND VERIFICATION FORM"]],
                    startY: 60,
                    theme: "grid",
                    headStyles: {
                      fillColor: [196, 216, 240],
                      textColor: [0, 0, 0],
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    styles: {
                      cellWidth: "auto",
                      halign: "center",
                    },
                  });

                  // Second Table (Left-aligned)
                  doc.autoTable({
                    body: [[`COMPANY NAME: ${currentCustomer.name || ""}`]],
                    startY: doc.autoTable.previous.finalY,
                    theme: "grid",
                    bodyStyles: {
                      fontSize: 10,
                      cellPadding: 5,
                      textColor: [0, 0, 0],
                      fontStyle: "bold", // Make body text bold
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    styles: {
                      cellWidth: "auto",
                      halign: "left",
                    },
                  });

                  doc.autoTable({
                    body: [
                      [
                        "Please note that it is mandatory for you to complete the form in all respects. The information you provide must be complete and correct and the same shall be treated in strict confidence. The details on this form will be used for all official requirements you should join the organization.",
                      ],
                    ],
                    startY: doc.autoTable.previous.finalY,
                    theme: "grid",
                    bodyStyles: {
                      fontSize: 10,
                      cellPadding: 5,
                      textColor: [0, 0, 0],
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    styles: { cellWidth: "auto", halign: "left" },
                  });

                  doc.autoTable({
                    head: [["Position Applied for", "Job Location"]],
                    body: [
                      [
                        currentCEFApplication.job_position_applied_for || "",
                        currentCEFApplication.job_location_applied_for || "",
                      ],
                    ],
                    startY: doc.autoTable.previous.finalY,
                    theme: "grid",
                    headStyles: {
                      fillColor: [196, 216, 240],
                      textColor: [0, 0, 0],
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    bodyStyles: {
                      fontSize: 10,
                      cellPadding: 5,
                      textColor: [0, 0, 0],
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    styles: { cellWidth: "auto", halign: "center" },
                  });

                  // Second Table (Left-aligned)
                  doc.autoTable({
                    head: [["Personal Information"]],
                    startY: doc.autoTable.previous.finalY,
                    theme: "grid",
                    headStyles: {
                      fillColor: [196, 216, 240],
                      textColor: [0, 0, 0],
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    styles: { cellWidth: "auto", halign: "left" },
                  });

                  // Second Table (Left-aligned)
                  doc.autoTable({
                    head: [
                      [
                        "Name of the Candidate(As per Government Identity proof)",
                        "Pancard Number",
                        "Aadhar Number",
                      ],
                    ],
                    body: [
                      [
                        currentCandidateApplication.name || "",
                        currentCEFApplication.pan || "",
                        currentCEFApplication.aadhar || "",
                      ],
                    ],
                    startY: doc.autoTable.previous.finalY,
                    theme: "grid",
                    headStyles: {
                      fillColor: [255, 255, 255],
                      textColor: [0, 0, 0],
                      fontStyle: "bold", // Make header text bold
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    bodyStyles: {
                      textColor: [0, 0, 0],
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    styles: {
                      cellWidth: "auto",
                      halign: "left",
                    },
                  });

                  doc.autoTable({
                    head: [
                      [
                        "Father's Name",
                        "Date of Birth(dd/mm/yy)",
                        "Husband's Name",
                      ],
                    ],
                    body: [
                      [
                        currentCEFApplication.father_name || "",
                        currentCEFApplication.dob || "",
                        currentCEFApplication.husband_name || "",
                      ],
                    ],
                    startY: doc.autoTable.previous.finalY,
                    theme: "grid",
                    headStyles: {
                      fillColor: [255, 255, 255],
                      textColor: [0, 0, 0],
                      fontStyle: "bold", // Make header text bold
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    bodyStyles: {
                      textColor: [0, 0, 0],
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    styles: {
                      cellWidth: "auto",
                      halign: "left",
                    },
                  });

                  doc.autoTable({
                    head: [
                      [
                        "Gender",
                        "Mobile Number",
                        "Nationality",
                        "Marital Status",
                      ],
                    ],
                    body: [
                      [
                        currentCEFApplication.gender || "",
                        currentCEFApplication.mb_no || "",
                        currentCEFApplication.nationality || "",
                        currentCEFApplication.marital_status || "",
                      ],
                    ],
                    startY: doc.autoTable.previous.finalY,
                    theme: "grid",
                    headStyles: {
                      fillColor: [255, 255, 255],
                      textColor: [0, 0, 0],
                      fontStyle: "bold", // Make header text bold
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    bodyStyles: {
                      textColor: [0, 0, 0],
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    styles: {
                      cellWidth: "auto",
                      halign: "left",
                    },
                  });

                  doc.autoTable({
                    head: [
                      [
                        "Current Address",
                        "",
                        "Period of Stay",
                        "Contact details",
                      ],
                    ],
                    body: [
                      [
                        "Full Address",
                        currentCEFApplication.full_address || "",
                        "From",
                        "Residence Landline Number",
                      ],
                      [
                        "Pin code",
                        currentCEFApplication.pin_code || "",
                        currentCEFApplication.curren_address_stay_from || "",
                        currentCEFApplication.curren_address_landline_number ||
                          "",
                      ],
                      [
                        "State",
                        currentCEFApplication.current_address_state || "",
                        "To Date",
                        "Alternate Mobile Number",
                      ],
                      [
                        "Prominent Landmark",
                        currentCEFApplication.current_prominent_landmark || "",
                        currentCEFApplication.current_address_stay_to || "",
                      ],
                      [
                        "Nearest Police Station",
                        currentCEFApplication.nearest_police_station || "",
                      ],
                    ],
                    startY: doc.autoTable.previous.finalY,
                    theme: "grid",
                    headStyles: {
                      fillColor: [196, 216, 240], // Light blue fill for header cells
                      textColor: [0, 0, 0], // Black text color
                      fontStyle: "bold", // Bold text
                      lineWidth: 0.5, // Border width
                      lineColor: [0, 0, 0], // Border color (black)
                    },
                    bodyStyles: {
                      textColor: [0, 0, 0], // Black text color
                      lineWidth: 0.5, // Border width for table rows
                      lineColor: [0, 0, 0], // Border color (black)
                    },
                    styles: {
                      cellWidth: "auto", // Auto width for cells
                      halign: "left", // Left-align text within cells
                    },
                    didDrawCell: function (data) {
                      // Apply custom styling to "From" and "Residence Landline Number" cells
                      if (
                        data.cell.raw === "From" ||
                        data.cell.raw === "Residence Landline Number" ||
                        data.cell.raw === "To Date" ||
                        data.cell.raw === "Alternate Mobile Number"
                      ) {
                        // Set the background fill color
                        doc.setFillColor(196, 216, 240); // Light blue
                        doc.rect(
                          data.cell.x,
                          data.cell.y,
                          data.cell.width,
                          data.cell.height,
                          "F"
                        ); // Fill the cell with color

                        // Set the text color, font style, and alignment
                        doc.setTextColor(0, 0, 0); // Black text color
                        doc.setFont("helvetica", "bold"); // Bold font style
                        doc.text(
                          data.cell.text,
                          data.cell.x + 2,
                          data.cell.y + data.cell.height / 2
                        ); // Re-render text inside the cell

                        // Set the border around the cell (optional: if you want custom borders for these specific cells)
                        doc.setLineWidth(0.5); // Border width
                        doc.setDrawColor(0, 0, 0); // Border color (black)
                        doc.rect(
                          data.cell.x,
                          data.cell.y,
                          data.cell.width,
                          data.cell.height
                        ); // Draw border
                      }
                    },
                  });
                  addFooter(doc);

                  doc.addPage();
                  doc.autoTable({
                    head: [["Declaration & Authorization"]],
                    startY: 60,
                    theme: "grid",
                    headStyles: {
                      fillColor: [196, 216, 240],
                      textColor: [0, 0, 0],
                      lineWidth: 0.5, // Add line width for table borders
                      lineColor: [0, 0, 0], // Set border color
                    },
                    styles: {
                      cellWidth: "auto",
                      halign: "center",
                    },
                  });

                  doc.autoTable({
                    body: [
                      [
                        "I hereby authorize SreeningStar (Tool) and its representative to verify information provided in my application for employment and this employee background verification form, and to conduct enquiries as may be necessary, at the company’s discretion. I authorize all persons who may have information relevant to this enquiry to disclose it to ScreeningStar (Tool) or its representative. I release all persons from liability on account of such disclosure.\n\n\nI confirm that the above information is correct to the best of my knowledge. I agree that in the event of my obtaining employment, my probationary appointment, confirmation as well as continued employment in the services of the company are subject to clearance of medical test and background verification check done by the company . .",
                      ],
                    ],
                    startY: doc.autoTable.previous.finalY,
                    theme: "grid",
                    bodyStyles: {
                      fontSize: 10,
                      cellPadding: 5,
                      textColor: [0, 0, 0],
                      fontStyle: "bold",
                      lineWidth: 0.5,
                      lineColor: [0, 0, 0],
                    },
                    styles: {
                      cellWidth: "auto",
                      halign: "left",
                    },
                  });

                  const imageUrlFull = currentCEFApplication.signature.trim();
                  const imageFormat = getImageFormat(imageUrlFull);
                  let img, width, height, base64Img, imgWidth, imgHeight;
                  if (await checkImageExists(imageUrlFull)) {
                    img = await validateImage(imageUrlFull);
                    if (img) {
                      ({ width, height } = scaleImage(
                        img,
                        doc.internal.pageSize.width - 20,
                        80
                      ));
                      base64Img = await fetchImageAsBase64(img.src);
                      // Calculate scaled dimensions for the image to fit within the cell
                      const maxCellWidth = 30; // Max width for the image in the cell
                      const maxCellHeight = 30; // Max height for the image in the cell

                      const scale = Math.min(
                        maxCellWidth / width,
                        maxCellHeight / height
                      );

                      imgWidth = width * scale;
                      imgHeight = height * scale;
                    }
                  }

                  doc.autoTable({
                    body: [
                      [
                        currentCandidateApplication.name || "",
                        "",
                        currentCEFApplication.created_at || "",
                      ],
                      [
                        "Full name of the candidate",
                        "Signature",
                        "Date of form filled",
                      ],
                    ],
                    startY: doc.autoTable.previous.finalY,
                    theme: "grid",
                    bodyStyles: {
                      fontSize: 10,
                      cellPadding: 5,
                      textColor: [0, 0, 0],
                      fontStyle: "bold",
                      lineWidth: 0.5,
                      lineColor: [0, 0, 0],
                    },
                    styles: {
                      cellWidth: "auto",
                      halign: "left",
                    },
                    didDrawCell: async (data) => {
                      if (
                        data.column.index === 1 &&
                        data.row.index === 0 &&
                        img
                      ) {
                        doc.addImage(
                          base64Img,
                          imageFormat,
                          data.cell.x + (data.cell.width - imgWidth) / 2, // Center horizontally
                          data.cell.y + (data.cell.height - imgHeight) / 2, // Center vertically
                          imgWidth,
                          imgHeight
                        );
                      }
                    },
                  });

                  // Footer with page number
                  addFooter(doc);
                  // Save PDF
                  // doc.save(pdfPath);
                  const pdfPathCloud = await savePdf(
                    doc,
                    pdfFileName,
                    targetDirectory
                  );
                  resolve(pdfPathCloud);
                } else {
                  reject(
                    new Error("Candidate background form does submited yet.")
                  );
                }
              }
            );
          } else {
            reject(new Error("Candidate application does not exist."));
          }
        }
      );
    });
  },
};
