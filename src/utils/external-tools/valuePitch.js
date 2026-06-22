const axios = require('axios');
const { sequelize } = require("../../config/db"); // Import the existing MySQL connection

const saveValuePitchStatus = async (data) => {
    console.log('data jo valuepitch mai save hora hai', data)
    try {
        const responseJson = data.response_json
            ? data.response_json
            : JSON.stringify(data.response || {});
        const statusCode = data.response?.statusCode || data.status_code || null;

        const updateSql = `
          UPDATE valuepitch_status
          SET response_json = :response_json,
              status_code = :status_code
          WHERE service_id = :service_id
            AND application_id = :application_id
            AND verify_id = :verify_id
        `;

        const [updateResult] = await sequelize.query(updateSql, {
            replacements: {
                service_id: data.service_id,
                application_id: data.application_id,
                verify_id: data.verifyId,
                response_json: responseJson,
                status_code: statusCode
            }
        });

        const updatedRows = updateResult?.affectedRows || updateResult?.changedRows || 0;
        if (updatedRows > 0) {
            console.log("âœ… DB UPDATE SUCCESS:", updateResult);
            return updateResult;
        }

        const [existingRows] = await sequelize.query(
            `
              SELECT id FROM valuepitch_status
              WHERE service_id = :service_id
                AND application_id = :application_id
                AND verify_id = :verify_id
              LIMIT 1
            `,
            {
                replacements: {
                    service_id: data.service_id,
                    application_id: data.application_id,
                    verify_id: data.verifyId
                }
            }
        );

        if (existingRows.length) {
            console.log("âœ… DB ROW ALREADY CURRENT:", existingRows[0]);
            return existingRows[0];
        }

        const sql = `
      INSERT INTO valuepitch_status 
      (service_id, application_id, verify_id, response_json, status_code)
      VALUES (:service_id, :application_id, :verify_id, :response_json, :status_code)
      ON DUPLICATE KEY UPDATE
        response_json = VALUES(response_json),
        status_code = VALUES(status_code)
    `;

        const [result] = await sequelize.query(sql, {
            replacements: {
                service_id: data.service_id,
                application_id: data.application_id,
                verify_id: data.verifyId,
                response_json: responseJson,
                status_code: statusCode
            }
        });

        console.log("✅ DB SAVE SUCCESS:", result);

        return result;

    } catch (err) {
        console.error("❌ DB SAVE ERROR:", err);
        throw err;
    }
};


const getValuePitchFromDB = async (serviceId, applicationId) => {
    try {
        const sql = `
          SELECT * FROM valuepitch_status
          WHERE service_id = :serviceId AND application_id = :applicationId
          ORDER BY id DESC LIMIT 1
        `;

        const [results] = await sequelize.query(sql, {
            replacements: { serviceId, applicationId }
        });

        if (!results.length) return null;

        const row = results[0];

        return {
            ...JSON.parse(row.response_json),  // API response
            verifyId: row.verify_id            // 🔥 manually attach
        };

    } catch (error) {
        console.error("DB Fetch Error:", error);
        return null;
    }
};

const parseValuePitchJson = (raw) => {
    if (!raw) return {};
    if (typeof raw === "object") return raw;

    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
};

const listPendingValuePitchCases = async (limit = 50) => {
    try {
        const sql = `
          SELECT
            vs.*,
            ca.application_id AS application_code,
            ca.name AS applicant_name,
            s.title AS service_name
          FROM valuepitch_status vs
          LEFT JOIN client_applications ca ON ca.id = vs.application_id
          LEFT JOIN services s ON s.id = vs.service_id
          WHERE vs.verify_id IS NOT NULL
            AND vs.verify_id != ''
            AND (
              vs.status_code IS NULL
              OR CAST(vs.status_code AS CHAR) != '201'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM valuepitch_status ready_vs
              WHERE ready_vs.service_id = vs.service_id
                AND ready_vs.application_id = vs.application_id
                AND ready_vs.id != vs.id
                AND (
                  ready_vs.response_json LIKE '%"valuePitchReadyMailSentAt"%'
                  OR CAST(ready_vs.status_code AS CHAR) = '201'
                )
              LIMIT 1
            )
          ORDER BY vs.id ASC
          LIMIT :limit
        `;

        const [rows] = await sequelize.query(sql, {
            replacements: { limit: Number(limit) || 50 }
        });

        return rows
            .map((row) => ({
                ...row,
                parsed_response: parseValuePitchJson(row.response_json)
            }))
            .filter((row) => {
                const response = row.parsed_response || {};
                const isReady = Number(response.statusCode) === 201;
                return !isReady;
            });
    } catch (error) {
        console.error("ValuePitch pending fetch error:", error);
        return [];
    }
};

