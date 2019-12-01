'use strict';
import * as vscode from 'vscode';
import { API, APIState, GitExtension, Repository } from './api/git';
import { LoggingService } from './lib/LoggingService';

export class StatusBar {
	private _statusBar: vscode.StatusBarItem;
	private _git: API;
	private _loggingService: LoggingService;
	private _workspaceRepos: { [key: number]: Repository } = {};
	private _subscriptions: vscode.Disposable[] = [];
	private _repoSubscriptions: vscode.Disposable[] = [];

	constructor(show: boolean, loggingService: LoggingService) {
		this._loggingService = loggingService;
		this._git = this._gitAPI;
		this._statusBar = this._setup();

		if (show) {
			this.enable();
		}
	}

	enable() {
		this._loggingService.logInfo('Enabling Status Bar');
		this._loadRepositories();
		this._setupSubscriptions();
		this._statusBar.show();
	}

	disable() {
		this._loggingService.logInfo('Disabling Status Bar');
		this._statusBar.hide();
		this.disposeSubscriptions();
	}

	disposeSubscriptions() {
		this._resetRepositories();
		this._loggingService.logInfo('Dispose Subscriptions');
		this._subscriptions.every(subscription => {
			subscription.dispose();
		});
		this._subscriptions = [];
	}

	private _setupSubscriptions() {
		if (this._subscriptions.length === 0) {
			this._subscriptions.push(vscode.window.onDidChangeActiveTextEditor(this._handleActiveTextEditorChange, this));
			this._subscriptions.push(this._git.onDidOpenRepository(this._handleOpenRepository, this));
			this._subscriptions.push(this._git.onDidChangeState(this._handleDidChangeState, this));
			this._subscriptions.push(
				vscode.workspace.onDidChangeWorkspaceFolders(() => {
					this._resetRepositories();
					this._loadRepositories();
				})
			);

			this._loggingService.logInfo('Setup Subscriptions (' + this._subscriptions.length + ')');
		}
	}

	private _disposeRepoSubscriptions() {
		this._loggingService.logInfo('Dispose Repo Subscriptions');
		this._repoSubscriptions.every(subscription => {
			subscription.dispose();
		});
		this._repoSubscriptions = [];
	}

	private _setupRepoSubscriptions(repo: Repository) {
		this._loggingService.logInfo('Setup subscriptions for repo: ' + repo.rootUri.toString());

		this._repoSubscriptions.push(
			repo.state.onDidChange(() => {
				this._loggingService.logInfo('Repo State Change');
				this._updateStatusBarForActiveEditor();
			})
		);

		this._repoSubscriptions.push(
			repo.ui.onDidChange(() => {
				if (repo.ui.selected) {
					this._loggingService.logInfo('Repo UI Change');
					this._updateStatusBar(repo);
				}
			})
		);
	}

	private _setup(): vscode.StatusBarItem {
		const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);

		statusBar.command = 'vscsm.openInSublimeMerge';
		this._reset(statusBar);

		return statusBar;
	}

	private _reset(statusBar: vscode.StatusBarItem) {
		this._loggingService.logInfo('reset');

		statusBar.text = '$(git-branch) ...';
		statusBar.tooltip = '';
	}

	private _updateStatusBar(repo: Repository) {
		const unstaged = repo.state.workingTreeChanges.length;
		const staged = repo.state.indexChanges.length;

		this._loggingService.logInfo('Update Status Bar');

		this._statusBar.text = '$(git-branch) ' + unstaged + ' $(git-commit) ' + staged;
		this._statusBar.tooltip = 'Open in Sublime Merge\n\nUnstaged: ' + unstaged + '\nTo be committed: ' + staged;
	}

	private _updateStatusBarForActiveEditor() {
		const repo = this._editorRepository(vscode.window.activeTextEditor);
		if (repo) {
			this._updateStatusBar(repo);
		}
	}

	private get _gitAPI(): API {
		const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
		return gitExtension.getAPI(1);
	}

	private _editorRepository(editor: vscode.TextEditor | undefined): Repository | null {
		if (editor) {
			const workspaceIndex = vscode.workspace.getWorkspaceFolder(editor.document.uri)!.index;

			if (this._workspaceRepos[workspaceIndex]) {
				return this._workspaceRepos[workspaceIndex];
			}
		}

		return null;
	}

	private _handleActiveTextEditorChange(editor: vscode.TextEditor | undefined) {
		const repo = this._editorRepository(editor);

		if (repo) {
			this._loggingService.logInfo('Active Text Editor Change -> Has Repo');
			this._updateStatusBar(repo);
			this._statusBar.show();
		} else {
			this._loggingService.logInfo('Active Text Editor Change -> No Repo');
			this._reset(this._statusBar);
			this._statusBar.hide();
		}
	}

	private _resetRepositories() {
		this._loggingService.logInfo('Reset repositories');
		this._disposeRepoSubscriptions();
		this._workspaceRepos = {};
	}

	private _loadRepositories() {
		if (this._git.state === 'initialized') {
			this._git.repositories.forEach(repo => {
				this._addWorkspaceRepo(repo);
			});

			this._loggingService.logInfo('Loaded workspace repositories');
		}
	}

	private _addWorkspaceRepo(repo: Repository) {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(repo.rootUri);

		if (workspaceFolder && !this._workspaceRepos[workspaceFolder.index]) {
			this._loggingService.logInfo('Add Workspace Repo. ' + workspaceFolder.index + ': ' + repo.rootUri.toString());
			this._setupRepoSubscriptions(repo);
			this._workspaceRepos[workspaceFolder.index] = repo;
		}
	}

	private _handleOpenRepository(repo: Repository) {
		this._loggingService.logInfo('_handleOpenRepository: ' + repo.rootUri.toString());
		this._addWorkspaceRepo(repo);
	}

	private _handleDidChangeState(state: APIState) {
		this._loggingService.logInfo('_handleDidChangeState: ' + state);

		if (state === 'initialized') {
			this._loadRepositories();
		}
	}
}
