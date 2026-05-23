const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let mainWindow = null;
let backendProcess = null;
let logFilePath = null;

app.setName("FieldPulse Lite");

if (process.env.FIELD_PULSE_USER_DATA_DIR) {
  const userDataDir = path.resolve(process.env.FIELD_PULSE_USER_DATA_DIR);
  fs.mkdirSync(userDataDir, { recursive: true });
  app.setPath("userData", userDataDir);
}

function getLogFilePath() {
  if (!logFilePath) {
    const logsDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    logFilePath = path.join(logsDir, "desktop.log");
  }
  return logFilePath;
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(getLogFilePath(), line, "utf8");
  } catch {
    // Logging must never keep the app from starting.
  }
}

function formatError(err) {
  return err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
}

function installConsoleFileLogging() {
  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);

  console.log = (...args) => {
    originalLog(...args);
    log(args.map(String).join(" "));
  };
  console.error = (...args) => {
    originalError(...args);
    log(args.map((arg) => (arg instanceof Error ? formatError(arg) : String(arg))).join(" "));
  };
}

function getBundleRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bundled");
  }
  return path.resolve(__dirname, "..");
}

function pathExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function canUsePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function choosePort(preferredPort) {
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (await canUsePort(port)) return port;
  }
  throw new Error(`No available local port near ${preferredPort}`);
}

function ensureRuntimeEnv(bundleRoot, port) {
  const userData = app.getPath("userData");
  const projectEnvPath = path.join(bundleRoot, ".env");
  const useProjectRuntime = !app.isPackaged && pathExists(projectEnvPath);
  const dataDir = useProjectRuntime
    ? path.join(bundleRoot, "backend", "data")
    : path.join(userData, "data");
  const uploadsDir = useProjectRuntime
    ? path.join(bundleRoot, "backend", "uploads")
    : path.join(userData, "uploads");
  const envPath = useProjectRuntime ? projectEnvPath : path.join(userData, ".env");
  const exampleEnv = path.join(bundleRoot, ".env.example");

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });

  if (!useProjectRuntime && !pathExists(envPath)) {
    if (pathExists(exampleEnv)) {
      fs.copyFileSync(exampleEnv, envPath);
    } else {
      fs.writeFileSync(
        envPath,
        "CLICKUP_API_TOKEN=\nCLICKUP_LIST_ID=\nPORT=3001\n",
        "utf8"
      );
    }
  }

  process.env.FIELD_PULSE_ENV_PATH = envPath;
  process.env.FIELD_PULSE_DATA_DIR = dataDir;
  process.env.FRONTEND_DIST_DIR = path.join(bundleRoot, "frontend", "dist");
  process.env.UPLOADS_DIR = uploadsDir;
  process.env.PORT = String(port);

  log(`Runtime mode: ${app.isPackaged ? "packaged" : "source checkout"}`);
  log(`Bundle root: ${bundleRoot}`);
  log(`Data directory: ${dataDir}`);
  log(`Uploads directory: ${uploadsDir}`);
  log(`Environment file: ${envPath}`);
  log(`Backend port: ${port}`);
}

function verifyBundle(bundleRoot) {
  const backendEntry = path.join(bundleRoot, "backend", "dist", "index.js");
  const frontendIndex = path.join(bundleRoot, "frontend", "dist", "index.html");

  if (!pathExists(backendEntry) || !pathExists(frontendIndex)) {
    throw new Error(
      "FieldPulse is not built yet. Run npm run build from the project root."
    );
  }

  return { backendEntry };
}

function startBackendWithNode(backendEntry) {
  log(`Starting backend with external Node: ${backendEntry}`);
  backendProcess = spawn("node", [backendEntry], {
    env: process.env,
    stdio: "pipe",
    windowsHide: true,
  });

  backendProcess.stdout.on("data", (data) => {
    process.stdout.write(`[FieldPulse backend] ${data}`);
  });
  backendProcess.stderr.on("data", (data) => {
    process.stderr.write(`[FieldPulse backend] ${data}`);
  });
  backendProcess.on("error", (err) => {
    log(`External backend process failed: ${formatError(err)}`);
    dialog.showErrorBox(
      "FieldPulse backend could not start",
      err instanceof Error ? err.message : String(err)
    );
  });
  backendProcess.on("exit", (code) => {
    log(`External backend process exited with code ${code}`);
    if (code && mainWindow) {
      mainWindow.webContents.send("backend-exit", code);
    }
  });
}

async function startBackendInProcess(backendEntry) {
  log(`Starting backend in Electron main process: ${backendEntry}`);
  await import(pathToFileURL(backendEntry).href);
}

async function waitForBackend(port) {
  const deadline = Date.now() + 15_000;
  const url = `http://127.0.0.1:${port}/api/health`;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Keep polling until the backend finishes booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("FieldPulse backend did not become ready in time.");
}

function createWindow(port) {
  log(`Opening desktop window at http://127.0.0.1:${port}/setup`);
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 820,
    minWidth: 920,
    minHeight: 680,
    backgroundColor: "#f5f5f0",
    title: "FieldPulse Lite",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  void mainWindow.loadURL(`http://127.0.0.1:${port}/setup`);
}

async function boot() {
  installConsoleFileLogging();
  const bundleRoot = getBundleRoot();
  const preferredPort = Number(
    process.env.FIELD_PULSE_PORT || process.env.PORT || 3001
  );
  const port = await choosePort(
    Number.isFinite(preferredPort) ? preferredPort : 3001
  );
  ensureRuntimeEnv(bundleRoot, port);
  const { backendEntry } = verifyBundle(bundleRoot);

  if (app.isPackaged) {
    await startBackendInProcess(backendEntry);
  } else {
    startBackendWithNode(backendEntry);
  }

  await waitForBackend(port);
  createWindow(port);
}

app.whenReady().then(() => {
  boot().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    log(`Startup failed: ${formatError(err)}`);
    dialog.showErrorBox("FieldPulse Lite could not start", message);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && process.env.PORT) {
      createWindow(Number(process.env.PORT));
    }
  });
});

app.on("before-quit", () => {
  log("FieldPulse Lite is quitting");
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

process.on("uncaughtException", (err) => {
  log(`Uncaught exception: ${formatError(err)}`);
});

process.on("unhandledRejection", (reason) => {
  log(`Unhandled rejection: ${formatError(reason)}`);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
