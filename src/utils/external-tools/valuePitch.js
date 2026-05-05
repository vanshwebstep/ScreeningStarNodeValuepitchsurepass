const axios = require('axios');
const { sequelize } = require("../../config/db"); // Import the existing MySQL connection

const saveValuePitchStatus = async (data) => {
    console.log('data jo valuepitch mai save hora hai', data)
    try {
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
                response_json: JSON.stringify(data.response),
                status_code: JSON.stringify(data.response?.statusCode) || null
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
    fetchValuePitchStatus,
    fetchValuePitchReportData
};