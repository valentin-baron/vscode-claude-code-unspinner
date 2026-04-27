"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var import_promises = require("fs/promises");
var import_path = __toESM(require("path"));
var vscode = __toESM(require("vscode"));

// src/parsing.ts
function charType(char) {
  if (/[a-zA-Z]/.test(char)) {
    return "letter";
  }
  if (char === '"') {
    return "quote";
  }
  if (/\s/.test(char)) {
    return "whitespace";
  }
  if (char === ",") {
    return "comma";
  }
  if (char === "[") {
    return "start";
  }
  if (char === "]") {
    return "end";
  }
  return "other";
}
function isQuoted(content, position, term) {
  return content[position - 1] === '"' && content[position + term.length] === '"';
}
function isAllowedChar(current, previous, prev2, rule) {
  try {
    const currentRule = rule[previous];
    if (Array.isArray(currentRule)) {
      return currentRule.includes(current);
    } else if (currentRule) {
      const subRule = currentRule[prev2];
      if (Array.isArray(subRule)) {
        return subRule.includes(current);
      }
    }
  } catch {
  }
  return false;
}
var BackwardsRule = {
  letter: ["letter", "quote"],
  quote: {
    letter: ["whitespace", "comma", "start"],
    // <, "A>
    whitespace: ["letter"],
    // <a" >
    comma: ["letter"]
    // <a",>
  },
  whitespace: ["comma", "whitespace", "quote", "start"],
  comma: ["quote", "whitespace"]
};
var ForwardsRule = {
  letter: ["letter", "quote"],
  quote: {
    letter: ["whitespace", "comma", "end"],
    // <a",>
    whitespace: ["letter"],
    // < "A>
    comma: ["letter"]
    // <,"A>
  },
  comma: ["quote", "whitespace"],
  whitespace: ["whitespace", "comma", "quote", "end"]
};
function backtrackToStart(content, position) {
  let previousCharType = charType(content[position]);
  let prev2CharType = charType(content[position + 1]);
  do {
    position--;
    const currentCharType = charType(content[position]);
    if (!isAllowedChar(currentCharType, previousCharType, prev2CharType, BackwardsRule)) {
      break;
    }
    if (currentCharType === "start") {
      return position;
    }
    prev2CharType = previousCharType;
    previousCharType = currentCharType;
  } while (position > 0);
  return -1;
}
function forwardTrackToEnd(content, position) {
  let previousCharType = charType(content[position]);
  let prev2CharType = charType(content[position - 1]);
  do {
    position++;
    const currentCharType = charType(content[position]);
    if (!isAllowedChar(currentCharType, previousCharType, prev2CharType, ForwardsRule)) {
      break;
    }
    if (currentCharType === "end") {
      return position;
    }
    prev2CharType = previousCharType;
    previousCharType = currentCharType;
  } while (position < content.length);
  return -1;
}

