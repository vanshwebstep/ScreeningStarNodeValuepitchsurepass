const CandidateMasterTrackerModel = require("../models/admin/candidateMasterTrackerModel");
const Admin = require("../models/admin/adminModel");
const Branch = require("../models/customer/branch/branchModel");
const CEF = require("../models/customer/branch/cefModel");
const Customer = require("../models/customer/customerModel");
const AppModel = require("../models/appModel");
const { jsPDF } = require("jspdf");
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

const LogoBgv = path.join(__dirname, '../../Images/LogoBgv.jpg');

/**
 * Checks if an image exists by making a HEAD request.
 * @param {string} url - Image URL.
 * @returns {Promise<boolean>} - True if image exists, otherwise false.
 */
async function checkImageExists(url) {
    try {
        const response = await axios.head(url);
        return response.status >= 200 && response.status < 300;
    } catch (error) {
        // console.error(`❌ Error checking image existence: ${url}`, error.message);
        return false;
    }
}

/**
 * Validates the image and retrieves metadata.
 * @param {string} url - Image URL.
 * @returns {Promise<Object|null>} - Image metadata or null if invalid.
 */
async function validateImage(url) {
    try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        if (response.status !== 200 || !response.data) {
            // console.warn(`⚠️ Image fetch failed: ${url} (Status: ${response.status})`);
            return null;
        }

        const buffer = Buffer.from(response.data);
        const metadata = await sharp(buffer).metadata();
        if (!metadata) {
            // console.warn(`⚠️ No metadata found for image: ${url}`);
            return null;
        }

        return {
            src: url,
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            buffer: buffer,
        };
    } catch (error) {
        // console.error(`❌ Error validating image: ${url}`, error.message);
        return null;
    }
}

/**
 * Fetches an image or an array of images and converts them to Base64.
 * @param {string|string[]} imageUrls - Image URL(s).
 * @returns {Promise<Object[]|null>} - Array of Base64 image data or null on failure.
 */
async function fetchImageToBase(imageUrls) {
    try {
        // console.log("🔄 Starting fetchImageToBase function...");
        const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
        // console.log("✅ Image URLs received:", urls);

        const results = [];

        for (const imageUrl of urls) {
            // console.log("🔍 Processing image:", imageUrl);

            if (imageUrl.startsWith("http") || imageUrl.startsWith("https")) {
                // console.log("🌐 Detected as a URL, checking if image exists...");

                if (!(await checkImageExists(imageUrl))) {
                    // console.warn(`⚠️ Image does not exist: ${imageUrl}`);
                    continue;
                }

                // console.log("✅ Image exists, validating...");
                const imgData = await validateImage(imageUrl);

                if (!imgData) {
                    // console.warn(`⚠️ Validation failed for image: ${imageUrl}`);
                    continue;
                }

                // console.log("✅ Image validated successfully, processing Base64 conversion...");
                results.push({
                    imageUrl: imgData.src,
                    base64: `data:image/${imgData.format};base64,${imgData.buffer.toString("base64")}`,
                    type: imgData.format,
                    width: imgData.width,
                    height: imgData.height,
                });

                // console.log("🎉 Image processed successfully:", imgData.src);
            } else {
                // console.log("📂 Detected as a local file, normalizing path...");
                const normalizedPath = path.resolve(imageUrl.replace(/\\/g, "/"));
                // console.log("📝 Normalized Path:", normalizedPath);

                if (fs.existsSync(normalizedPath)) {
                    // console.log("✅ File exists, reading...");
                    const imageBuffer = fs.readFileSync(normalizedPath);
                    // console.log("✅ Successfully read file, converting to Base64...");
                    return `data:image/png;base64,${imageBuffer.toString("base64")}`;
                } else {
                    // console.error(`❌ Error: Local file not found -> ${normalizedPath}`);
                    return null;
                }
            }
        }

        // console.log("🏁 Processing complete. Returning results...");
        return results.length > 0 ? results : null;
    } catch (error) {
        // console.error(`❌ Error fetching images as Base64:`, error.message);
        return null;
    }
}

function calculateDateGap(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
        return null; // Return null for negative gaps (startDate is later than endDate)
    }

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();

    if (months < 0) {
        years--;
        months += 12;
    }

    return { years: Math.abs(years), months: Math.abs(months) };
}

