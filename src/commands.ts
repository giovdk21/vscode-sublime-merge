'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import { execFile, execFileSync } from 'child_process';
import { LoggingService } from './lib/LoggingService';
import { Repositories } from './lib/Repositories';

export class RegisterCommands {
	private _context: vscode.ExtensionContext;
	private _loggingService: LoggingService;
	private _repositories: Repositories;

	constructor(context: vscode.ExtensionContext, repositories: Repositories, loggingService: LoggingService) {
		this._context = context;
		this._loggingService = loggingService;
		this._repositories = repositories;
	}

	init() {
		let openInSublimeMerge = vscode.commands.registerCommand('vscsm.openInSublimeMerge', () => {
			this._runSublimeMerge(['.']);
		});

		let blameInSublimeMerge = vscode.commands.registerCommand('vscsm.blameInSublimeMerge', () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const selectionInfo = editor.selection;
				this._runSublimeMerge(['blame', editor.document.fileName, String(selectionInfo.start.line)]);
			}
		});

		let fileHistoryInSublimeMerge = vscode.commands.registerCommand('vscsm.fileHistoryInSublimeMerge', () => {
			this._runSublimeMerge(['search', 'file:"' + this._currentFileRelativePathToRepo()]);
		});

		let lineHistoryInSublimeMerge = vscode.commands.registerCommand('vscsm.lineHistoryInSublimeMerge', () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const selectionInfo = editor.selection;
				const searchQuery =
					'file:"' + this._currentFileRelativePathToRepo() +
					'" line:' +
					String(selectionInfo.start.line + 1) +
					'-' +
					String(selectionInfo.end.line + 1);

				this._runSublimeMerge(['search', searchQuery]);
			}
		});

		let myCommitsInSublimeMerge = vscode.commands.registerCommand('vscsm.myCommitsInSublimeMerge', () => {
			const gitUsername = this.getGitConfig('user.name');
			if (!gitUsername) {
				vscode.window.showWarningMessage('Failed to determine your git username from your configuration');
				return;
			}

			this._runSublimeMerge(['search', 'author:"' + gitUsername + '"']);
		});

		this._context.subscriptions.push(openInSublimeMerge);
		this._context.subscriptions.push(blameInSublimeMerge);
		this._context.subscriptions.push(fileHistoryInSublimeMerge);
		this._context.subscriptions.push(lineHistoryInSublimeMerge);
		this._context.subscriptions.push(myCommitsInSublimeMerge);
	}


	private _runSublimeMerge(args: string[]) {
		const path = this._getCurrentFileRepoPath();
		if (!path) {
			return null;
		}

		execFile('smerge', args, { cwd: path });
	}

	private _currentFileUri(): vscode.Uri | null {
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document.uri.scheme === 'file') {
			return editor.document.uri;
		}

		return null;
	}

	private _getCurrentFileRepoPath(): string | null {
		const fileUri = this._currentFileUri();

		if (fileUri) {
			return this._getRepositoryPath(fileUri);
		}

		return null;
	}

	private _getRepositoryPath(fileUri: vscode.Uri) {
		const repo = this._repositories.repoForFile(fileUri);

		if (repo) {
			return repo.rootUri.fsPath;
		}

		return null;
	}

	private _currentFileRelativePathToRepo(): string {
		const fileUri = this._currentFileUri();
		if (!fileUri) { return ''; }
		const repoPath = this._getRepositoryPath(fileUri);
		if (!repoPath) { return ''; }

		return path.relative(repoPath, fileUri.fsPath);
	}

	private getGitConfig(param: string) {
		const path = this._getCurrentFileRepoPath();
		if (!path) {
			return null;
		}

		let output;
		try {
			output = execFileSync('git', ['config', param], { cwd: path });
		} catch (e) {
			this._loggingService.logError('Error while reading Git config (' + param + '): ' + e);
			return null;
		}

		return output.toString().trimRight();
	}
}
