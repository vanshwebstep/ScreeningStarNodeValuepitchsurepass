const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config(); // Ensure you load environment variables

// Import routes
const utilsRoutes = require("./routes/utilsRoutes");
const adminRoutes = require("./routes/admin/indexRoutes");
const vendorRoutes = require("./routes/admin/vendorRoutes");
const ticketRoutes = require("./routes/admin/ticketRoutes");
const packageRoutes = require("./routes/admin/packageRoutes");
const holidayRoutes = require("./routes/admin/holidayRoutes");
const serviceRoutes = require("./routes/admin/serviceRoutes");
const integratedServiceRoutes = require("./routes/admin/integratedServiceRoutes");
const customerRoutes = require("./routes/customer/indexRoutes");
const userHistoryRoutes = require("./routes/admin/userHistory");
const jsonFormRoutes = require("./routes/admin/jsonFormRoutes");
const tatDelayRoutes = require("./routes/admin/tatDelayRoutes");
const clientSpocRoutes = require("./routes/admin/clientSpocRoutes");
const branchRoutes = require("./routes/customer/branch/indexRoutes");
const internalStorageRoutes = require("./routes/admin/internalStorageRoutes");
const billingSpocRoutes = require("./routes/admin/billingSpocRoutes");
const reportMasterRoutes = require("./routes/admin/reportMasterRoutes");
const serviceGroupRoutes = require("./routes/admin/serviceGroupRoutes");
const notificationRoutes = require("./routes/admin/notificationRoutes");
const weeklyReportRoutes = require("./routes/admin/weeklyReportRoutes");
const emailTemplateRoutes = require("./routes/admin/emailTemplateRoutes");
const recordTrackerRoutes = require("./routes/admin/recordTrackerRoutes");
const invoiceMasterRoutes = require("./routes/admin/invoiceMasterRoutes");
const dataManagementRoutes = require("./routes/admin/dataManagementRoutes");
const teamManagementRoutes = require("./routes/admin/teamManagementRoutes");
const generateInvoiceRoutes = require("./routes/admin/generateInvoiceRoutes");
const personalManagerRoutes = require("./routes/admin/personalManagerRoutes");
const acknowledgementRoutes = require("./routes/admin/acknowledgementRoutes");
const clientAllocationRoutes = require("./routes/admin/clientAllocationRoutes");
const authorizedDetailRoutes = require("./routes/admin/authorizedDetailRoutes");
const escalationManagerRoutes = require("./routes/admin/escalationManagerRoutes");
const billingEscalationRoutes = require("./routes/admin/billingEscalationRoutes");
const trashedRoutes = require("./routes/admin/trashedRoutes");
const clientMasterTrackerRoutes = require("./routes/admin/clientMasterTrackerRoutes");
const externalLoginCredentials = require("./routes/admin/externalLoginCredentialsRoutes");
const documentCheckInTrackerRoutes = require("./routes/admin/documentCheckInTrackerRoutes");
const candidateMasterTrackerRoutes = require("./routes/admin/candidateMasterTrackerRoutes");
const expenseTrackerRoutes = require("./routes/admin/expenseTrackerRoutes");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static("uploads"));

// Define routes
app.use("/ticket", ticketRoutes);
app.use("/vendor", vendorRoutes);
app.use("/json-form", jsonFormRoutes);
app.use("/user-history", userHistoryRoutes);
app.use("/team-management", teamManagementRoutes);
app.use("/personal-manager", personalManagerRoutes);
app.use("/client-allocation", clientAllocationRoutes);
app.use("/document-check-in", documentCheckInTrackerRoutes);
app.use("/client-master-tracker", clientMasterTrackerRoutes);
app.use("/trashed", trashedRoutes);
app.use("/candidate-master-tracker", candidateMasterTrackerRoutes);

// =====----- EMPLOYEE CREDENTIALS -----=====
app.use("/admin", adminRoutes);

// =====----- CLIENT MASTER DATA -----=====
app.use("/customer", customerRoutes);
app.use("/client-spoc", clientSpocRoutes);
app.use("/billing-spoc", billingSpocRoutes);
app.use("/email-template", emailTemplateRoutes);
app.use("/authorized-detail", authorizedDetailRoutes);
app.use("/billing-escalation", billingEscalationRoutes);
app.use("/escalation-manager", escalationManagerRoutes);

// =====----- BILLING DASHBOARD -----=====
app.use("/record-tracker", recordTrackerRoutes);
app.use("/invoice-master", invoiceMasterRoutes);
app.use("/generate-invoice", generateInvoiceRoutes);
app.use("/expense-tracker", expenseTrackerRoutes);


// =====----- REPORT MASTER -----=====
app.use("/report-master", reportMasterRoutes);

// =====----- DATA MANAGEMENT -----=====
app.use("/data-management", dataManagementRoutes);

app.use("/branch", branchRoutes);
app.use("/internal-storage", internalStorageRoutes);
app.use("/package", packageRoutes);
app.use("/service", serviceRoutes);
app.use("/integrated-service", integratedServiceRoutes);
app.use("/holiday", holidayRoutes);
app.use("/notification", notificationRoutes);
app.use("/service-group", serviceGroupRoutes);
app.use("/weekly-reports", weeklyReportRoutes);
app.use("/acknowledgement", acknowledgementRoutes);
app.use("/tat-delay", tatDelayRoutes);
app.use("/external-login-credentials", externalLoginCredentials);
app.use("/utils", utilsRoutes);
// Error handling middleware (optional)
app.use((err, req, res, next) => {
  console.error(err.stack); // Log error stack for debugging
  res.status(500).send("Something broke!"); // Send a generic error message
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

