const NotificationModel = require("../../models/admin/notificationsModel");
const Common = require("../../models/admin/commonModel");

exports.index = async (req, res) => {
  try {
    const { YWRtaW5faWQ } = req.query;

    if (!YWRtaW5faWQ) {
      return res.status(400).json({
        status: false,
        message: "Missing required field: admin_id",
      });
    }

    const decodedAdminId = Buffer.from(YWRtaW5faWQ, "base64").toString("utf8");
    const adminIdNumber = parseFloat(decodedAdminId);
    const adminId = adminIdNumber / 1.5;

    if (isNaN(adminId) || !adminId) {
      return res.status(400).json({
        status: false,
        message: "Invalid admin ID provided.",
      });
    }

    const tatDelayAction = "tat_reminder";
    const newApplicationsAction = "admin_manager";

    // Wrap authorization checks in promises
    const isAuthorized = (adminId, action) =>
      new Promise((resolve, reject) => {
        Common.isAdminAuthorizedForAction(adminId, action, (authResult) => {
          if (!authResult.status) {
            reject(new Error(authResult.message || "Unauthorized action")); // Reject the promise with an error
          } else {
            resolve(authResult.status); // Resolve the promise with the status
          }
        });
      });

    try {
      // Perform both authorization checks concurrently
      const [newApplicationStatus, tatDelayStatus] = await Promise.all([
        isAuthorized(adminId, newApplicationsAction),
        isAuthorized(adminId, tatDelayAction),
      ]);

      // Fetch TAT delay list
      NotificationModel.index((notificationErr, notificationResult) => {
        if (notificationErr) {
          console.error("TAT Delay List Error:", notificationErr);
          return res.status(500).json({
            status: false,
            err: notificationErr,
            message: "Error fetching TAT delay list.",
          });
        }

        if (!tatDelayStatus) {
          notificationResult.tatDelayList = [];
        }

        if (!newApplicationStatus) {
          notificationResult.newApplications = [];
        }

        return res.status(200).json({
          status: true,
          message: "Data fetched successfully.",
          data: notificationResult,
          totalNotifications: notificationResult.length,
        });
      });
    } catch (error) {
      console.error("Authorization Error:", error);
      return res.status(403).json({
        status: false,
        message: "Unauthorized action.",
      });
    }
  } catch (error) {
    console.error("Unexpected Error:", error);
    res.status(500).json({
      status: false,
      message: "An unexpected error occurred.",
    });
  }
};

exports.view = async (req, res) => {
  try {
    const { YWRtaW5faWQ } = req.query;

    if (!YWRtaW5faWQ) {
      return res.status(400).json({
        status: false,
        message: "Missing required field: admin_id",
      });
    }

    // Decode and calculate adminId
    const decodedAdminId = Buffer.from(YWRtaW5faWQ, "base64").toString("utf8");
    const adminIdNumber = parseFloat(decodedAdminId);
    const adminId = adminIdNumber / 1.5;

    if (isNaN(adminId) || !adminId) {
      return res.status(400).json({
        status: false,
        message: "Invalid admin ID provided.",
      });
    }

    const tatDelayAction = "tat_reminder";
    const newApplicationsAction = "admin_manager";

    // Helper function to perform authorization check
    const isAuthorized = (adminId, action) => {
      return new Promise((resolve, reject) => {
        Common.isAdminAuthorizedForAction(adminId, action, (authResult) => {
          if (!authResult.status) {
            reject(new Error(authResult.message || "Unauthorized action"));
          } else {
            resolve(authResult.status);
          }
        });
      });
    };

    // Perform authorization checks concurrently
    const [newApplicationStatus, tatDelayStatus] = await Promise.all([
      isAuthorized(adminId, newApplicationsAction),
      isAuthorized(adminId, tatDelayAction),
    ]);

    // Fetch TAT delay list
    NotificationModel.view((notificationErr, notificationResult) => {
      if (notificationErr) {
        console.error("TAT Delay List Error:", notificationErr);
        return res.status(500).json({
          status: false,
          err: notificationErr,
          message: "Error fetching TAT delay list.",
        });
      }

      // Update notification results based on authorization status
      if (!tatDelayStatus) {
        notificationResult.tatDelayList = [];
      }

      if (!newApplicationStatus) {
        notificationResult.newApplications = [];
      }

      return res.status(200).json({
        status: true,
        message: "Data fetched successfully.",
        data: notificationResult,
        totalNotifications: notificationResult.length,
      });
    });
  } catch (error) {
    console.error("Error:", error);

    // Differentiate errors between unauthorized and unexpected errors
    if (error.message === "Unauthorized action") {
      return res.status(403).json({
        status: false,
        message: "Unauthorized action.",
      });
    }

    return res.status(500).json({
      status: false,
      message: "An unexpected error occurred.",
    });
  }
};

