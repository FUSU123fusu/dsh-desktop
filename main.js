// dsh-desktop: Electron shell that boots the local `dsh web` profile
// (DeepSeek Harness) and loads its browser UI in a native window.
//
// Flow: spawn `dsh web --port 0` -> read "dsh web: http://..." from stdout
// -> BrowserWindow.loadURL(...). The child is killed (process tree) on quit.

const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn, execFile } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const BOOT_TIMEOUT_MS = 60000;

let mainWindow = null;
let dshChild = null;
let quitting = false;

/**
 * Locate the bundled dsh entrypoint (shipped inside the app), or null.
 * Packaged: <resources>/dsh/lib/bin.js. Dev: <app>/dsh-bundle/lib/bin.js.
 */
function bundledDshBin() {
  const p = app.isPackaged
    ? path.join(process.resourcesPath, "dsh", "lib", "bin.js")
    : path.join(__dirname, "dsh-bundle", "lib", "bin.js");
  return fs.existsSync(p) ? p : null;
}

/** Spawn the dsh web server; resolve with the server URL from its stdout. */
function bootDsh() {
  return new Promise((resolve, reject) => {
    let child;
    const bin = bundledDshBin();
    if (bin) {
      // Run the bundled dsh with Electron's embedded Node — the target
      // machine needs neither Node.js nor an npm-installed dsh.
      child = spawn(process.execPath, [bin, "web", "--port", "0"], {
        cwd: os.homedir(),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      });
    } else {
      // Dev fallback: use the globally npm-installed dsh.
      // .cmd shims need cmd.exe as an intermediary on Windows.
      child = spawn("cmd.exe", ["/c", "dsh.cmd", "web", "--port", "0"], {
        cwd: os.homedir(),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
    dshChild = child;

    let stderrBuf = "";
    const urlRe = /dsh web:\s*(https?:\/\/\S+)/i;

    const timer = setTimeout(() => {
      reject(new Error(`等待 dsh web 启动超时（${BOOT_TIMEOUT_MS / 1000}s）\n${stderrBuf}`));
    }, BOOT_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      const m = urlRe.exec(chunk.toString());
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`无法启动 dsh：${err.message}\n请确认已通过 npm 全局安装 @deepseek-ai/dsh。`));
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`dsh web 提前退出（code ${code}）\n${stderrBuf}`));
    });
  });
}

/** Kill the spawned dsh process tree. */
function killDsh() {
  if (!dshChild || dshChild.killed) return;
  try {
    // /T kills the whole tree (cmd.exe -> node).
    // windowsHide: taskkill is a console app — don't flash a console window.
    execFile("taskkill", ["/PID", String(dshChild.pid), "/T", "/F"], { windowsHide: true }, () => {});
  } catch {
    /* best effort */
  }
  dshChild = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: "#0f1115",
    title: "dsh",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links in the system browser, not in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) && !url.startsWith("http://127.0.0.1") && !url.startsWith("http://localhost")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.loadFile(path.join(__dirname, "loading.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function start() {
  createWindow();
  try {
    const url = await bootDsh();
    if (mainWindow) await mainWindow.loadURL(url);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(
        `window.showError(${JSON.stringify(msg)})`
      ).catch(() => {});
    }
    console.error(msg);
  }
}

// Single-instance lock: a second launch just focuses the running window
// instead of booting another dsh server.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(start);

  app.on("before-quit", () => {
    quitting = true;
    killDsh();
  });

  app.on("window-all-closed", () => {
    killDsh();
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && !quitting) start();
  });
}


process.on("uncaughtException", (err) => {
  dialog.showErrorBox("dsh-desktop 错误", String(err && err.stack || err));
});