const saveValuePitchPollResult = async ({
    service_id,
    application_id,
    verifyId,
    statusResponse,
    reportResponse,
    existingResponse = {}
}) => {
    const response = {
        ...existingResponse,
        ...(statusResponse || {}),
        valuePitchStatus: statusResponse || null,
        valuePitchReport: reportResponse || null,
        valuePitchLastCheckedAt: new Date().toISOString()
    };

    return saveValuePitchStatus({
        service_id,
        application_id,
        verifyId,
        response
    });
};

const markValuePitchReadyMailSent = async ({ service_id, application_id, verifyId, existingResponse = {} }) => {
    const response = {
        ...existingResponse,
        valuePitchReadyMailSentAt: new Date().toISOString()
    };

    return saveValuePitchStatus({
        service_id,
        application_id,
        verifyId,
        response
    });
};

const claimValuePitchReadyMail = async ({ service_id, application_id, verifyId }) => {
    try {
        const now = new Date().toISOString();
        const sql = `
          UPDATE valuepitch_status
          SET response_json = JSON_SET(
            COALESCE(NULLIF(response_json, ''), '{}'),
            '$.valuePitchReadyMailSendingAt',
            :now
          )
          WHERE service_id = :service_id
            AND application_id = :application_id
            AND verify_id = :verify_id
            AND CAST(status_code AS CHAR) = '201'
            AND response_json NOT LIKE '%"valuePitchReadyMailSendingAt"%'
            AND response_json NOT LIKE '%"valuePitchReadyMailSentAt"%'
        `;

        const [result] = await sequelize.query(sql, {
            replacements: {
                service_id,
                application_id,
                verify_id: verifyId,
                now
            }
        });

        const claimedRows = result?.affectedRows || result?.changedRows || 0;
        return claimedRows > 0;
    } catch (error) {
        console.error("ValuePitch ready-mail claim error:", error);
        return false;
    }
};

const hasValuePitchReadySuccess = async ({ service_id, application_id, verifyId }) => {
    try {
        const sql = `
          SELECT id, verify_id, status_code, response_json
          FROM valuepitch_status
          WHERE service_id = :service_id
            AND application_id = :application_id
            AND (
              response_json LIKE '%"valuePitchReadyMailSentAt"%'
              OR CAST(status_code AS CHAR) = '201'
            )
            ${verifyId ? "AND verify_id != :verify_id" : ""}
          ORDER BY id DESC
          LIMIT 1
        `;

        const [rows] = await sequelize.query(sql, {
            replacements: {
                service_id,
                application_id,
                verify_id: verifyId
            }
        });

        return rows.length ? rows[0] : null;
    } catch (error) {
        console.error("ValuePitch ready-success guard error:", error);
        return null;
    }
};

const getValuePitchCheckinStatuses = async (applicationId, serviceIds = []) => {
    try {
        const ids = serviceIds.map((id) => String(id).trim()).filter(Boolean);
        if (!applicationId || !ids.length) return {};

        const sql = `
          SELECT vs.*
          FROM valuepitch_status vs
          INNER JOIN (
            SELECT service_id, MAX(id) AS latest_id
            FROM valuepitch_status
            WHERE application_id = :applicationId
              AND service_id IN (:serviceIds)
            GROUP BY service_id
          ) latest
            ON latest.latest_id = vs.id
        `;

        const [rows] = await sequelize.query(sql, {
            replacements: {
                applicationId,
                serviceIds: ids
            }
        });

        return rows.reduce((acc, row) => {
            const response = parseValuePitchJson(row.response_json);
            const statusCode = Number(row.status_code || response.statusCode || response.valuePitchStatus?.statusCode);
            const statusMsg = response.statusMsg || response.valuePitchStatus?.statusMsg || "";

            acc[String(row.service_id)] = {
                verifyId: row.verify_id,
                statusCode,
                statusMsg,
                report: response.report || response.valuePitchReport?.report || null,
                reportUrl: response.reportUrl || response.valuePitchReport?.reportUrl || null,
                responseReceived: Boolean(row.response_json),
                reportReady: statusCode === 201,
                mailSentAt: response.valuePitchReadyMailSentAt || null,
                lastCheckedAt: response.valuePitchLastCheckedAt || null
            };

            return acc;
        }, {});
    } catch (error) {
        console.error("ValuePitch checkin status fetch error:", error);
        return {};
    }
};

