"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const vscode = __importStar(require("vscode"));
const parsing_1 = require("./parsing");
async function findFirstClaudeCodeSettingsFile() {
    for (const workspace of vscode.workspace.workspaceFolders ?? []) {
        const settingsFile = path_1.default.join(workspace.uri.fsPath, '.claude', 'settings.json');
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(settingsFile));
            return settingsFile;
        }
        catch {
            // file doesn't exist in this workspace, try next
        }
    }
    return undefined;
}
async function activate(context) {
    const claudeCodeExtensionFolder = vscode.extensions.getExtension('anthropics.claude-code')?.extensionPath;
    if (!claudeCodeExtensionFolder) {
        vscode.window.showErrorMessage('Claude Code extension is not installed or activated.');
        return;
    }
    const settingsMode = vscode.workspace.getConfiguration('claude-code-unspinner').get('configMode') ?? 'vscodeSettings';
    let spinnerVerbs = undefined;
    switch (settingsMode) {
        case 'claudeCodeSettings': {
            const claudeCodeSettingsFile = await findFirstClaudeCodeSettingsFile();
            if (claudeCodeSettingsFile) {
                const jsonContent = await (0, promises_1.readFile)(claudeCodeSettingsFile, 'utf8');
                const settings = JSON.parse(jsonContent);
                spinnerVerbs = settings.spinnerVerbs;
                break;
            }
            // falls through to vscodeSettings when no .claude/settings.json is found
        }
        case 'vscodeSettings':
            spinnerVerbs = vscode.workspace.getConfiguration('claude-code-unspinner').get('spinnerVerbs');
            break;
    }
    const extensionWebViewPath = path_1.default.join(claudeCodeExtensionFolder, 'webview', 'index.js');
    const extensionWebViewContent = await (0, promises_1.readFile)(extensionWebViewPath, 'utf8');
    if (settingsMode === 'off') {
        const originalVerbs = context.globalState.get('originalVerbs');
        const currentVerbs = context.globalState.get('currentVerbs');
        if (originalVerbs && currentVerbs) {
            const restoredContent = extensionWebViewContent.replace(currentVerbs, originalVerbs);
            await context.globalState.update('currentVerbs', undefined);
            await context.globalState.update('originalVerbs', undefined);
            await (0, promises_1.writeFile)(extensionWebViewPath, restoredContent);
        }
        return;
    }
    if (!spinnerVerbs) {
        return;
    }
    if (await replaceBySearchTerm(context, extensionWebViewContent, spinnerVerbs, extensionWebViewPath)) {
        return;
    }
    await replaceCurrentVerbs(context, extensionWebViewContent, spinnerVerbs, extensionWebViewPath);
}
async function replaceBySearchTerm(context, content, spinnerVerbs, extensionWebViewPath) {
    const searchTerm = vscode.workspace.getConfiguration('claude-code-unspinner').get('originalSearchTerm') ?? 'Accomplishing';
    const positionOfSearchTerm = content.indexOf(searchTerm);
    if (positionOfSearchTerm > -1) {
        if (!(0, parsing_1.isQuoted)(content, positionOfSearchTerm, searchTerm)) {
            return false;
        }
        const startIndex = (0, parsing_1.backtrackToStart)(content, positionOfSearchTerm);
        if (startIndex === -1) {
            return false;
        }
        const endIndex = (0, parsing_1.forwardTrackToEnd)(content, positionOfSearchTerm);
        if (endIndex === -1) {
            return false;
        }
        const originalVerbsJson = content.slice(startIndex, endIndex + 1);
        let verbs = JSON.parse(originalVerbsJson);
        if (spinnerVerbs.mode === 'replace') {
            verbs = spinnerVerbs.verbs;
        }
        else if (spinnerVerbs.mode === 'append') {
            verbs.push(...spinnerVerbs.verbs);
        }
        const newVerbsJson = JSON.stringify(verbs);
        await context.globalState.update('originalVerbs', originalVerbsJson);
        await context.globalState.update('currentVerbs', newVerbsJson);
        const replacedContent = content.slice(0, startIndex) + newVerbsJson + content.slice(endIndex + 1);
        await (0, promises_1.writeFile)(extensionWebViewPath, replacedContent);
        return true;
    }
    return false;
}
async function replaceCurrentVerbs(context, content, spinnerVerbs, extensionWebViewPath) {
    const currentVerbs = context.globalState.get('currentVerbs');
    if (!currentVerbs) {
        return;
    }
    let verbs = JSON.parse(currentVerbs);
    if (spinnerVerbs.mode === 'replace') {
        verbs = spinnerVerbs.verbs;
    }
    else if (spinnerVerbs.mode === 'append') {
        for (const verb of spinnerVerbs.verbs) {
            if (!verbs.includes(verb)) {
                verbs.push(verb);
            }
        }
    }
    const newVerbs = JSON.stringify(verbs);
    await context.globalState.update('currentVerbs', newVerbs);
    const replacedContent = content.replace(currentVerbs, newVerbs);
    await (0, promises_1.writeFile)(extensionWebViewPath, replacedContent);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map