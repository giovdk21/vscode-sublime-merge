'use strict';
import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { Repository } from './api/git';
import { LoggingService } from './lib/LoggingService';
import { Repositories } from './lib/Repositories';

export class StatusBar {
	private _config: Configuration;
	private _statusBar: vscode.StatusBarItem;
	private _loggingService: LoggingService;
	private _subscriptions: vscode.Disposable[] = [];
	private _repoSubscriptions: vscode.Disposable[] = [];
	private _repositories: Repositories;

	constructor(config: Configuration, repositories: Repositories, loggingService: LoggingService) {
		this._config = config;
		this._loggingService = loggingService;
		this._repositories = repositories;
		this._statusBar = this._setup(config.statusBarItemPosition);

		if (config.showInStatusBar) {
			this.enable();
		}
	}

	enable() {
		this._loggingService.logInfo('Enabling Status Bar');
		this._setupRepositories();
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
		this._loggingService.logInfo('StatusBar: Dispose Subscriptions');
		this._subscriptions.every(subscription => {
			subscription.dispose();
		});
		this._subscriptions = [];
	}

	private _setupSubscriptions() {
		if (this._subscriptions.length === 0) {
			this._subscriptions.push(vscode.window.onDidChangeActiveTextEditor(this._handleActiveTextEditorChange, this));

			this._subscriptions.push(
				vscode.workspace.onDidChangeWorkspaceFolders(() => {
					this._resetRepositories();
					this._setupRepositories();
				})
			);

			this._subscriptions.push(
				this._repositories.onRepositoriesDidChange(() => {
					this._resetRepositories();
					this._setupRepositories();
				})
			);

			this._subscriptions.push(this._repositories.onDidInitialize(this._setupRepositories, this));

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
				this._loggingService.logInfo(`Repo State Change (${repo.rootUri.toString()})`);
				this._updateStatusBarForActiveEditor();
			})
		);

		this._repoSubscriptions.push(
			repo.ui.onDidChange(() => {
				if (repo.ui.selected) {
					this._loggingService.logInfo(`Repo UI Change (${repo.rootUri.toString()})`);
					this._updateStatusBar(repo);
				}
			})
		);
	}

	private _setup(position: string): vscode.StatusBarItem {
		let statusBarConfig: [vscode.StatusBarAlignment, number?] = [vscode.StatusBarAlignment.Right];
		if (position === "left") {
			statusBarConfig = [vscode.StatusBarAlignment.Left, 100];
		}

		const statusBar = vscode.window.createStatusBarItem(...statusBarConfig);

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
		let statusBarText: string;

		statusBarText = `$(git-branch) ${unstaged} $(git-commit) ${staged}`;

		if (this._config.showBranchNameInStatusBar) {
			statusBarText = `${this._getBranchName(repo)} ${statusBarText}`;
		}

		this._loggingService.logInfo(`Update Status Bar (${repo.rootUri.toString()})`);

		this._statusBar.text = statusBarText;
		this._statusBar.tooltip = 'Open in Sublime Merge\n\nUnstaged: ' + unstaged + '\nTo be committed: ' + staged;
	}

	private _getBranchName(repo: Repository): string {
		return repo.state.HEAD && repo.state.HEAD.name ? repo.state.HEAD.name : '';
	}

	private _updateStatusBarForActiveEditor() {
		const repo = this._editorRepository(vscode.window.activeTextEditor);
		if (repo) {
			this._updateStatusBar(repo);
		}
	}

	private _editorRepository(editor: vscode.TextEditor | undefined): Repository | null {
		if (editor) {
			return this._repositories.repoForFile(editor.document.uri);
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
	}

	private _setupRepositories() {
		this._repositories.repositories.forEach(repo => {
			this._setupRepoSubscriptions(repo);
		});
	}
}
