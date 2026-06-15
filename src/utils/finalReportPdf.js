const ClientMasterTrackerModel = require("../models/admin/clientMasterTrackerModel");
const { jsPDF } = require("jspdf");
const AppModel = require("../models/appModel");
const Customer = require("../models/customer/customerModel");
const Service = require("../models/admin/serviceModel");

require("jspdf-autotable");
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
const { generateValuePitchToken, addValuePitchCase, fetchValuePitchStatus, fetchValuePitchReportData, getValuePitchFromDB, saveValuePitchStatus } = require("../utils/external-tools/valuePitch");
const { getSurepassStatusList, getServicesWithPrefill } = require("../utils/external-tools/surePass");

const { createCanvas, loadImage } = require('canvas');

const aadhaarIconPath = path.join(__dirname, "../assets/images/icons/1.png");
const aadhaarIconData = fs.readFileSync(aadhaarIconPath);
const aadhaarIcon = `data:image/png;base64,${aadhaarIconData.toString("base64")}`;

const coloredPath = path.join(__dirname, "../assets/images/icons/colored.png");
const coloredData = fs.readFileSync(coloredPath);
const colored = `data:image/png;base64,${coloredData.toString("base64")}`;

const emailIconGreenPath = path.join(__dirname, "../assets/images/icons/emailIconGreen.png");
const emailIconGreenData = fs.readFileSync(emailIconGreenPath);
const emailIconGreen = `data:image/png;base64,${emailIconGreenData.toString("base64")}`;

const greenShieldPath = path.join(__dirname, "../assets/images/icons/greenShield.png");
const greenShieldData = fs.readFileSync(greenShieldPath);
const greenShield = `data:image/png;base64,${greenShieldData.toString("base64")}`;

const logo3Path = path.join(__dirname, "../assets/images/icons/3.png");
const logo3Data = fs.readFileSync(logo3Path);
const logo3 = `data:image/png;base64,${logo3Data.toString("base64")}`;

const logo4Path = path.join(__dirname, "../assets/images/icons/4.png");
const logo4Data = fs.readFileSync(logo4Path);
const logo4 = `data:image/png;base64,${logo4Data.toString("base64")}`;

const logo5Path = path.join(__dirname, "../assets/images/icons/5.png");
const logo5Data = fs.readFileSync(logo5Path);
const logo5 = `data:image/png;base64,${logo5Data.toString("base64")}`;

const logo6Path = path.join(__dirname, "../assets/images/icons/6.png");
const logo6Data = fs.readFileSync(logo6Path);
const logo6 = `data:image/png;base64,${logo6Data.toString("base64")}`;

const logo8Path = path.join(__dirname, "../assets/images/icons/7.png");
const logo8Data = fs.readFileSync(logo8Path);
const logo8 = `data:image/png;base64,${logo8Data.toString("base64")}`;

const logo9Path = path.join(__dirname, "../assets/images/icons/8.png");
const logo9Data = fs.readFileSync(logo9Path);
const logo9 = `data:image/png;base64,${logo9Data.toString("base64")}`;

const emblemIconPath = path.join(__dirname, "../assets/images/icons/2.png");
const emblemIconData = fs.readFileSync(emblemIconPath);
const emblemIcon = `data:image/png;base64,${emblemIconData.toString("base64")}`;

const orangeShieldPath = path.join(__dirname, "../assets/images/icons/orangeShield.png");
const orangeShieldData = fs.readFileSync(orangeShieldPath);
const orangeShield = `data:image/png;base64,${orangeShieldData.toString("base64")}`;

const yellowShieldPath = path.join(__dirname, "../assets/images/icons/yellowShield.png");
const yellowShieldData = fs.readFileSync(yellowShieldPath);
const yellowShield = `data:image/png;base64,${yellowShieldData.toString("base64")}`;

const screeningLogoNewPath = path.join(__dirname, "../assets/images/screeningLogoNew.png");
const screeningLogoNewData = fs.readFileSync(screeningLogoNewPath);
const screeningLogoNew = `data:image/png;base64,${screeningLogoNewData.toString("base64")}`;

const PDFuserPath = path.join(__dirname, "../assets/images/PDFuser.png");
const PDFuserData = fs.readFileSync(PDFuserPath);
const PDFuser = `data:image/png;base64,${PDFuserData.toString("base64")}`;

const PDFuserGirlPath = path.join(__dirname, "../assets/images/PDFuserGirl.png");
const PDFuserGirlData = fs.readFileSync(PDFuserGirlPath);
const PDFuserGirl = `data:image/png;base64,${PDFuserGirlData.toString("base64")}`;

const isoLogoPath = path.join(__dirname, "../assets/images/iso.png");
const isoLogoData = fs.readFileSync(isoLogoPath);
const isoLogo = `data:image/png;base64,${isoLogoData.toString("base64")}`;

const isoLogo2Path = path.join(__dirname, "../assets/images/iso2.png");
const isoLogo2Data = fs.readFileSync(isoLogo2Path);
const isoLogo2 = `data:image/png;base64,${isoLogo2Data.toString("base64")}`;

const noImagePath = path.join(__dirname, "../assets/images/no-image.png");
const noImageData = fs.readFileSync(noImagePath);
const noImageTarget = `data:image/png;base64,${noImageData.toString("base64")}`;

const greenTargetPath = path.join(__dirname, "../assets/images/green-target.png");
const greenTargetData = fs.readFileSync(greenTargetPath);
const greenTarget = `data:image/png;base64,${greenTargetData.toString("base64")}`;

const redTargetPath = path.join(__dirname, "../assets/images/red-target.png");
const redTargetData = fs.readFileSync(redTargetPath);
const redTarget = `data:image/png;base64,${redTargetData.toString("base64")}`;

const yellowTargetPath = path.join(__dirname, "../assets/images/yellow-target.png");
const yellowTargetData = fs.readFileSync(yellowTargetPath);
const yellowTarget = `data:image/png;base64,${yellowTargetData.toString("base64")}`;

const orangeTargetPath = path.join(__dirname, "../assets/images/orange-target.png");
const orangeTargetData = fs.readFileSync(orangeTargetPath);
const orangeTarget = `data:image/png;base64,${orangeTargetData.toString("base64")}`;

const riskFreePath = path.join(__dirname, "../assets/images/risk-free.png");
const riskFreeData = fs.readFileSync(riskFreePath);
const riskFreeTarget = `data:image/png;base64,${riskFreeData.toString("base64")}`;

const getImageFormat = (url) => {
    const ext = url.split(".").pop().toLowerCase();
    if (ext === "png") return "PNG";
    if (ext === "jpg" || ext === "jpeg") return "JPEG";
    if (ext === "webp") return "WEBP";
    return "PNG"; // Default to PNG if not recognized
};

async function validateImage(url) {
    try {
        // Use axios to fetch the image as a binary buffer
        const response = await axios.get(url, { responseType: "arraybuffer" });
        // Check if the image was fetched successfully
        if (response.status !== 200) {
            console.warn(
                `Image fetch failed for URL: ${url} with status: ${response.status}`
            );
            return null;
        }

        // Check if the response data is valid
        if (!response.data) {
            console.warn(`No data found in the response for URL: ${url}`);
            return null;
        }

        // Convert the response data to a Buffer
        const buffer = Buffer.from(response.data);

        // Use sharp to extract image metadata
        const metadata = await sharp(buffer).metadata();

        // If the metadata is invalid or not retrieved, return null
        if (!metadata) {
            console.warn(`Unable to fetch metadata for image from URL: ${url}`);
            return null;
        }
        // Return the image URL, width, and height in an array
        return { src: url, width: metadata.width, height: metadata.height };
    } catch (error) {
        console.error(`Error validating image from ${url}:`, error);
        return null;
    }
}

async function fetchImageAsBase64(imageUrls) {
    const convertToBase64 = async (url) => {
        const name = path.basename(url.trim());

        try {
            const response = await axios.get(url.trim(), { responseType: "arraybuffer" });
            const buffer = Buffer.from(response.data, "binary");

            const contentType = response.headers["content-type"] || "image/png";
            const ext = contentType.split("/")[1].toLowerCase();

            const validateImageResult = await validateImage(url.trim());
            return {
                name,
                url,
                base64: `data:${contentType};base64,${buffer.toString("base64")}`,
                type: ext,
                width: validateImageResult.width,
                height: validateImageResult.height
            };
        } catch (error) {
            return {
                name,
                url,
                base64: null,
                type: null,
                width: null,
                height: null,
                error: error.message
            };
        }
    };

    let urlArray = Array.isArray(imageUrls)
        ? imageUrls
        : typeof imageUrls === "string"
            ? imageUrls.split(",").map((url) => url.trim()).filter(Boolean)
            : (() => { throw new Error("Invalid input: must be a string or array of strings."); })();

    return await Promise.all(urlArray.map(convertToBase64));
}

const addFooter = (doc) => {
    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();


        const leftText = 'ISO QTY MGT - 9001:2015';
        const centerText = `PAGE ${i} OF ${totalPages}`;
        const rightText = '(ISO) IMSS - 27001:2013';

        const fontSize = 10;
        const yPos = pageHeight - 10;
        const footerHeight = 12;
        const footerTopY = pageHeight - footerHeight;

        // Set fill color for footer background
        if (i === 1 || i === totalPages) {
            doc.setFillColor(255);
        } else {
            doc.setFillColor(255, 255, 255); // White
        }

        // Draw footer background
        doc.rect(0, footerTopY, pageWidth, footerHeight, 'F');

        // Draw top border of footer

        doc.setDrawColor(46, 93, 172);

        // #3d75a6
        doc.setLineWidth(0.4);
        doc.line(0, footerTopY - 10, pageWidth, footerTopY - 10); // Top edge of the footer

        // Set text styles
        doc.setFontSize(fontSize);
        doc.setTextColor(0, 0, 0);
        doc.setFont('TimesNewRoman', 'normal');

        // Draw footer text
        doc.text(leftText, 10, yPos);

        const centerTextWidth = doc.getTextWidth(centerText);
        doc.text(centerText, (pageWidth - centerTextWidth) / 2, yPos);

        const rightTextWidth = doc.getTextWidth(rightText);
        doc.text(rightText, pageWidth - rightTextWidth - 10, yPos);
    }
};

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

async function addImageToPDF(
    doc,
    imageUrl,
    imageFormat,
    centerXImage,
    yPosition
) {
    const img = await validateImage(imageUrl);

    if (img) {
        try {
            // Check if the image format is correct (PNG, JPEG, etc.)
            if (img.src && imageFormat) {
                doc.addImage(
                    img.src,
                    imageFormat,
                    centerXImage,
                    yPosition,
                    img.width,
                    img.height
                );
            }
        } catch (error) {
            console.error(`Failed to add image to PDF: ${imageUrl}`, error);
        }
    } else {
        console.warn(`Image validation failed for ${imageUrl}`);
    }
}

// Function to format the date to "DD-MM-YYYY" format
const formatDate = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') {
        return 'NOT APPLICABLE';
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return dateStr; // Return the original if it's not a valid date
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
};


function formatStatus(status) {
    // Step 1: Replace all special characters with a space
    let formatted = status.replace(/[^a-zA-Z0-9 ]/g, " ");

    // Step 2: Trim extra spaces from start and end, and then split into words
    formatted = formatted.trim().replace(/\s+/g, " ");

    // Step 3: Capitalize based on length
    if (formatted.length < 6) {
        // Capitalize the whole string
        return formatted.toUpperCase();
    } else {
        // Capitalize only the first letter of each word
        return formatted.replace(/\b\w/g, function (char) {
            return char.toUpperCase();
        });
    }
}

