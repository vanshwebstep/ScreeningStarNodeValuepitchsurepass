const cron = require("node-cron");
const CEF = require("../models/customer/branch/cefModel");
const cefController = require("../controllers/customer/branch/candidate/cefController");

// Log to indicate that the cron job script has started
console.log("Cron job initialized...");

// Schedule a cron job to run at 8 AM, 12 PM, 4 PM, 8 PM, and 11 PM daily
cron.schedule("0 8,12,16,20,23 * * *", () => {
    console.log("Executing cron job for unsubmitted applications...");

    // Call the unsubmittedApplications function from the controller
    cefController.unsubmittedApplications(
        { body: {} }, // Simulated request object (empty body)
        {
            status: (code) => ({
                json: (response) => console.log(`Response (${code}):`, response),
            }),
            headersSent: false, // Ensure response headers are not sent prematurely
        }
    );
});

// Uncomment the following line to run the cron job every 5 seconds for testing/debugging
// cron.schedule("*/5 * * * * *", () => { console.log("Running every 5 seconds..."); });

/*
PM2
pm2 start src/cron-jobs/unsubmittedCandidateApplications.js --name unsubmittedBGVCronJob
cat ~/.pm2/logs/unsubmittedBGVCronJob-error.log
*/