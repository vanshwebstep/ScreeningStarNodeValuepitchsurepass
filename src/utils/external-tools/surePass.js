const axios = require("axios");
const { sequelize } = require("../../config/db");


// ✅ SAVE COMMON SUREPASS RESPONSE
const saveSurepassStatus = async (data) => {
    try {
        console.log("📦 [DB] Saving Surepass response...");
        console.log("➡️ Service:", data.service_name);
        console.log("➡️ Application ID:", data.application_id);

        const sql = `
      INSERT INTO surepass_status 
      (service_name, service_id, application_id, request_json, response_json, status_code)
      VALUES (:service_name, :service_id, :application_id, :request_json, :response_json, :status_code)
      ON DUPLICATE KEY UPDATE
        response_json = VALUES(response_json),
        status_code = VALUES(status_code),
        request_json = VALUES(request_json)
    `;

        const [result] = await sequelize.query(sql, {
            replacements: {
                service_name: data.service_name,
                service_id: data.service_id,
                application_id: data.application_id,
                request_json: JSON.stringify(data.request),
                response_json: JSON.stringify(data.response),
                status_code: data.response?.status_code || null,
            },
        });

        console.log("✅ [DB] Save successful");
        return result;

    } catch (err) {
        console.error("❌ [DB ERROR] Failed to save Surepass:", err);
        throw err;
    }
};
const getServicesWithPrefill = async ({ service_ids, application_id }) => {
    try {
        console.log("📥 Incoming:", { service_ids, application_id });

        // 🔹 Step 1: Get application services
        const appResult = await sequelize.query(
            `SELECT services FROM client_applications WHERE id = :application_id`,
            {
                replacements: { application_id },
                type: sequelize.QueryTypes.SELECT,
            }
        );

        let appServiceIds = [];

        if (appResult.length && appResult[0].services) {
            appServiceIds = appResult[0].services
                .split(",")
                .map(id => id.trim());
        }

        console.log("📊 Application Services:", appServiceIds);

        // 🔹 Step 2: Fetch surepass data
        const surepassData = await sequelize.query(
            `
            SELECT service_id, request_json, response_json
            FROM surepass_status
            WHERE application_id = :application_id
            AND service_id IN (:service_ids)
        `,
            {
                replacements: {
                    application_id,
                    service_ids,
                },
                type: sequelize.QueryTypes.SELECT,
            }
        );

        // 🔹 Step 3: Map bana lo
        const surepassMap = {};

        surepassData.forEach(item => {
            surepassMap[item.service_id] = {
                request: item.request_json,
                response: item.response_json,
            };
        });

        // 🔹 Step 4: Final result ONLY for payload services
        const finalServices = service_ids.map(serviceId => {
            const cleanId = String(serviceId).trim();

            const existsInApplication = appServiceIds.includes(cleanId);

            let is_prefilled = false;
            let status = "not_exist";
            let request_json = null;
            let response_json = null;

            if (existsInApplication) {
                const spData = surepassMap[cleanId];

                if (spData && spData.request && spData.response) {
                    is_prefilled = true;
                    status = "exist";

                    request_json = JSON.parse(spData.request);
                    response_json = JSON.parse(spData.response);
                } else {
                    status = "data_not_found";
                }
            } else {
                status = "service_not_in_application";
            }

            return {
                service_id: cleanId,
                exists_in_application: existsInApplication,
                is_prefilled,
                status,
                request_json,
                response_json,
            };
        });

        return {
            status: true,
            data: finalServices,
        };

    } catch (err) {
        console.error("❌ ERROR:", err);

        return {
            status: false,
            message: "Something went wrong",
            error: err.message
        };
    }
};
const getSurepassStatusList = async (req, res) => {
    try {
        console.log("📥 [DB] Fetching Surepass records...");

        const { service_name, application_id, limit = 10, offset = 0 } = req.query;

        let whereClause = "WHERE 1=1";
        const replacements = {};

        // 🔍 Optional Filters
        if (service_name) {
            whereClause += " AND service_name = :service_name";
            replacements.service_name = service_name;
        }

        if (application_id) {
            whereClause += " AND application_id = :application_id";
            replacements.application_id = application_id;
        }

        const sql = `
            SELECT 
                id,
                service_name,
                service_id,
                application_id,
                request_json,
                response_json,
                status_code,
                created_at,
                updated_at
            FROM surepass_status
            ${whereClause}
            ORDER BY id DESC
            LIMIT :limit OFFSET :offset
        `;

        const results = await sequelize.query(sql, {
            replacements: {
                ...replacements,
                limit: Number(limit),
                offset: Number(offset),
            },
            type: sequelize.QueryTypes.SELECT,
        });

        console.log(`✅ [DB] ${results.length} records fetched`);

        return res.status(200).json({
            success: true,
            count: results.length,
            data: results,
        });

    } catch (err) {
        console.error("❌ [DB ERROR] Fetch failed:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch Surepass records",
        });
    }
};

