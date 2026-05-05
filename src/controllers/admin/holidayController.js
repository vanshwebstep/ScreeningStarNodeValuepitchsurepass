const Holiday = require("../../models/admin/holidayModel");
const Common = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to create a new holiday
exports.create = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { title, date, admin_id, _token } = req.body;

  let missingFields = [];
  if (!title || title === "") missingFields.push("Title");
  if (!date || date === "") missingFields.push("Date");
  if (!admin_id || date === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "admin_access";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      // Check the status returned by the authorization function
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
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

      Holiday.create(title, date, (err, result) => {
        if (err) {
          console.error("Database error:", err);
          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Holiday",
            "Create",
            "0",
            null,
            err,
            () => {}
          );
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        Common.adminActivityLog(
          ipAddress,
          ipType,
          admin_id,
          "Holiday",
          "Create",
          "1",
          `{id: ${result.insertId}}`,
          null,
          () => {}
        );

        res.json({
          status: true,
          message: "Holiday created successfully",
          holiday: result,
          token: newToken,
        });
      });
    });
  });
};

// Controller to list all holidays
exports.list = (req, res) => {
  const { admin_id, _token } = req.query;

  let missingFields = [];
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const action = "admin_access";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
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

      Holiday.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        res.json({
          status: true,
          message: "Holidays fetched successfully",
          holidays: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.getHolidayById = (req, res) => {
  const { id, admin_id, _token } = req.query;
  let missingFields = [];
  if (!id || id === "") missingFields.push("Holiday ID");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const action = "admin_access";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
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

      Holiday.getHolidayById(id, (err, currentHoliday) => {
        if (err) {
          console.error("Error fetching holiday data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        if (!currentHoliday) {
          return res.status(404).json({
            status: false,
            message: "Holiday not found",
            token: newToken,
          });
        }

        return res.json({
          status: true,
          message: "Holiday retrieved successfully",
          holiday: currentHoliday,
          token: newToken,
        });
      });
    });
  });
};

// Controller to update a holiday
exports.update = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, title, date, admin_id, _token } = req.body;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Holiday ID");
  if (!title || title === "") missingFields.push("Title");
  if (!date || date === "") missingFields.push("Date");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const action = "admin_access";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      // Check the status returned by the authorization function
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
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

      Holiday.getHolidayById(id, (err, currentHoliday) => {
        if (err) {
          console.error("Error fetching holiday data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        const changes = {};
        if (currentHoliday.title !== title) {
          changes.title = {
            old: currentHoliday.title,
            new: title,
          };
        }
        if (currentHoliday.date !== date) {
          changes.date = {
            old: currentHoliday.date,
            new: date,
          };
        }

        Holiday.update(id, title, date, (err, result) => {
          if (err) {
            console.error("Database error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Holiday",
              "Update",
              "0",
              JSON.stringify({ id, ...changes }),
              err,
              () => {}
            );
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Holiday",
            "Update",
            "1",
            JSON.stringify({ id, ...changes }),
            null,
            () => {}
          );

          return res.json({
            status: true,
            message: "Holiday updated successfully",
            holiday: result,
            token: newToken,
          });
        });
      });
    });
  });
};

// Controller to delete a holiday
exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { id, admin_id, _token } = req.query;

  let missingFields = [];
  if (!id || id === "") missingFields.push("Holiday ID");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const action = "admin_access";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      // Check the status returned by the authorization function
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
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

      Holiday.getHolidayById(id, (err, currentHoliday) => {
        if (err) {
          console.error("Error fetching holiday data:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        Holiday.delete(id, (err, result) => {
          if (err) {
            console.error("Database error:", err);
            Common.adminActivityLog(
              ipAddress,
              ipType,
              admin_id,
              "Holiday",
              "Delete",
              "0",
              JSON.stringify({ id, ...currentHoliday }),
              err,
              () => {}
            );
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          Common.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Holiday",
            "Delete",
            "1",
            JSON.stringify(currentHoliday),
            null,
            () => {}
          );

          return res.json({
            status: true,
            message: "Holiday deleted successfully",
            token: newToken,
          });
        });
      });
    });
  });
};
