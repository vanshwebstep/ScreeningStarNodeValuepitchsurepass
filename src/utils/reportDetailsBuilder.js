const ClientMasterTrackerModel = require("../models/admin/clientMasterTrackerModel");
const Service = require("../models/admin/serviceModel");
const {
  getValuePitchFromDB,
  fetchValuePitchStatus,
  fetchValuePitchReportData,
} = require("./external-tools/valuePitch");
const {
  getServicesWithPrefill,
  buildSurepassResultRows,
} = require("./external-tools/surePass");

const REPORT_EMPTY_VALUE = "N/A";

const callModel = (fn, ...args) =>
  new Promise((resolve, reject) => {
    fn(...args, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });

const isBlankReportValue = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "");

const formatReportDateValue = (value) => {
  if (isBlankReportValue(value)) {
    return REPORT_EMPTY_VALUE;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).trim() || REPORT_EMPTY_VALUE;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const normalizeReportValue = (value) => {
  if (isBlankReportValue(value)) {
    return REPORT_EMPTY_VALUE;
  }

  if (value instanceof Date) {
    return formatReportDateValue(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(trimmed)) {
      return formatReportDateValue(trimmed);
    }
    return trimmed || REPORT_EMPTY_VALUE;
  }

  return value;
};

const upperReportValue = (value) => {
  const normalized = normalizeReportValue(value);
  return typeof normalized === "string" ? normalized.toUpperCase() : normalized;
};

const toReportKey = (value, fallback = "field") => {
  const key = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return key || fallback;
};

const cleanReportLabel = (label) =>
  String(label || "")
    .replace(/\s*:\s*$/, "")
    .trim();

const setUniqueReportKey = (target, preferredKey, value) => {
  const baseKey = preferredKey || "field";
  let key = baseKey;
  let counter = 2;

  while (Object.prototype.hasOwnProperty.call(target, key)) {
    key = `${baseKey}_${counter}`;
    counter += 1;
  }

  target[key] = value;
  return key;
};

const changeReportLabel = (label, generateReportType) => {
  if (
    String(generateReportType || "").toUpperCase() !==
    "VENDOR CONFIDENTIAL SCREENING REPORT"
  ) {
    return label;
  }

  const vendorLabelMap = {
    "name of the applicant:": "Name of the Organization:",
    "date of birth:": "Date of Incorporation:",
    "applicant details": "ORGANISATION DETAILS",
  };

  const normalizedLabel = String(label || "").trim().toLowerCase();
  return vendorLabelMap[normalizedLabel] || label;
};

const parseReportFormJson = (reportFormJson) => {
  if (!reportFormJson) {
    return null;
  }

  if (typeof reportFormJson === "string") {
    return JSON.parse(reportFormJson);
  }

  if (typeof reportFormJson.json === "string") {
    return JSON.parse(reportFormJson.json);
  }

  return reportFormJson.json || reportFormJson;
};

const parseServiceIds = (services) =>
  String(services || "")
    .split(",")
    .map((serviceId) => serviceId.trim())
    .filter(Boolean);

const parseServiceTypes = (serviceInfo) =>
  String(serviceInfo?.service_type || "")
    .split(",")
    .map((type) => type.trim().toLowerCase())
    .filter(Boolean);

const isAnnexureInput = (field) => {
  const name = String(field?.name || "").toLowerCase();
  const label = String(field?.label || "").toLowerCase();

  return (
    field?.type === "file" ||
    name.startsWith("annexure") ||
    name.startsWith("checkbox_annexure") ||
    label.includes("annexure")
  );
};

const getValuePitchReportUrl = (report) => {
  if (!report || typeof report !== "object") {
    return null;
  }

  return (
    report.reportUrl ||
    report.report_url ||
    report.url ||
    report.report?.reportUrl ||
    report.data?.reportUrl ||
    null
  );
};

const pickValuePitchReport = (response) => {
  if (!response || typeof response !== "object") {
    return null;
  }

  if (getValuePitchReportUrl(response.valuePitchReport)) {
    return response.valuePitchReport;
  }

  if (getValuePitchReportUrl(response)) {
    return response;
  }

  if (getValuePitchReportUrl(response.report)) {
    return response.report;
  }

  if (getValuePitchReportUrl(response.data)) {
    return response.data;
  }

  return null;
};

const fetchValuePitchReportForService = async (serviceInfo, serviceId, clientApplicationId) => {
  const serviceTypes = parseServiceTypes(serviceInfo);
  if (!serviceTypes.includes("valuepitch")) {
    return null;
  }

  try {
    const cachedResponse = await getValuePitchFromDB(serviceId, clientApplicationId);
    const cachedReport = pickValuePitchReport(cachedResponse);
    if (getValuePitchReportUrl(cachedReport)) {
      return cachedReport;
    }

    if (!cachedResponse?.verifyId) {
      return cachedReport;
    }

    const [statusRes, reportRes] = await Promise.all([
      fetchValuePitchStatus({
        verifyId: cachedResponse.verifyId,
        service_id: serviceId,
        application_id: clientApplicationId,
      }),
      fetchValuePitchReportData({
        verifyId: cachedResponse.verifyId,
        service_id: serviceId,
        application_id: clientApplicationId,
      }),
    ]);

    return (
      pickValuePitchReport(reportRes?.data) ||
      pickValuePitchReport(statusRes?.data) ||
      cachedReport
    );
  } catch (error) {
    console.error("ValuePitch report URL fetch error:", error?.message || error);
    return null;
  }
};

const fetchSurepassRowsForService = async (serviceInfo, serviceId, clientApplicationId) => {
  const serviceTypes = parseServiceTypes(serviceInfo);
  if (!serviceTypes.includes("surepass")) {
    return [];
  }

  try {
    const surepassResult = await getServicesWithPrefill({
      service_ids: [serviceId],
      application_id: clientApplicationId,
    });

    const record = surepassResult?.data?.[0] || null;
    if (!record) {
      return [];
    }

    return Array.isArray(record.surepass_result_rows) && record.surepass_result_rows.length
      ? record.surepass_result_rows
      : buildSurepassResultRows(record);
  } catch (error) {
    console.error("SurePass report rows fetch error:", error?.message || error);
    return [];
  }
};

const buildReportHeaderDetails = (applicationInfo) => {
  const isVendorReport =
    String(applicationInfo?.generate_report_type || "").toUpperCase() ===
    "VENDOR CONFIDENTIAL SCREENING REPORT";

  const reportType = upperReportValue(
    String(applicationInfo?.report_type || "EMPLOYMENT").replace(/_/g, " ")
  );

  const rows = isVendorReport
    ? [
        [
          "REFERENCE ID",
          upperReportValue(applicationInfo?.application_id),
          "DATE OF INCORPORATION",
          formatReportDateValue(applicationInfo?.dob),
        ],
        [
          "EMPLOYEE ID",
          upperReportValue(applicationInfo?.employee_id),
          "INSUFF CLEARED",
          formatReportDateValue(applicationInfo?.first_insuff_reopened_date),
        ],
        [
          "VERIFICATION INITIATED",
          upperReportValue(formatReportDateValue(applicationInfo?.initiation_date)),
          "FINAL REPORT DATE",
          formatReportDateValue(applicationInfo?.report_date),
        ],
        [
          "VERIFICATION STATUS",
          upperReportValue(applicationInfo?.final_verification_status),
          "REPORT STATUS",
          upperReportValue(applicationInfo?.report_status),
        ],
        ["REPORT TYPE", reportType],
      ]
    : [
        [
          "REFERENCE ID",
          upperReportValue(applicationInfo?.application_id),
          "DATE OF BIRTH",
          formatReportDateValue(applicationInfo?.dob),
        ],
        [
          "EMPLOYEE ID",
          upperReportValue(applicationInfo?.employee_id),
          "INSUFF CLEARED",
          formatReportDateValue(applicationInfo?.first_insuff_reopened_date),
        ],
        [
          "VERIFICATION INITIATED",
          upperReportValue(formatReportDateValue(applicationInfo?.initiation_date)),
          "FINAL REPORT DATE",
          formatReportDateValue(applicationInfo?.report_date),
        ],
        [
          "REPORT TYPE",
          reportType,
          "REPORT STATUS",
          upperReportValue(applicationInfo?.report_status),
        ],
      ];

  return rows.reduce((header, row) => {
    for (let index = 0; index < row.length; index += 2) {
      if (row[index]) {
        header[row[index]] = normalizeReportValue(row[index + 1]);
      }
    }
    return header;
  }, {});
};

const appendSurepassRows = ({ sectionRows, sectionData, headers, surepassRows }) => {
  if (!Array.isArray(surepassRows) || !surepassRows.length) {
    return;
  }

  const particularHeader = headers[0] || "PARTICULARS";
  const applicantHeader = headers[1] || "APPLICANT DETAILS";

  sectionRows.push({
    [particularHeader]: "SurePass Response",
  });

  setUniqueReportKey(sectionData, "surepass_response", {
    label: "SurePass Response",
  });

  surepassRows.forEach((row) => {
    if (!Array.isArray(row) || !row.length) {
      return;
    }

    const label = cleanReportLabel(row[0]);
    const value = row.length > 1 ? normalizeReportValue(row[1]) : REPORT_EMPTY_VALUE;
    const rowDetails = {
      [particularHeader]: label,
    };

    if (row.length > 1) {
      rowDetails[applicantHeader] = value;
    }

    sectionRows.push(rowDetails);
    setUniqueReportKey(sectionData, toReportKey(label, "surepass_row"), {
      label,
      [applicantHeader]: value,
    });
  });
};

const buildReportSectionDetails = ({
  serviceId,
  serviceInfo,
  reportFormJson,
  annexureData,
  generateReportType,
  valuePitchReport,
  surepassRows,
}) => {
  const parsedReportForm = parseReportFormJson(reportFormJson);
  const heading = parsedReportForm?.heading || serviceInfo?.title || `Service ${serviceId}`;
  const dbTable = parsedReportForm?.db_table
    ? String(parsedReportForm.db_table).replace(/-/g, "_")
    : toReportKey(heading, `service_${serviceId}`);
  const headers = Array.isArray(parsedReportForm?.headers)
    ? parsedReportForm.headers.map((header) => changeReportLabel(header, generateReportType))
    : [];
  const rows = Array.isArray(parsedReportForm?.rows) ? parsedReportForm.rows : [];
  const sectionRows = [];
  const sectionData = {};
  const annexures = [];

  rows.forEach((row) => {
    const label = changeReportLabel(row?.label || "", generateReportType);
    const inputFields = Array.isArray(row?.inputs)
      ? row.inputs
          .map((input) => {
            const inputName = String(input?.name || "").replace(/\s+/g, "");
            if (!inputName) {
              return null;
            }

            return {
              name: inputName,
              type: input?.type || "text",
              value: normalizeReportValue(annexureData?.[inputName]),
              label,
            };
          })
          .filter(Boolean)
      : [];

    const annexureInputs = inputFields.filter(isAnnexureInput);
    if (annexureInputs.length > 0) {
      annexureInputs.forEach((input) => {
        annexures.push({
          label: cleanReportLabel(input.label),
          value: input.value,
        });
      });
    }

    const nonAnnexureInputs = inputFields.filter((field) => !isAnnexureInput(field));
    if (nonAnnexureInputs.length === 0) {
      return;
    }

    const baseInput =
      nonAnnexureInputs.find((field) => !field.name.startsWith("verified_")) ||
      nonAnnexureInputs[0];
    const baseName = baseInput.name.replace(/^verified_/, "");
    const verifiedName = `verified_${baseName}`.replace("verified_verified_", "verified_");
    let verifiedInput =
      nonAnnexureInputs.find((field) => field.name === verifiedName) ||
      null;

    if (!verifiedInput && Object.prototype.hasOwnProperty.call(annexureData || {}, verifiedName)) {
      verifiedInput = {
        name: verifiedName,
        type: "text",
        value: normalizeReportValue(annexureData?.[verifiedName]),
        label,
      };
      nonAnnexureInputs.push(verifiedInput);
    }

    const applicantValue = normalizeReportValue(annexureData?.[baseName] ?? baseInput.value);
    const verifiedValue = verifiedInput
      ? normalizeReportValue(annexureData?.[verifiedInput.name] ?? verifiedInput.value)
      : REPORT_EMPTY_VALUE;
    const rowKey = toReportKey(label, baseName);

    const particularHeader = headers[0] || "PARTICULARS";
    const applicantHeader = headers[1] || "APPLICANT DETAILS";
    const verifiedHeader = headers[2] || "VERIFIED DETAILS";
    const cleanLabel = cleanReportLabel(label);

    const rowDetails = {
      [particularHeader]: cleanLabel,
      [applicantHeader]: applicantValue,
    };

    if (headers.length > 2 || verifiedInput) {
      rowDetails[verifiedHeader] = verifiedValue;
    }

    sectionRows.push(rowDetails);
    setUniqueReportKey(sectionData, rowKey, {
      label: cleanLabel,
      [applicantHeader]: applicantValue,
      [verifiedHeader]: verifiedValue,
    });
  });

  const reportUrl = getValuePitchReportUrl(valuePitchReport);
  if (reportUrl) {
    const particularHeader = headers[0] || "PARTICULARS";
    const applicantHeader = headers[1] || "APPLICANT DETAILS";
    const normalizedReportUrl = normalizeReportValue(reportUrl);

    sectionRows.push({
      [particularHeader]: "Report URL",
      [applicantHeader]: normalizedReportUrl,
    });

    setUniqueReportKey(sectionData, "report_url", {
      label: "Report URL",
      [applicantHeader]: normalizedReportUrl,
    });
  }

  appendSurepassRows({ sectionRows, sectionData, headers, surepassRows });

  return {
    service_id: serviceId,
    service_name: serviceInfo?.title || heading,
    service_type: serviceInfo?.service_type || REPORT_EMPTY_VALUE,
    db_table: dbTable,
    heading: String(heading).toUpperCase(),
    status: normalizeReportValue(annexureData?.status),
    visible_in_pdf: annexureData?.status !== "nil",
    report_url: normalizeReportValue(reportUrl),
    headers,
    data: sectionData,
    rows: sectionRows,
    annexures,
  };
};

const buildReportDetails = async (clientApplicationId, branchId) => {
  const applicationInfo = await callModel(
    ClientMasterTrackerModel.applicationByID,
    clientApplicationId,
    branchId
  );

  const serviceIds = parseServiceIds(applicationInfo?.services);
  const services = [];

  for (const serviceId of serviceIds) {
    try {
      const [serviceInfo, reportPayload] = await Promise.all([
        callModel(Service.getServiceById, serviceId),
        callModel(
          ClientMasterTrackerModel.reportFormJsonWithannexureData,
          clientApplicationId,
          serviceId
        ),
      ]);
      const [valuePitchReport, surepassRows] = await Promise.all([
        fetchValuePitchReportForService(serviceInfo, serviceId, clientApplicationId),
        fetchSurepassRowsForService(serviceInfo, serviceId, clientApplicationId),
      ]);

      services.push(
        buildReportSectionDetails({
          serviceId,
          serviceInfo,
          reportFormJson: reportPayload?.reportFormJson,
          annexureData: reportPayload?.annexureData || {},
          generateReportType: applicationInfo?.generate_report_type,
          valuePitchReport,
          surepassRows,
        })
      );
    } catch (error) {
      services.push({
        service_id: serviceId,
        service_name: `Service ${serviceId}`,
        service_type: REPORT_EMPTY_VALUE,
        db_table: `service_${serviceId}`,
        heading: `SERVICE ${serviceId}`,
        status: REPORT_EMPTY_VALUE,
        visible_in_pdf: false,
        report_url: REPORT_EMPTY_VALUE,
        headers: [],
        data: {},
        rows: [],
        annexures: [],
        error: error?.message || "Failed to fetch report fields.",
      });
    }
  }

  const tables = services.reduce((acc, section) => {
    setUniqueReportKey(acc, section.db_table, {
      heading: section.heading,
      service_id: section.service_id,
      service_name: section.service_name,
      report_url: section.report_url,
      data: section.data,
      rows: section.rows,
      annexures: section.annexures,
    });
    return acc;
  }, {});

  return {
    header: buildReportHeaderDetails(applicationInfo),
    services,
    tables,
  };
};

module.exports = {
  buildReportDetails,
};