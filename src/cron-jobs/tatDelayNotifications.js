const cron = require("node-cron");
const tatDelayController = require("../controllers/admin/tatDelayController");

console.log("🚀 Cron job initialized...");

// ✅ Immediately trigger the function once on script start
console.log("🔔 Running immediate TAT delay notification...");
tatDelayController.sendAutoNotification(
    { body: {} }, // Mock request object
    {
        status: (code) => ({
            json: (response) => console.log(`Immediate Response (${code}):`, response),
        }),
        headersSent: false,
    }
);

// 🕒 Schedule cron job to run daily at 8 AM, 12 PM, 4 PM, 8 PM, and 11 PM
cron.schedule("0 8,12,16,20,23 * * *", () => {
    console.log("🕒 Executing scheduled TAT delay notifications...");

    tatDelayController.sendAutoNotification(
        { body: {} }, // Mock request object
        {
            status: (code) => ({
                json: (response) => console.log(`Scheduled Response (${code}):`, response),
            }),
            headersSent: false,
        }
    );
});

// Uncomment below for testing: runs every 5 seconds
// cron.schedule("*/5 * * * * *", () => console.log("Test run: every 5 seconds"));
// pm2 start src/cron-jobs/tatDelayNotifications.js --name tat-delay-job
