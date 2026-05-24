import { loadConfig } from "../src/config.js";
import { initSchema, getDbPath } from "../src/db.js";

// PR 2b: db.ts now reads its paths via getConfig(), so this CLI script
// must call loadConfig() before invoking initSchema/getDbPath. loadConfig
// owns dotenv loading (honoring FIELD_PULSE_ENV_PATH), so the previous
// manual dotenv.config() call here is no longer needed.
loadConfig();

initSchema();
console.log(`Database initialized at: ${getDbPath()}`);
