'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import { execFile, execFileSync } from 'child_process';
import { Configuration } from './configuration';
import { LoggingService } from './lib/LoggingService';
import { Repositories } from './lib/Repositories';

type PlatformsConfigObj = {
	linux?: string;
	osx?: string;
	windows?: string;
}

export class RegisterCommands {
	private _config: Configuration;
	private _context: vscode.ExtensionContext;
	private _loggingService: LoggingService;
	private _repositories: Repositories;

	constructor(
		config: Configuration,
		context: vscode.ExtensionContext,
		repositories: Repositories,
		loggingService: LoggingService
	) {
		this._config = config;
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
				this._runSublimeMerge(['blame', this._currentFileRelativePathToRepo(), String(selectionInfo.start.line)]);
			}
		});

		let fileHistoryInSublimeMerge = vscode.commands.registerCommand('vscsm.fileHistoryInSublimeMerge', () => {
			this._runSublimeMerge(['search', `file:"${this._currentFileRelativePathToRepo()}"`]);
		});

		let lineHistoryInSublimeMerge = vscode.commands.registerCommand('vscsm.lineHistoryInSublimeMerge', () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const selectionInfo = editor.selection;
				const searchQuery =
					`file:"${this._currentFileRelativePathToRepo()}" ` +
					'line:' +
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

	private _getExecutablePath(smergeExecutablePath: string | PlatformsConfigObj) {
		if (typeof smergeExecutablePath === 'string') {
			return smergeExecutablePath;
		}

		if (typeof smergeExecutablePath === 'object') {
			const platform = process.platform;

			if (platform === 'win32' && smergeExecutablePath['windows']) {
				return smergeExecutablePath['windows'];
			} else if (platform === 'darwin' && smergeExecutablePath['osx']) {
				return smergeExecutablePath['osx'];
			} else if (['freebsd', 'linux', 'openbsd'].includes(platform) && smergeExecutablePath['linux']) {
				return smergeExecutablePath['linux'];
			}
		}

		return 'smerge';
	}

	private _runSublimeMerge(args: string[]) {
		const path = this._getCurrentRepoPath();
		if (!path) {
			return;
		}

		const executablePath = this._getExecutablePath(this._config.smergeExecutablePath);
		const proc = execFile(executablePath, args, { cwd: path });
		this._loggingService.logInfo(`Running "${executablePath}" (pid: ${proc.pid})`);

		proc.on('error', async err => {
			const path = process.env.PATH;

			this._loggingService.logError(err.message);
			this._loggingService.logInfo(`PATH: ${path}`);

			const openSettings = await vscode.window.showWarningMessage(
				`Failed running "${executablePath}". The executable was not found in "${path}". `,
				'Set or check "vscsm.smergeExecutablePath"'
			);
			if (openSettings) {
				vscode.commands.executeCommand('workbench.action.openSettings');
			}
		});
	}

	private _currentFileUri(): vscode.Uri | null {
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document.uri.scheme === 'file') {
			return editor.document.uri;
		}

		return null;
	}

	private _getCurrentRepoPath(): string | undefined {
		const fileUri = this._currentFileUri();

		if (fileUri) {
			return this._getRepositoryPath(fileUri);
		}

		const workspaceRootFolder = this._workspaceRootFolder();
		if (workspaceRootFolder) {
			return this._getRepositoryPath(workspaceRootFolder);
		}
	}

	private _workspaceRootFolder(): vscode.Uri | undefined {
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
			return vscode.workspace.workspaceFolders[0].uri;
		}
	}

	private _getRepositoryPath(fileUri: vscode.Uri): string | undefined {
		const repo = this._repositories.repoForFile(fileUri);

		if (repo) {
			return repo.rootUri.fsPath;
		}
	}

	private _currentFileRelativePathToRepo(): string {
		const fileUri = this._currentFileUri();
		if (!fileUri) { return ''; }
		const repoPath = this._getRepositoryPath(fileUri);
		if (!repoPath) { return ''; }
		const repoUri = vscode.Uri.file(repoPath);

		return path.posix.relative(repoUri.path, fileUri.path);
	}

	private getGitConfig(param: string): string | null {
		const path = this._getCurrentRepoPath();
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

		return output.toString().trimEnd();
	}
}
