// electron-builder afterPack hook: copy the bundled dsh tree into
// <appOutDir>/resources/dsh. extraResources is NOT used on purpose — its
// file filtering silently drops node_modules, which dsh needs at runtime.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const src = path.join(context.packager.projectDir, "dsh-bundle");
  const dest = path.join(context.appOutDir, "resources", "dsh");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, verbatimSymlinks: true });
  console.log(`afterPack: copied dsh-bundle -> ${dest}`);
};