module.exports = {
    generatePDF: async (
        client_applicaton_id,
        branch_id,
        pdfFileName,
        targetDirectory
    ) => {
        return new Promise((resolve, reject) => {
            // Fetch application data
            ClientMasterTrackerModel.applicationByID(
                client_applicaton_id,
                branch_id,
                async (err, applicationInfo) => {
                    if (err) {
                        console.error("Database error:", err);
                        return reject(new Error(`Database error: ${err.message}`));
                    }

                    if (!applicationInfo) {
                        return reject(new Error("Application not found"));
                    }

                    console.log(`applicationInfo - `, applicationInfo);

                    const generate_report_type = applicationInfo.generate_report_type;
                    if (!generate_report_type) {
                        return reject(new Error("Please select a report type before generating the report."));
                    }

                    const companyName = applicationInfo.customer_name;
                    console.log(`applicationInfo - `, applicationInfo);

                    Customer.infoByID(
                        parseInt(applicationInfo.customer_id),
                        (err, currentCustomer) => {
                            if (err) {
                                console.error("Database error during customer retrieval:", err);
                                return reject(new Error("Failed to retrieve Customer. Please try again."));
                            }

                            if (!currentCustomer) {
                                return reject(new Error("Customer not found."));
                            }

                            const modifiedNames = currentCustomer.emails;

                            const emailArray = JSON.parse(modifiedNames);

                            const customerEmails = emailArray.map(email => {
                                // console.log('firstName', email);
                                return email;
                            });

                            // Fetch CMT Application Data
                            ClientMasterTrackerModel.getCMTApplicationById(
                                client_applicaton_id,
                                async (err, CMTApplicationData) => {
                                    if (err) {
                                        console.error("Database error:", err);
                                        return reject(new Error(`Database error: ${err.message}`));
                                    }

                                    // Split service_id into an array
                                    const serviceIds = applicationInfo.services
                                        .split(",")
                                        .map((id) => id.trim());
                                    const annexureResults = [];
                                    let pendingRequests = serviceIds.length;

                                    if (pendingRequests === 0) {
                                        reject(new Error("No service IDs to process."));
                                    }
                                    const getSurepassStatus = (service) => {
                                        let services = service?.screeningstar_response;

                                        console.log("🚀 services:", services);

                                        if (!services) {
                                            return { label: "PENDING", color: "black" };
                                        }

                                        // normalize to array
                                        if (!Array.isArray(services)) {
                                            services = [services];
                                        }

                                        let hasValidationError = false;
                                        let hasInvalid = false;
                                        let hasError = false;
                                        let hasSuccess = false;
                                        let hasPrefilled = false;

                                        services.forEach((item) => {
                                            // ✅ Track prefilled
                                            if (item.is_prefilled) {
                                                hasPrefilled = true;
                                            } else {
                                                return; // skip but don't break whole logic
                                            }

                                            const res = item.response_json;
                                            if (!res) return;

                                            // ✅ SUCCESS
                                            if (res.success === true && res.status_code === 200) {
                                                hasSuccess = true;
                                            }

                                            // ❌ VALIDATION ERROR
                                            if (
                                                res.message === "Input payload validation failed" ||
                                                res.errors
                                            ) {
                                                hasValidationError = true;
                                            }

                                            // ❌ INVALID
                                            if (res.message?.toLowerCase().includes("invalid")) {
                                                hasInvalid = true;
                                            }

                                            // ❌ GENERAL ERROR
                                            if (
                                                res.message?.toLowerCase().includes("verification failed") ||
                                                res.status_code >= 500 ||
                                                (res.success === false && res.status_code === 422 && !res.message)
                                            ) {
                                                hasError = true;
                                            }
                                        });

                                        // 🎯 PRIORITY LOGIC (IMPORTANT)

                                        // ❌ If no prefilled → managed by API
                                        if (!hasPrefilled) {
                                            return { label: "MANAGED BY SUREPASS API", color: "gray" };
                                        }

                                        // ❌ Fail cases (highest priority)
                                        if (hasInvalid || hasError || hasValidationError) {
                                            return { label: "FAILED", color: "red" };
                                        }

                                        // ✅ Success
                                        if (hasSuccess) {
                                            return { label: "VERIFIED", color: "green" };
                                        }

                                        // 🟡 Default fallback
                                        return { label: "MANAGED BY SUREPASS API", color: "black" };
                                    };
                                    for (const serviceId of serviceIds) {

                                        const currentService = await new Promise((resolve) => {
                                            Service.getServiceById(serviceId, (err, data) => {
                                                resolve(data || null);
                                            });
                                        });

                                        const serviceTypeRaw = currentService?.service_type?.trim().toLowerCase() || "";
                                        const types = serviceTypeRaw.split(",").map(t => t.trim());

                                        const hasValuePitch = types.includes("valuepitch");
                                        const hasSurepass = types.includes("surepass");
                                        const hasManual = types.includes("manual");

                                        console.log("📊 Service Type:", serviceTypeRaw);

                                        // ================== FETCH FORM DATA ==================
                                        const result = await new Promise((resolve) => {
                                            ClientMasterTrackerModel.reportFormJsonWithannexureData(
                                                client_applicaton_id,
                                                serviceId,
                                                (err, data) => {
                                                    if (err) return resolve({ err });
                                                    resolve({ data });
                                                }
                                            );
                                        });

                                        let screeningStarData = null;
                                        let valuePitchStatusData = null;
                                        let valuePitchReportData = null;

                                        // ================== VALUEPITCH ==================
                                        if (hasValuePitch) {
                                            console.log("🔥 VALUEPITCH FLOW");

                                            screeningStarData = await getValuePitchFromDB(serviceId, client_applicaton_id);

                                            if (
                                                screeningStarData &&
                                                screeningStarData.status !== false &&
                                                screeningStarData.verifyId
                                            ) {
                                                console.log("⚡ Calling ValuePitch APIs");

                                                const [statusRes, reportRes] = await Promise.all([
                                                    fetchValuePitchStatus({
                                                        verifyId: screeningStarData.verifyId,
                                                        service_id: serviceId,
                                                        application_id: client_applicaton_id
                                                    }),
                                                    fetchValuePitchReportData({
                                                        verifyId: screeningStarData.verifyId,
                                                        service_id: serviceId,
                                                        application_id: client_applicaton_id
                                                    })
                                                ]);

                                                valuePitchStatusData = statusRes?.data || null;
                                                valuePitchReportData = reportRes?.data || null;

                                                screeningStarData = await getValuePitchFromDB(serviceId, client_applicaton_id);
                                            } else {
                                                console.log("⛔ Skipping ValuePitch API call");
                                            }
                                        }

                                        // ================== SUREPASS ==================
                                        else if (hasSurepass) {
                                            console.log("🔥 SUREPASS FLOW");

                                            try {
                                                const surepassResult = await getServicesWithPrefill({
                                                    service_ids: [serviceId],   // 👈 single service ke liye call
                                                    application_id: client_applicaton_id
                                                });

                                                if (surepassResult?.status && surepassResult.data?.length) {
                                                    const sp = surepassResult.data[0];

                                                    screeningStarData = {
                                                        service_id: sp.service_id,
                                                        status: sp.status,
                                                        is_prefilled: sp.is_prefilled,
                                                        request_json: sp.request_json,
                                                        response_json: sp.response_json
                                                    };
                                                } else {
                                                    screeningStarData = {
                                                        service_id: serviceId,
                                                        status: "data_not_found"
                                                    };
                                                }

                                            } catch (err) {
                                                console.error("❌ Surepass Error:", err);

                                                screeningStarData = {
                                                    service_id: serviceId,
                                                    status: "error",
                                                    message: err.message
                                                };
                                            }
                                        }

                                        // ================== MANUAL ==================
                                        else if (hasManual) {
                                            console.log("🔥 MANUAL FLOW");
                                            screeningStarData = null;
                                        }

                                        // ================== FINAL RESPONSE ==================
                                        if (result.err) {
                                            annexureResults.push({
                                                service_id: serviceId,
                                                service_type: serviceTypeRaw,
                                                screeningstar_response: screeningStarData,
                                                verifyId: screeningStarData?.verifyId || null,
                                                serviceStatus: false,
                                                valuePitchStatus: valuePitchStatusData,
                                                valuePitchReport: valuePitchReportData,
                                                message: result.err.message
                                            });
                                        } else {
                                            const { reportFormJson, annexureData } = result.data;

                                            annexureResults.push({
                                                service_id: serviceId,
                                                service_type: serviceTypeRaw,
                                                screeningstar_response: screeningStarData,
                                                verifyId: screeningStarData?.verifyId || null,
                                                serviceStatus: true,
                                                annexureStatus: true,
                                                valuePitchStatus: valuePitchStatusData,
                                                valuePitchReport: valuePitchReportData,
                                                reportFormJson,
                                                annexureData
                                            });
                                        }

                                        if (--pendingRequests === 0) finalizeRequest();

                                        async function finalizeRequest() {
                                            if (pendingRequests === 0) {
                                                const servicesData = annexureResults;
                                                console.log('servicesData --- ', servicesData)
                                                AppModel.appInfo("frontend", async (err, appInfo) => {
                                                    if (err) {
                                                        console.error("Database error:", err);
                                                        return res.status(500).json({
                                                            status: false,
                                                            message:
                                                                "An error occurred while retrieving application information. Please try again.",
                                                        });
                                                    }

                                                    if (!appInfo) {
                                                        console.error(
                                                            "Database error during app info retrieval:",
                                                            err
                                                        );
                                                        return reject(
                                                            new Error("Information of the application not found.")
                                                        );
                                                    }

                                                    const appHost = appInfo.host || "www.example.com";
                                                    const appName = appInfo.name || "Example Company";
                                                    try {
                                                        const doc = new jsPDF({ compress: true });
                                                        const pageWidth = doc.internal.pageSize.getWidth();
                                                        const pageHeight = doc.internal.pageSize.getHeight();
                                                        // RGB for #F3FBFD
                                                        doc.setFillColor(255, 255, 255);

                                                        // Draw full-page background rect (before content)
                                                        doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
                                                        const timesNewRomanBase64 = "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ICYgMCA5ISIiGf//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAB4A2gGYAZgBmAGYAZoBngGiAaYBpgGmAagBqAAAAAMABAAFAAYABwAIAAkACgALAAwADQAOAA8AEAARABIAEwAUABUAFgAXABgAGQAaABsAHAAdAB4AHwAgACEAIgAjACQAJQAmACcAKAApACoAKwAsAC0ALgAvADAAMQAyADMANAA1ADYANwA4ADkAOgA7ADwAPQA+AD8AQABBAEIAQwBEAEUARgBHAEgASQBKAEsATABNAE4ATwBQAFEAUgBTAFQAVQBWAFcAWABZAFoAWwBcAF0AXgBfAGAAYQB1AHYAdwB4AHkAegB7AHwAfQB+AH8AgACBAIIAgwCEAIUAhgCHAIgAiQCKAIsAjACNAI4AjwCQAJEAkgCTAJQAlQCWAJcAmACZAJoAmwCcAJ0AngCfAKAAoQCiAKMApAClAKYApwCoAKkAqgCrAKwArQCuAK8AsACxALIAswC0ALUAtgC3ALgAuQC6ALsAvAC9AL4AvwDAAMEAwgDDAMQAxQDGAMcAyADJAMoAywDMAM0AzgDPANAA0QDSANMA1ABjAGgAcgBwAHEAawBsAGIAbQBuAGQAZgBnAG8AZQBpAGoAdABzAIwLYAMBADAAAAAAAP4AAAD+AAAAwQAmAUkAGgH3AAAB7wAoA1AAHgMuACMAqAAgAUkAHwF0AC4B8gBGAlgAKgEOAEEBIgAUAQ4AQQETAAAB/gAbAf4AcwH+ACEB/gAyAf4AEAH+AEEB/gAlAf4AHwH+ADwB/gAhAQ4AQQEOAEECWAAlAlgAKgJYACUBzwAtA8gAPQLuAAYCoAAUAq0AIALhABQCcQAUAigAFAL2ACAC7wAUAVYAFwGNAAQC8AAUAnQAFAOeABQC4wAAAuoAIAJAABQC4gAgArMAFAIwADoCTgAKAvAAEQLUAAADsgAAAuYAAAK2//ACbgAKATAAKQET//8BLQANAfAADAImAAAAyQALAb0AIAH6//wBwgAgAf4AIAHOACABJAASAfQAFAIIAAYBFgAZARb/wQH+AAoBFQAUAyUACgIGAAoB+gAgAgQABwIAACABWAAIAZIAMgEiAAgCBgAIAe4AAALxAAAB9wAIAgIAAAHPABQBTgATAQMAZQFOABMCXwAmAQ4AQQIcAAkB8ABBAnAAQQHmABoBsAAUAUgAEQSbAB4BSgAyASoAQQEqAEECBABBAgQAQQFeACoCHAAUA+gAFAFkAAsECgAYAUoAMgH0AAAAwQAmAfQAOwISABQCEgAKAl8AAACyAEEB9AA8AnwAFAL4ABcBQAAMAhAAMgJdABQBIgAUAvkAFQFhAAoBkAAlAlgAKgFkAB4BKwAeAMkACgINABMCGwAeAPIAQQHPACABLABBAVwAFAIQADIDNgA8AykAPAM3ABwBrwAgAu4ABgJnABQCoAAUAjIAFALEAAACcQAUA8YACAIsABQC+AAUAvgAFAKKABQCvAAAA54AFALvABQC6gAgAvcAFAJAABQCrQAgAk4ACgK2AAgDBwAUAuYAAAMDABQCyAAAA+AAFAPnABQCtgAUA1kAFAJKABQCtgAUBAsAFAKP//wBvQAgAfwAIgHOAAoBmAAKAd8AAAHOACACvQAIAZQAFAIMAAoCDAAKAdwACgIQAAACgQAKAg4ACgH6ACACDgAKAgQABwHCACAByQAIAgIAAAJxABgB9wAIAhgACgHnAAAC8wAKAv0ACgH1AAoCfwAKAb0ACgHCABQCvgAKAdQAAAK4AqgBzwETAGMAAAJIA3ICiAJuAagC6AJdAYL/nAAA//P/LP8+/1gBqP/n/48BjwB1ANcBSgDtAgoArv/CAjQBEgBkAIUBAf8ZAlABgwEj/24AaAASAGAALACXAFgAJACtAagA7AFGAGAAcAEtALMA9wE6AM0B4QFjAL8B1ACBAKYAxACYAHAAMgAgAFIAXwBCALkAjAAKACwAAAAAAZoBkAAFAAECvAKKAAAAjwK8AooAAAHFADIBAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBbHRzAEAAICIZAwEA5wAAA3IA5wAAAAAAEAAAANgJCwcAAgICAwUECAcCAwMEBQIDAgIFBQUFBQUFBQUFAgIFBQUECQcGBgcGBQcHAwQHBggHBwUHBgUFBwcJBwYGAwIDBAUCBAUEBQQDBQUDAwUCBwUFBQUDBAMFBAcFBQQDAgMFAgUEBgQEAwsDAwMFBQMFCQMJAwUCBQUFBQIFBgcDBQUDBwMEBQMDAgUFAgQDAwUHBwcEBwYGBQYGCQUHBwYGCAcHBwUGBQYHBwcGCQkGCAUGCQYEBQQEBAQGBAUFBAUGBQUFBQQEBQYFBQQHBwUGBAQGBAAKDAgAAwMCAwUFCAgCAwQFBgMDAwMFBQUFBQUFBQUFAwMGBgYFCggHBwcGBggIAwQIBgkHBwYHBwYGCAcJBwcGAwMDBQYCBAUFBQUDBQUDAwUDCAUFBQUDBAMFBQgFBQUDAwMGAwUFBgUEAwwDAwMFBQQFCgQKAwUCBQUFBgIFBggDBQYDCAQEBgQDAgUFAgUDAwUICAgECAYHBgcGCgYICAcHCQgHCAYHBgcIBwgHCgoHCQYHCgcEBQUEBQUHBAUFBQUGBQUFBQUFBQYFBQUICAUGBAUHBQALDQgAAwMCBAYFCQkCBAQFBwMDAwMGBgYGBgYGBgYGAwMHBwcFCwgHCAgHBggIBAQIBwoICAYICAYGCAgKCAgHAwMDBQYCBQYFBgUDBgYDAwYDCQYGBgYEBAMGBQgGBgUEAwQHAwYFBwUFBA0EAwMGBgQGCwQLBAYCBgYGBwIGBwgEBgcDCAQEBwQDAgYGAwUDBAYJCQkFCAcHBggHCwYICAcICggICAYIBggJCAgICwsICQYICwcFBgUEBQUIBAYGBQYHBgYGBgUFBgcGBgUICAYHBQUIBQAMDgkAAwMCBAYGCgoCBAQGBwMDAwMGBgYGBgYGBgYGAwMHBwcGDAkICAkIBwkJBAUJCAsJCQcJCAcHCQkLCQgHBAMEBgcCBQYFBgYEBgYDAwYDCgYGBgYEBQMGBgkGBgYEAwQHAwYGBwYFBA4EBAQGBgQGDAQMBAYCBgYGBwIGCAkEBgcDCQQFBwQEAgYGAwYEBAYKCgoFCQcIBwgIDAcJCQgICwkJCQcIBwgJCQkJDAwICgcIDAgFBgYFBgYIBQYGBgYIBgYGBgUFBggGBgYJCQYIBQUIBgANDwoAAwMDBAcGCwsCBAUGCAQEBAQHBwcHBwcHBwcHBAQICAgGDQoJCQoIBwoKBAUKCAwKCgcKCQcICgkMCgkIBAQEBgcDBgcGBwYEBwcEBAcECgcHBwcEBQQHBgoHBwYEAwQIBAcGCAYGBA8EBAQHBwUHDQUNBAcDBwcHCAIHCAoEBwgECgUFCAUEAwcHAwYEBQcLCwsGCggJBwkIDQcKCggJDAoKCgcJCAkKCgoJDQ0JCwgJDQkGBwYFBgYJBQcHBgcIBwcHBwYGBwgHBwYKCgcIBgYJBgAOEQsABAQDBQcHDAsCBQUHCAQEBAQHBwcHBwcHBwcHBAQICAgGDgsJCgoJCAsLBQYLCQ0KCggKCggICwoNCgoJBAQEBwgDBgcGBwYEBwcEBAcECwcHBwcFBgQHBwsHBwYFBAUIBAgHCQcGBREFBAQHBwUIDgUOBQcDBwcHCAIHCQsEBwgECwUGCAUEAwcIAwYEBQcMCwwGCwkJCAoJDggLCwkKDQsKCwgKCAoLCgsKDg4KDAgKDgkGBwYGBwYKBgcHBwcJBwcHBwYGBwkHCAcLCwcJBgYKBwAPEgwABAQDBQgHDQwDBQYHCQQEBAQICAgICAgICAgIBAQJCQkHDwsKCgsJCAsLBQYLCQ4LCwkLCggJCwsOCwoJBQQFBwgDBwgHCAcECAgEBAgEDAgICAgFBgQIBwsICAcFBAUJBAgHCQcGBRIFBAQICAUIDwUQBQgDCAgICQMICgsFCAkECwUGCQUEAwgIBAcFBQgMDAwGCwkKCAsJDggLCwoLDgsLCwkKCQoMCwwLDw8KDQkKEAoHCAcGBwcLBggIBwgKCAgICAcHCAkICAcLCwgKBwcLBwAQEwwABAQDBQgIDg0DBQYICgQFBAQICAgICAgICAgIBAQKCgoHDwwLCwwKCQwMBQYMCg8MDAkMCwkJDAwPDAsKBQQFCAkDBwgHCAcFCAgEBAgEDQgICAgGBgUICAwICAcFBAUKBAkICggHBRMFBQUICAYJEAYRBQgDCAgICgMICgwFCAoFDAYGCgYFAwgJBAcFBggNDQ0HDAoLCQsKDwkMDAoLDwwMDAkLCQsMDAwLEBALDgkLEQoHCAcHCAcLBggICAgKCAgICAcHCAoICQgMDAgKBwcLBwARFA0ABAQDBgkIDg4DBgYICgUFBQUJCQkJCQkJCQkJBQUKCgoIEA0LDA0LCQ0NBgcNCxANDQoNDAoKDQwQDQwLBQUFCAkDCAkICQgFCQkFBQkFDgkJCQkGBwUJCA0JCQgGBAYKBQkICwgHBhQGBQUJCQYJEQYSBgkDCQkJCgMJCw0FCQoFDQYHCgYFAwkJBAgFBgkODg4HDQoLCgwLEAkNDQsMEA0NDQoMCgwNDQ0MEREMDwoMEgsICQgHCAgMBwkJCAkLCQkJCQgICQsJCQgNDQkLCAgMCAASFQ4ABQUDBgkJDw8DBgcJCwUFBQUJCQkJCQkJCQkJBQULCwsIEQ4MDA0LCg4OBgcOCxENDQoNDAoLDg0RDQwLBQUFCQoECAkICQgFCQkFBQkFDgkJCQkGBwUJCQ4JCQgGBQYLBQoJCwkIBhUGBQUJCQYKEgYTBgkDCQoKCwMJCw4GCgsFDgYHCwYFBAkKBAgFBgoPDw8IDgsMCg0LEQoODgwNEQ4NDgoMCwwODQ4NEhIMDwsMEwwICQgHCQgNBwkJCQoMCQkJCQgICQsJCgkODgkMCAgNCAATFg8ABQUEBgoJEA8DBgcJCwUGBQUKCgoKCgoKCgoKBQULCwsJEg4NDQ4MCg4OBggODBIODgsODQsLDg4SDg0MBgUGCQoECAoJCgkGCgoFBQoFDwoKCgoHCAYKCQ4KCgkGBQYMBQoJDAkIBhYGBgYKCgcKEwcUBgoECgoKDAMKDA4GCgsGDgcICwcGBAoKBQkGBwoQDxAIDgwNCw0MEgsODgwNEg4ODgsNCw0PDg8OExMNEAsNFAwICgkICQkNCAoKCQoMCgoKCgkJCgwKCgkODwoMCAkNCQAUGA8ABQUEBwoKERADBwcKDAUGBQYKCgoKCgoKCgoKBQUMDAwJEw8NDg8NCw8PBwgPDRMPDwwPDgsMDw4TDw4MBgYGCgsECQoJCgkGCgoGBgoGEAoKCgoHCAYKCg8KCgkHBQcMBQsKDAoJBxgHBgYKCgcLFAcVBwoECgsLDAQKDQ8GCwwGDwcIDAcGBAsLBQkGBwsQEBAJDwwNCw4NEwsPDw0OEw8PDwwODA4QDw8OFBQOEQwOFQ0JCgkICgkOCAoKCgsNCwoLCgkJCg0KCwoPDwoNCQkOCQAVGRAABQUEBwsKEhEEBwgKDQYGBgYLCwsLCwsLCwsLBgYNDQ0KFBAODg8NDBAQBwgQDRMQEAwPDwwMEA8UEA8NBgYGCgwECQsJCwoGCwsGBgsGEQsLCwsHCAYLChALCwoHBQcNBgsKDQoJBxkHBgYLCwcLFQcWBwsECwsLDQQLDRAHCw0GEAcIDQcGBAsLBQoGBwsREREJEA0ODA8NFAwQEA4PExAQEAwODA8QEBAPFRUPEgwPFg4JCwoJCgoPCAsLCgsNCwsLCwkKCw0LCwoQEAsNCQkPCgAWGhEABgYEBwsLExIEBwgLDQYGBgYLCwsLCwsLCwsLBgYNDQ0KFREPDxAODBERCAkRDhQQEA0QDwwNERAVEA8OBwYHCwwECgsKCwoGCwsGBgsGEgsLCwsICQYLCxELCwoHBgcN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//EAKQBE/+QAOABE//EAXABE/+oAJABG/+QAWQBG//EAXABG/+oAWgBG/+oANwBG/9YAMwBH//EAOgBH/+IAWgBH/+oAKQBH/9sAOABH//IANwBH/+IAWQBH//EAXABH/+oAJABH/+QAPABH/70AWgBI//EAWwBI/+oAOQBI/7sANQBI/+oALQBI//EAPABI/54ANwBI/9YAXABI/+oAJABI/+QAWQBI/+oAOgBI/9YAOABI//EAKQBI/+QAMwBI/+QALgBI/+QAEABJ//IAKQBK/9MAOgBK/70ANwBK/8wAOABK/+oAWQBK/+IAWgBK/+IAJABK//EAPABM/9YAOQBM/9YAKQBM/+oAOgBM/+QAOgBQ//gAOABS//EAPABS/58AJABS/9YALQBS//EAOgBS/9YAWQBS/+oAMQBS/+oAXABS/+oALgBS/+QAOQBS/60ANQBS/+oANwBS/9YAMwBS/+QAKQBS/+QAWgBS//EAKQBU/+oAPABU/64AOQBU/8QAJABU/+QANwBV/+IAOQBV/9YAOgBV//IAOABW/+IANwBW/9YAMwBW/+QASQBXAB4AJABX/+IANQBX/+oALwBY/+IANwBY/+oAJQBY//EALgBY/+IAMQBY/+IANQBY/+oAOQBY/+QAJABY/+QAOgBY/+QALQBY//EAPABY/7sAKABZ/9sAMQBZ/9sAUgBZ/+oAKgBZ/9sANQBZ/9MAXABZ/9sAKwBZ/+oAPABZ/70AWABZ//EANwBZ/8wALwBZ/6YARgBZ//EAKQBZ/9sAJABZ/58AKABa/+IAKwBa/+oAJABa/58AUgBa//EANQBa/+IARABa//EAKQBa/+IARgBa/+oASABa//EALwBa/8wANwBa/9YANwBb/9sAJQBc//EAJABc/5EAKABc/+IAKQBc/+UALgBc/7sAOQBc/7sAKwBc/+oALwBc/8gASABc/+oAOgBc/+QANwBc/8gAqACV/1sAqQCV/8IAowCV/70AsgCV/8IAswCV/7UApQCV/4MApgCV/5oAmACV/5wApwCV/5wAmACZ/9sApQCZ/84AsgCZ/9sApwCZ/9sAswCZ/8IAowCZ/88AqACZ/84ApgCZ/84AqQCZ/84AowCb/+cAEACb/84ApgCb/+cAnACb/+cAqACc/+cAsgCg/84AowCg/84ApQCg/8IAswCg/9sAqQCg/84AmACg/84ApwCg/9sAqACg/84AqACj/84ApwCj//MAmQCj//QAnwCj/+cAlQCj/70AqgCj/84AqwCj/9sArgCj//MAmwCj/+cAmACm//QAqwCm/9sApwCm//QArgCm//QAmwCm/+cAnwCm/+cAqACm/8IAEACn/84ApwCnAAwAlQCn/5wAowCn//MAsgCn/+cAqQCn/84AqQCo/84AlQCo/8cAEACo/88AowCo/9sApgCo/+cApQCo/+cAlQCp/8MAqACp/84AmQCp/+cAnwCp/9sAmACp/9sApwCp/84AswCq/88AEACq/84AowCq/84AqQCq/84AqACq/84AsgCs/+cAowCs/9sAlQCs/2sArwC0/+cAsQC0/+cApQC0/+cAmAC0/9sAowC0/+cApwC1/9sAmAC1/84AqAC1/6kAqAC2/84AlQC2/9sAqAC4/84AmAC5/8IAugC5/+cAvAC5/+cApwC5/8IAqAC5/8IAxwC5/+cAyAC5/+cAuwC6//QAlQC6/9sAvwC6//MAqAC6/6kApwC6/84AuAC6//MAxwC6//MAmAC6/8IAxgC7/+cAugC7/+cAwwC7/+cAqAC8/8IAqAC//84AmADA/6kAugDA/9sApwDA/8IAxwDA/9sAqADA/50AyADA/84AqADB/84AqADC/84ApwDC//MAmADD/8IApwDD/84AvwDD//QAlQDD/9sAxwDD//QAuADD//MAuwDD/+cAyADD/9sAmADF/8IAqADF/8IApwDF/+cAvwDG//QAxwDG//QAqADG/8IAmADG/7UApwDG/84AyADG/9sAlQDH/8IAtQDI/+cAwwDI//QAxQDI/+cAtwDI//QAxgDI//QAmADI/7UAlQDI/7UApwDI/7UAlQDJ/9sAqADJ/7UAqADK/6kAlQDM/6kApwDU/84AEAUFBwQAAAADAAAAAAAAABwAAQAAAAACTAADAAEAAANSAAQCMAAAAB4AEAADAA4AfgD/AZICxgLcIBQgGiAeICIgJiAwIDohIiIZ//8AAAAgAKABkgLGAtwgEyAYIBwgICAmIDAgOSEiIhn//wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAeANoBmAGYAZgBmAGaAZ4BogGmAaYBpgGoAagAAAADAAQABQAGAAcACAAJAAoACwAMAA0ADgAPABAAEQASABMAFAAVABYAFwAYABkAGgAbABwAHQAeAB8AIAAhACIAIwAkACUAJgAnACgAKQAqACsALAAtAC4ALwAwADEAMgAzADQANQA2ADcAOAA5ADoAOwA8AD0APgA/AEAAQQBCAEMARABFAEYARwBIAEkASgBLAEwATQBOAE8AUABRAFIAUwBUAFUAVgBXAFgAWQBaAFsAXABdAF4AXwBgAGEAdQB2AHcAeAB5AHoAewB8AH0AfgB/AIAAgQCCAIMAhACFAIYAhwCIAIkAigCLAIwAjQCOAI8AkACRAJIAkwCUAJUAlgCXAJgAmQCaAJsAnACdAJ4AnwCgAKEAogCjAKQApQCmAKcAqACpAKoAqwCsAK0ArgCvALAAsQCyALMAtAC1ALYAtwC4ALkAugC7ALwAvQC+AL8AwADBAMIAwwDEAMUAxgDHAMgAyQDKAMsAzADNAM4AzwDQANEA0gDTANQAYwBoAHIAcABxAGsAbABiAG0AbgBkAGYAZwBvAGUAaQBqAHQAcwCMC2AAAAEGAAABAAAAAAAAAAEDAAAAAgAAAAAAAAAAAAAAAAAAAAEAAAMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXF1eX2BhAAAAYmNkZWZnaGkAagAAAAAAa2xtbm9wcXJzAHQAAAAAdXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPUAAQCuAAAACAAEAADAA8AfgD/AZICxgLcBE8gFCAaIB4gIiAmIDAgOiEiIhn//wAAACAAoAGSAsYC3AQQIBMgGCAcICAgJiAwIDkhIiIZ//8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAgANwBmgGaAZoBvgGYAZoBngGiAaYBpgGmAagBqAAAAAMABAAFAAYABwAIAAkACgALAAwADQAOAA8AEAARABIAEwAUABUAFgAXABgAGQAaABsAHAAdAB4AHwAgACEAIgAjACQAJQAmACcAKAApACoAKwAsAC0ALgAvADAAMQAyADMANAA1ADYANwA4ADkAOgA7ADwAPQA+AD8AQABBAEIAQwBEAEUARgBHAEgASQBKAEsATABNAE4ATwBQAFEAUgBTAFQAVQBWAFcAWABZAFoAWwBcAF0AXgBfAGAAYQB1AHYAdwB4AHkAegB7AHwAfQB+AH8AgACBAIIAgwCEAIUAhgCHAIgAiQCKAIsAjACNAI4AjwCQAJEAkgCTAJQAlQCWAJcAmACZAJoAmwCcAJ0AngCfAKAAoQCiAKMApAClAKYApwCoAKkAqgCrAKwArQCuAK8AsACxALIAswC0ALUAtgC3ALgAuQC6ALsAvAC9AL4AvwDAAMEAwgDDAMQAxQDGAMcAyADJAMoAywDMAM0AzgDPANAA0QDSANMA1ABjAGgAcgBwAHEAawBsAGIAbQBuAGQAZgBnAG8AZQBpAGoAdABzAIwLYACVAJYAlwCYAJkAmgCbAJwAnQCeAJ8AoAChAKIAowCkAKUApgCnAKgAqQCqAKsArACtAK4ArwCwALEAsgCzALQAtQC2ALcAuAC5ALoAuwC8AL0AvgC/AMAAwQDCAMMAxADFAMYAxwDIAMkAygDLAMwAzQDOAM8A0ADRANIA0wDU"
                                                        const timesNewRomanBoldBase64 = "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AaABogGmAaoBrgGuAa4BsAGwAAAAAwAEAAUABgAHAAgACQAKAAsADAANAA4ADwAQABEAEgATABQAFQAWABcAGAAZABoAGwAcAB0AHgAfACAAIQAiACMAJAAlACYAJwAoACkAKgArACwALQAuAC8AMAAxADIAMwA0ADUANgA3ADgAOQA6ADsAPAA9AD4APwBAAEEAQgBDAEQARQBGAEcASABJAEoASwBMAE0ATgBPAFAAUQBSAFMAVABVAFYAVwBYAFkAWgBbAFwAXQBeAF8AYABhAHoAewB8AH0AfgB/AIAAgQCCAIMAhACFAIYAhwCIAIkAigCLAIwAjQCOAI8AkACRAJIAkwCUAJUAlgCXAJgAmQCaAJsAnACdAJ4AnwCgAKEAogCjAKQApQCmAKcAqACpAKoAqwCsAK0ArgCvALAAsQCyALMAtAC1ALYAtwC4ALkAugC7ALwAvQC+AL8AwADBAMIAwwDEAMUAxgDHAMgAyQDKAMsAzADNAM4AzwDQANEA0gDTANQA1QDWANcA2ABsAHgAagB2AHkAYwBoAHQAcgBzAG0AbgBiAG8AcABkAGYAZwBxAGUAaQBrAHcAdQCQ/yoDAQAwAAAAAAEAAAABAAAAAN4AHgHPACgB9AAUAgoAHgMoABcDFwAaAOAAKAE9ABoBPQAKAdQAKAI6ABIBBgAoAU0AGADyACgBFv/9AfQAKAH0AD4B9AAkAfQAIgH0ACEB9AAkAfQAIAH0ABwB9AAkAfQAIgDyACgBBgAoAjoAEgI6ABICOgASAa0AFAOOABgCvv/2ApYADQKwABQCyAANAmoADQJaAA0C+gAYAvkADQF2AA0B9wAAAwoADQJ8AA0DmgANAsEADQL2ABQCTAANAvEAFALWAA0CCgAeAncADQLNAAsCrv/4A9n/+AK3AAACo//2AooABgEAACgBFv/9AQAAAAHKAAoCBAAAAOwAEAHgABwCCwAKAaYAFAIRABQBqwAUASoAEgHtABQCCQANAQoADQEN/6YCJAAKAQoADQMaAA0CEQANAdQAFAISAAoCCQAUAZwADQFqABoBSAAQAfsACgHY//gCuv/4AdUACAHlAAwBvQAQAWIAKADcAE4BYgAoAggAEwEGACgB9P//AdsAKAPoAFYB0QAcAbsAGAFNAAoEjwAXAgoAHgFNAC0D2AAmARwALwEcAC8B7AAvAewAGgFeACMCLwAUBB4AFAFNAAkEMwAqAWQAEQFNACwC0gAkAtIACQH0AAAA3gAeAfQAPwH0ABECCgAUAjoAGwDcAE4B3wAhAU0ACgLrABcBPQARAfQAEQI6ABIC6wAXAU0ACgGQAB8COgASASgADgEoAAwA9QAXAjAAFgIuABMA+gAsAU0AKwEsACMBSgANAfQAEQLuACMC7gAjAu4ACwGtABQCvv/2AnYADQKaAA0CTQANAsEAAQJqAA0D6gAIAe0ADAMjAA0DEwANAs8ADQLQAAADmgANAvkADQLyABgC9gANAkwADQKgABoCdwANAqQAAAMEABICtwAAAyEADQLgAAAEbQANBHIADQLEAAwD1gANAnEADQJ4AA0EMgANAroAAAHgABwB6QAgAdQADQGeAA0B4gAAAasAFAK6AAoBkgAKAfIADQHyAA0B2wANAeMAAAKKAA0CAAANAdQAFAH6AA0CEgAKAaYAFgG7AAoB5QAMAuoAFAHVAAgB/AANAeoAAALuAA0C9QANAfsADAKmAA0BwAANAaMACgLIAA0B1gAAAqcCtwHRAJcAAQJMARMC5v+xAnYBJQGbA58CWgKQA2ICOAG5A3IAAP/z/x//4wFX/zD/RgDV/4kBOwFpAF4A6wINAE8BAQIhAXoBTQAzAfkAuQEl/33/wgCCABIAYAAHAJsAKQBnAOAB2AEqAQ4BogDrALgARwCRAH0AYAFNATwAVAB4ABwAuACjAIwAXwAnADUAawDEAEUACQCXAEIAAAAAAZgCvAAFAAECvAKKAAAAjwK8AooAAAHFADIBAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBbHRzACAAICIZAwEA5wAAA58A5wAAAAAAEAAAANwJCwcAAgICBAUFBwcCAwMEBQIDAgMFBQUFBQUFBQUFAgIFBQUECAYGBgYGBQcHAwUHBggGBwUHBwUGBgYJBgYGAgMCBAUCBAUEBQQDBAUCAgUCBwUEBQUEAwMFBAYEBAQDAgMFAgUECQQEAwsFAwkDAwQEAwUJAwoDAwYGBQIFBQUFAgQDBwMFBQcDBAUDAwIFBQIDAwMFBwcHBAYGBgUGBgkEBwcGBggHBwcFBgYGBwYHBwoKBgkGBgoGBAQEBAQEBgQEBAQEBgUEBQUEBAQHBAUEBwcFBgQEBgQACgwIAAMDAgUFBQgIAgMDBQYDAwIDBQUFBQUFBQUFBQIDBgYGBAkHBwcHBgYICAQFCAYJBwgGCAcFBgcHCgcHBwMDAwUFAgUFBAUEAwUFAwMFAwgFBQUFBAQDBQUHBQUEBAIEBQMFBQoFBAMMBQMKAwMFBQQGCwMLBAMHBwUCBQUFBgIFAwcDBQYHAwQGAwMCBgYDAwMDBQgICAQHBgcGBwYKBQgIBwcJCAgIBgcGBwgHCAcLCwcKBgYLBwUFBQQFBAcEBQUFBQcFBQUFBAQFBwUFBQgIBQcEBAcFAAsNCAADAwIFBgYJCQIDAwUGAwQDAwYGBgYGBgYGBgYDAwYGBgUKCAcICAcHCAgEBgkHCggIBggIBgcICAsIBwcDAwMFBgMFBgUGBQMFBgMDBgMJBgUGBgUEBAYFCAUFBQQCBAYDBgULBQUEDQYECwMDBQUEBgwEDAQECAgGAgYGBgYCBQQIAwYGCAQEBgMDAwYGAwQDBAYICAgFCAcHBggHCwUJCQgICggICAYHBwcICAkIDA0ICwcHDAgFBQUFBQUIBAUFBQUHBgUGBgUFBQgFBgUICAYHBQUIBQAMDgkAAwMDBgYGCgkDBAQGBwMEAwMGBgYGBgYGBgYGAwMHBwcFCwgICAkHBwkJBAYJCAsICQcJCQYICQgMCAgIAwMDBQYDBgYFBgUEBgYDAwcDCgYGBgYFBAQGBggGBgUEAwQGAwYGDAYFBA4GBAwDAwYGBAcNBA0EBAkJBgMGBgYHAwYECQQGBwkEBQcEBAMHBwMEBAQGCQkJBQgICAcIBwwGCgkJCQsJCQkHCAgICQgKCQ4OCAwICA0IBgYGBQYFCAUGBgYGCAYGBgYFBQYJBgYGCQkGCAUFCQYADQ8KAAMDAwYHBwsKAwQEBgcDBAMEBwcHBwcHBwcHBwMDBwcHBgwJCQkJCAgKCgUHCggMCQoICgkHCAkJDQkJCAMEAwYHAwYHBQcGBAYHAwMHAwoHBgcHBQUEBwYJBgYGBQMFBwMHBg0GBgQPBwQNBAQGBgUHDgQOBQQJCQcDBwcHBwMGBAoEBwcKBAUHBAQDBwcDBAQEBwoKCgYJCAkICQgNBgoKCQkMCgoKCAkICQoJCgoPDwkNCAgOCQYGBgUGBgkFBgYGBggHBgcHBQYGCgYHBgoKBwkGBQkGAA4QCwAEBAMGBwcLCwMEBAcIBAUDBAcHBwcHBwcHBwcDBAgICAYNCgkKCgkICwsFBwsJDQoLCAsKBwkKCg4KCQkEBAQGBwMHBwYHBgQHBwQECAQLBwcHBwYFBQcHCgcHBgUDBQcEBwcOBwYFEAcFDgQEBwcFCA8FDwUFCgoHAwcHBwgDBwUKBAcICgUGCAQEAwgIBAUEBQcLCwsGCgkJCAoJDgcLCwoKDQsLCwgJCQkLCgsKEBAKDgkJDwoHBwcGBwYKBgcHBwcJBwcHBwYGBwoHBwcLCwcJBgYKBwAPEgwABAQDBwgIDAwDBQUHCQQFBAQICAgICAgICAgIBAQJCQkGDgsKCgsJCQsLBggMCg4LCwkLCwgJCwoPCgoKBAQEBwgEBwgGCAYEBwgEBAgEDAgHCAgGBQUIBwoHBwcFAwUIBAgHDwcHBRIIBQ8EBAcHBQgQBRAFBQsLCAMICAgJAwcFCwUICQsFBgkEBAQICAQFBQUICwsLBgsJCgkLCQ8HDAwLCw4LCwsJCgkKDAoMCxERCw8JCRAKBwcHBgcGCgYHBwcHCggHCAgGBwcLBwgHCwsICgcGCwcAEBMMAAQEBAcICA0NBAUFBwkEBQQECAgICAgICAgICAQECQkJBw8LCwsLCgoMDAYIDAoPCwwJDAwICgsLEAsLCgQEBAcIBAgIBwgHBQgIBAQJBA0IBwgIBwYFCAgLCAgHBgQGCAQICBAHBwUTCAUQBQUICAYJEQURBgUMDAgECAgICQQIBQwFCAkMBQYJBQUECQkEBQUFCAwMDAcLCgsJCwoQCA0NDAwPDAwMCQsKCwwLDQwSEgsQCgoRCwgIBwcIBwsGCAgICAoIBwgIBwcIDAgICAwMCAsHBwsIABEUDQAEBAQICQkODQQFBQgKBAYEBQkJCQkJCQkJCQkEBAoKCgcPDAsMDAsKDQ0GCQ0LEAwNCg0MCQsMDBEMCwsEBQQICQQICQcJBwUICQUFCQUNCQgJCQcGBgkIDAgICAYEBgkECQgRCAgGFAkGEQUFCAgGChIGEgYGDAwJBAkJCQoECAYNBQkKDQYHCgUFBAoJBAYFBgkNDQ0HDAsLCgwLEQgODQwMEA0NDQoLCwsNDA4NExMMEQsLEgwICAgHCAcMBwgICAgLCQgJCQcICA0ICQgNDQkMCAcMCAASFQ4ABQUECAkJDw4EBgYICgUGBAUJCQkJCQkJCQkJBAUKCgoIEA0MDA0LCw4OBwkOCxENDgsODQkLDQwSDQwMBQUFCAkECQkICggFCQkFBQoFDgoICgkHBwYJCA0ICQgGBAYJBQkJEggIBhUJBhIFBQkJBgoTBhMGBg0NCQQJCQkKBAkGDQYJCg0GBwoFBQQKCgUGBQYJDg4OCA0LDAsNCxIJDg4NDREODg4LDAsMDg0ODRQUDRILCxMNCQkIBwkIDQcJCQkJDAkICQoICAkNCAkJDg4JDAgIDQgAExYPAAUFBAkKCg8PBAYGCQsFBgUFCgoKCgoKCgoKCgUFCwsLCBENDQ0ODAsODgcKDwwSDQ4LDg4KDA4NEw0NDAUFBQkKBAkKCAoIBgkKBQUKBQ8KCQoKCAcGCgkNCQkIBwQHCgUKCRMJCAYWCgYTBQUJCQcLFAYUBwYODgoECgoKCwQJBg4GCgsOBggLBgYFCwsFBgYGCg4ODggNDA0LDQwTCQ8PDg4SDg4OCw0MDQ8NDw4WFg0TDAwUDQkJCQgJCA0ICQkJCQwKCQoKCAgJDgkKCQ4OCg0JCA4JABQXDwAFBQQJCgoQEAQGBgkLBQcFBgoKCgoKCgoKCgoFBQsLCwkSDg0ODgwMDw8HChANEg4PDA8PCg0ODhQODg0FBgUJCgUKCggLCQYKCgUFCwUQCwkLCggHBwoJDgkKCQcEBwoFCgoUCQkHFwoHFAYGCgoHCxUHFgcHDg4KBAoKCgsECgcPBgoLDwcICwYGBQsLBQcGBwoPDw8JDg0NDA4MFAoQEA4OEg8PDwwNDQ4PDhAPFxcOFA0NFQ4KCgkICgkOCAoKCgoNCgkKCwgJCg8JCgoPDwoOCQgOCQAVGRAABQUFCgsLEREFBwcKDAYHBQYLCwsLCwsLCwsLBQYMDAwJEw8ODg8NDRAQCAsQDRMPEAwQDwsNDw4VDw4OBQYFCgsFCgsJCwkGCgsGBgwGEQsKCwsJCAcLCg8KCgkHBQcLBgsKFQoJBxkLBxUGBgoKBwwWBxcHBw8PCwULCwsMBQoHEAcLDBAHCAwGBgUMDAUHBgcLEBAQCQ8NDgwPDRUKEREPDxMQEBAMDg0OEA8RDxgYDxUNDRcPCgoKCQoJDwgKCgoKDgsKCwsJCQoQCgsKEBALDgkJDwoAFhoRAAYGBQoLCxIRBQcHCg0GBwUGCwsLCwsLCwsLCwUGDQ0NCRQPDw8QDg0REQgLEQ4UEBENERALDhAPFg8PDgYGBgoLBQsMCQwJBwsLBgYMBhEMCgwLCQgHCwoPCgsKCAUICwYLChYKCgcaCwcWBgYLCwgMFwcYCAcQEAsFCwsLDQULBxAHCw0QBwkNBwcFDAwGBwcHCxEREQkPDg8NEA4WCxIREBAUERERDQ8ODxEPEhAZGRAWDg4YDwsLCgkLCQ8JCwsKCw4LCgsMCQoLEAoLCxERCw8KCRAKABcbEgAGBgULDAwTEgUHBwsNBggGBgwMDAwMDAwMDAwGBg0NDQoVEA8QEA4OEhIJDBIPFRARDhERDA8QEBcQEA8GBgYLDAULDAoMCgcLDAYGDQYSDAsMDAkICAwLEAsLCggFCAwGDAsXCwoIGwwIFwcHCwsIDRgIGQgIEREMBQwMDA0FCwgRBwwNEQgJDQcHBg0NBggHCAwREREKEA4PDhAOFwsSEhERFRIREQ4PDxASEBIRGhoQFw4PGRALCwsKCwoQCQsLCwsPDAsMDAoKCxELDAsREQwQCgoQCwAYHBIABgYFCwwNExMFCAgLDgYIBgcMDAwMDAwMDAwMBgYODg4KFhEQEREPDhISCQwTDxYREg4SEQ0PERAYERAQBgcGCwwGDA0KDQoHDA0GBg0GEw0LDQ0KCQgMCxELDAsIBQgMBgwLGAsLCBwNCBgHBwwMCA0ZCBoJCBERDAUMDA0OBQsIEggMDhIICg4HBwYNDQYIBwgMEhISChEPEA4RDxgMExMRERYSEhIOEA8QExETEhsbERgPDxoRDAwLCgwKEQoMDAsMEAwLDA0KCwwSCwwMEhIMEAsKEQsAAAAAAQAACvoAAQHSADAACAq8ACQACv+5AC8ACv+fAEkACgB9AJkACv+pACcADP+1ACkAD/+tAC0AD//bACYAD//iADIAD//IADMAD/+tADQAD//bADYAD//bADcAD/+tADgAD/+9ADkAD/+RADoAD/+fADwAD/+DACUAD//bAFUAD/+7AFYAD//iAFcAD//5AFkAD/+7AFoAD/+7AFwAD/+7ACcAD//TAJwAD/+EAKsAD/+cAKwAD/9eALwAD/+1AMsAD//OACYAEP/iADMAEP/kADkAEP+tAC4AEP+fADoAEP/IADsAEP/IACQAEP/IAJwAEP/CAJ8AEP/OADwAEP+RAKsAEP/OACkAEP/IAKwAEP/CAK4AEP/OAEkAEP/yADcAEP+7AC0AEf/bADMAEf+tAFkAEf+7ADkAEf+RAFoAEf+6ACUAEf/qAFwAEf+7ADQAEf/EADoAEf+fACYAEf/iAJwAEf+DADYAEf/bACkAEf+tADwAEf+DAKsAEf+cADIAEf/JADcAEf+sAKwAEf9eACcAEf/UAFUAEf+7ALwAEf+1ADgAEf+9AMsAEf+1AJwAHf/OACkAHf/WAKwAHf+1ADkAHf+tADoAHf+sADwAHf+fAKsAHf/bADcAHf/WADcAHv/WADwAHv+fAKwAHv+cADkAHv+tACkAHv/WAKsAHv/OAJwAHv/OADoAHv+tADkAJP9qAEoAJP/5ACYAJP/CAC0AJP/CADMAJP+IADcAJP+qACcAJP/CADoAJP93ACUAJP/iADgAJP+pADQAJP/bACkAJP+pACoAJP/OADIAJP+kADwAJP9nAEMAJP9ZABAAJP/IAC4AJv+8ADoAJv/bACQAJv+1ADwAJv+7ADsAJv/WADcAJv/wADUAJv/bADkAJv/EAC8AJ//5ADoAKv/iADkAKv/MACQAKv/CADUAKv/qACkAKv/iADwAKv/bAEMALf/kABAALf/IADIALf/qADcALf/BAC8AMv/7ADgAMv/xAC4AMv/TADkAMv/IADoAMv/RADUAMv/qADwAMv+9ADcAMv/wADsAMv/IACQAMv/aACkAMv/iAC8AM//qACkANP/iADoANP/bAC8ANP/iACQANP/CADkANP+9ADsANP/iADgANP/xADwANP/EAC4ANP/EADgANv/qADcANv/qADwANv/TACoANv/qADoANv/iADYAN//bACQAN/+1AC8AN//DADUAN//WABAAN/+7ADIAN//kAC8AOP+9ACQAOP/CADUAOP/bACUAOP/bADQAOP/xADIAOP/xADYAOP/bADMAOP/xABAAOf+tACQAOf92ADMAOf/qAC8AOf+nADUAOf/EADIAOf/TACoAOf/MACcAOf+1ADQAOf/aADYAOf+9ACUAOf/MADIAOv/WACQAOv+cACYAOv/xADUAOv+tABAAOv/IACoAOv/yADQAOv/bAC8AOv+AACUAOv/TADYAOv/iADMAOv/qADIAO//IABAAO/+7ADQAO//UACcAO//iACYAO//kACcAPP/OABAAPP+tADUAPP/KADIAPP/UADQAPP/qADMAPP/yACoAPP/iACQAPP93AC8APP+kADYAPP/TACUAPP/bADEARP/iADMARP/kADwARP+7ADoARP/fACkARP/YADcARP/dADkARP+7AFoARP/xAC4ARP/iADgARP/xAFwARP/qACQARv/kAFkARv/xAFwARv/qAFoARv/qADcARv/KACkAR//bADoAR//iAFoAR//qACQAR//kADgAR//yADcAR//iAFkAR//xAFwAR//qADMAR//xADwAR/+9AFoASP/xAFsASP/qADkASP+7AC0ASP/xACQASP/kADwASP+eADcASP/WAFwASP/qACkASP/LAFkASP/qADoASP/KADgASP/xADMASP/kAC4ASP/kADUASP/qABAASf/yACQASv/xADoASv+9ADcASv/MADgASv/qAFkASv/iAFoASv/iACkASv/TADwATP/WADkATP/WACkATP/qADoATP/kADoAUP/4ADgAUv/xADwAUv+fAC0AUv/xADEAUv/qADoAUv/KAFkAUv/qAC4AUv/kAFwAUv/qADUAUv/qADkAUv+tADMAUv/kADcAUv/WACkAUv/LACQAUv/WAFoAUv/xACQAVP/kADwAVP+uADkAVP/EACkAVP/qADoAVf/mACkAVf/nADcAVf/iADkAVf/WADgAVv/iADcAVv/vADMAVv/wAEkAVwAeADUAV//qACQAV//iADUAWP/qACkAWP/nADcAWP/qACQAWP/kADwAWP+7ADoAWP/kADkAWP/kAC4AWP/iAC8AWP/iAC0AWP/xACUAWP/xADEAWP/iADEAWf/bACoAWf/bAFIAWf/qADUAWf/TACsAWf/qAFwAWf/bAC8AWf+mADwAWf+9AFgAWf/xADcAWf/MACkAWf/bAEYAWf/xACQAWf+rACgAWf/bACsAWv/qACQAWv+4ADUAWv/iAFIAWv/xACkAWv/iAEQAWv/xAC8AWv/MAEYAWv/qAEgAWv/xACgAWv/iADcAWv/WADcAW//bACUAXP/xACQAXP+dACkAXP/ZAC4AXP+7ACsAXP/qADkAXP+7AC8AXP/IACgAXP/iAEgAXP/qADoAXP+3ADcAXP/IAKwAmf9bAK0Amf/CAKcAmf+9ALYAmf/CALcAmf/BAKkAmf+DAKoAmf/MAJwAmf+JAKsAmf+0AJwAnf/bAKkAnf/CALYAnf/bAKsAnf/PALcAnf/CAKcAnf/PAKwAnf+5AKoAnf/nAK0Anf/O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ABAAEQASABMAFAAVABYAFwAYABkAGgAbABwAHQAeAB8AIAAhACIAIwAkACUAJgAnACgAKQAqACsALAAtAC4ALwAwADEAMgAzADQANQA2ADcAOAA5ADoAOwA8AD0APgA/AEAAQQBCAEMARABFAEYARwBIAEkASgBLAEwATQBOAE8AUABRAFIAUwBUAFUAVgBXAFgAWQBaAFsAXABdAF4AXwBgAGEAegB7AHwAfQB+AH8AgACBAIIAgwCEAIUAhgCHAIgAiQCKAIsAjACNAI4AjwCQAJEAkgCTAJQAlQCWAJcAmACZAJoAmwCcAJ0AngCfAKAAoQCiAKMApAClAKYApwCoAKkAqgCrAKwArQCuAK8AsACxALIAswC0ALUAtgC3ALgAuQC6ALsAvAC9AL4AvwDAAMEAwgDDAMQAxQDGAMcAyADJAMoAywDMAM0AzgDPANAA0QDSANMA1ADVANYA1wDYAGwAeABqAHYAeQBjAGgAdAByAHMAbQBuAGIAbwBwAGQAZgBnAHEAZQBpAGsAdwB1AJD/KgCZAJoAmwCcAJ0AngCfAKAAoQCiAKMApAClAKYApwCoAKkAqgCrAKwArQCuAK8AsACxALIAswC0ALUAtgC3ALgAuQC6ALsAvAC9AL4AvwDAAMEAwgDDAMQAxQDGAMcAyADJAMoAywDMAM0AzgDPANAA0QDSANMA1ADVANYA1wDY"
                                                        // Adding normal font
                                                        doc.addFileToVFS('TimesNewRoman.ttf', timesNewRomanBase64);
                                                        doc.addFont('TimesNewRoman.ttf', 'TimesNewRoman', 'light');

                                                        doc.addFileToVFS('TimesNewRomanBold.ttf', timesNewRomanBoldBase64);
                                                        doc.addFont('TimesNewRomanBold.ttf', 'TimesNewRomanBold', 'bold');
                                                        doc.setFont('TimesNewRomanBold');
                                                        doc.setFont('TimesNewRoman');

                                                        const boldFont = 'TimesNewRomanBold';


                                                        const normalFont = 'TimesNewRoman';
                                                        doc.addFont('TimesNewRomanBold.ttf', boldFont, 'normal');
                                                        doc.addFont('TimesNewRoman.ttf', normalFont, 'normal');

                                                        // Helper: convert any image URL/base64 to circular base64 PNG using canvas
                                                        async function getRoundedImage(imagePathOrUrl, size) {
                                                            const image = await loadImage(imagePathOrUrl);

                                                            const canvas = createCanvas(size, size);
                                                            const ctx = canvas.getContext('2d');

                                                            // Draw circle clipping
                                                            ctx.beginPath();
                                                            ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                                                            ctx.closePath();
                                                            ctx.clip();

                                                            // Draw image inside the circle
                                                            ctx.drawImage(image, 0, 0, size, size);

                                                            console.log(`canva returned`);
                                                            // Return base64 PNG data
                                                            return canvas.toDataURL('image/png');
                                                        }

                                                        // === Main PDF Code ===
                                                        let headerTableDataOne;
                                                        let yPosition;
                                                        const centerX = pageWidth / 2;
                                                        const sideMargin = 10;
                                                        const cyan = [67, 133, 246];
                                                        //    const cyan = [67, 133, 246];  /*  Green  */
                                                        // const cyan = [252, 187, 5];   /*Yellow  */
                                                        // const cyan = [231, 65, 54];  /*Red  */
                                                        // const cyan = [67, 133, 246]; /* Blue  */
                                                        const profileSize = 50;
                                                        const profileY = 55;
                                                        const nameFontSize = 16;

                                                        const screeningLogo = screeningLogoNew;
                                                        const customLogo =
                                                            applicationInfo?.custom_template === "yes" && applicationInfo?.custom_logo?.trim()
                                                                ? await fetchImageAsBase64(applicationInfo.custom_logo.trim())
                                                                : null;
                                                        const logoBase64 = customLogo?.[0]?.base64 || screeningLogo;
                                                        doc.addImage(logoBase64, "PNG", centerX - 37, 10, 76, 24);

                                                        // === 2. MAIN TITLE BAR ===
                                                        const mainTitle = applicationInfo?.generate_report_type || "CONFIDENTIAL BACKGROUND SCREENING REPORT";

                                                        const titleY = 39;
                                                        doc.setFillColor(...cyan); // [67, 133, 246]
                                                        doc.setDrawColor(46, 93, 172);
                                                        // Default thin line



                                                        doc.rect(10, titleY, pageWidth - 20, 15, "FD"); // Now border will show


                                                        doc.setFont("TimesNewRoman", "bold");
                                                        doc.setFontSize(11);
                                                        doc.setTextColor(255);

                                                        doc.text(mainTitle, centerX, titleY + 9, { align: "center" });

                                                        // === 3. PROFILE PHOTO (rounded)
                                                        let profilePhoto = applicationInfo.gender === "Female" ? noImageTarget : noImageTarget;
                                                        let isProfileExist = false;
                                                        if (applicationInfo?.photo) {
                                                            const imgUrl = await fetchImageAsBase64(applicationInfo.photo.trim());
                                                            profilePhoto = imgUrl?.[0]?.base64 || profilePhoto;
                                                            isProfileExist = true;
                                                        }
                                                        doc.setFillColor(255);


                                                        // === 4. NAME (centered below profile)
                                                        // === 4. NAME (centered below profile)

                                                        const nameText = applicationInfo.name || "Name";
                                                        const nameY = profileY + 55;
                                                        doc.setFontSize(nameFontSize);
                                                        doc.setFont("TimesNewRoman", "bold");
                                                        doc.setTextColor(0, 0, 0); // text color white

                                                        // Split text into lines
                                                        const lines = doc.splitTextToSize(nameText, 100);
                                                        const lineHeight = nameFontSize * 0.3528; // approximate line height in mm
                                                        const textHeight = lines.length * lineHeight;

                                                        // Optional: add slight shadow for blur effect
                                                        doc.setDrawColor(0, 0, 0, 0.1); // light shadow
                                                        doc.setFillColor(255); // blue background   onchange

                                                        // Draw rounded rectangle with slight blur/shadow effect
                                                        const rectX = centerX + 20 - 60; // adjust for center
                                                        const rectY = nameY - lineHeight;
                                                        const rectWidth = 120;
                                                        const rectHeightt = textHeight + 4;
                                                        const borderRadius = 3; // small rounded corners

                                                        doc.roundedRect(rectX, rectY, rectWidth, rectHeightt, borderRadius, borderRadius, 'F');

                                                        // Draw text on top

                                                        const barY = nameY + 10;
                                                        // === Company Name Rendering (centered in right bar)
                                                        const companyFontSize = 14;
                                                        doc.setFontSize(companyFontSize);
                                                        doc.setTextColor(255);
                                                        doc.setFont("TimesNewRoman", "bold");

                                                        // Split text to fit inside the right bar width


                                                        // Draw text centered

                                                        doc.setFontSize(companyFontSize);

                                                        // ---------------------------
                                                        // Layout & sizing (constants)
                                                        // ---------------------------
                                                        const margin = 10;
                                                        const totalAvailable = pageWidth - 20; // pageWidth minus left & right page margins
                                                        const profileImageWidth = 45;
                                                        const imageX = 35;

                                                        // === decide bar widths
                                                        const rightBarMinWidth = Math.max(totalAvailable / 2); // your logic; this yields half
                                                        const leftBarWidth = totalAvailable - rightBarMinWidth;
                                                        const rightBarWidth = totalAvailable - leftBarWidth;

                                                        // vertical positions
                                                        const paddingY = 9;      // vertical padding inside bars
                                                        const barX = margin;     // left-most X for bars
                                                        // barY is assumed provided above in your code

                                                        // ---------------------------
                                                        // Company name wrapping + height
                                                        // ---------------------------
                                                        doc.setFontSize(companyFontSize);
                                                        doc.setFont("TimesNewRoman", "bold");

                                                        // Wrap the company name into the right bar width (leave horizontal padding)
                                                        const horizontalPadding = 10;
                                                        const wrappedRight = doc.splitTextToSize(companyName, rightBarWidth - horizontalPadding * 2);

                                                        // Convert font size (pt) to approximate mm line height (your previous factor)
                                                        const companyLineHeight = companyFontSize * 0.3528;
                                                        const companyTextHeight = wrappedRight.length * companyLineHeight;

                                                        // Height of the combined bar area used for vertical centering
                                                        const companyBarHeight = companyTextHeight + paddingY * 2 - 4;

                                                        // ---------------------------
                                                        // Draw bars (left + right) and border
                                                        // ---------------------------
                                                        doc.setFillColor(...cyan);
                                                        doc.rect(barX, barY, leftBarWidth, companyBarHeight, "F");

                                                        doc.setFillColor(161, 194, 250);
                                                        doc.rect(barX + leftBarWidth, barY, rightBarWidth, companyBarHeight, "F");

                                                        const borderColorr = [67, 133, 246];
                                                        const borderThickness = 1.5;
                                                        doc.setLineWidth(borderThickness);
                                                        doc.setDrawColor(...borderColorr);

                                                        // ---------------------------
                                                        // Images (status + profile)
                                                        // ---------------------------
                                                        const statusImages = {
                                                            GREEN: greenTarget,
                                                            RED: redTarget,
                                                            YELLOW: yellowTarget,
                                                            ORANGE: orangeTarget,
                                                        };

                                                        const status = (applicationInfo.final_verification_status || "").toUpperCase();
                                                        const statusImage = statusImages[status];
                                                        if (statusImage) {
                                                            // place status image inside right bar near top (adjust coordinates to taste)
                                                            doc.addImage(statusImage, "PNG", barX + leftBarWidth + 20, profileY + 13, 67, 40);
                                                        } else {
                                                            doc.text("No status image available", barX + leftBarWidth + 10, barY + 12);
                                                        }

                                                        const roundedImage = await getRoundedImage(profilePhoto, 100);
                                                        doc.addImage(profilePhoto, "PNG", imageX, profileY + 15, 40, 40);

                                                        // ---------------------------
                                                        // Compute center positions
                                                        // ---------------------------
                                                        // center X of right bar (absolute page coordinates)
                                                        const rightBarCenterX = barX + leftBarWidth + (rightBarWidth / 2);

                                                        // center X of left bar (if you need to center text in left bar)
                                                        const leftBarCenterX = barX + leftBarWidth / 2;

                                                        // Compute vertical center Y for text inside the bar
                                                        // We want the vertical center of the text block to sit in the center of the bar.
                                                        const companyTextY = barY + 1 + (companyBarHeight / 2) - (companyTextHeight / 2) + companyLineHeight / 2;
                                                        // note: for jsPDF, y is baseline for a line — we added half a line to better align

                                                        // ---------------------------
                                                        // Draw company name centered in the RIGHT bar
                                                        // ---------------------------
                                                        doc.setFontSize(companyFontSize);
                                                        doc.setTextColor(255);

                                                        // Use the wrappedRight content and draw it centered at rightBarCenterX
                                                        // doc.text can take an array (multiline) and an options object { align: "center" }
                                                        doc.text(wrappedRight, rightBarCenterX, companyTextY, { align: "center" });

                                                        // ---------------------------
                                                        // Example: if you also want a centered label inside LEFT bar (optional)
                                                        // ---------------------------
                                                        const wrappedLeft = doc.splitTextToSize(lines, leftBarWidth - horizontalPadding * 2);
                                                        const leftTextHeight = wrappedLeft.length * companyLineHeight;
                                                        const leftTextY = barY + 1 + (companyBarHeight / 2) - (leftTextHeight / 2) + companyLineHeight / 2;
                                                        doc.text(wrappedLeft, leftBarCenterX, leftTextY, { align: "center" });

                                                        doc.setLineWidth(0.5);
                                                        doc.autoTable({
                                                            body: headerTableDataOne,
                                                            startY: 54,
                                                            styles: {
                                                                font: 'TimesNewRoman', // Default font
                                                                fontSize: 10,
                                                                cellPadding: 2,
                                                                textColor: [0, 0, 0],
                                                                lineWidth: 0.2,
                                                                lineColor: [67, 133, 246],
                                                                overflow: 'visible',
                                                            },
                                                            columnStyles: {
                                                                0: {
                                                                    cellWidth: 80, // Adjust width based on label size
                                                                    halign: 'left',
                                                                    valign: 'middle',
                                                                    overflow: 'visible',
                                                                },
                                                                1: {
                                                                    cellWidth: 'auto',
                                                                    halign: 'left',
                                                                    valign: 'middle',
                                                                }
                                                            },
                                                            theme: 'grid',
                                                            headStyles: {
                                                                fillColor: [67, 133, 246],

                                                                textColor: [255, 255, 255],
                                                                fontStyle: 'bold',
                                                            },
                                                            tableLineColor: [67, 133, 246],
                                                            tableLineWidth: 0.2,
                                                            margin: { left: sideMargin, right: sideMargin, bottom: 20 },
                                                            didParseCell: function (data) {
                                                                if (data.section === 'body' && data.column.index === 0) {
                                                                    data.cell.styles.font = 'TimesNewRoman'; // Bold font for headings
                                                                    data.cell.styles.whiteSpace = 'nowrap';
                                                                } else if (data.section === 'body' && data.column.index === 1) {
                                                                    data.cell.styles.font = 'TimesNewRomanLight'; // Light font for values
                                                                }
                                                            }
                                                        });
                                                        doc.setFont("TimesNewRoman", "normal");

                                                        let headerTableData;
                                                        const previousY = barY + companyBarHeight;
                                                        const startY = previousY + 7;

                                                        if (generate_report_type == 'CONFIDENTIAL BACKGROUND SCREENING REPORT') {
                                                            headerTableData = [
                                                                ["REFERENCE ID", String(applicationInfo.application_id).toUpperCase(), "DATE OF BIRTH", formatDate(applicationInfo.dob) || "N/A"],
                                                                ["EMPLOYEE ID", String(applicationInfo.employee_id || "N/A").toUpperCase(), "INSUFF CLEARED", formatDate(applicationInfo.first_insuff_reopened_date, true) || "N/A"],
                                                                ["VERIFICATION INITIATED", formatDate(applicationInfo.initiation_date).toUpperCase() || "N/A", "FINAL REPORT DATE", formatDate(applicationInfo.report_date) || "N/A"],
                                                                // ["VERIFICATION PURPOSE", (applicationInfo.verification_purpose || "EMPLOYMENT").toUpperCase(), "VERIFICATION STATUS", (applicationInfo.final_verification_status || "N/A").toUpperCase()],
                                                                ["REPORT TYPE", (applicationInfo.report_type || "EMPLOYMENT").replace(/_/g, " ").toUpperCase(), "REPORT STATUS", (applicationInfo.report_status || "N/A").toUpperCase()]
                                                            ];
                                                        } else if (generate_report_type == 'VENDOR CONFIDENTIAL SCREENING REPORT') {
                                                            headerTableData = [
                                                                ["REFERENCE ID", String(applicationInfo.application_id).toUpperCase(), "DATE OF INCORPORATION", formatDate(applicationInfo.dob) || "N/A"],
                                                                ["EMPLOYEE ID", String(applicationInfo.employee_id || "N/A").toUpperCase(), "INSUFF CLEARED", formatDate(applicationInfo.first_insuff_reopened_date, true) || "N/A"],
                                                                ["VERIFICATION INITIATED", formatDate(applicationInfo.initiation_date).toUpperCase() || "N/A", "FINAL REPORT DATE", formatDate(applicationInfo.report_date) || "N/A"],
                                                                // This row has only 2 cells (spans full row)
                                                                ["VERIFICATION STATUS", (applicationInfo.final_verification_status || "N/A").toUpperCase(), "REPORT STATUS", (applicationInfo.report_status || "N/A").toUpperCase()],
                                                                ["REPORT TYPE", (applicationInfo.report_type || "EMPLOYMENT").replace(/_/g, " ").toUpperCase()]
                                                            ];
                                                        }

                                                        const colorMapping = {
                                                            Yellow: 'yellow',
                                                            Red: 'red',
                                                            Blue: 'blue',
                                                            Green: 'green',
                                                            Orange: 'orange',
                                                            Pink: 'pink',
                                                        };
                                                        doc.autoTable({
                                                            body: headerTableData,
                                                            didParseCell: function (data) {
                                                                const { column, cell } = data;

                                                                // Apply bold font to first and third columns (headings)
                                                                if (column.index === 0 || column.index === 2) {
                                                                    data.cell.styles.font = "TimesNewRomanBold"; // Ensure bold font for headings
                                                                } else {
                                                                    data.cell.styles.font = "TimesNewRoman"; // Ensure normal font for values
                                                                }

                                                                // Apply color to "VERIFICATION STATUS" column (last column)
                                                                const verificationStatusColumnIndex = 3;
                                                                const cellText = cell.raw;
                                                                if (column.index === verificationStatusColumnIndex && typeof cellText === 'string') {
                                                                    const matchedColor = Object.keys(colorMapping).find(color =>
                                                                        cellText.includes(color.toUpperCase())
                                                                    );
                                                                    if (matchedColor) {
                                                                        data.cell.styles.textColor = colorMapping[matchedColor];
                                                                    }
                                                                }
                                                            },

                                                            startY: startY,
                                                            styles: {
                                                                font: 'TimesNewRoman', // Default font for table
                                                                fontSize: 10,
                                                                cellPadding: 2,
                                                                textColor: [0, 0, 0],
                                                                lineWidth: 0.2,
                                                                lineColor: [67, 133, 246],
                                                            },
                                                            theme: 'grid',
                                                            headStyles: {
                                                                fillColor: [67, 133, 246],
                                                                textColor: [255, 255, 255],
                                                                fontStyle: 'bold',
                                                            },
                                                            tableLineColor: [67, 133, 246],
                                                            tableLineWidth: 0.2,
                                                            margin: { left: sideMargin, right: sideMargin, bottom: 20 }
                                                        });

                                                        // === Calculate finalY after tables ===
                                                        const { finalY } = doc.lastAutoTable || { finalY: 10 };

                                                        const ysPosition = finalY + 5;
                                                        // === Define image row box dimensions ===
                                                        const imageRowHeight = 16;           // Enough height for 10x10 icons + padding
                                                        const imageRowY = ysPosition; // Push it down a bit after table

                                                        // === Draw background rectangle for image row ===
                                                        doc.setFillColor(67, 133, 246);
                                                        // === Load and place image icons with custom sizes ===
                                                        const images = [
                                                            { src: aadhaarIcon, width: 12, height: 10 }, // +5 width
                                                            { src: emblemIcon, width: 9, height: 11 },
                                                            { src: logo3, width: 12, height: 11 },
                                                            { src: logo4, width: 12, height: 13 },
                                                            { src: logo5, width: 13, height: 11 },
                                                            { src: logo6, width: 11, height: 11 },
                                                            { src: logo8, width: 13, height: 14 },
                                                            { src: logo9, width: 12, height: 13 },

                                                        ];
                                                        const gap = 12.3; // spacing between circles
                                                        const startX = 10;
                                                        let currentX = startX;
                                                        const circleRadius = 10; // adjust based on max img size
                                                        const iconY = imageRowY + imageRowHeight / 2; // vertical center

                                                        images.forEach((img) => {
                                                            const centerX = currentX + circleRadius;
                                                            const centerY = iconY + 4;

                                                            // Draw white filled circle with black border
                                                            doc.setFillColor(255, 255, 255);   // white fill
                                                            doc.setDrawColor(67, 133, 246);         // black border
                                                            doc.circle(centerX, centerY, circleRadius, "FD"); // Fill + Draw

                                                            // Place the image inside (centered in circle)
                                                            const imgX = centerX - img.width / 2;
                                                            const imgY = centerY - img.height / 2;
                                                            doc.addImage(img.src, "PNG", imgX, imgY, img.width, img.height);

                                                            currentX += circleRadius * 1.2 + gap; // move to next circle
                                                        });
                                                        const afterImageBoxY = imageRowY + imageRowHeight + 10; // Add 10 for some spacing



                                                        const imageArray = [colored, yellowShield, orangeShield, greenShield];

                                                        doc.autoTable({
                                                            startY: afterImageBoxY + 3,
                                                            head: [
                                                                [
                                                                    {
                                                                        content: "COLOR CODE / ADJUDICATION MATRIX",
                                                                        colSpan: 4,
                                                                        styles: {
                                                                            halign: 'center',
                                                                            fontSize: 11,
                                                                            font: "TimesNewRomanBold",
                                                                            fontStyle: 'bold',
                                                                            textColor: [255],
                                                                            fillColor: [67, 133, 246],
                                                                        }
                                                                    }
                                                                ],
                                                                [
                                                                    { content: 'MAJOR DISCREPANCY', styles: { font: "TimesNewRomanBold", halign: 'center', fontStyle: 'bold' } },
                                                                    { content: 'MINOR DISCREPANCY', styles: { halign: 'center', fontStyle: 'bold' } },
                                                                    { content: 'UNABLE TO VERIFY', styles: { halign: 'center', fontStyle: 'bold' } },
                                                                    { content: 'ALL CLEAR', styles: { halign: 'center', fontStyle: 'bold' } }
                                                                ]
                                                            ],
                                                            body: [
                                                                ['', '', '', ''] // Row with empty cells for image placement
                                                            ],
                                                            didDrawCell: function (data) {
                                                                const { row, column, cell } = data;

                                                                // Draw image only in the first body row
                                                                if (data.section === 'body' && row.index === 0 && column.index >= 0 && column.index <= 3) {
                                                                    const image = imageArray[column.index];
                                                                    if (image) {
                                                                        const imgWidth = 12;
                                                                        const imgHeight = 12;
                                                                        const x = cell.x + (cell.width - imgWidth) / 2;
                                                                        const y = cell.y + (cell.height - imgHeight) / 2;
                                                                        doc.addImage(image, 'PNG', x, y, imgWidth, imgHeight);
                                                                    }
                                                                }
                                                            },
                                                            styles: {
                                                                font: 'TimesNewRomanBold',
                                                                fontSize: 9,
                                                                cellPadding: 5,
                                                                lineWidth: 0.2,
                                                                textColor: [0, 0, 0],
                                                                fontStyle: 'bold',
                                                                lineColor: [67, 133, 246],
                                                            },
                                                            headStyles: {
                                                                textColor: [0, 0, 0],
                                                                fontStyle: 'bold',
                                                                fillColor: [255, 255, 255] // Explicit white to avoid rendering issues
                                                            },
                                                            theme: 'grid',
                                                            margin: { left: 10, right: 10, bottom: 20 }
                                                        });

                                                        addFooter(doc);

                                                        doc.addPage();
                                                        let newYPosition = 5;
                                                        const SummaryTitle = "SUMMARY OF THE VERIFICATION CONDUCTED";
                                                        const backgroundColor = (67, 133, 246);
                                                        const borderColor = '#3d75a6';
                                                        const xsPosition = 10;
                                                        doc.setTextColor(255);
                                                        const fullWidth = pageWidth - 20;
                                                        const rectHeight = 13;

                                                        // Set background color and border for the rectangle
                                                        doc.setFillColor(67, 133, 246);
                                                        doc.setDrawColor(46, 93, 172);
                                                        doc.setLineWidth(0.4);
                                                        doc.rect(xsPosition, newYPosition + 10, fullWidth, rectHeight, 'FD');


                                                        // doc.setFont('TimesNewRoman', 'bold');
                                                        doc.setFont('TimesNewRomanBold');
                                                        doc.setFontSize(11);
                                                        const getHeadingFromJson = (jsonString) => {
                                                            if (!jsonString) return null;

                                                            try {
                                                                // ✅ Clean string (important)
                                                                const cleaned = jsonString
                                                                    .replace(/\n/g, '')       // remove new lines
                                                                    .replace(/\r/g, '')
                                                                    .trim();

                                                                const parsed = JSON.parse(cleaned);

                                                                return parsed?.heading || null;
                                                            } catch (err) {
                                                                console.log("❌ JSON Parse Error:", err, jsonString);
                                                                return null;
                                                            }
                                                        };
                                                        // Calculate the vertical center of the rectangle (center of the rectangle)
                                                        const verticalCenterY = newYPosition + (rectHeight / 2);
                                                        const getPdfColor = (color) => {
                                                            const map = {
                                                                red: [255, 0, 0],
                                                                green: [0, 128, 0],
                                                                yellow: [255, 193, 7],
                                                                orange: [255, 165, 0],
                                                                blue: [0, 0, 255],
                                                                pink: [255, 105, 180],
                                                                gray: [128, 128, 128],
                                                                black: [0, 0, 0],
                                                            };

                                                            return map[color] || [0, 0, 0];
                                                        };
                                                        // Calculate the horizontal center of the page (center of the page)
                                                        const horizontalCenterX = pageWidth / 2;

                                                        // Add text with proper centering
                                                        doc.text(SummaryTitle, horizontalCenterX, verticalCenterY + 10, { align: 'center', baseline: 'middle' });
                                                        console.log("servicesData for table:", servicesData);
                                                        const marginTop = 8;
                                                        const nextContentYPosition = newYPosition + rectHeight + marginTop;
                                                        doc.setFont('TimesNewRoman');

                                                        doc.autoTable({
                                                            head: [
                                                                [
                                                                    {
                                                                        content: 'SCOPE OF SERVICES / COMPONENT',
                                                                        styles: {
                                                                            halign: 'left',
                                                                            valign: 'middle',
                                                                            fontStyle: 'bold',
                                                                            font: "TimesNewRomanBold",
                                                                            whiteSpace: 'nowrap',
                                                                            cellWidth: 'auto'
                                                                        }
                                                                    },
                                                                    {
                                                                        content: 'INFORMATION VERIFIED BY',
                                                                        styles: {
                                                                            halign: 'left',
                                                                            valign: 'middle',
                                                                            fontStyle: 'bold',
                                                                            font: "TimesNewRomanBold",
                                                                            whiteSpace: 'nowrap',
                                                                            cellWidth: 'auto'
                                                                        }
                                                                    },
                                                                    {
                                                                        content: 'VERIFIED DATE',
                                                                        styles: {
                                                                            halign: 'center',
                                                                            valign: 'middle',
                                                                            font: "TimesNewRomanBold",
                                                                            fontStyle: 'bold',
                                                                            whiteSpace: 'nowrap',
                                                                            cellWidth: 'auto'
                                                                        }
                                                                    },
                                                                    {
                                                                        content: 'VERIFICATION STATUS'.toUpperCase(),
                                                                        styles: {
                                                                            halign: 'center',
                                                                            valign: 'middle',
                                                                            font: "TimesNewRomanBold",
                                                                            fontStyle: 'bold',
                                                                            whiteSpace: 'nowrap',
                                                                            cellWidth: 'auto'
                                                                        }
                                                                    },
                                                                ]
                                                            ],
                                                            body: servicesData
                                                                // .filter(service => service?.annexureData?.status) // Filter out rows with no status
                                                                .map(service => {
                                                                    const colorMapping = {
                                                                        Yellow: 'yellow',
                                                                        Red: 'red',
                                                                        Blue: 'blue',
                                                                        Green: 'green',
                                                                        Orange: 'orange',
                                                                        Pink: 'pink',
                                                                    };
                                                                    const annexure = Array.isArray(service?.annexureData)
                                                                        ? service.annexureData[0]
                                                                        : service?.annexureData;
                                                                    const serviceTypeRaw =
                                                                        service?.service_type ||
                                                                        (service?.valuePitchStatus ? "valuepitch" : "");
                                                                    const serviceTypes = serviceTypeRaw
                                                                        .split(',')
                                                                        .map(s => s.trim().toLowerCase());
                                                                    let rawStatus = "Not Verified";
                                                                    console.log('myservicetyoe is = serviceTypes', serviceTypes)
                                                                    console.log('myservicetyoe of service', service)

                                                                    // const serviceType = service?.service_type || "";
                                                                    // const serviceTypes = serviceType.split(',').map(s => s.trim().toLowerCase())
                                                                    // ================= VALUEPITCH =================
                                                                    if (serviceTypes.includes("valuepitch")) {
                                                                        const vpStatus = service?.valuePitchStatus;
                                                                        const vpReport = service?.valuePitchReport;

                                                                        if (
                                                                            vpStatus?.statusCode === 201 &&
                                                                            vpStatus?.statusMsg?.toLowerCase().includes("ready") &&
                                                                            vpReport?.report
                                                                        ) {
                                                                            rawStatus = vpReport.report; // ✅ GREEN / RED
                                                                        } else {
                                                                            rawStatus = "Managed By ValuePitch API";
                                                                        }
                                                                    }
                                                                    if (serviceTypes.includes("surepass")) {
                                                                        const sp = getSurepassStatus(service);
                                                                        rawStatus = sp.label;  // ✅ don't return early
                                                                    }
                                                                    // ================= DEFAULT =================
                                                                    else if (annexure?.status) {
                                                                        rawStatus = annexure.status;
                                                                    }
                                                                    console.log("Raw status for service:", service);
                                                                    // Convert raw status to readable text
                                                                    let statusContent = rawStatus
                                                                        .replace(/_/g, ' ') // Replace underscores with spaces
                                                                        .replace(/[^a-zA-Z0-9 ]/g, '') // Remove special characters
                                                                        .replace(/\b\w/g, char => char.toUpperCase()) // Capitalize words
                                                                        .trim();

                                                                    if (!statusContent || statusContent.toLowerCase() === 'nil') {
                                                                        return null; // Skip this row
                                                                    }

                                                                    // Default display
                                                                    let displayText = statusContent;
                                                                    let textColorr = 'black';

                                                                    // Find and extract color from status
                                                                    for (let color in colorMapping) {
                                                                        if (statusContent.toLowerCase().includes(color.toLowerCase())) {
                                                                            displayText = color.toUpperCase(); // Show only the color name
                                                                            textColorr = colorMapping[color];  // Set corresponding color
                                                                            break; // Stop after first match
                                                                        }
                                                                    }

                                                                    return [
                                                                        {
                                                                            content: getHeadingFromJson(service?.reportFormJson?.json) || "N/A",
                                                                            styles: {
                                                                                halign: 'left',
                                                                            },
                                                                        },
                                                                        {
                                                                            content: (() => {
                                                                                const serviceTypeRaw =
                                                                                    service?.service_type ||
                                                                                    (service?.valuePitchStatus ? "valuepitch" : "");
                                                                                const serviceTypes = serviceTypeRaw
                                                                                    .split(',')
                                                                                    .map(s => s.trim().toLowerCase());

                                                                                // ================= VALUEPITCH =================
                                                                                if (serviceTypes.includes("valuepitch")) {

                                                                                    const vpReport = service?.valuePitchReport;

                                                                                    if (vpReport?.job_name) {
                                                                                        return vpReport.job_name
                                                                                            .split(":")[0]                // remove time
                                                                                            .replace(/_/g, ' ')          // underscores → spaces
                                                                                            .replace(/\b\w/g, c => c.toUpperCase());
                                                                                    }
                                                                                    return "Managed By ValuePitch API";
                                                                                }


                                                                                // ================= DEFAULT =================
                                                                                const annexure = Array.isArray(service?.annexureData)
                                                                                    ? service.annexureData[0]
                                                                                    : service?.annexureData;

                                                                                if (annexure) {
                                                                                    const key = Object.keys(annexure).find(
                                                                                        key =>
                                                                                            key.endsWith('info_source') ||
                                                                                            key.endsWith('information_source') ||
                                                                                            key.startsWith('info_source') ||
                                                                                            key.startsWith('information_source')
                                                                                    );
                                                                                    return key ? annexure[key] : "N/A";
                                                                                }

                                                                                return "N/A";
                                                                            })(),
                                                                        },
                                                                        {
                                                                            content: (() => {
                                                                                const serviceTypeRaw =
                                                                                    service?.service_type ||
                                                                                    (service?.valuePitchStatus ? "valuepitch" : "");
                                                                                const serviceTypes = serviceTypeRaw
                                                                                    .split(',')
                                                                                    .map(s => s.trim().toLowerCase());

                                                                                const formatDate = (dateStr) => {
                                                                                    const date = new Date(dateStr);
                                                                                    if (isNaN(date)) return "N/A";
                                                                                    return date.toLocaleDateString('en-GB').replace(/\//g, '-');
                                                                                };

                                                                                // ================= VALUEPITCH =================
                                                                                if (serviceTypes.includes("valuepitch")) {
                                                                                    const vpReport = service?.valuePitchReport;

                                                                                    if (vpReport?.dateOfVerification) {
                                                                                        return formatDate(vpReport.dateOfVerification);
                                                                                    }

                                                                                    return "N/A";
                                                                                }

                                                                                // ================= DEFAULT =================
                                                                                const annexure = Array.isArray(service?.annexureData)
                                                                                    ? service.annexureData[0]
                                                                                    : service?.annexureData || {};

                                                                                const matchKey = Object.keys(annexure).find(key =>
                                                                                    key.includes('date_of_verification')
                                                                                );

                                                                                if (matchKey && annexure[matchKey]) {
                                                                                    return formatDate(annexure[matchKey]);
                                                                                }

                                                                                return "N/A";
                                                                            })(),
                                                                            styles: {
                                                                                fontWeight: 'bold',
                                                                                fontStyle: 'normal',
                                                                            },
                                                                        },
                                                                        {
                                                                            content: (() => {
                                                                                const serviceType = service?.service_type || "";
                                                                                const serviceTypes = serviceType.split(',').map(s => s.trim().toLowerCase());

                                                                                // ================= VALUEPITCH =================
                                                                                if (serviceTypes.includes("valuepitch")) {
                                                                                    const vpStatus = service?.valuePitchStatus;
                                                                                    const vpReport = service?.valuePitchReport;

                                                                                    // ✅ Report Ready
                                                                                    if (
                                                                                        vpStatus?.statusCode === 201 &&
                                                                                        vpStatus?.statusMsg?.toLowerCase().includes("ready") &&
                                                                                        vpReport?.report
                                                                                    ) {
                                                                                        return vpReport.report.toUpperCase(); // GREEN / RED etc.
                                                                                    }

                                                                                    // ❌ Not Ready
                                                                                    return "MANAGED BY VALUEPITCH API";
                                                                                }

                                                                                // ================= SUREPASS =================
                                                                                if (serviceTypes.includes("surepass")) {
                                                                                    const sp = getSurepassStatus(service);
                                                                                    return sp.label;
                                                                                }

                                                                                // ================= DEFAULT =================
                                                                                return formatStatus(displayText).toUpperCase();
                                                                            })(),
                                                                            styles: {
                                                                                fontStyle: 'bold',
                                                                                font: 'TimesNewRomanBold',
                                                                                textColor: (() => {
                                                                                    const serviceType = service?.service_type || "";
                                                                                    const serviceTypes = serviceType.split(',').map(s => s.trim().toLowerCase());

                                                                                    // ================= VALUEPITCH =================
                                                                                    if (serviceTypes.includes("valuepitch")) {
                                                                                        const vpStatus = service?.valuePitchStatus;
                                                                                        const vpReport = service?.valuePitchReport;

                                                                                        if (
                                                                                            vpStatus?.statusCode === 201 &&
                                                                                            vpStatus?.statusMsg?.toLowerCase().includes("ready") &&
                                                                                            vpReport?.report
                                                                                        ) {
                                                                                            const color = vpReport.report.toLowerCase();

                                                                                            const colorMapping = {
                                                                                                green: 'green',
                                                                                                red: 'red',
                                                                                                yellow: 'yellow',
                                                                                                orange: 'orange',
                                                                                                pink: 'pink',
                                                                                                blue: 'blue',
                                                                                            };

                                                                                            return colorMapping[color] || 'black';
                                                                                        }

                                                                                        return 'black';
                                                                                    }

                                                                                    // ================= SUREPASS =================
                                                                                    if (serviceTypes.includes("surepass")) {
                                                                                        const sp = getSurepassStatus(service);
                                                                                        return getPdfColor(sp.color); // ✅ RGB color
                                                                                    }

                                                                                    // ================= DEFAULT =================
                                                                                    return textColorr;
                                                                                })(),
                                                                            },
                                                                        },
                                                                    ];
                                                                })
                                                                .filter(Boolean), // Remove null entries from the map result

                                                            startY: nextContentYPosition + 10,
                                                            styles: {
                                                                fontSize: 9,
                                                                font: "TimesNewRoman",
                                                                cellPadding: 2,
                                                                halign: 'center',
                                                                valign: 'middle',
                                                                lineWidth: 0.2,
                                                                lineColor: [67, 133, 246],
                                                                textColor: [0, 0, 0],
                                                            },
                                                            theme: 'grid',
                                                            headStyles: {
                                                                textColor: [0, 0, 0],
                                                                fontStyle: 'bold',
                                                                fillColor: null,
                                                                font: "TimesNewRoman",
                                                                halign: 'center',
                                                                valign: 'middle',
                                                            },
                                                            tableLineColor: [67, 133, 246],
                                                            tableLineWidth: 0.2,
                                                            font: "TimesNewRoman",
                                                            textColor: [0, 0, 0],
                                                            margin: { left: 10, right: 10, bottom: 25, },
                                                            tableWidth: 'auto',
                                                            columnStyles: {
                                                                0: { cellWidth: 'auto', halign: 'center' },
                                                                1: { cellWidth: 'auto', halign: 'center' },
                                                                2: { cellWidth: 'auto', halign: 'center' },
                                                                3: { cellWidth: 'auto', halign: 'center' },
                                                            },
                                                        });



                                                        addFooter(doc);


                                                        yPosition = 10;
                                                        let annexureIndex = 1;

                                                        function changeLabel(label, generate_report_type) {

                                                            if (generate_report_type !== 'VENDOR CONFIDENTIAL SCREENING REPORT') {
                                                                return label;
                                                            }

                                                            const labelChangeAsPerVendorOrBGV = {
                                                                "name of the applicant:": "Name of the Organization:",
                                                                "date of birth:": "Date of Incorporation:",
                                                                "applicant details": "ORGANISATION DETAILS"
                                                            };

                                                            if (label && typeof label === "string" && label.trim() !== "") {
                                                                const lowerLabel = label.trim().toLowerCase();
                                                                if (labelChangeAsPerVendorOrBGV.hasOwnProperty(lowerLabel)) {
                                                                    return labelChangeAsPerVendorOrBGV[lowerLabel];
                                                                }
                                                            }
                                                            return label;
                                                        }

                                                        for (const service of servicesData) {
                                                            let yPosition = 10; // Reset yPosition to the top margin

                                                            const reportFormJson = service?.reportFormJson?.json
                                                                ? JSON.parse(service.reportFormJson.json)
                                                                : null;
                                                            // console.log('reportFormJson', reportFormJson)
                                                            const headingText = reportFormJson?.heading.toUpperCase() || null;
                                                            const Myheaders = reportFormJson?.headers || null;
                                                            const rows = reportFormJson?.rows || [];
                                                            console.log('Myheaders', Myheaders);
                                                            const serviceData = [];
                                                            if (service?.annexureData?.status !== 'nil') {
                                                                if (headingText) {
                                                                    // console.log('headingText',headingText)
                                                                    doc.addPage();
                                                                    addFooter(doc);

                                                                    rows.forEach((row) => {
                                                                        const inputLabel = row.label || "";
                                                                        const valuesObj = {};
                                                                        console.log('inputLabel', inputLabel);
                                                                        row.inputs.forEach((input) => {
                                                                            const inputName = input.name;
                                                                            let verifiedInputName = `verified_${inputName}`;

                                                                            verifiedInputName = verifiedInputName.replace("verified_verified_", "verified_");

                                                                            const value = service?.annexureData?.[inputName] || "";
                                                                            const verifiedValue = service?.annexureData?.[verifiedInputName] || "";

                                                                            valuesObj[inputName] = value;
                                                                            valuesObj["isVerifiedExist"] = !!verifiedValue;
                                                                            if (verifiedValue) valuesObj[verifiedInputName] = verifiedValue;

                                                                            valuesObj["name"] = inputName.replace("verified_", "");
                                                                        });

                                                                        serviceData.push({
                                                                            label: inputLabel,
                                                                            values: valuesObj,
                                                                        });
                                                                    });
                                                                    const serviceTypeRaw =
                                                                        service?.service_type ||
                                                                        (service?.valuePitchStatus ? "valuepitch" : "");
                                                                    const serviceTypes = serviceTypeRaw
                                                                        .split(',')
                                                                        .map(s => s.trim().toLowerCase());

                                                                    let tableData = [];
                                                                    if (serviceTypes.includes("valuepitch")) {
                                                                        const vpStatus = service?.valuePitchStatus;

                                                                        // ✅ Report Ready
                                                                        if (
                                                                            vpStatus?.statusCode === 201 &&
                                                                            vpStatus?.statusMsg?.toLowerCase().includes("ready")
                                                                        ) {
                                                                            const vpReport = service?.valuePitchReport || {};
                                                                            console.log('vpReport', vpReport)
                                                                            tableData = [
                                                                                ["Name", vpReport?.name || "N/A"],
                                                                                ["Report", vpReport?.report || "N/A"],
                                                                                ["Address", vpReport?.addresses?.[0]?.address || "N/A"],
                                                                                ["Date Of Verification",
                                                                                    vpReport?.dateOfVerification
                                                                                        ? new Date(vpReport.dateOfVerification)
                                                                                            .toLocaleDateString('en-GB')
                                                                                            .replace(/\//g, '-')
                                                                                        : "N/A"
                                                                                ],
                                                                                ["Report URL", vpReport?.reportUrl || "N/A"],
                                                                            ];
                                                                        }

                                                                        // ❌ Report Not Ready
                                                                        else if (vpStatus?.statusMsg) {
                                                                            tableData = [
                                                                                [vpStatus.statusMsg]
                                                                            ];
                                                                        }
                                                                    }

                                                                    // ================= SUREPASS =================
                                                                    // ================= SUREPASS =================
                                                                    else if (serviceTypes.includes("surepass")) {
                                                                        const sp = service?.screeningstar_response;

                                                                        if (!sp || !sp.is_prefilled) {
                                                                            tableData = [
                                                                                ["Status", "Managed by Surepass API"]
                                                                            ];
                                                                        } else {
                                                                            const res = sp.response_json || {};
                                                                            const req = sp.request_json || {};

                                                                            // 🔥 STATUS
                                                                            const getStatus = () => {
                                                                                if (res?.success === true || res?.status_code === 200) return "SUCCESS";
                                                                                if (res?.status_code >= 500) return "SERVER ERROR";
                                                                                if (res?.errors || res?.success === false) return "FAILED";
                                                                                return "PENDING";
                                                                            };

                                                                            const formatKey = (key) =>
                                                                                key?.replace(/_/g, " ")
                                                                                    ?.replace(/\b\w/g, c => c.toUpperCase());

                                                                            const cleanValue = (value) => {
                                                                                if (value === null || value === undefined) return "N/A";
                                                                                if (typeof value === "boolean") return value ? "Yes" : "No";
                                                                                return value.toString();
                                                                            };

                                                                            const cleanText = (text) => {
                                                                                return String(text)
                                                                                    .replace(/[^\x00-\x7F]/g, "")
                                                                                    .replace(/\s+/g, " ")
                                                                                    .trim();
                                                                            };

                                                                            // 🔥 RECURSIVE FUNCTION
                                                                            const buildRows = (obj) => {
                                                                                let rows = [];

                                                                                Object.entries(obj).forEach(([key, value]) => {
                                                                                    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                                                                                        // ✅ FIX: section header → only ONE column
                                                                                        rows.push([formatKey(key)]);
                                                                                        rows = rows.concat(buildRows(value));
                                                                                    }
                                                                                    else if (Array.isArray(value)) {
                                                                                        value.forEach((item, idx) => {
                                                                                            if (typeof item === "object") {
                                                                                                rows = rows.concat(buildRows(item));
                                                                                            } else {
                                                                                                rows.push([`${formatKey(key)} ${idx + 1}`, cleanValue(item)]);
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                    else {
                                                                                        rows.push([cleanText(formatKey(key)), cleanValue(value)]);
                                                                                    }
                                                                                });

                                                                                return rows;
                                                                            };

                                                                            // ================= BUILD TABLE =================
                                                                            tableData = [
                                                                                ["Status", getStatus()],
                                                                            ];

                                                                            if (res?.message) {
                                                                                tableData.push(["Message", res.message]);
                                                                            }

                                                                            if (res?.message_code) {
                                                                                tableData.push(["Code", formatKey(res.message_code)]);
                                                                            }

                                                                            // 🔥 REQUEST DATA
                                                                            tableData.push(["Request Data"]); // ✅ FIXED
                                                                            tableData = tableData.concat(buildRows(req));

                                                                            // 🔥 RESPONSE DATA
                                                                            if (res && Object.keys(res).length) {
                                                                                tableData.push(["Response Data"]); // ✅ FIXED
                                                                                tableData = tableData.concat(buildRows(res));
                                                                            }

                                                                            // ❌ ERRORS
                                                                            if (res?.errors) {
                                                                                tableData.push(["Errors"]); // ✅ FIXED
                                                                                tableData = tableData.concat(buildRows(res.errors));
                                                                            }
                                                                        }
                                                                    }

                                                                    // ================= DEFAULT =================
                                                                    else {
                                                                        tableData = serviceData
                                                                            .map((data, index) => {

                                                                                if (!data || !data.values) {
                                                                                    console.log("Skipped: data or data.values is missing");
                                                                                    return null;
                                                                                }

                                                                                const name = data.values.name;
                                                                                // console.log("Extracted name:", name);

                                                                                if (!name || name.startsWith("annexure")) {
                                                                                    console.log("Skipped: name is invalid or starts with 'annexure'");
                                                                                    return null;
                                                                                }

                                                                                const isVerifiedExist = data.values.isVerifiedExist;
                                                                                const rawValue = data.values[name];
                                                                                const verified = data.values[`verified_${name}`];

                                                                                // fallback: if rawValue is undefined but verified is present, use verified as value

                                                                                const finalValue = rawValue !== undefined ? rawValue : verified;

                                                                                if (name == 'additional_fee_police_verification_pa') {

                                                                                }

                                                                                const formatDate = (dateStr) => {
                                                                                    const date = new Date(dateStr);
                                                                                    if (isNaN(date)) {
                                                                                        console.log("Invalid date string:", dateStr);
                                                                                        return dateStr;
                                                                                    }
                                                                                    const day = String(date.getDate()).padStart(2, '0');
                                                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                                                    const year = date.getFullYear();
                                                                                    const formatted = `${day}-${month}-${year}`;
                                                                                    console.log("Formatted date:", formatted);
                                                                                    return formatted;
                                                                                };

                                                                                const formattedValue =
                                                                                    typeof finalValue === 'string' && finalValue.match(/^\d{4}-\d{2}-\d{2}$/)
                                                                                        ? formatDate(finalValue)
                                                                                        : finalValue;

                                                                                const formattedVerified =
                                                                                    typeof verified === 'string' && verified.match(/^\d{4}-\d{2}-\d{2}$/)
                                                                                        ? formatDate(verified)
                                                                                        : verified;

                                                                                const result = formattedVerified
                                                                                    ? [data.label, formattedValue, formattedVerified]
                                                                                    : [data.label, formattedValue];

                                                                                console.log("Mapped result:", result);

                                                                                return result;
                                                                            })
                                                                            .filter((item) => item !== null);
                                                                    }

                                                                    if (tableData.length > 0) {

                                                                        const pageWidth = doc.internal.pageSize.width;
                                                                        const backgroundColor = "#f5f5f5";
                                                                        const borderColor = "#3d75a6";
                                                                        const xsPosition = 10;
                                                                        const rectHeight = 8;

                                                                        doc.setLineWidth(0.2); // Set border thickness to 0.2
                                                                        doc.setFillColor(67, 133, 246);
                                                                        doc.setTextColor(255);
                                                                        doc.setDrawColor(46, 93, 172);

                                                                        doc.rect(xsPosition, yPosition, pageWidth - 20, rectHeight, "FD");

                                                                        doc.setFontSize(10);
                                                                        doc.setFont('TimesNewRomanBold')

                                                                        const textHeight = doc.getTextDimensions(headingText).h + 1;
                                                                        const verticalCenter = yPosition + rectHeight / 2 + textHeight / 4;

                                                                        doc.text(headingText, pageWidth / 2, verticalCenter, { align: "center" });

                                                                        yPosition += rectHeight;
                                                                        const colorMap = {
                                                                            red: [255, 0, 0],
                                                                            green: [0, 128, 0],
                                                                            blue: [0, 0, 255],
                                                                            yellow: [255, 255, 0],
                                                                            black: [0, 0, 0],
                                                                            white: [255, 255, 255],
                                                                            orange: [255, 165, 0],
                                                                            purple: [128, 0, 128],
                                                                            pink: [255, 192, 203],
                                                                            gray: [128, 128, 128]
                                                                        };

                                                                        const dynamicHead = Myheaders.map(header => ({
                                                                            content: changeLabel(header, generate_report_type),
                                                                            styles: { halign: "left", fontStyle: "bold" }
                                                                        }));
                                                                        const isTwoColumnBody = dynamicHead.length < 3;

                                                                        doc.autoTable({
                                                                            head: [dynamicHead],
                                                                            body: tableData
                                                                                .map((row) => {
                                                                                    if (!row || typeof row[0] !== 'string') return null;
                                                                                    if (row.length === 1) {
                                                                                        return [
                                                                                            {
                                                                                                content: row[0],
                                                                                                colSpan: isTwoColumnBody ? 2 : 3,
                                                                                                styles: {
                                                                                                    halign: "center",
                                                                                                    fontStyle: "bold"
                                                                                                }
                                                                                            }
                                                                                        ];
                                                                                    }
                                                                                    const cell = row[0].toLowerCase();
                                                                                    if (cell.includes('addition') && cell.includes('fee')) return null;

                                                                                    const isColourCodeRow = row[0] === "Colour Code:";

                                                                                    if (isTwoColumnBody) {
                                                                                        // Use only 2 columns in body
                                                                                        if (row.length === 1) {
                                                                                            return [
                                                                                                {
                                                                                                    content: changeLabel(row[0], generate_report_type),
                                                                                                    colSpan: 2,
                                                                                                    styles: { halign: "center", fontStyle: "bold" }
                                                                                                }
                                                                                            ];
                                                                                        }
                                                                                        return [
                                                                                            { content: changeLabel(row[0], generate_report_type), styles: { halign: "left", fontStyle: "bold" } },
                                                                                            {
                                                                                                content: isColourCodeRow ? formatContent(row[1]).toUpperCase() : formatContent(row[1]),
                                                                                                styles: isColourCodeRow ? { ...getStyle(row[1], isColourCodeRow) } : {}
                                                                                            }
                                                                                        ];
                                                                                    } else {
                                                                                        // Normal 3-column body
                                                                                        if (row.length === 1) {
                                                                                            return [
                                                                                                {
                                                                                                    content: changeLabel(row[0], generate_report_type),
                                                                                                    colSpan: 3,
                                                                                                    styles: { halign: "center", fontStyle: "bold" }
                                                                                                }
                                                                                            ];
                                                                                        }
                                                                                        return row.length === 2
                                                                                            ? [
                                                                                                { content: changeLabel(row[0], generate_report_type), styles: { halign: "left", fontStyle: "bold" } },
                                                                                                {
                                                                                                    content: isColourCodeRow ? formatContent(row[1]).toUpperCase() : formatContent(row[1]),
                                                                                                    colSpan: 2,
                                                                                                    styles: isColourCodeRow ? { ...getStyle(row[1], isColourCodeRow) } : {}
                                                                                                }
                                                                                            ]
                                                                                            : [
                                                                                                { content: changeLabel(row[0], generate_report_type), styles: { halign: "left", fontStyle: "bold" } },
                                                                                                {
                                                                                                    content: isColourCodeRow ? formatContent(row[1]).toUpperCase() : formatContent(row[1]),
                                                                                                    styles: isColourCodeRow ? { ...getStyle(row[1], isColourCodeRow) } : {}
                                                                                                },
                                                                                                {
                                                                                                    content: isColourCodeRow ? formatContent(row[2]).toUpperCase() : formatContent(row[2]),
                                                                                                    styles: isColourCodeRow ? { ...getStyle(row[2], isColourCodeRow) } : {}
                                                                                                }
                                                                                            ];
                                                                                    }
                                                                                })
                                                                                .filter(row => row !== null),
                                                                            startY: yPosition,
                                                                            styles: {
                                                                                font: 'times',
                                                                                fontSize: 10,
                                                                                cellPadding: 2,
                                                                                lineWidth: 0.2,
                                                                                lineColor: [67, 133, 246]
                                                                            },
                                                                            columnStyles: isTwoColumnBody
                                                                                ? {
                                                                                    0: { cellWidth: 65 },
                                                                                    1: { cellWidth: 'auto' }  // second column expands
                                                                                }
                                                                                : {
                                                                                    0: { cellWidth: 65 },
                                                                                    1: { cellWidth: 'auto' },
                                                                                    2: { cellWidth: 'auto' }
                                                                                },
                                                                            theme: "grid",
                                                                            headStyles: {
                                                                                fontStyle: "bold",
                                                                                fillColor: backgroundColor,
                                                                                textColor: [0, 0, 0],
                                                                                fontSize: 10,
                                                                                halign: "left"
                                                                            },
                                                                            bodyStyles: { textColor: [0, 0, 0] },
                                                                            margin: { horizontal: 10 }

                                                                        });





                                                                        // Function to format text (uppercase & bold)
                                                                        function formatContent(text) {
                                                                            return text
                                                                        }

                                                                        // console.log('text---',text)
                                                                        function getStyle(text, isColourCodeRow) {
                                                                            // console.log(`isColourCodeRow (1):`, isColourCodeRow);  // Log the value of isColourCodeRow

                                                                            let styles = { halign: "left", fontStyle: "bold" };

                                                                            // If isColourCodeRow is false, return default styles
                                                                            if (!isColourCodeRow) {
                                                                                // console.log('Returning default styles:', styles);
                                                                                return styles;
                                                                            }

                                                                            if (!text) {
                                                                                console.log('No text provided, returning default styles:', styles);
                                                                                return styles;
                                                                            }

                                                                            // console.log('text to check color map:', text);  // Log the text for debugging the color match

                                                                            // Iterate through the colorMap to find a matching color
                                                                            Object.keys(colorMap).forEach(color => {
                                                                                // console.log(`Checking if text contains color: ${color}`);  // Log each color being checked

                                                                                if (text.toLowerCase().includes(color)) {
                                                                                    console.log(`Color match found! Applying color: ${colorMap[color]}`);  // Log the color match

                                                                                    styles.textColor = colorMap[color]; // Apply color from the colorMap
                                                                                }
                                                                            });

                                                                            console.log('Returning styles:', styles);  // Log the final styles
                                                                            return styles;
                                                                        }






                                                                        yPosition = doc.lastAutoTable.finalY + 10;

                                                                        const remarksData = serviceData.find((data) => data.label === "Remarks");
                                                                        const remarks = remarksData?.values?.name;

                                                                        if (remarks) {
                                                                            doc.setFont("TimesNewRomanBold");
                                                                            doc.setFontSize(10);
                                                                            doc.setTextColor(100, 100, 100);
                                                                            doc.text(`Remarks: ${remarks}`, 10, yPosition);
                                                                            yPosition += 5;
                                                                        }


                                                                        const annexureImagesKey = Object.keys(service?.annexureData || {}).find(
                                                                            key => key.toLowerCase().startsWith('annexure') && !key.includes('[') && !key.includes(']')
                                                                        );
                                                                        const checkboxKey = Object.keys(service?.annexureData || {}).find(
                                                                            key => key.toLowerCase().startsWith('checkbox_annexure') && !key.includes('[') && !key.includes(']')
                                                                        );
                                                                        const value = service?.annexureData?.[checkboxKey];

                                                                        if (checkboxKey) {
                                                                            const value = service?.annexureData[checkboxKey]; // Get the value of the checkbox key
                                                                            if (value === true || value === 'true' || value === 1 || value === '1') {
                                                                                // console.log("This is true or 1");

                                                                                // When checkbox is true or 1, adjust image handling logic
                                                                                if (annexureImagesKey) {
                                                                                    const annexureImagesStr = service?.annexureData[annexureImagesKey];
                                                                                    const annexureImagesSplitArr = annexureImagesStr ? annexureImagesStr.split(',') : [];

                                                                                    const pageWidth = doc.internal.pageSize.width; // Define page width before loop

                                                                                    if (annexureImagesSplitArr.length === 0) {
                                                                                        doc.setFont("TimesNewRomanbold");
                                                                                        doc.setFontSize(10);
                                                                                        doc.text("No annexure images available.", pageWidth / 2, yPosition, { align: "center" });
                                                                                        yPosition += 10;
                                                                                    } else {
                                                                                        const imageBases = await fetchImageAsBase64(annexureImagesStr.trim());
                                                                                        if (imageBases) {

                                                                                            for (const [index, image] of imageBases.entries()) {
                                                                                                if (!image.base64 || !image.base64.startsWith('data:image/')) {
                                                                                                    console.error(`Invalid base64 data for image ${index + 1}`);
                                                                                                    continue;
                                                                                                }

                                                                                                try {
                                                                                                    const maxBoxWidth = doc.internal.pageSize.width - 20;
                                                                                                    const maxBoxHeight = doc.internal.pageSize.height - 50; // Adjust height to full page

                                                                                                    // If a new page is required, add it
                                                                                                    if (yPosition + maxBoxHeight > doc.internal.pageSize.height - 15) {
                                                                                                        doc.addPage();
                                                                                                        yPosition = 10;
                                                                                                    }

                                                                                                    // Centered Annexure text
                                                                                                    const text = `ANNEXURE ${index + 1}`;
                                                                                                    doc.setFont('TimesNewRomanBold');
                                                                                                    doc.setFontSize(10);
                                                                                                    doc.text(text, pageWidth / 2, yPosition, { align: "center" }); // Ensure text is always centered
                                                                                                    yPosition += 5;

                                                                                                    // Draw image box
                                                                                                    const padding = 5;
                                                                                                    doc.setDrawColor(46, 93, 172);
                                                                                                    doc.setLineWidth(0.2);
                                                                                                    doc.rect(10, yPosition, maxBoxWidth, maxBoxHeight);

                                                                                                    // Calculate image dimensions while maintaining aspect ratio
                                                                                                    const width = maxBoxWidth - 2 * padding;
                                                                                                    let height = (width * image.height) / image.width;

                                                                                                    // Ensure image does not exceed box height
                                                                                                    if (height > maxBoxHeight - 2 * padding) {
                                                                                                        height = maxBoxHeight - 2 * padding;
                                                                                                    }

                                                                                                    const centerXImage = 10 + padding;
                                                                                                    const centerYImage = yPosition + padding + (maxBoxHeight - height - 2 * padding) / 2;

                                                                                                    // Add the image
                                                                                                    doc.addImage(image.base64, image.type, centerXImage, centerYImage, width, height);

                                                                                                    // Move yPosition for next content
                                                                                                    yPosition += maxBoxHeight + 10;
                                                                                                } catch (error) {
                                                                                                    console.error(`Error adding image ${index + 1}:`, error);
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    }

                                                                                }
                                                                            } else {
                                                                                // console.log("Checkbox is not true or 1, no changes to layout");
                                                                            }
                                                                        } else {
                                                                            // console.log("No checkbox key found");
                                                                        }

                                                                        if (!checkboxKey || !value || (value !== true && value !== 'true' && value !== 1 && value !== '1')) {
                                                                            // Default handling when no checkbox is true (same as original logic for images)
                                                                            if (annexureImagesKey) {
                                                                                const annexureImagesStr = service?.annexureData[annexureImagesKey];
                                                                                const annexureImagesSplitArr = annexureImagesStr ? annexureImagesStr.split(',') : [];

                                                                                const maxBoxWidth = doc.internal.pageSize.width - 20;
                                                                                const maxBoxHeight = 120;
                                                                                const padding = 5;

                                                                                if (annexureImagesSplitArr.length === 0) {
                                                                                    doc.setFont("TimesNewRomanbold");
                                                                                    doc.setFontSize(10);
                                                                                    doc.text("No annexure images available.", pageWidth / 2, yPosition, { align: "center" });
                                                                                    yPosition += 10;
                                                                                } else {
                                                                                    const imageBases = await fetchImageAsBase64(annexureImagesStr.trim());
                                                                                    if (imageBases) {
                                                                                        for (const [index, image] of imageBases.entries()) {
                                                                                            if (!image.base64 || !image.base64.startsWith('data:image/')) {
                                                                                                console.error(`Invalid base64 data for image ${index + 1}`);
                                                                                                continue;
                                                                                            }

                                                                                            try {
                                                                                                const width = maxBoxWidth - 2 * padding;
                                                                                                const height = maxBoxHeight - 2 * padding;

                                                                                                if (yPosition + maxBoxHeight > doc.internal.pageSize.height - 15) {
                                                                                                    doc.addPage();
                                                                                                    yPosition = 10;
                                                                                                }

                                                                                                const text = `ANNEXURE ${index + 1}`;
                                                                                                doc.setFont('TimesNewRomanBold');
                                                                                                doc.setFontSize(10);
                                                                                                doc.text(text, pageWidth / 2, yPosition, { align: "center" }); // Centered text
                                                                                                yPosition += 5;

                                                                                                doc.setDrawColor(46, 93, 172);
                                                                                                doc.setLineWidth(0.2);
                                                                                                doc.rect(10, yPosition, maxBoxWidth, maxBoxHeight);

                                                                                                const centerXImage = 10 + padding + (maxBoxWidth - width - 2 * padding) / 2;
                                                                                                const centerYImage = yPosition + padding + (maxBoxHeight - height - 2 * padding) / 2;

                                                                                                doc.addImage(image.base64, image.type, centerXImage, centerYImage, width, height);

                                                                                                yPosition += maxBoxHeight + 10;
                                                                                            } catch (error) {
                                                                                                console.error(`Error adding image ${index + 1}:`, error);
                                                                                                // You may choose to show a message or skip silently
                                                                                                continue;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }

                                                                            }
                                                                            else {
                                                                                doc.setFont("TimesNewRomanbold");
                                                                                doc.setFontSize(10);
                                                                                doc.text("No annexure images available.", pageWidth / 2, yPosition, { align: "center" });
                                                                                yPosition += 10;
                                                                            }
                                                                        }
                                                                        function scaleImageForPDF(imageWidth, imageHeight, maxWidth, maxHeight) {
                                                                            let width = imageWidth;
                                                                            let height = imageHeight;

                                                                            // Scale the width if it exceeds maxWidth
                                                                            if (imageWidth > maxWidth) {
                                                                                width = maxWidth;
                                                                                height = (imageHeight * maxWidth) / imageWidth;
                                                                            }

                                                                            // Scale the height if it exceeds maxHeight
                                                                            if (height > maxHeight) {
                                                                                height = maxHeight;
                                                                                width = (imageWidth * maxHeight) / imageHeight;
                                                                            }

                                                                            return { width, height };
                                                                        }

                                                                        addFooter(doc);
                                                                    }

                                                                }
                                                            }
                                                        }

                                                        // doc.addPage();
                                                        // RGB for #F3FBFD

                                                        const disclaimerButtonWidth = doc.internal.pageSize.width - 20; // Full width minus margins
                                                        let disclaimerY = 10; // Starting position

                                                        if (disclaimerY < 20) {
                                                            doc.addPage();
                                                            doc.setFillColor(255, 255, 255);

                                                            // Draw full-page background rect (before content)
                                                            doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');


                                                            addFooter(doc);
                                                            disclaimerY = 10;
                                                        }

                                                        // Reset text color if needed
                                                        doc.setTextColor(0, 0, 0);

                                                        const disclaimerButtonHeight = 13; // Button height (without padding)

                                                        const buttonBottomPadding = 5; // Padding below the button
                                                        const disclaimerTextTopMargin = 5; // Margin from top of the disclaimer text

                                                        // Adjusted Disclaimer Button Height (includes padding)
                                                        const adjustedDisclaimerButtonHeight = disclaimerButtonHeight + buttonBottomPadding;


                                                        // Center the 'DISCLAIMER' text
                                                        const disclaimerButtonTextWidth = doc.getTextWidth('DISCLAIMER :');
                                                        const buttonTextHeight = doc.getFontSize();
                                                        const disclaimerButtonXPosition = (doc.internal.pageSize.width - disclaimerButtonWidth) / 2;
                                                        doc.setDrawColor(46, 93, 172); // Border color
                                                        doc.setFillColor(67, 133, 246); // Fill color
                                                        doc.rect(disclaimerButtonXPosition, disclaimerY, disclaimerButtonWidth, disclaimerButtonHeight, 'F'); // Fill
                                                        doc.rect(disclaimerButtonXPosition, disclaimerY, disclaimerButtonWidth, disclaimerButtonHeight, 'D'); // Border
                                                        doc.setTextColor(255);// Black text
                                                        doc.setFont('TimesNewRomanBold');

                                                        // Center the 'DISCLAIMER' text
                                                        const disclaimerTextXPosition = disclaimerButtonXPosition + disclaimerButtonWidth / 2 - disclaimerButtonTextWidth / 1.2;
                                                        const disclaimerTextYPosition = disclaimerY + disclaimerButtonHeight / 2 + buttonTextHeight / 4 - 1;
                                                        doc.setFontSize(12);
                                                        let currentY = disclaimerY + adjustedDisclaimerButtonHeight + disclaimerTextTopMargin;
                                                        doc.text('DISCLAIMER', disclaimerTextXPosition, disclaimerTextYPosition);


                                                        yPosition = disclaimerTextYPosition + 17;

                                                        doc.setFont("TimesNewRoman");
                                                        doc.setFontSize(12);
                                                        doc.setTextColor(0, 0, 0);
                                                        let startXNew = 10;

                                                        // Line 1
                                                        doc.setFont("TimesNewRoman", "normal");
                                                        // Base sentence
                                                        const baseText = "This is a computer-generated document issued by";
                                                        doc.text(baseText, startXNew, yPosition);

                                                        // Choose company name based on template
                                                        const customCompanyName = applicationInfo.custom_template === "yes"
                                                            ? applicationInfo.customer_name
                                                            : "Screeningstar Solutions Private Limited";

                                                        // Print company name after base sentence
                                                        doc.setFont("TimesNewRoman", "bold");
                                                        const baseTextWidth = doc.getTextWidth(baseText);
                                                        doc.text(customCompanyName, startXNew + baseTextWidth, yPosition);

                                                        // Print "and does not" after the full sentence
                                                        doc.setFont("TimesNewRoman", "normal");
                                                        const fullLineWidth = baseTextWidth + doc.getTextWidth(customCompanyName) + 7;
                                                        doc.text("and does not", startXNew + fullLineWidth, yPosition);


                                                        doc.setFont("TimesNewRoman", "normal");
                                                        yPosition += 6;
                                                        doc.text("require a physical or digital signature.", startXNew, yPosition);

                                                        // Line 2
                                                        yPosition += 10;
                                                        doc.text("This report is strictly for internal use by the client for purposes such as employment verification,vendor ", startXNew, yPosition);
                                                        yPosition += 5;
                                                        doc.text("assessment, or due diligence. It is not a replacement for statutory checks or legal procedures mandated", startXNew, yPosition);
                                                        yPosition += 5;
                                                        doc.text(" by government authorities.", startXNew, yPosition);

                                                        // Line 3
                                                        yPosition += 10;
                                                        doc.text("All data has been sourced from publicly accessible records, educational institutions, ex-employers, online", startXNew, yPosition);
                                                        yPosition += 5;
                                                        doc.text(" portals, verbal confirmations, and government databases such as ", startXNew, yPosition);

                                                        // Hyperlink
                                                        const linkText = "https://ecourts.gov.in";
                                                        const linkX = 9 + doc.getTextWidth("portals, verbal confirmations, and government databases such as");
                                                        doc.setTextColor(0, 0, 255);
                                                        doc.text(linkText, linkX + 2, yPosition);

                                                        // After link
                                                        doc.setTextColor(0, 0, 0);
                                                        yPosition += 5;
                                                        doc.text(" Solutions is not the originator of this data and cannot guarantee its completeness or accuracy.", startXNew, yPosition);

                                                        // "as is, where is"
                                                        yPosition += 10;
                                                        doc.setFont("TimesNewRoman", "normal");
                                                        doc.text("While all efforts are made to ensure accuracy, this report is provided on an ", startXNew, yPosition);
                                                        doc.setFont("TimesNewRoman", "bold");
                                                        const boldX = startXNew + doc.getTextWidth("While all efforts are made to ensure accuracy, this report is provided on an");
                                                        doc.text("“as is, where is”", boldX, yPosition);
                                                        doc.setFont("TimesNewRoman", "normal");
                                                        yPosition += 5;
                                                        doc.text("basis. Final responsibility for decisions based on this report rests solely with the client.", startXNew, yPosition);

                                                        // PAN & Aadhaar section
                                                        yPosition += 10;
                                                        doc.text("All verification checks are conducted with proper authorization from the individual or with written approval", startXNew, yPosition);
                                                        yPosition += 5;
                                                        doc.text(" from the client where applicable. PAN and Aadhaar checks are conducted through authorized system ", startXNew, yPosition);
                                                        yPosition += 5;
                                                        doc.text("integrations; screenshots may not always be available.", startXNew, yPosition);

                                                        // Confidential + IT Act
                                                        yPosition += 10;
                                                        doc.setFont("TimesNewRoman", "normal");
                                                        doc.text("The content of this report is ", startXNew, yPosition);

                                                        doc.setFont("TimesNewRoman", "bold");
                                                        const confidentialX = startXNew + doc.getTextWidth("The content of this report is ");
                                                        doc.text("confidential", confidentialX, yPosition);

                                                        doc.setFont("TimesNewRoman", "normal");
                                                        const confidentialAfterX = startXNew + doc.getTextWidth("The content of this report is confidential ") + 4;

                                                        doc.text("and must be stored securely in compliance with data privacy ,", confidentialAfterX, yPosition);

                                                        yPosition += 5;
                                                        doc.text("regulations including the ", startXNew, yPosition);

                                                        doc.setFont("TimesNewRoman", "bold");
                                                        const itActX = startXNew + doc.getTextWidth("regulations including the ");
                                                        doc.text("IT Act 2000.", itActX, yPosition);

                                                        const newXPosition = startXNew + doc.getTextWidth("regulations including the IT Act 2000. ");
                                                        doc.setFont("TimesNewRoman", "normal");

                                                        doc.text("Misuse, redistribution, or unauthorized  disclosure of ", newXPosition, yPosition);
                                                        yPosition += 5;
                                                        doc.text("this report is strictly prohibited. ", startXNew, yPosition);

                                                        yPosition += 8;
                                                        doc.text("For queries or customizations, please contact:", startXNew, yPosition);
                                                        // Example: disclaimer_emails = ["email1@example.com", "email2@example.com"]
                                                        let disclaimer_emails = [];
                                                        function validateEmail(email) {
                                                            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                                            return re.test(email);
                                                        }

                                                        if (applicationInfo.custom_template === "yes") {
                                                            if (applicationInfo.disclaimer_emails && typeof applicationInfo.disclaimer_emails === "string") {
                                                                disclaimer_emails = applicationInfo.disclaimer_emails
                                                                    .split(",")                              // Split by comma
                                                                    .map(email => email.trim())              // Trim each email
                                                                    .filter(email => validateEmail(email));  // Keep only valid emails
                                                            } else {
                                                                disclaimer_emails = []; // Or a default list if needed
                                                            }
                                                        } else {
                                                            disclaimer_emails = [
                                                                "compliance@screeningstar.com",
                                                                "bgv@screeningstar.com"
                                                            ];
                                                        }

                                                        yPosition += 10;
                                                        let currentDisclaimerX = startXNew;

                                                        disclaimer_emails.forEach((email, index) => {
                                                            // Show icon before the second email (index === 1)
                                                            if (index === 0 && emailIconGreen) {
                                                                doc.addImage(emailIconGreen, 'PNG', currentDisclaimerX, yPosition - 4, 5, 5);
                                                                currentDisclaimerX += 7; // Add space after the icon
                                                            }

                                                            // Add separator before emails with index > 0
                                                            if (index > 0) {
                                                                const separator = " | ";
                                                                doc.setTextColor(0, 0, 255);
                                                                doc.text(separator, currentDisclaimerX, yPosition);
                                                                currentDisclaimerX += doc.getTextWidth(separator);
                                                            }

                                                            // Draw the email text
                                                            doc.setTextColor(0, 0, 255);
                                                            doc.text(email, currentDisclaimerX, yPosition);
                                                            currentDisclaimerX += doc.getTextWidth(email + " ");
                                                        });

                                                        // Reset color after emails
                                                        doc.setTextColor(0, 0, 0);

                                                        // Update Company Details Y (aligned with the same paragraph block)
                                                        let companyDetailsY = yPosition + disclaimerTextTopMargin - 4;
                                                        let endOfDetailY = companyDetailsY + 10;
                                                        const sealImage = riskFreeTarget;
                                                        const imgWidth = 40;
                                                        const imgHeight = 40;
                                                        const centerXNew = (pageWidth - imgWidth) / 2;

                                                        // doc.addImage(sealImage, "PNG", centerXNew, endOfDetailY, imgWidth, imgHeight);

                                                        if (endOfDetailY + disclaimerButtonHeight > doc.internal.pageSize.height - 20) {
                                                            doc.addPage();
                                                            endOfDetailY = 20;
                                                        }


                                                        // Ensure footer is added
                                                        addFooter(doc);

                                                        const sanitizeFilename = (str) => {
                                                            return str
                                                                .replace(/[\/\\?%*:|"<> ().]/g, '-') // replace invalid characters, including dot & parentheses
                                                                .replace(/-+/g, '-')                 // replace multiple hyphens with a single one
                                                                .replace(/^-|-$/g, '');              // remove starting/ending hyphens
                                                        };

                                                        const newPdfFileName = sanitizeFilename(`${applicationInfo?.application_id || 'NA'}-${applicationInfo.name || 'NA'}-${applicationInfo.employee_id || 'NA'}-${applicationInfo.report_type === 'interim_report' ? 'INTERIM_REPORT' : applicationInfo.report_type === 'final_report' ? 'FINAL_REPORT' : 'UNKNOWN_REPORT'}`) + '.pdf';
                                                        console.log(newPdfFileName)
                                                        const pdfPathCloud = await savePdf(
                                                            doc,
                                                            newPdfFileName,
                                                            targetDirectory
                                                        );

                                                        // doc.save('pdfPath.pdf');
                                                        console.log(`pdfPath`);
                                                        // resolve(`pdfPath`);

                                                        resolve(pdfPathCloud);
                                                    } catch (error) {
                                                        console.error("PDF generation error:", error);
                                                        reject(new Error("Error generating PDF"));
                                                    }
                                                });
                                            }
                                        }
                                    }
                                }
                            );
                        });
                }
            );
        });
    },
};
