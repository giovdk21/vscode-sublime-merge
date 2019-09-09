// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { execFile, execFileSync } from 'child_process';

// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
	let openInSublimeMerge = vscode.commands.registerCommand('vscsm.openInSublimeMerge', () => {
		// The code you place here will be executed every time your command is executed

		const editor = vscode.window.activeTextEditor;
		if (editor) {
			runSublimeMerge(['.'], editor.document.uri);
		}
	});

	let blameInSublimeMerge = vscode.commands.registerCommand('vscsm.blameInSublimeMerge', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const selectionInfo = editor.selection;
			runSublimeMerge(['blame', editor.document.fileName, String(selectionInfo.start.line)], editor.document.uri);
		}
	});

	let fileHistoryInSublimeMerge = vscode.commands.registerCommand('vscsm.fileHistoryInSublimeMerge', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const relativeFilePath = vscode.workspace.asRelativePath(editor.document.uri, false);
			getGitConfig('user.name', editor.document.uri);

			runSublimeMerge(['search', 'file:"' + relativeFilePath], editor.document.uri);
		}
	});

	let lineHistoryInSublimeMerge = vscode.commands.registerCommand('vscsm.lineHistoryInSublimeMerge', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const selectionInfo = editor.selection;
			const relativeFilePath = vscode.workspace.asRelativePath(editor.document.uri, false);
			const searchQuery = 'file:"' + relativeFilePath +
				'" line:' + String(selectionInfo.start.line + 1) + '-' + String(selectionInfo.end.line + 1);

			runSublimeMerge(['search', searchQuery], editor.document.uri);
		}
	});

	let myCommitsInSublimeMerge = vscode.commands.registerCommand('vscsm.myCommitsInSublimeMerge', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const gitUsername = getGitConfig('user.name', editor.document.uri);
			if (!gitUsername) {
				vscode.window.showWarningMessage('Failed to determine your git username from your configuration');
				return;
			}

			runSublimeMerge(['search', 'author:"' + gitUsername + '"'], editor.document.uri);
		}
	});

	context.subscriptions.push(openInSublimeMerge);
	context.subscriptions.push(blameInSublimeMerge);
	context.subscriptions.push(fileHistoryInSublimeMerge);
	context.subscriptions.push(lineHistoryInSublimeMerge);
	context.subscriptions.push(myCommitsInSublimeMerge);
}

// this method is called when the extension is deactivated
export function deactivate() { }

function getWorkspaceFolderPath(currentDocumentURI: vscode.Uri) {
	const folder = vscode.workspace.getWorkspaceFolder(currentDocumentURI);
	if (!folder) return null;

	return folder.uri.fsPath;
}

function runSublimeMerge(args: string[], currentDocumentURI: vscode.Uri) {
	if (currentDocumentURI.scheme === 'file') {
		const path = getWorkspaceFolderPath(currentDocumentURI);
		if (!path) return null;

		execFile('smerge', args, { cwd: path });
	}
}

function getGitConfig(param: string, currentDocumentURI: vscode.Uri) {
	const path = getWorkspaceFolderPath(currentDocumentURI);
	if (!path) return null;
	let output;

	try {
		output = execFileSync('git', ['config', param], { cwd: path });
	}
	catch (e) {
		console.log('Error while reading Git config (' + param + '): ' + e);
		return null;
	}

	return output.toString().trimRight();
}