// Generate Token
const generateValuePitchToken = async () => {
    try {
        const response = await axios.post(
            'https://prod.crimescan.ai/v1/verify_manual_api/api/users/signIn',
            {
                username: process.env.VALUEPITCH_USERNAME,
                password: process.env.VALUEPITCH_PASSWORD
            },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );

        const token = response?.data?.apiKey || null;

        if (!token) {
            return { status: false, message: "Token not found", data: response.data };
        }

        return { status: true, token };

    } catch (error) {
        return {
            status: false,
            message: "Token failed",
            error: error?.response?.data || error.message
        };
    }
};

/*
const addValuePitchCaseData= {
  username: "manual_api_test_user_name",
  name: "Salman Khan",
  applicantId: "test_123",
  addresses: [
    {
      address: "Galaxy Apartments Bandra Mumbai Maharashtra",
      periodOfStay: "5 years"
    }
  ],
  dob: "01/01/1965",
  fatherName: "Salim Khan"
};
*/

// Add Case with dynamic data
const addValuePitchCase = async (data) => {
    try {
        console.log("Step 1: Input data ->", data);

        const tokenRes = await generateValuePitchToken();

        if (!tokenRes.status) {
            return tokenRes;
        }

        const token = tokenRes.token;

        console.log("Step 2: Token received");

        // ✅ Dynamic mapping with fallback
        const payload = {
            username: process.env.VALUEPITCH_USERNAME,
            name: data?.name || "",
            applicantId: data?.applicantId || "",
            addresses: (data?.addresses || []).map(addr => ({
                address: addr?.address || "",
                periodOfStay: addr?.periodOfStay || ""
            })),
            dob: data?.dob || "",
            fatherName: data?.fatherName || ""
        };

        console.log("Step 3: Final payload ->", payload);

        const response = await axios.post(
            'https://mvp.verify24x7.in/verifyManualApi/api/tasks/addCases',
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        console.log("Step 4: API response ->", response.data);

        return {
            status: true,
            data: response.data
        };

    } catch (error) {
        console.error("Case API failed ->", error?.response?.data || error.message);

        return {
            status: false,
            message: "Case creation failed",
            error: error?.response?.data || error.message
        };
    }
};
const fetchValuePitchStatus = async (data) => {
    console.log('datasss', data)
    try {

        if (!data?.verifyId) {
            return { status: false, message: "verifyId is required" };
        }

        const tokenRes = await generateValuePitchToken();
        if (!tokenRes.status) return tokenRes;

        const token = tokenRes.token;

        const payload = {
            username: process.env.VALUEPITCH_USERNAME,
            verifyId: data.verifyId
        };

        const response = await axios.post(
            "https://prod.crimescan.ai/v1/verify_manual_api/api/tasks/getCaseStatus",
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                validateStatus: () => true
            }
        );

        const apiData = response.data;


        return {
            status: true,
            data: apiData
        };

    } catch (error) {
        return {
            status: false,
            error: error?.response?.data || error.message
        };
    }
};

const fetchValuePitchReportData = async (data) => {
    console.log('datasss', data)
    try {

        if (!data?.verifyId) {
            return { status: false, message: "verifyId is required" };
        }

        const tokenRes = await generateValuePitchToken();
        if (!tokenRes.status) return tokenRes;

        const token = tokenRes.token;

        const payload = {
            username: process.env.VALUEPITCH_USERNAME,
            verifyId: data.verifyId
        };

        const response = await axios.post(
            "https://prod.crimescan.ai/v1/verify_manual_api/api/tasks/getCaseResultsWithReports",
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                validateStatus: () => true
            }
        );

        const apiData = response.data;


        return {
            status: true,
            data: apiData
        };

    } catch (error) {
        return {
            status: false,
            error: error?.response?.data || error.message
        };
    }
};
// Export
module.exports = {
    generateValuePitchToken,
    addValuePitchCase,
    saveValuePitchStatus,
    getValuePitchFromDB,
    listPendingValuePitchCases,
    saveValuePitchPollResult,
    markValuePitchReadyMailSent,
    claimValuePitchReadyMail,
    hasValuePitchReadySuccess,
    getValuePitchCheckinStatuses,
    fetchValuePitchStatus,
    fetchValuePitchReportData
};
