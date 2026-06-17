const cron = require("node-cron");
const {
  fetchValuePitchStatus,
  fetchValuePitchReportData,
  listPendingValuePitchCases,
  saveValuePitchPollResult,
  markValuePitchReadyMailSent,
  claimValuePitchReadyMail,
  hasValuePitchReadySuccess
} = require("../utils/external-tools/valuePitch");
const { valuePitchReadyMail } = require("../mailer/admin/client-master-tracker/valuePitchReadyMail");

let isRunning = false;

const isValuePitchReady = (statusData) =>
  Number(statusData?.statusCode) === 201 &&
  String(statusData?.statusMsg || "").trim().toLowerCase() === "report is ready";

const isValuePitchReadyMailEnabled = () =>
  String(process.env.VALUEPITCH_READY_MAIL_ENABLED || "").toLowerCase() === "true";

async function processValuePitchCase(row) {
  const verifyId = row.verify_id;
  const label = `application=${row.application_code || row.application_id}, service=${row.service_name || row.service_id}, verifyId=${verifyId}`;

  const alreadyReady = await hasValuePitchReadySuccess({
    service_id: row.service_id,
    application_id: row.application_id,
    verifyId
  });

  if (alreadyReady) {
    console.log(
      `ValuePitch mail skipped because this application/service is already ready. ${label}, existingVerifyId=${alreadyReady.verify_id}`
    );
    return;
  }

  const statusResult = await fetchValuePitchStatus({ verifyId });
  const statusData = statusResult?.data || null;

  if (!statusResult?.status || !statusData) {
    console.log(`ValuePitch status not received yet for ${label}`);
    return;
  }

  if (!isValuePitchReady(statusData)) {
    console.log(`ValuePitch report not ready yet for ${label}. Response:`, statusData);
    await saveValuePitchPollResult({
      service_id: row.service_id,
      application_id: row.application_id,
      verifyId,
      statusResponse: statusData,
      reportResponse: row.parsed_response?.valuePitchReport || null,
      existingResponse: row.parsed_response || {}
    });
    return;
  }

  const reportResult = await fetchValuePitchReportData({ verifyId });
  const reportData = reportResult?.data || null;

  await saveValuePitchPollResult({
    service_id: row.service_id,
    application_id: row.application_id,
    verifyId,
    statusResponse: statusData,
    reportResponse: reportData,
    existingResponse: row.parsed_response || {}
  });

  const mailResponse = {
    ...(row.parsed_response || {}),
    ...statusData,
    valuePitchStatus: statusData,
    valuePitchReport: reportData,
    valuePitchLastCheckedAt: new Date().toISOString()
  };

  const readyBeforeMail = await hasValuePitchReadySuccess({
    service_id: row.service_id,
    application_id: row.application_id,
    verifyId
  });

  if (readyBeforeMail) {
    console.log(
      `ValuePitch mail skipped before send because this application/service became ready. ${label}, existingVerifyId=${readyBeforeMail.verify_id}`
    );
    return;
  }

  if (!isValuePitchReadyMailEnabled()) {
    console.log(`ValuePitch ready mail is currently on hold. ${label}`);
    return;
  }

  const mailClaimed = await claimValuePitchReadyMail({
    service_id: row.service_id,
    application_id: row.application_id,
    verifyId
  });

  if (!mailClaimed) {
    console.log(`ValuePitch mail skipped because another process already claimed it. ${label}`);
    return;
  }

  await valuePitchReadyMail({
    applicationCode: row.application_code,
    applicantName: row.applicant_name,
    serviceName: row.service_name,
    verifyId
  });

  await markValuePitchReadyMailSent({
    service_id: row.service_id,
    application_id: row.application_id,
    verifyId,
    existingResponse: mailResponse
  });

  console.log(`ValuePitch report ready mail completed for ${label}`);
}

async function runValuePitchReadyPoll() {
  if (isRunning) {
    console.log("ValuePitch polling already running, skipping this tick.");
    return;
  }

  isRunning = true;

  try {
    const pendingCases = await listPendingValuePitchCases(
      process.env.VALUEPITCH_POLL_LIMIT || 50
    );

    if (!pendingCases.length) {
      console.log("ValuePitch polling: no pending cases.");
      return;
    }

    for (const row of pendingCases) {
      try {
        await processValuePitchCase(row);
      } catch (error) {
        console.error(`ValuePitch polling failed for verifyId=${row.verify_id}:`, error?.message || error);
      }
    }
  } catch (error) {
    console.error("ValuePitch polling run failed:", error?.message || error);
  } finally {
    isRunning = false;
  }
}

function startValuePitchReportPolling() {
  console.log("ValuePitch polling cron initialized.");
  cron.schedule("*/5 * * * *", runValuePitchReadyPoll);
}

if (require.main === module) {
  startValuePitchReportPolling();
  runValuePitchReadyPoll();
}

module.exports = {
  runValuePitchReadyPoll,
  startValuePitchReportPolling
};