function calculateDateDifference(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    if (isNaN(d1) || isNaN(d2)) return "Invalid Date";

    // Check if date1 is greater than or equal to date2
    if (d1 >= d2) return "No gap";

    let years = d2.getFullYear() - d1.getFullYear();
    let months = d2.getMonth() - d1.getMonth();
    let days = d2.getDate() - d1.getDate();

    if (days < 0) {
        months--;
        days += new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    return `${years > 0 ? years + " year(s) " : ""}${months > 0 ? months + " month(s) " : ""}${days > 0 ? days + " day(s)" : ""}`.trim();
}

function calculateGaps(annexureData) {
    // console.log("Received annexureData:", annexureData);

    const secondaryEndDate = annexureData?.gap_validation?.education_fields?.secondary?.secondary_end_date_gap || null;
    // console.log("secondaryEndDate:", secondaryEndDate);

    const seniorSecondaryStartDate = annexureData?.gap_validation?.education_fields?.senior_secondary?.senior_secondary_start_date_gap || null;
    // console.log("seniorSecondaryStartDate:", seniorSecondaryStartDate);

    const seniorSecondaryEndDate = annexureData?.gap_validation?.education_fields?.senior_secondary?.senior_secondary_end_date_gap || null;
    // console.log("seniorSecondaryEndDate:", seniorSecondaryEndDate);

    const graduationStartDate = annexureData?.gap_validation?.education_fields?.graduation_1?.graduation_start_date_gap || null;
    // console.log("graduationStartDate:", graduationStartDate);

    const graduationEndDate = annexureData?.gap_validation?.education_fields?.graduation_1?.graduation_end_date_gap || null;
    // console.log("graduationEndDate:", graduationEndDate);

    const postGraduationStartDate = annexureData?.gap_validation?.education_fields?.post_graduation_1?.post_graduation_start_date_gap || null;
    // console.log("postGraduationStartDate:", postGraduationStartDate);

    const postGraduationEndDate = annexureData?.gap_validation?.education_fields?.post_graduation_1?.post_graduation_end_date_gap || null;
    // console.log("postGraduationEndDate:", postGraduationEndDate);

    const phdStartDate = annexureData?.gap_validation?.education_fields?.phd_1?.phd_start_date_gap || null;
    // console.log("phdStartDate:", phdStartDate);

    const validGaps = {
        gapSecToSrSec: calculateDateGap(secondaryEndDate, seniorSecondaryStartDate),
        gapSrSecToGrad: calculateDateGap(seniorSecondaryEndDate, graduationStartDate),
        gapGradToPostGrad: calculateDateGap(graduationEndDate, postGraduationStartDate),
        gapPostGradToPhd: calculateDateGap(postGraduationEndDate, phdStartDate)
    };
    // console.log("Calculated validGaps:", validGaps);

    const nonNegativeGaps = Object.fromEntries(
        Object.entries(validGaps).filter(([_, value]) => value !== null)
    );
    // console.log("Filtered nonNegativeGaps:", nonNegativeGaps);

    function getEmploymentDates(data) {
        // console.log("Extracting employment dates from:", data);

        const employmentStartDates = [];
        const employmentEndDates = [];
        let i = 1;
        const employmentValues = data?.gap_validation?.employment_fields;

        if (!employmentValues) {
            // console.log("No employment fields found.");
            return { employmentStartDates, employmentEndDates };
        }

        while (true) {
            const employmentKey = `employment_${i}`;
            const employmentData = employmentValues[employmentKey];

            if (!employmentData) break;

            if (employmentData.employment_start_date_gap) {
                employmentStartDates.push({
                    name: `employment_start_date_gap_${i}`,
                    value: employmentData.employment_start_date_gap
                });
                // console.log(`Added employment start date:`, employmentStartDates[employmentStartDates.length - 1]);
            }
            if (employmentData.employment_end_date_gap) {
                employmentEndDates.push({
                    name: `employment_end_date_gap_${i}`,
                    value: employmentData.employment_end_date_gap
                });
                // console.log(`Added employment end date:`, employmentEndDates[employmentEndDates.length - 1]);
            }
            i++;
        }

        return { employmentStartDates, employmentEndDates };
    }

    const { employmentStartDates, employmentEndDates } = getEmploymentDates(annexureData);
    // console.log("Extracted employmentStartDates:", employmentStartDates);
    // console.log("Extracted employmentEndDates:", employmentEndDates);

    function getEmploymentDateDifferences(startDates, endDates) {
        // console.log("Calculating employment date differences...");
        return endDates.map((endDate, i) => {
            const nextStart = startDates[i + 1]?.value || null;
            // console.log(`Processing endDate: ${endDate.value}, nextStart: ${nextStart}`);

            if (endDate.value && nextStart && endDate.value !== nextStart) {
                const diff = calculateDateDifference(endDate.value, nextStart);
                // console.log(`Gap found: ${endDate.value} to ${nextStart} - Difference:`, diff);
                return {
                    endName: endDate.name,
                    endValue: endDate.value,
                    startName: startDates[i + 1].name,
                    startValue: nextStart,
                    difference: diff
                };
            }
            return null;
        }).filter(Boolean);
    }

    const employmentGaps = getEmploymentDateDifferences(employmentStartDates, employmentEndDates);
    // console.log("Final employment gaps:", employmentGaps);
    return { employGaps: employmentGaps, gaps: nonNegativeGaps };
}

function createEmploymentFields(noOfEmployments, fieldValue) {
    let employmentFieldsData = fieldValue.employment_fields;

    // Check if it's a string (i.e., it's been stringified previously) and parse it
    if (typeof employmentFieldsData === 'string') {
        employmentFieldsData = JSON.parse(employmentFieldsData);
    }

    const employmentFields = {}; // Initialize the employmentFields object to store all employment data

    // Dynamically structure the data like: employment_1, employment_2, etc.
    for (let i = 1; i <= noOfEmployments; i++) {
        const employmentData = employmentFieldsData[`employment_${i}`] || {};

        employmentFields[`employment_${i}`] = {
            employment_type_gap: employmentData.employment_type_gap || '',
            employment_start_date_gap: employmentData.employment_start_date_gap || '',
            employment_end_date_gap: employmentData.employment_end_date_gap || '',
        };
    }

    return employmentFields;
}


const formatDate = (isoString) => {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
};
module.exports = {
    candidateFormPDF: async (
        candidate_applicaton_id,
        branch_id,
        customer_id,
        pdfFileName,
        targetDirectory
    ) => {
        return new Promise((resolve, reject) => {
            // console.log(`DEBUG: Calling applicationListByBranchByCandidateID for ID: ${candidate_applicaton_id}`);

            CandidateMasterTrackerModel.applicationListByBranchByCandidateID(
                candidate_applicaton_id,
                branch_id,
                async (err, application) => {
                    if (err) {
                        // console.error("Database error:", err);
                        return reject(new Error(`Database error: ${err.message}`));
                    }

                    if (!application) {
                        // console.warn("Application not found");
                        return reject(new Error("Application not found"));
                    }

                    // console.log(`application - `, application);

                    // console.log(`Step 1: Application data fetched for ID: ${candidate_applicaton_id}`);

                    CandidateMasterTrackerModel.applicationByID(
                        candidate_applicaton_id,
                        branch_id,
                        (err, application) => {
                            if (err) {
                                reject(
                                    new Error(err.message)
                                );
                            }

                            if (!application) {
                                reject(
                                    new Error("Application not found")
                                );
                            }
                            // console.log(`application - `, application);
                            const service_ids = Array.isArray(application.services)
                                ? application.services
                                : application.services.split(",").map((item) => item.trim());

                            CandidateMasterTrackerModel.cefApplicationByID(
                                candidate_applicaton_id,
                                branch_id,
                                (err, CEFApplicationData) => {
                                    if (err) {
                                        // console.error("Database error:", err);
                                        reject(
                                            new Error(err.message)
                                        );
                                    }

                                    Branch.getBranchById(branch_id, (err, currentBranch) => {
                                        if (err) {
                                            // console.error("Database error during branch retrieval:", err);
                                            reject(
                                                new Error('Failed to retrieve Branch. Please try again.')
                                            );
                                        }

                                        if (!currentBranch) {
                                            reject(
                                                new Error('Branch not found.')
                                            );
                                        }

                                        Admin.list((err, adminList) => {
                                            if (err) {
                                                // console.error("Database error:", err);
                                                reject(
                                                    new Error(err.message)
                                                );
                                            }
                                            Customer.getCustomerById(
                                                parseInt(currentBranch.customer_id),
                                                (err, currentCustomer) => {
                                                    if (err) {
                                                        /*
                                                        // console.error(
                                                            "Database error during customer retrieval:",
                                                            err
                                                        );
                                                        */
                                                        reject(
                                                            new Error('Failed to retrieve Customer. Please try again.')
                                                        );
                                                    }

                                                    if (!currentCustomer) {
                                                        reject(
                                                            new Error('Customer not found.')
                                                        );
                                                    }

                                                    CEF.formJsonWithData(
                                                        service_ids,
                                                        candidate_applicaton_id,
                                                        async (err, serviceData) => {
                                                            if (err) {
                                                                // console.error("Database error:", err);
                                                                reject(
                                                                    new Error('An error occurred while fetching service form json.')
                                                                );
                                                            }

                                                            const serviceValueDataForPDF = Object.values(serviceData)?.map(item => item.data) || [];

                                                            data = {
                                                                application,
                                                                CEFData: CEFApplicationData,
                                                                branchInfo: currentBranch,
                                                                customerInfo: currentCustomer,
                                                                serviceData,
                                                                serviceValueDataForPDF,
                                                                admins: adminList,
                                                            };

                                                            // console.log(`Step 2: Service data fetched for ID: ${candidate_applicaton_id}`);

                                                            const customerInfo = data.customerInfo || {};

                                                            customBgv = data.customerInfo?.is_custom_bgv || '';
                                                            companyName = data.application?.customer_name || '';
                                                            purpose = data.application?.purpose_of_application || '';
                                                            cefData = data.CEFData || {};
                                                            nationality = data.application?.nationality || '';
                                                            isSameAsPermanent = false

                                                            // console.log(`Step 3: Data prepared for PDF generation`);

                                                            const parsedData = data?.serviceData || [];

                                                            let allJsonData = [];
                                                            let allJsonDataValue = [];
                                                            let annexureData = [];
                                                            let initialAnnexureData = {
                                                                gap_validation: {
                                                                    highest_education_gap: '',
                                                                    years_of_experience_gap: '',
                                                                    no_of_employment: 0,

                                                                }
                                                            };
                                                            annexureData = initialAnnexureData;

                                                            // Populate annexureData from parsedData
                                                            if (parsedData && Object.keys(parsedData).length > 0) {
                                                                // Sorting and restructuring the parsed data
                                                                const sortedData = Object.entries(parsedData)
                                                                    .sort(([, a], [, b]) => {
                                                                        const groupA = a.group || '';  // Default to empty string if a.group is null or undefined
                                                                        const groupB = b.group || '';  // Default to empty string if b.group is null or undefined
                                                                        return groupA.localeCompare(groupB);
                                                                    })
                                                                    .reduce((acc, [key, value]) => {
                                                                        acc[key] = value;  // Reconstruct the object with sorted entries
                                                                        return acc;
                                                                    }, {});

                                                                // Collecting jsonData and jsonDataValue
                                                                for (const key in parsedData) {
                                                                    if (parsedData.hasOwnProperty(key)) {
                                                                        const jsonData = parsedData[key]?.jsonData;  // Safe navigation in case it's null or undefined
                                                                        if (jsonData) {
                                                                            allJsonData.push(jsonData);  // Store jsonData in the array
                                                                            ;
                                                                        }

                                                                        const jsonDataValue = parsedData[key]?.data;  // Safe navigation in case it's null or undefined
                                                                        if (jsonDataValue) {
                                                                            allJsonDataValue.push(jsonDataValue);  // Store jsonData in the array
                                                                        }
                                                                    }
                                                                }
                                                                // Constructing the annexureData object
                                                                allJsonData.forEach(service => {
                                                                    if (service.db_table !== 'gap_validation') {
                                                                        service?.rows?.forEach(row => {  // Check if rows exist before iterating
                                                                            row?.inputs?.forEach(input => {
                                                                                // Fetch the static inputs dynamically from annexureData

                                                                                // Fetch the dynamic field value from allJsonDataValue
                                                                                let fieldValue = allJsonDataValue.find(data => data && data.hasOwnProperty(input.name)); // Check for null or undefined before accessing `hasOwnProperty`
                                                                                // If fieldValue exists, we set it, otherwise, static value should remain
                                                                                if (fieldValue && fieldValue.hasOwnProperty(input.name)) {

                                                                                    // Set dynamic value in the correct field in annexureData
                                                                                    if (!annexureData[service.db_table]) {
                                                                                        annexureData[service.db_table] = {}; // Initialize the service table if it doesn't exist
                                                                                    }

                                                                                    // Set the dynamic value in the service table under the input's name
                                                                                    annexureData[service.db_table][input.name] = fieldValue[input.name] || "  ";


                                                                                } else {

                                                                                }
                                                                            });
                                                                        });
                                                                    } else {
                                                                        let fieldValue = allJsonDataValue.find(data => data && data.hasOwnProperty('no_of_employment')); // Check for null or undefined before accessing `hasOwnProperty`
                                                                        let initialAnnexureDataNew = initialAnnexureData;
                                                                        if (fieldValue && fieldValue.hasOwnProperty('no_of_employment')) {
                                                                            initialAnnexureDataNew = updateEmploymentFields(annexureData, fieldValue.no_of_employment, fieldValue); // Call function to handle employment fields
                                                                        } else {
                                                                        }
                                                                        annexureData[service.db_table].employment_fields = initialAnnexureDataNew.gap_validation.employment_fields;
                                                                    }

                                                                });
                                                            }

                                                            // console.log(`Step 4: Annexure data prepared for PDF generation`);

                                                            const serviceDataMain = allJsonData;
                                                            try {
                                                                // Create a new PDF document
                                                                const doc = new jsPDF({ compress: true });
                                                                let yPosition = 10;
                                                                const gapY = 8; // consistent gap between tables

                                                                // Table 1: Header
                                                                doc.autoTable({
                                                                    startY: yPosition,
                                                                    head: [[{
                                                                        content: 'Background Verification Form',
                                                                        styles: {
                                                                            halign: 'center',
                                                                            fontSize: 12,
                                                                            fontStyle: 'bold',
                                                                            fillColor: [197, 217, 241],
                                                                            textColor: [80, 80, 80]
                                                                        }
                                                                    }]],
                                                                    body: [[{
                                                                        content: `Company name: ${companyName}`,
                                                                        styles: { fontStyle: 'bold', halign: 'center' }
                                                                    }]],
                                                                    theme: 'grid',
                                                                    margin: { top: 10, left: 15, right: 15 },
                                                                    styles: {
                                                                        cellPadding: 2,
                                                                        fontSize: 10,
                                                                        lineWidth: 0.2,
                                                                        lineColor: [0, 0, 0]
                                                                    }
                                                                });
                                                                yPosition = doc.autoTable.previous.finalY + gapY;
                                                                const pageWidth = doc.internal.pageSize.getWidth() - 30;

                                                                console.log('cefData', cefData);
                                                                const personalBody = [
                                                                    [{ content: "Full Name of the Applicant", styles: { fontStyle: 'bold' } }, cefData.full_name || "N/A"],
                                                                    [{ content: "Pancard Number", styles: { fontStyle: 'bold' } }, cefData.pan_card_number || "N/A"],
                                                                    [{ content: "Aadhar Number", styles: { fontStyle: 'bold' } }, cefData.aadhar_card_number || "N/A"],
                                                                    [{ content: "Father's Name", styles: { fontStyle: 'bold' } }, cefData.father_name || "N/A"],
                                                                    [{ content: "Date of Birth (dd/mm/yy)", styles: { fontStyle: 'bold' } }, cefData.dob || "N/A"],
                                                                    [{ content: "Husband's Name", styles: { fontStyle: 'bold' } }, cefData.husband_name || "N/A"],
                                                                    [{ content: "Gender", styles: { fontStyle: 'bold' } }, cefData.gender || "N/A"],
                                                                    [{ content: "Mobile Number", styles: { fontStyle: 'bold' } }, cefData.mb_no || "N/A"],
                                                                    [{ content: "Nationality", styles: { fontStyle: 'bold' } }, cefData.nationality || "N/A"],
                                                                    [{ content: "Marital Status", styles: { fontStyle: 'bold' } }, cefData.marital_status || "N/A"]
                                                                ];
                                                                console.log(`step1`);
                                                                doc.autoTable({
                                                                    startY: yPosition,
                                                                    head: [[{
                                                                        content: "Personal Information",
                                                                        colSpan: 2,
                                                                        styles: {
                                                                            halign: "center",
                                                                            fontSize: 12,
                                                                            fontStyle: "bold",
                                                                            fillColor: [197, 217, 241],
                                                                            textColor: [80, 80, 80],
                                                                            cellPadding: 2
                                                                        }
                                                                    }]],
                                                                    body: personalBody,
                                                                    theme: 'grid',
                                                                    margin: { top: 10, left: 15, right: 15 },
                                                                    styles: {
                                                                        fontSize: 10,
                                                                        font: 'helvetica',
                                                                        textColor: [80, 80, 80],
                                                                        lineWidth: 0.2,
                                                                        lineColor: [0, 0, 0],
                                                                        cellPadding: 2
                                                                    },
                                                                    headStyles: {
                                                                        fillColor: [197, 217, 241],
                                                                        textColor: [0, 0, 0],
                                                                        fontStyle: 'bold',
                                                                        fontSize: 11
                                                                    },
                                                                    columnStyles: {
                                                                        0: { cellWidth: pageWidth * 0.4 },
                                                                        1: { cellWidth: pageWidth * 0.6 }
                                                                    }
                                                                });
                                                                yPosition = doc.autoTable.previous.finalY + gapY;
                                                                console.log(`step2`);

                                                                // Table 3: Current Address
                                                                doc.autoTable({
                                                                    startY: yPosition,
                                                                    head: [[{
                                                                        content: 'Current Address',
                                                                        colSpan: 2,
                                                                        styles: {
                                                                            halign: 'center',
                                                                            fontSize: 12,
                                                                            fontStyle: 'bold',
                                                                            fillColor: [197, 217, 241],
                                                                            textColor: [80, 80, 80]
                                                                        }
                                                                    }]],
                                                                    body: [
                                                                        [
                                                                            { content: 'Current Address', styles: { fontStyle: 'bold' } },
                                                                            cefData.full_address || 'N/A'
                                                                        ],
                                                                        [
                                                                            { content: 'Pin Code', styles: { fontStyle: 'bold' } },
                                                                            cefData.pin_code || 'N/A'
                                                                        ],
                                                                        [
                                                                            { content: 'Mobile Number', styles: { fontStyle: 'bold' } },
                                                                            cefData.current_address_landline_number || 'N/A'
                                                                        ],
                                                                        [
                                                                            { content: 'Current State', styles: { fontStyle: 'bold' } },
                                                                            cefData.current_address_state || 'N/A'
                                                                        ],
                                                                        [
                                                                            { content: 'Current Landmark', styles: { fontStyle: 'bold' } },
                                                                            cefData.current_prominent_landmark || 'N/A'
                                                                        ],
                                                                        [
                                                                            { content: 'Current Address Stay No.', styles: { fontStyle: 'bold' } },
                                                                            cefData.current_address_stay_to || 'N/A'
                                                                        ],
                                                                        [
                                                                            { content: 'Nearest Police Station', styles: { fontStyle: 'bold' } },
                                                                            cefData.nearest_police_station || 'N/A'
                                                                        ]
                                                                    ],
                                                                    theme: 'grid',
                                                                    margin: { top: 10, left: 15, right: 15 },
                                                                    styles: {
                                                                        fontSize: 10,
                                                                        cellPadding: 2,
                                                                        lineWidth: 0.2,
                                                                        lineColor: [0, 0, 0]
                                                                    },
                                                                    columnStyles: {
                                                                        0: { cellWidth: pageWidth * 0.4 },
                                                                        1: { cellWidth: pageWidth * 0.6 }
                                                                    }
                                                                });

                                                                console.log(`step3`);

                                                                yPosition = doc.autoTable.previous.finalY - 2;
                                                                (async () => {
                                                                    if (!serviceDataMain.length) {
                                                                        const pageWidth = doc.internal.pageSize.width;
                                                                        doc.text("No service data available.", pageWidth / 2, yPosition + 10, { align: 'center' });
                                                                        yPosition += 20;
                                                                    } else {

                                                                        for (let i = 0; i < serviceDataMain.length; i++) {
                                                                            const service = serviceDataMain[i];
                                                                            console.log(`step6`);

                                                                            const isNonEmpty = (obj) => {
                                                                                if (!obj || typeof obj !== 'object') return false;
                                                                                return Object.values(obj).some(
                                                                                    (value) =>
                                                                                        value !== null &&
                                                                                        !(typeof value === 'string' && value.trim() === '')
                                                                                );
                                                                            };
                                                                            console.log(`step7`);

                                                                            let tableData = [];
                                                                            let shouldSkipEntireTable = false;
                                                                            console.log(`step8`);

                                                                            for (const row of service.rows) {
                                                                                for (const input of row.inputs) {
                                                                                    const isCheckbox = input.type === 'checkbox';
                                                                                    const value = serviceValueDataForPDF[service?.db_table]?.[input?.name] || 'N/A';

                                                                                    if (
                                                                                        isCheckbox &&
                                                                                        (value === '1' || value === 1 || value === true || value === 'true')
                                                                                    ) {
                                                                                        shouldSkipEntireTable = true;
                                                                                        break;
                                                                                    }
                                                                                }
                                                                                if (shouldSkipEntireTable) break;
                                                                            }

                                                                            if (shouldSkipEntireTable) {
                                                                                continue;
                                                                            }

                                                                            service.rows.forEach((row) => {
                                                                                row.inputs.forEach((input) => {
                                                                                    const value = serviceValueDataForPDF[service?.db_table]?.[input?.name] || 'N/A';

                                                                                    if (input.type === 'file' || input.type === 'checkbox') return;

                                                                                    tableData.push([
                                                                                        { content: input.label, styles: { fontStyle: 'bold' } }, // Bold label
                                                                                        value
                                                                                    ]);
                                                                                });
                                                                            });

                                                                            // ✅ Add spacing bet
                                                                            if (tableData.length > 0 && i !== 0) {
                                                                                yPosition -= 2;
                                                                            }
                                                                            if (tableData.length > 0) {
                                                                                doc.setFontSize(16);
                                                                                yPosition += 10;

                                                                                const pageHeight = doc.internal.pageSize.getHeight();
                                                                                const pageWidth = doc.internal.pageSize.getWidth();
                                                                                const tableWidth = pageWidth - 30;
                                                                                const col1Width = tableWidth * 0.4;
                                                                                const col2Width = tableWidth * 0.6;

                                                                                const estimatedTableHeight = 10 + (tableData.length * 10); // Rough estimation, adjust if needed

                                                                                // Check if space is sufficient, otherwise add a new page
                                                                                if (yPosition + estimatedTableHeight > pageHeight) {
                                                                                    doc.addPage();
                                                                                    yPosition = 20;
                                                                                }

                                                                                doc.autoTable({
                                                                                    startY: yPosition,
                                                                                    head: [
                                                                                        [
                                                                                            {
                                                                                                content: service.heading,
                                                                                                colSpan: 2,
                                                                                                styles: {
                                                                                                    halign: 'center',
                                                                                                    fontSize: 12,
                                                                                                    fontStyle: 'bold',
                                                                                                    fillColor: [197, 217, 241],
                                                                                                    textColor: [80, 80, 80]
                                                                                                }
                                                                                            }
                                                                                        ]
                                                                                    ],
                                                                                    body: tableData,
                                                                                    theme: 'grid',
                                                                                    margin: { top: 10, left: 15, right: 15 },
                                                                                    styles: {
                                                                                        fontSize: 10,
                                                                                        cellPadding: 2,
                                                                                        lineWidth: 0.2,
                                                                                        lineColor: [0, 0, 0],
                                                                                    },
                                                                                    columnStyles: {
                                                                                        0: { cellWidth: col1Width },
                                                                                        1: { cellWidth: col2Width }
                                                                                    },
                                                                                    headStyles: {
                                                                                        fillColor: [197, 217, 241],
                                                                                        textColor: [80, 80, 80]
                                                                                    },
                                                                                    didDrawPage: (data) => {
                                                                                        // You can add a title or page number here if needed
                                                                                    },
                                                                                    // Avoid repeating head automatically
                                                                                    // only draw header on the first page of the table
                                                                                    didDrawCell: (data) => {
                                                                                        if (data.section === 'head' && data.row.index > 0) {
                                                                                            data.cell.styles.fillColor = null; // Skip redraw of header
                                                                                        }
                                                                                    }
                                                                                });

                                                                                yPosition = doc.lastAutoTable.finalY;
                                                                            }

                                                                        }
                                                                    }

                                                                    let newYPosition = 20
                                                                    doc.addPage();
                                                                    const disclaimerButtonHeight = 8; // Button height (without padding)
                                                                    const disclaimerButtonWidth = doc.internal.pageSize.width - 20; // Full width minus margins

                                                                    // Constants for additional spacing
                                                                    const buttonBottomPadding = 5; // Padding below the button
                                                                    const backgroundColor = '#c5d9f1';

                                                                    let disclaimerY = 10; // Starting position
                                                                    const adjustedDisclaimerButtonHeight = disclaimerButtonHeight + buttonBottomPadding;
                                                                    const disclaimerButtonXPosition = (doc.internal.pageSize.width - disclaimerButtonWidth) / 2;

                                                                    doc.setDrawColor(0, 0, 0); // Set border color to black
                                                                    doc.setFillColor(backgroundColor); // Fill color
                                                                    doc.rect(disclaimerButtonXPosition, disclaimerY, disclaimerButtonWidth, disclaimerButtonHeight, 'F'); // Fill
                                                                    doc.rect(disclaimerButtonXPosition, disclaimerY, disclaimerButtonWidth, disclaimerButtonHeight, 'D'); // Border

                                                                    doc.setTextColor(80, 80, 80); // Black text
                                                                    doc.setFontSize(13);

                                                                    // Calculate center Y of button for vertical alignment
                                                                    const disclaimerTextYPosition = disclaimerY + (disclaimerButtonHeight / 2) + (doc.getFontSize() / 8);
                                                                    doc.setFont('helvetica', 'bold'); // Set font to Helvetica Bold
                                                                    doc.text('Declaration and Authorization', doc.internal.pageSize.width / 2, disclaimerTextYPosition, {
                                                                        align: 'center',
                                                                    });


                                                                    const disclaimerTextPart1 = `I hereby authorize Screeningstar Solutions Private Limited and its representative to verify the information provided in my application for employment and this employee background verification form, and to conduct enquiries as may be necessary, at the company’s discretion.
                                                                    
                                                                    I authorize all persons who may have information relevant to this enquiry to disclose it to ScreeningStar HR Services Pvt Ltd or its representative. I release all persons from liability on account of such disclosure. I confirm that the above information is correct to the best of my knowledge. I agree that in the event of my obtaining employment, my probationary appointment, confirmation as well as continued employment in the services of the company are subject to clearance of medical test and background verification check done by the company.`;

                                                                    const disclaimerLinesPart1 = doc.splitTextToSize(disclaimerTextPart1, disclaimerButtonWidth);
                                                                    const lineHeight = 5
                                                                    const disclaimerTextHeight =
                                                                        disclaimerLinesPart1.length * lineHeight +
                                                                        lineHeight; // Extra space for anchor // Extra space for anchor
                                                                    const disclaimerTextTopMargin = 5; // Margin from top of the disclaimer text

                                                                    const totalContentHeight = adjustedDisclaimerButtonHeight + disclaimerTextHeight + disclaimerTextTopMargin;
                                                                    let currentY = disclaimerY + adjustedDisclaimerButtonHeight + disclaimerTextTopMargin;
                                                                    let maxLineWidth = 0;
                                                                    disclaimerLinesPart1.forEach((line) => {
                                                                        const lineWidth = doc.getTextWidth(line);
                                                                        if (lineWidth > maxLineWidth) {
                                                                            maxLineWidth = lineWidth;
                                                                        }
                                                                    });
                                                                    const paragraphX = (doc.internal.pageSize.width - maxLineWidth - 10.5);
                                                                    const paragraphGap = 2; // smaller gap between paragraphs
                                                                    const paragraphs = disclaimerTextPart1.trim().split(/\n\s*\n/); // split into paragraphs
                                                                    doc.setFont('helvetica', 'normal'); // Reset to normal for following text

                                                                    paragraphs.forEach(paragraph => {
                                                                        const lines = doc.splitTextToSize(paragraph.trim(), disclaimerButtonWidth);

                                                                        lines.forEach((line, index) => {
                                                                            doc.setFontSize(13);
                                                                            doc.setFont('helvetica', 'normal'); // Reset to normal for following text

                                                                            const words = line.trim().split(' ');
                                                                            const lineWidth = doc.getTextWidth(line);
                                                                            const spaceWidth = doc.getTextWidth(' ');
                                                                            const extraSpace = disclaimerButtonWidth - lineWidth;
                                                                            const spacesToAdd = words.length - 1;

                                                                            let spacing = 0;

                                                                            // Apply spacing only if it's not the last line and enough words to space
                                                                            if (index !== lines.length - 1 && spacesToAdd > 0) {
                                                                                spacing = extraSpace / spacesToAdd;

                                                                                // 👌 Control it — don’t let it stretch too much
                                                                                const maxSpacing = 1.5; // You can tweak this to 1 or 2
                                                                                spacing = Math.min(spacing, maxSpacing);
                                                                            }

                                                                            let x = paragraphX;
                                                                            words.forEach((word, wordIndex) => {
                                                                                doc.text(word, x, currentY);
                                                                                x += doc.getTextWidth(word) + spaceWidth + (wordIndex < words.length - 1 ? spacing : 0);
                                                                            });

                                                                            currentY += lineHeight;
                                                                        });

                                                                        currentY += paragraphGap;
                                                                    });

                                                                    newYPosition = doc.autoTable.previous.finalY - 10; // Adjusting for space from the last table


                                                                    const newPageWidth = pageWidth + 10;
                                                                    // Create a single row table
                                                                    const tableWidth = newPageWidth * 0.9; // Adjust this value for the desired table width
                                                                    const tableMargin = (newPageWidth - tableWidth) / 2; // Calculate the left margin to center the table
                                                                    const createdDate = formatDate(cefData.created_at);


                                                                    doc.autoTable({
                                                                        startY: newYPosition - 70,
                                                                        margin: { left: tableMargin }, // Apply the margin to center the table
                                                                        body: [
                                                                            [
                                                                                {
                                                                                    content: 'Full Name of Applicant',
                                                                                    styles: { fontStyle: 'bold', halign: 'center' } // Center align the first column
                                                                                },
                                                                                {
                                                                                    content: cefData.full_name,
                                                                                    styles: { fontStyle: 'normal', halign: 'center' } // Center align the second column
                                                                                },
                                                                                {
                                                                                    content: 'Date',
                                                                                    styles: { fontStyle: 'bold', halign: 'center' } // Center align the third column
                                                                                },
                                                                                {
                                                                                    content: createdDate,
                                                                                    styles: {
                                                                                        fontStyle: 'normal',
                                                                                        fillColor: [255, 255, 255], // white background
                                                                                        halign: 'center' // Center align the fourth column
                                                                                    }
                                                                                }
                                                                            ]
                                                                        ],
                                                                        theme: 'grid',
                                                                        styles: {
                                                                            fontSize: 12,
                                                                            halign: 'center', // Center align the entire table content
                                                                            lineWidth: 0.2,
                                                                            lineColor: [0, 0, 0],
                                                                            cellPadding: 2,
                                                                        },
                                                                        columnStyles: {
                                                                            0: { cellWidth: newPageWidth * 0.3 },
                                                                            1: { cellWidth: newPageWidth * 0.2 },
                                                                            2: { cellWidth: newPageWidth * 0.3 },
                                                                            3: { cellWidth: newPageWidth * 0.2 },
                                                                        }
                                                                    });

                                                                    // Save PDF
                                                                    console.log(`pdfFileName - `, pdfFileName);
                                                                    // doc.save(`123.pdf`);

                                                                    // console.log(`targetDirectory - `, targetDirectory);
                                                                    const pdfPathCloud = await savePdf(
                                                                        doc,
                                                                        pdfFileName,
                                                                        targetDirectory
                                                                    );
                                                                    resolve(pdfPathCloud);
                                                                    // console.log("PDF generation completed successfully.");
                                                                })();
                                                            } catch (error) {
                                                                // console.error("PDF generation error:", error);
                                                                reject(new Error("Error generating PDF"));
                                                            }
                                                        }
                                                    );
                                                }
                                            );
                                        });
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    },
};