// src/extension.ts
var log = vscode.window.createOutputChannel("Claude Code Unspinner");
async function findFirstClaudeCodeSettingsFile() {
  for (const workspace2 of vscode.workspace.workspaceFolders ?? []) {
    const settingsFile = import_path.default.join(workspace2.uri.fsPath, ".claude", "settings.json");
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(settingsFile));
      return settingsFile;
    } catch {
    }
  }
  return void 0;
}
async function promptReload() {
  const action = await vscode.window.showInformationMessage(
    "Spinner verbs updated. Reload window to apply changes.",
    "Reload Window"
  );
  if (action === "Reload Window") {
    await vscode.commands.executeCommand("workbench.action.reloadWindow");
  }
}
async function applyConfiguration(context, claudeCodeExtensionFolder) {
  log.appendLine("applyConfiguration called");
  const settingsMode = vscode.workspace.getConfiguration("claude-code-unspinner").get("configMode") ?? "vscodeSettings";
  log.appendLine(`configMode: ${settingsMode}`);
  let spinnerVerbs = void 0;
  switch (settingsMode) {
    case "claudeCodeSettings": {
      const claudeCodeSettingsFile = await findFirstClaudeCodeSettingsFile();
      log.appendLine(`claudeCodeSettings file: ${claudeCodeSettingsFile ?? "not found"}`);
      if (claudeCodeSettingsFile) {
        const jsonContent = await (0, import_promises.readFile)(claudeCodeSettingsFile, "utf8");
        const settings = JSON.parse(jsonContent);
        spinnerVerbs = settings.spinnerVerbs;
        break;
      }
    }
    case "vscodeSettings":
      spinnerVerbs = vscode.workspace.getConfiguration("claude-code-unspinner").get("spinnerVerbs");
      break;
  }
  log.appendLine(`spinnerVerbs: ${JSON.stringify(spinnerVerbs)}`);
  const extensionWebViewPath = import_path.default.join(claudeCodeExtensionFolder, "webview", "index.js");
  const extensionWebViewContent = await (0, import_promises.readFile)(extensionWebViewPath, "utf8");
  if (settingsMode === "off") {
    const originalVerbs = context.globalState.get("originalVerbs");
    const currentVerbs = context.globalState.get("currentVerbs");
    if (originalVerbs && currentVerbs) {
      const restoredContent = extensionWebViewContent.replace(currentVerbs, originalVerbs);
      await context.globalState.update("currentVerbs", void 0);
      await context.globalState.update("originalVerbs", void 0);
      await (0, import_promises.writeFile)(extensionWebViewPath, restoredContent);
      await promptReload();
    }
    return;
  }
  if (!spinnerVerbs) {
    log.appendLine("no spinnerVerbs configured, nothing to do");
    return;
  }
  const changed = await replaceBySearchTerm(context, extensionWebViewContent, spinnerVerbs, extensionWebViewPath) || await replaceCurrentVerbs(context, extensionWebViewContent, spinnerVerbs, extensionWebViewPath);
  log.appendLine(`changed: ${changed}`);
  if (changed) {
    await promptReload();
  }
}
async function activate(context) {
  log.appendLine("activate called");
  const claudeCodeExtensionFolder = vscode.extensions.getExtension("anthropic.claude-code")?.extensionPath;
  log.appendLine(`claudeCodeExtensionFolder: ${claudeCodeExtensionFolder ?? "not found"}`);
  if (!claudeCodeExtensionFolder) {
    vscode.window.showErrorMessage("Claude Code extension is not installed or activated.");
    return;
  }
  await applyConfiguration(context, claudeCodeExtensionFolder);
  context.subscriptions.push(
    log,
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("claude-code-unspinner")) {
        await applyConfiguration(context, claudeCodeExtensionFolder);
      }
    })
  );
}
async function replaceBySearchTerm(context, content, spinnerVerbs, extensionWebViewPath) {
  const searchTerm = vscode.workspace.getConfiguration("claude-code-unspinner").get("originalSearchTerm") ?? "Accomplishing";
  const positionOfSearchTerm = content.indexOf(searchTerm);
  if (positionOfSearchTerm === -1) {
    return false;
  }
  if (!isQuoted(content, positionOfSearchTerm, searchTerm)) {
    return false;
  }
  const startIndex = backtrackToStart(content, positionOfSearchTerm);
  if (startIndex === -1) {
    return false;
  }
  const endIndex = forwardTrackToEnd(content, positionOfSearchTerm);
  if (endIndex === -1) {
    return false;
  }
  const originalVerbsJson = content.slice(startIndex, endIndex + 1);
  let verbs = JSON.parse(originalVerbsJson);
  if (spinnerVerbs.mode === "replace") {
    verbs = spinnerVerbs.verbs;
  } else if (spinnerVerbs.mode === "append") {
    verbs.push(...spinnerVerbs.verbs);
  }
  const newVerbsJson = JSON.stringify(verbs);
  if (newVerbsJson === originalVerbsJson) {
    return false;
  }
  await context.globalState.update("originalVerbs", originalVerbsJson);
  await context.globalState.update("currentVerbs", newVerbsJson);
  const replacedContent = content.slice(0, startIndex) + newVerbsJson + content.slice(endIndex + 1);
  await (0, import_promises.writeFile)(extensionWebViewPath, replacedContent);
  return true;
}
async function replaceCurrentVerbs(context, content, spinnerVerbs, extensionWebViewPath) {
  const currentVerbs = context.globalState.get("currentVerbs");
  if (!currentVerbs) {
    return false;
  }
  let verbs = JSON.parse(currentVerbs);
  if (spinnerVerbs.mode === "replace") {
    verbs = spinnerVerbs.verbs;
  } else if (spinnerVerbs.mode === "append") {
    for (const verb of spinnerVerbs.verbs) {
      if (!verbs.includes(verb)) {
        verbs.push(verb);
      }
    }
  }
  const newVerbs = JSON.stringify(verbs);
  if (newVerbs === currentVerbs) {
    return false;
  }
  await context.globalState.update("currentVerbs", newVerbs);
  const replacedContent = content.replace(currentVerbs, newVerbs);
  await (0, import_promises.writeFile)(extensionWebViewPath, replacedContent);
  return true;
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
