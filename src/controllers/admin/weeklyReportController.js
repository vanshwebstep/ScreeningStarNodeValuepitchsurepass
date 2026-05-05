const WeeklyReport = require("../../models/admin/weeklyReportModel");
const Common = require("../../models/admin/commonModel");

exports.index = (req, res) => {
  const { admin_id, _token } = req.query;

  // Check for missing fields
  let missingFields = [];
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  Common.isAdminTokenValid(_token, admin_id, (err, result) => {
    if (err) {
      console.error("Error checking token validity:", err);
      return res.status(500).json(err);
    }

    if (!result.status) {
      return res.status(401).json({ status: false, message: result.message });
    }

    const newToken = result.newToken;

    // Get the current date details
    const currentDate = new Date();
    const currentDay = currentDate.getDay();

    // Calculate first and last days of the current week
    const firstDayOfWeek = new Date(currentDate);
    firstDayOfWeek.setDate(currentDate.getDate() - currentDay);
    const lastDayOfWeek = new Date(currentDate);
    lastDayOfWeek.setDate(currentDate.getDate() + (6 - currentDay));

    // Format dates for SQL query
    const startOfWeek = firstDayOfWeek.toISOString().split("T")[0];
    const endOfWeek = lastDayOfWeek.toISOString().split("T")[0];

    // Retrieve weekly reports within the current week
    WeeklyReport.list(startOfWeek, endOfWeek, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ status: false, message: err.message, token: newToken });
      }

      return res.json({
        status: true,
        message: "Weekly reports sent successfully",
        token: newToken,
        data: result,
      });
    });
  });
};
