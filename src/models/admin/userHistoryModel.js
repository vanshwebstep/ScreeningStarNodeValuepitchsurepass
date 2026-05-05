const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const moment = require("moment"); // Ensure you have moment.js installed

const tatDelay = {
  index: async (callback) => {
    // SQL query to retrieve applications, customers, branches, tat_days, and admin details
    const SQL = `
                SELECT 
                    logs.admin_id,
                    admins.name AS admin_name,
                    admins.profile_picture,
                    admins.email AS admin_email,
                    admins.mobile AS admin_mobile,
                    admins.emp_id,
                    -- First login time
                    MIN(logs.created_at) AS first_login_time,
                    -- Last logout time
                    MAX(logs.created_at) AS last_logout_time,
                    -- First login time
                    MIN(logs.created_at) AS created_at
                FROM admin_login_logs AS logs
                INNER JOIN admins ON logs.admin_id = admins.id
                WHERE logs.action IN ('login')
                GROUP BY logs.admin_id, DATE(logs.created_at)
                ORDER BY logs.admin_id, DATE(logs.created_at) DESC;
    `;
    const applicationResults = await sequelize.query(SQL, {
      type: QueryTypes.SELECT,
    });

    if (applicationResults.length === 0) {
      return callback(null, { message: "No records found" });
    }
    // Return the processed data
    return callback(null, applicationResults);
  },

  /*
  attendanceIndex: async (callback) => {
    try {
      // Step 1: Fetch all admins
      const admins = await sequelize.query(`
        SELECT id AS admin_id, name AS admin_name, profile_picture, email AS admin_email, mobile AS admin_mobile, emp_id
        FROM admins
      `, {
        type: QueryTypes.SELECT,
      });

      // Step 2: Fetch all check-ins/outs
      const attendanceRecords = await sequelize.query(`
        SELECT 
          cio.admin_id,
          cio.status,
          cio.created_at,
          DATE(cio.created_at) AS record_date,
          (
            SELECT MIN(logs.created_at)
            FROM admin_login_logs AS logs
            WHERE logs.admin_id = cio.admin_id 
              AND logs.action = 'login'
              AND DATE(logs.created_at) = DATE(cio.created_at)
          ) AS first_login_time
        FROM check_in_outs AS cio
        ORDER BY DATE(cio.created_at) DESC
      `, {
        type: QueryTypes.SELECT,
      });

      // Step 3: Fetch break data
      const breaks = await sequelize.query(`
        SELECT b.*
        FROM admin_breaks b
        INNER JOIN (
          SELECT admin_id, type, DATE(created_at) AS record_date, MAX(id) AS max_id
          FROM admin_breaks
          GROUP BY admin_id, type, DATE(created_at)
        ) latest
        ON b.id = latest.max_id
      `, {
        type: QueryTypes.SELECT,
      });

      // Step 4: Group all attendance and breaks
      const grouped = {};

      for (const record of attendanceRecords) {
        const date = record.record_date;
        const adminId = record.admin_id;

        if (!grouped[date]) grouped[date] = {};
        if (!grouped[date][adminId]) {
          grouped[date][adminId] = {
            date,
            admin_id: adminId,
            first_check_in_time: null,
            last_check_out_time: null,
            check_in_outs: [],
            breaks: [],
            first_login_time: record.first_login_time,
          };
        }

        const entry = grouped[date][adminId];

        const isCheckIn = record.status === 'check-in';
        const isCheckOut = record.status === 'check-out';

        if (isCheckIn) {
          if (!entry.first_check_in_time || new Date(record.created_at) < new Date(entry.first_check_in_time)) {
            entry.first_check_in_time = record.created_at;
          }
        }

        if (isCheckOut) {
          if (!entry.last_check_out_time || new Date(record.created_at) > new Date(entry.last_check_out_time)) {
            entry.last_check_out_time = record.created_at;
          }
        }

        entry.check_in_outs.push({
          status: record.status,
          time: record.created_at,
        });
      }

      for (const brk of breaks) {
        const date = brk.created_at.toISOString().split("T")[0];
        const adminId = brk.admin_id;

        if (!grouped[date]) grouped[date] = {};
        if (!grouped[date][adminId]) {
          grouped[date][adminId] = {
            date,
            admin_id: adminId,
            first_check_in_time: null,
            last_check_out_time: null,
            check_in_outs: [],
            breaks: [],
            first_login_time: null,
          };
        }

        grouped[date][adminId].breaks.push({
          type: brk.type,
          time: brk.created_at,
        });
      }

      // Step 5: Final result: ensure all admins exist even if no attendance or break
      const result = [];

      const allDates = Object.keys(grouped);
      for (const admin of admins) {
        for (const date of allDates) {
          const base = grouped[date][admin.admin_id] || {
            date,
            admin_id: admin.admin_id,
            first_check_in_time: null,
            last_check_out_time: null,
            check_in_outs: [],
            breaks: [],
            first_login_time: null,
          };

          result.push({
            ...base,
            admin_name: admin.admin_name,
            profile_picture: admin.profile_picture,
            admin_email: admin.admin_email,
            admin_mobile: admin.admin_mobile,
            emp_id: admin.emp_id,
          });
        }
      }

      // Optional: sort result by date descending
      result.sort((a, b) => new Date(b.date) - new Date(a.date));
      const filteredResult = result.filter(item => item.check_in_outs.length > 0 || item.breaks.length > 0);
      return callback(null, filteredResult);

      // return callback(null, result);
    } catch (error) {
      console.error("Error in index:", error);
      return callback(error, null);
    }
  },
  */

  attendanceIndex: async (fromMonth, fromYear, toMonth, toYear, callback) => {
    try {
      const breakTableName = "admin_breaks";
      const adminLoginLogsTableName = "admin_login_logs";

      console.table({ fromMonth, fromYear, toMonth, toYear });

      // Format date as YYYY-MM-DD
      const formatDate = (date, type = '') => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0'); // month is 0-indexed
        const dd = String(date.getDate()).padStart(2, '0');

        if (type === 'start') {
          return `${yyyy}-${mm}-${dd} 00:00:00`;
        } else if (type === 'end') {
          return `${yyyy}-${mm}-${dd} 23:59:59`;
        }else{
          return `${yyyy}-${mm}-${dd}`;
        }
      };

      // First and last day of month
      const fromDate = formatDate(new Date(fromYear, fromMonth - 1, 1), 'start'); // 1st day
      const toDate = formatDate(new Date(toYear, toMonth, 0), 'end');           // last day

      console.log("fromDate -", fromDate); // 2025-09-01
      console.log("toDate -", toDate);     // 2025-09-30

      console.log("Fetching all admins...");
      const admins = await sequelize.query(
        `
      SELECT id AS admin_id, name AS admin_name, profile_picture, email AS admin_email, mobile AS admin_mobile, emp_id
      FROM admins
    `,
        {
          type: QueryTypes.SELECT,
        }
      );

      console.log(`Fetched Admins - `, admins.length);

      console.log("Fetching all distinct dates...");
      const datesResult = await sequelize.query(
        `
                                                SELECT DISTINCT DATE(created_at) AS date
                                                FROM ${adminLoginLogsTableName}
                                                WHERE created_at BETWEEN :fromDate AND :toDate
                                                AND result = '1'
                                                ORDER BY date DESC
                                              `,
        {
          replacements: { fromDate, toDate },
          type: QueryTypes.SELECT,
        }
      );

      console.log(`Fetched Dates - `, datesResult.length);

      const distinctDates = datesResult.map((d) => d.date);

      console.log("Fetching all distinct break types...");
      const breakTypesResult = await sequelize.query(
        `
      SELECT DISTINCT type FROM ${breakTableName}
    `,
        { type: QueryTypes.SELECT }
      );

      const breakTypes = breakTypesResult.map((t) => t.type);

      console.log(`Fetched BreakTypes - `, breakTypes.length);

      console.log("Fetching all login/logout records...");
      const loginLogoutRecords = await sequelize.query(
        `
                                                      SELECT admin_id, action, created_at, DATE(created_at) AS date
                                                      FROM ${adminLoginLogsTableName}
                                                      WHERE action IN ('login', 'logout')
                                                      AND result = '1'
                                                      AND created_at BETWEEN :fromDate AND :toDate
                                                    `,
        {
          replacements: { fromDate, toDate },
          type: QueryTypes.SELECT,
        }
      );

      console.log(`fromDate - `, fromDate);
      console.log(`toDate - `, toDate);

      console.log(`[SQL] loginLogoutRecords - `, loginLogoutRecords);

      console.log("Fetching all break records...");
      const breakRecords = await sequelize.query(
        `
                                            SELECT admin_id, type, created_at, DATE(created_at) AS date
                                            FROM ${breakTableName}
                                            WHERE created_at BETWEEN :fromDate AND :toDate
                                          `,
        {
          replacements: { fromDate, toDate },
          type: QueryTypes.SELECT,
        }
      );

      console.log("Fetching leave records...");
      const leaveRecords = await sequelize.query(
        `
                                                SELECT admin_id, purpose_of_leave, from_date, to_date, remarks
                                                FROM personal_managers
                                                WHERE status = 1 AND (
                                                  (from_date BETWEEN :fromDate AND :toDate)
                                                  OR (to_date BETWEEN :fromDate AND :toDate)
                                                  OR (:fromDate BETWEEN from_date AND to_date)
                                                  OR (:toDate BETWEEN from_date AND to_date)
                                                )
                                              `,
        {
          replacements: { fromDate, toDate },
          type: QueryTypes.SELECT,
        }
      );

      console.log("Organizing data...");
      const loginMap = {};
      for (const log of loginLogoutRecords) {
        const key = `${log.admin_id}_${log.date}`;
        const DEBUG = log.admin_id === 89;

        // Optional debug logs for specific admin
        if (DEBUG) {
          console.log(`\n[DEBUG] Processing log:`, log);
          console.log(`[DEBUG] Generated key:`, key);
        }

        // Initialize map entry if not exists
        if (!loginMap[key]) {
          loginMap[key] = { login: null, logout: null };
          if (DEBUG) {
            console.log(`[DEBUG] Initialized loginMap[${key}]:`, loginMap[key]);
          }
        }

        if (log.action === "login") {
          if (DEBUG) {
            console.log(`[DEBUG] Action is login. Current stored login:`, loginMap[key].login);
          }

          if (!loginMap[key].login || new Date(log.created_at) < new Date(loginMap[key].login)) {
            if (DEBUG) {
              console.log(`[DEBUG] Updating login time from ${loginMap[key].login} to ${log.created_at}`);
            }
            loginMap[key].login = log.created_at;
          }
        } else if (log.action === "logout") {
          if (DEBUG) {
            console.log(`[DEBUG] Action is logout. Current stored logout:`, loginMap[key].logout);
          }

          if (!loginMap[key].logout || new Date(log.created_at) > new Date(loginMap[key].logout)) {
            if (DEBUG) {
              console.log(`[DEBUG] Updating logout time from ${loginMap[key].logout} to ${log.created_at}`);
            }
            loginMap[key].logout = log.created_at;
          }
        }

        if (DEBUG) {
          console.log(`[DEBUG] Current loginMap[${key}]:`, loginMap[key]);
        }
      }

      console.log(`loginMap - `, loginMap);



      const breakMap = {};
      for (const brk of breakRecords) {
        const key = `${brk.admin_id}_${brk.date}`;
        breakMap[key] = breakMap[key] || {};
        if (
          !breakMap[key][brk.type] ||
          new Date(brk.created_at) < new Date(breakMap[key][brk.type])
        ) {
          breakMap[key][brk.type] = brk.created_at;
        }
      }

      const leaveMap = {};
      for (const leave of leaveRecords) {
        leaveMap[leave.admin_id] = leaveMap[leave.admin_id] || [];
        leaveMap[leave.admin_id].push({
          purpose_of_leave: leave.purpose_of_leave,
          remarks: leave.remarks,
          from_date: leave.from_date,
          to_date: leave.to_date,
        });
      }

      function isDateInRange(dateStr, from, to) {
        const date = new Date(dateStr);
        return new Date(from) <= date && date <= new Date(to);
      }

      const finalResult = [];
      for (const admin of admins) {
        const leaves = leaveMap[admin.admin_id] || [];

        for (const date of distinctDates) {
          const key = `${admin.admin_id}_${date}`;
          const logData = loginMap[key] || {};
          console.log(`admin.admin_id - `, admin.admin_id);
          if (admin.admin_id == 89) {
            console.log(`key - `, key);
            console.log(`logData - `, logData);
          }
          const breakData = breakMap[key] || {};

          const breakTimes = {};
          for (const type of breakTypes) {
            breakTimes[type] = breakData[type] || null;
          }

          // Check if it's a leave day
          const leaveForDay = leaves.find((l) => isDateInRange(date, l.from_date, l.to_date));

          // ✅ If leave exists AND no login/logout records, consider it a leave day
          const hasLog = logData.login || logData.logout;
          const hasBreak = breakMap[key] && Object.keys(breakMap[key]).length > 0;

          // Skip this entry if it's a leave day and logs exist (conflict case)
          if (leaveForDay && (hasLog || hasBreak)) {
            // Optionally log conflict
            console.warn(`⚠️ Leave conflict: Admin ${admin.admin_id} has logs on leave date ${date}`);
            // continue; // OR handle differently
          }

          finalResult.push({
            date,
            admin_id: admin.admin_id,
            admin_name: admin.admin_name,
            profile_picture: admin.profile_picture,
            admin_email: admin.admin_email,
            admin_mobile: admin.admin_mobile,
            emp_id: admin.emp_id,
            first_login_time: logData.login || null,
            last_logout_time: logData.logout || null,
            break_times: breakTimes,
            purpose_of_leave: leaveForDay ? leaveForDay.purpose_of_leave : null,
            leave_from_date: leaveForDay ? leaveForDay.from_date : null,
            leave_to_date: leaveForDay ? leaveForDay.to_date : null,
          });
        }
      }

      finalResult.sort((a, b) => new Date(a.date) - new Date(b.date));

      console.log("Final result compiled. Total entries:", finalResult.length);
      return callback(null, {
        attendance_records: finalResult,
        leave_summary: leaveMap,
      });

    } catch (error) {
      console.error("Error in attendanceIndex:", error);
      return callback(error, null);
    }
  },

  activityList: async (logDate, adminId, callback) => {
    const query = `SELECT * FROM \`admin_activity_logs\` WHERE \`admin_id\` = ? AND DATE(created_at) = ?;`;

    console.log("Database connection established successfully.");
    const results = await sequelize.query(query, {
      replacements: [adminId, logDate],
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  },
};

// Helper function to handle query errors and release connection
function handleQueryError(err, connection, callback) {
  console.error("Query error:", err);

  callback(err, null);
}

module.exports = tatDelay;
