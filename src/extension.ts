import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import * as vscode from 'vscode';
import { backtrackToStart, forwardTrackToEnd, isQuoted } from './parsing';

const log = vscode.window.createOutputChannel('Claude Code Unspinner');

type SettingsMode = 'vscodeSettings' | 'claudeCodeSettings' | 'off';

interface SpinnerVerbs {
	mode: "replace" | "append",
	verbs: string[]
}

async function findFirstClaudeCodeSettingsFile(): Promise<string | undefined> {
	for (const workspace of vscode.workspace.workspaceFolders ?? []) {
		const settingsFile = path.join(workspace.uri.fsPath, '.claude', 'settings.json');
		try {
			await vscode.workspace.fs.stat(vscode.Uri.file(settingsFile));
			return settingsFile;
		} catch {
			// file doesn't exist in this workspace, try next
		}
	}
	return undefined;
}

async function promptReload() {
	const action = await vscode.window.showInformationMessage(
		'Spinner verbs updated. Reload window to apply changes.',
		'Reload Window'
	);
	if (action === 'Reload Window') {
		await vscode.commands.executeCommand('workbench.action.reloadWindow');
	}
}

async function applyConfiguration(context: vscode.ExtensionContext, claudeCodeExtensionFolder: string) {
	log.appendLine('applyConfiguration called');
	const settingsMode = vscode.workspace.getConfiguration('claude-code-unspinner').get<SettingsMode>('configMode') ?? 'vscodeSettings';
	log.appendLine(`configMode: ${settingsMode}`);

	let spinnerVerbs: SpinnerVerbs | undefined = undefined;
	switch (settingsMode) {
		case 'claudeCodeSettings': {
			const claudeCodeSettingsFile = await findFirstClaudeCodeSettingsFile();
			log.appendLine(`claudeCodeSettings file: ${claudeCodeSettingsFile ?? 'not found'}`);
			if (claudeCodeSettingsFile) {
				const jsonContent = await readFile(claudeCodeSettingsFile, 'utf8');
				const settings = JSON.parse(jsonContent);
				spinnerVerbs = settings.spinnerVerbs;
				break;
			}
			// falls through to vscodeSettings when no .claude/settings.json is found
		}
		case 'vscodeSettings':
			spinnerVerbs = vscode.workspace.getConfiguration('claude-code-unspinner').get<SpinnerVerbs>('spinnerVerbs');
			break;
	}
	log.appendLine(`spinnerVerbs: ${JSON.stringify(spinnerVerbs)}`);

	const extensionWebViewPath = path.join(claudeCodeExtensionFolder, 'webview', 'index.js');
	const extensionWebViewContent = await readFile(extensionWebViewPath, 'utf8');

	if (settingsMode === 'off') {
		const originalVerbs: string | undefined = context.globalState.get('originalVerbs');
		const currentVerbs: string | undefined = context.globalState.get('currentVerbs');
		if (originalVerbs && currentVerbs) {
			const restoredContent = extensionWebViewContent.replace(currentVerbs, originalVerbs);
			await context.globalState.update('currentVerbs', undefined);
			await context.globalState.update('originalVerbs', undefined);
			await writeFile(extensionWebViewPath, restoredContent);
			await promptReload();
		}
		return;
	}

	if (!spinnerVerbs) {
		log.appendLine('no spinnerVerbs configured, nothing to do');
		return;
	}

	const changed =
		await replaceBySearchTerm(context, extensionWebViewContent, spinnerVerbs, extensionWebViewPath) ||
		await replaceCurrentVerbs(context, extensionWebViewContent, spinnerVerbs, extensionWebViewPath);

	log.appendLine(`changed: ${changed}`);
	if (changed) {
		await promptReload();
	}
}

export async function activate(context: vscode.ExtensionContext) {
	log.appendLine('activate called');
	const claudeCodeExtensionFolder = vscode.extensions.getExtension('anthropic.claude-code')?.extensionPath;
	log.appendLine(`claudeCodeExtensionFolder: ${claudeCodeExtensionFolder ?? 'not found'}`);
	if (!claudeCodeExtensionFolder) {
		vscode.window.showErrorMessage('Claude Code extension is not installed or activated.');
		return;
	}

	await applyConfiguration(context, claudeCodeExtensionFolder);

	context.subscriptions.push(
		log,
		vscode.workspace.onDidChangeConfiguration(async (e) => {
			if (e.affectsConfiguration('claude-code-unspinner')) {
				await applyConfiguration(context, claudeCodeExtensionFolder);
			}
		})
	);
}

async function replaceBySearchTerm(context: vscode.ExtensionContext, content: string, spinnerVerbs: SpinnerVerbs, extensionWebViewPath: string): Promise<boolean> {
	const searchTerm = vscode.workspace.getConfiguration('claude-code-unspinner').get<string>('originalSearchTerm') ?? 'Accomplishing';
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
	let verbs = JSON.parse(originalVerbsJson) as string[];
	if (spinnerVerbs.mode === 'replace') {
		verbs = spinnerVerbs.verbs;
	} else if (spinnerVerbs.mode === 'append') {
		verbs.push(...spinnerVerbs.verbs);
	}
	const newVerbsJson = JSON.stringify(verbs);
	if (newVerbsJson === originalVerbsJson) {
		return false;
	}
	await context.globalState.update('originalVerbs', originalVerbsJson);
	await context.globalState.update('currentVerbs', newVerbsJson);

	const replacedContent = content.slice(0, startIndex) + newVerbsJson + content.slice(endIndex + 1);
	await writeFile(extensionWebViewPath, replacedContent);
	return true;
}

async function replaceCurrentVerbs(context: vscode.ExtensionContext, content: string, spinnerVerbs: SpinnerVerbs, extensionWebViewPath: string): Promise<boolean> {
	const currentVerbs: string | undefined = context.globalState.get('currentVerbs');
	if (!currentVerbs) {
		return false;
	}
	let verbs = JSON.parse(currentVerbs) as string[];
	if (spinnerVerbs.mode === 'replace') {
		verbs = spinnerVerbs.verbs;
	} else if (spinnerVerbs.mode === 'append') {
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
	await context.globalState.update('currentVerbs', newVerbs);

	const replacedContent = content.replace(currentVerbs, newVerbs);
	await writeFile(extensionWebViewPath, replacedContent);
	return true;
}

export function deactivate() {}
