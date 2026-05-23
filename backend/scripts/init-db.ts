import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { initSchema, getDbPath } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

initSchema();
console.log(`Database initialized at: ${getDbPath()}`);
