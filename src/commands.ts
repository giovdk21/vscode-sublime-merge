'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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

	/**
	 * Resolves a URI to a local filesystem path.
	 *
	 * For devcontainer remote URIs (vscode-remote://dev-container+<hex>/...),
	 * the hex-encoded authority contains the local host folder the container was
	 * opened from.  We decode it and remap the container path to the equivalent
	 * local path so that smerge (which runs on the host) receives a valid path.
	 *
	 * Falls back to uri.fsPath when the URI is not a recognised devcontainer URI
	 * or when decoding fails.
	 */
	private _resolveToLocalPath(uri: vscode.Uri): string {
		if (uri.scheme === 'file') {
			return uri.fsPath;
		}

		if (uri.scheme === 'vscode-remote' && uri.authority.startsWith('dev-container+')) {
			const hexPart = uri.authority.slice('dev-container+'.length);
			try {
				const decoded = Buffer.from(hexPart, 'hex').toString('utf8');

				// The authority may encode a JSON object or a plain path string.
				let localRoot: string;
				if (decoded.startsWith('{')) {
					const parsed = JSON.parse(decoded) as Record<string, string>;
					localRoot = parsed.hostPath ?? parsed.localFolder ?? '';
				} else {
					localRoot = decoded;
				}

				// Validate it looks like an absolute path (Unix or Windows).
				if (!localRoot || (!localRoot.startsWith('/') && !/^[A-Za-z]:/.test(localRoot))) {
					return uri.fsPath;
				}

				// Normalize to resolve any ".." segments before use.
				localRoot = path.normalize(localRoot);

				// Map the container-side path back to the host path using the
				// first workspace folder as the container workspace root.
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (workspaceFolders && workspaceFolders.length > 0) {
					const containerRoot = workspaceFolders[0].uri.path;
					if (uri.path.startsWith(containerRoot)) {
						const relativePart = uri.path.slice(containerRoot.length);
						return localRoot + (relativePart || '');
					}
				}

				return localRoot;
			} catch {
				// Fall through to fsPath fallback.
			}
		}

		return uri.fsPath;
	}

	/**
	 * Walks up the directory tree from the given local path to find the nearest
	 * directory containing a .git entry (file or folder), which is the root of
	 * the innermost git repository containing that path.
	 */
	private _findNearestGitRoot(localPath: string): string | undefined {
		let dir = fs.statSync(localPath).isDirectory() ? localPath : path.dirname(localPath);
		while (true) {
			if (fs.existsSync(path.join(dir, '.git'))) {
				return dir;
			}
			const parent = path.dirname(dir);
			if (parent === dir) { break; }
			dir = parent;
		}
		return undefined;
	}

	private _runSublimeMerge(args: string[]) {
		const repoPath = this._getCurrentRepoPath();
		if (repoPath) { this._launchSublimeMerge(args, repoPath); }
	}

	private _launchSublimeMerge(args: string[], repoPath: string) {
		const executablePath = this._getExecutablePath(this._config.smergeExecutablePath);
		const proc = execFile(executablePath, args, { cwd: repoPath });
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
		if (editor) {
			const uri = editor.document.uri;
			if (uri.scheme === 'file' || uri.scheme === 'vscode-remote') {
				return uri;
			}
		}

		return null;
	}

	private _getCurrentRepoPath(): string | undefined {
		const fileUri = this._currentFileUri();

		if (fileUri) {
			// Git API first: handles registered repos including nested (sortedByPathDepth picks innermost)
			const repoPath = this._getRepositoryPath(fileUri);
			if (repoPath) { return repoPath; }

			// Fallback: filesystem walk (handles devcontainer/remote where git API may be unavailable,
			// and nested repos not yet registered by the git extension)
			try {
				const localPath = this._resolveToLocalPath(fileUri);
				const nearest = this._findNearestGitRoot(localPath);
				if (nearest) {
					this._loggingService.logInfo(`Nearest git root for ${localPath}: ${nearest}`);
					return nearest;
				}
			} catch {}
		}

		const workspaceRootFolder = this._workspaceRootFolder();
		if (workspaceRootFolder) {
			// Git API first
			const repoPath = this._getRepositoryPath(workspaceRootFolder);
			if (repoPath) { return repoPath; }

			// Fallback: filesystem walk
			try {
				const workspaceLocalPath = this._resolveToLocalPath(workspaceRootFolder);
				const nearest = this._findNearestGitRoot(workspaceLocalPath);
				if (nearest) { return nearest; }
				return workspaceLocalPath;
			} catch {
				return this._resolveToLocalPath(workspaceRootFolder);
			}
		}
	}

	private _getRepositoryPath(fileUri: vscode.Uri): string | undefined {
		const repo = this._repositories.repoForFile(fileUri);
		if (repo) {
			return this._resolveToLocalPath(repo.rootUri);
		}
	}

	private _workspaceRootFolder(): vscode.Uri | undefined {
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
			return vscode.workspace.workspaceFolders[0].uri;
		}
	}

	private _currentFileRelativePathToRepo(): string {
		const fileUri = this._currentFileUri();
		if (!fileUri) { return ''; }

		// Git API first: resolveToLocalPath on both URIs gives consistent host paths for devcontainer
		const repo = this._repositories.repoForFile(fileUri);
		if (repo) {
			const repoLocalPath = this._resolveToLocalPath(repo.rootUri);
			const fileLocalPath = this._resolveToLocalPath(fileUri);
			return path.relative(repoLocalPath, fileLocalPath);
		}

		// Fallback: filesystem walk (devcontainer/remote where git API is unavailable)
		try {
			const localFilePath = this._resolveToLocalPath(fileUri);
			const repoRoot = this._findNearestGitRoot(localFilePath);
			if (repoRoot) {
				return path.relative(repoRoot, localFilePath);
			}
		} catch {}

		// Last resort: relative to the workspace folder.
		const workspaceFolder = this._workspaceRootFolder();
		if (workspaceFolder) {
			return path.posix.relative(workspaceFolder.path, fileUri.path);
		}

		return '';
	}

	private getGitConfig(param: string): string | null {
		const repoPath = this._getCurrentRepoPath();
		if (!repoPath) {
			return null;
		}

		let output;
		try {
			output = execFileSync('git', ['config', param], { cwd: repoPath });
		} catch (e) {
			this._loggingService.logError('Error while reading Git config (' + param + '): ' + e);
			return null;
		}

		return output.toString().trimEnd();
	}
}