// ✅ GENERIC API CALL
const hitSurepassAPI = async ({ endpoint, payload }) => {
    try {
        console.log("🌐 [API] Calling Surepass...");
        console.log("➡️ Endpoint:", endpoint);
        console.log("➡️ Payload:", payload);

        const response = await axios.post(
            `https://kyc-api.surepass.app${endpoint}`,
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.SUREPASS_TOKEN}`,
                },
                validateStatus: () => true
            }
        );

        console.log("📥 [API RESPONSE]:", response.data);

        return {
            status: true,
            data: response.data
        };

    } catch (error) {
        console.error("❌ [API ERROR]:", error?.response?.data || error.message);

        return {
            status: false,
            error: error?.response?.data || error.message
        };
    }
};



// ✅ SERVICE CONFIG
const SUREPASS_SERVICES = {
    aadhaar_to_uan: {
        endpoint: "/api/v1/income/epfo/aadhaar-to-uan",
        mapPayload: (data) => ({
            aadhaar_number: data.aadhaar_number,
        }),
    },
    mobile_to_uan: {
        endpoint: "/api/v1/income/epfo/find-uan",
        mapPayload: (data) => ({
            mobile_number: data.mobile_number,
        }),
    },
    pan_to_current_employment: {
        endpoint: "/api/v1/employment/pan-to-current-employment",
        mapPayload: (data) => ({
            pan_number: data.pan_number,
        }),
    },
    current_employment_details: {
        endpoint: "/api/v1/employment/current-employment-pan-mobile",
        mapPayload: (data) => ({
            uan_number: data.uan_number,
            pan_number: data.pan_number,
            mobile_number: data.mobile_number,

        }),
    },
    current_employment_pan_mobile: {
        endpoint: "/api/v1/employment/current-employment-pan-mobile",
        mapPayload: (data) => ({
            uan_number: data.uan_number,
            pan_number: data.pan_number,
            mobile_number: data.mobile_number,

        }),
    },
    passport_verification: {
        endpoint: "/api/v1/passport/passport/passport-details",
        mapPayload: (data) => ({
            id_number: data.id_number,
            dob: data.dob,
        }),
    },
    driving_license_check: {
        endpoint: "/api/v1/driving-license/driving-license",
        mapPayload: (data) => ({
            id_number: data.id_number,
            dob: data.dob,
        }),
    },
    bank_verify: {
        endpoint: "/api/v1/bank-verification",
        mapPayload: (data) => ({
            account_number: data.account_number,
            ifsc: data.ifsc,
        }),
    },
    aadhaar_validation: {
        endpoint: "/api/v1/aadhaar-validation/aadhaar-validation",
        mapPayload: (data) => ({
            id_number: data.id_number,
        }),
    },
    voter_id_verification: {
        endpoint: "/api/v1/voter-id/voter-id",
        mapPayload: (data) => ({
            id_number: data.id_number,
        }),
    },
    director_phone: {
        endpoint: "/api/v1/corporate/director-phone",
        mapPayload: (data) => ({
            id_number: data.id_number,
        }),
    },
    tan_verification: {
        endpoint: "/api/v1/tan/",
        mapPayload: (data) => ({
            id_number: data.id_number,
        }),
    },
    tan_company_search: {
        endpoint: "/api/v1/tan/",
        mapPayload: (data) => ({
            id_number: data.id_number,
        }),

    },
    tds_check: {
        endpoint: "/api/v1/tan/tds-check",
        mapPayload: (data) => ({
            tan_number: data.tan_number,
            pan_number: data.pan_number,
            year: data.year,
            quarter: data.quarter,
            type_of_return: data.type_of_return,
        }),

    },
    itr_compliance_check: {
        endpoint: "/api/v1/itr/itr-compliance-check",
        mapPayload: (data) => ({
            pan_number: data.pan_number,
        }),
    },
    mobile_to_pan: {
        endpoint: "/api/v1/pan/mobile-to-pan",
        mapPayload: (data) => ({
            mobile_no: data.mobile_no,
            name: data.name,
        }),
    },
    mobile_number_to_pan_number: {
        endpoint: "/api/v1/pan/mobile-to-pan",
        mapPayload: (data) => ({
            mobile_no: data.mobile_no,
            name: data.name,
        }),
    },
    pan_advanced: {
        endpoint: "/api/v1/pan/pan-adv",
        mapPayload: (data) => ({
            id_number: data.id_number,
        }),
    },
    pan_comprehensive_plus: {
        endpoint: "/api/v1/pan/pan-comprehensive-plus",
        mapPayload: (data) => ({
            id_number: data.id_number,
        }),
    },
    digilocker: {
        endpoint: "/api/v1/digilocker/initialize",
        mapPayload: (data) => ({
            redirect_url: data.redirect_url,
            skip_main_screen: data.skip_main_screen,
            signup_flow: data.signup_flow,
            full_name: data.full_name,
            user_email: data.user_email,
            mobile_number: data.mobile_number,
            expiry_minutes: data.expiry_minutes,
            verify_email: data.verify_email,
            send_email: data.send_email,
            send_sms: data.send_sms,
            verify_phone: data.verify_phone,

        }),
    },
    bank_verification: {
        endpoint: "/api/v1/bank-verification",
        mapPayload: (data) => ({
            id_number: data.id_number,
            ifsc: data.ifsc,
            ifsc_details: data.ifsc_details,
        }),

    },
};




// ✅ MAIN RUNNER
const runSurepassService = async ({
    service_name,
    service_id,
    application_id,
    raw_data
}) => {
    try {
        console.log("🔥 [START] Surepass Execution");
        console.log("➡️ Service Name:", service_name);
        console.log("➡️ Raw Data:", raw_data);

        // 🔍 service config fetch
        const service = SUREPASS_SERVICES[service_name];

        if (!service) {
            console.error("❌ Invalid service_name:", service_name);
            return { status: false, message: "Invalid service_name" };
        }

        console.log("✅ Service config found");

        // ✅ payload mapping
        const payload = service.mapPayload(raw_data);
        console.log("📤 Final Payload:", payload);

        // ⛔ validation
        if (Object.values(payload).some(v => !v)) {
            console.warn("⚠️ Payload has empty values");
        }

        // 🧠 👉 Digilocker special case
        // 🧠 👉 Digilocker special case
        let apiPayload = payload;
        // ✅ API CALL
        let requestToSave = payload;
        if (service_name === "digilocker") {
            apiPayload = {
                data: {
                    expiry_minutes: Number(payload.expiry_minutes) || 0,

                    send_sms: Boolean(payload.send_sms),
                    send_email: Boolean(payload.send_email),
                    verify_phone: Boolean(payload.verify_phone),
                    verify_email: Boolean(payload.verify_email),

                    redirect_url: payload.redirect_url?.trim() || "",

                    skip_main_screen: Boolean(payload.skip_main_screen),
                    signup_flow: Boolean(payload.signup_flow),

                    prefill_options: {
                        full_name: payload.full_name?.trim() || "",
                        user_email: payload.user_email?.trim() || "",
                        mobile_number: String(payload.mobile_number || "")
                    }
                }
            };
            requestToSave = apiPayload;

            console.log("📦 Digilocker Payload:", JSON.stringify(apiPayload, null, 2));
        }


        // 👉 Digilocker ke case me transformed payload save karo
        if (service_name === "digilocker") {
            requestToSave = apiPayload;
        }
        console.log("🚀 Step: Calling API...");
        const apiRes = await hitSurepassAPI({
            endpoint: service.endpoint,
            payload: requestToSave   // 👈 yaha change
        });

        if (!apiRes.status) {
            console.error("❌ API failed, stopping flow");
            return apiRes;
        }

        console.log("✅ API Success");

        // ✅ SAVE RESPONSE (original payload hi save hoga)

        console.log("💾 Step: Saving response to DB...");
        await saveSurepassStatus({
            service_name,
            service_id,
            application_id,
            request: requestToSave,   // 👈 original payload
            response: apiRes.data
        });

        console.log("🏁 [END] Surepass Success");

        return {
            status: true,
            data: apiRes.data
        };

    } catch (error) {
        console.error("❌ [FATAL ERROR]:", error);

        return {
            status: false,
            message: "Surepass execution failed",
            error: error.message
        };
    }
};



module.exports = {
    runSurepassService,
    getSurepassStatusList,
    getServicesWithPrefill
};