const Common = require("../../models/admin/commonModel");

exports.isAdminTokenValid = (req, res) => {
  const { admin_id } = req.params;

  if (!admin_id) {
    return res
      .status(400)
      .json({ status: false, message: "Admin ID is required" });
  }

  // Convert admin_id to a number to ensure correct type handling
  const adminId = Number(admin_id);

  Common.isAdminTokenValid(adminId, (err, result) => {
    if (err) {
      console.error("Error checking token validity:", err);
      return res.status(500).json(err);
    }

    // Respond based on the result from the model
    res.status(result.status ? 200 : 401).json(result);
  });
};
