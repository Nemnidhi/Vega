/**
 * Builds every index declared on every model against the connected database.
 *
 * The serving process runs with `autoIndex` off in production (see
 * src/lib/db/mongodb.ts), so this is what actually creates them there. Run it as a
 * deploy step, after the code that declares the indexes is live:
 *
 *   npm run sync:indexes
 *   npm run sync:indexes -- --dry
 *
 * `syncIndexes` also *drops* indexes that exist in the database but are no longer
 * declared on the model, which is the point - it makes the database match the code -
 * but it means a hand-created index will disappear. `--dry` lists what would change
 * without touching anything.
 *
 * Unique index builds fail on existing duplicates rather than silently discarding
 * rows. That failure is reported per model and the script exits non-zero; resolve the
 * duplicates and run it again. One model failing does not stop the others.
 */
import mongoose from "mongoose";
import * as models from "@/models";

const DRY_RUN = process.argv.includes("--dry");

// The models are exported untyped (`models.X || model(...)` yields `any`), so this narrows
// them to just the surface used here rather than to a full Model generic.
type ModelLike = mongoose.Model<unknown>;

function collectModels(): ModelLike[] {
  return (Object.values(models) as unknown[])
    .filter((value): value is ModelLike => {
      // A Mongoose model is a constructor *function*, not a plain object - checking for
      // "object" here silently matched nothing at all.
      if (!value || (typeof value !== "function" && typeof value !== "object")) return false;
      const candidate = value as Partial<ModelLike>;
      return typeof candidate.modelName === "string" && typeof candidate.syncIndexes === "function";
    })
    .sort((first, second) => first.modelName.localeCompare(second.modelName));
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;

  if (!uri || !dbName) {
    throw new Error("MONGODB_URI and MONGODB_DB_NAME must be set.");
  }

  await mongoose.connect(uri, { dbName, autoIndex: false, family: 4 });
  console.log(`Connected to ${dbName}${DRY_RUN ? " (dry run - nothing will be written)" : ""}\n`);

  const collected = collectModels();
  const failures: Array<{ model: string; error: string }> = [];
  let created = 0;
  let dropped = 0;

  for (const model of collected) {
    try {
      if (DRY_RUN) {
        const diff = await model.diffIndexes();
        if (diff.toCreate.length === 0 && diff.toDrop.length === 0) {
          console.log(`  ${model.modelName}: up to date`);
          continue;
        }
        created += diff.toCreate.length;
        dropped += diff.toDrop.length;
        console.log(
          `  ${model.modelName}: would create ${diff.toCreate.length}, would drop ${diff.toDrop.length}`,
        );
        for (const index of diff.toCreate) console.log(`      + ${JSON.stringify(index)}`);
        for (const name of diff.toDrop) console.log(`      - ${name}`);
        continue;
      }

      const droppedNames = await model.syncIndexes();
      dropped += droppedNames.length;
      console.log(
        `  ${model.modelName}: synced${droppedNames.length ? ` (dropped ${droppedNames.join(", ")})` : ""}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ model: model.modelName, error: message });
      console.error(`  ${model.modelName}: FAILED - ${message}`);
    }
  }

  console.log(
    `\n${collected.length} models processed` +
      (DRY_RUN ? `, ${created} indexes to create, ${dropped} to drop` : `, ${dropped} stale indexes dropped`),
  );

  await mongoose.disconnect();

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} model(s) failed. A unique index build fails when the collection ` +
        `already holds duplicates - find and resolve them, then run this again.`,
    );
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
