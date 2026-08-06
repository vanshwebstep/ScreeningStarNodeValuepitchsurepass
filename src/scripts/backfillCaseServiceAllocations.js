/**
 * One-time backfill: populate `case_service_allocations` from
 * `client_applications.services` (comma-separated service IDs).
 *
 * Run from project root (path adjust kar lena agar config/db ka path alag hai):
 *   node scripts/backfillCaseServiceAllocations.js
 *
 * Safe to re-run: existing (client_application_id, service_id) pairs skip ho jaate hain.
 */

const { sequelize } = require("../config/db"); // <-- path check kar lena apne project ke hisaab se
const { QueryTypes } = require("sequelize");

async function run() {
  const t0 = Date.now();

  // 1. Eligible applications (same filter jo listForAdmin mein use ho raha hai)
  const applications = await sequelize.query(
    `SELECT id, application_id, services
     FROM client_applications
     WHERE is_deleted != 1
       AND is_data_qc = 1
       AND services IS NOT NULL
       AND TRIM(services) != ''`,
    { type: QueryTypes.SELECT }
  );
  console.log(`Eligible client_applications: ${applications.length}`);

  // 2. Service id -> title map
  const serviceRows = await sequelize.query(`SELECT id, title FROM services`, {
    type: QueryTypes.SELECT,
  });
  const serviceTitleMap = new Map(serviceRows.map((s) => [String(s.id), s.title]));

  // 3. Already-existing (client_application_id, service_id) pairs — duplicate na ho
  const existingRows = await sequelize.query(
    `SELECT client_application_id, service_id FROM case_service_allocations`,
    { type: QueryTypes.SELECT }
  );
  const existingSet = new Set(
    existingRows.map((r) => `${r.client_application_id}_${r.service_id}`)
  );

  // 4. Build insert rows
  const toInsert = [];
  let skippedUnknownService = 0;

  for (const app of applications) {
    const serviceIds = String(app.services)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const serviceId of serviceIds) {
      const key = `${app.id}_${serviceId}`;
      if (existingSet.has(key)) continue; // already allocated, skip

      const title = serviceTitleMap.get(serviceId);
      if (!title) {
        skippedUnknownService++;
        console.warn(
          `Skipping: client_application_id=${app.id} (${app.application_id}) has unknown service_id=${serviceId}`
        );
        continue;
      }

      toInsert.push({
        client_application_id: app.id,
        service_id: Number(serviceId),
        service_title: title,
      });
      existingSet.add(key); // avoid dupes within this same run too
    }
  }

  console.log(`Rows to insert: ${toInsert.length}`);
  if (skippedUnknownService) {
    console.log(`Skipped (unknown service_id): ${skippedUnknownService}`);
  }

  if (!toInsert.length) {
    console.log("Nothing to insert. Done.");
    return;
  }

  // 5. Bulk insert in chunks
  const CHUNK_SIZE = 500;
  let insertedCount = 0;

  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => "(?, ?, ?, 'unassigned', 'WIP', 1, 1, NOW(), NOW())").join(",");
    const replacements = chunk.flatMap((r) => [r.client_application_id, r.service_id, r.service_title]);

    await sequelize.query(
      `INSERT INTO case_service_allocations
         (client_application_id, service_id, service_title, vendor_case_status,
          verification_status, vendor_case_enabled, vendor_upload_enabled,
          created_at, updated_at)
       VALUES ${placeholders}`,
      { replacements, type: QueryTypes.INSERT }
    );

    insertedCount += chunk.length;
    console.log(`Inserted ${insertedCount}/${toInsert.length}`);
  }

  console.log(`Done in ${(Date.now() - t0) / 1000}s. Total inserted: ${insertedCount}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });