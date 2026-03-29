'use strict';
import * as vscode from 'vscode';
import { API, APIState, GitExtension, Repository } from '../api/git';
import { LoggingService } from './LoggingService';


export class Repositories {
	private _git: API | null;
	private _loggingService: LoggingService;
	private _subscriptions: vscode.Disposable[] = [];
	private _initialized: boolean = false;
	private _gitSubscribed: boolean = false;

	private _InitializedEvent = new vscode.EventEmitter<any>();
	public readonly onDidInitialize: vscode.Event<any> = this._InitializedEvent.event;

	private _ChangedRepositoriesEvent = new vscode.EventEmitter<any>();
	public readonly onRepositoriesDidChange: vscode.Event<any> = this._ChangedRepositoriesEvent.event;

	constructor(loggingService: LoggingService) {
		this._loggingService = loggingService;
		this._git = null;

		const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
		if (!gitExtension) {
			this._loggingService.logInfo('Git extension not found');
			return;
		}

		if (gitExtension.isActive) {
			this._loggingService.logInfo('Git extension already active');
			this._initFromGitExtension(gitExtension.exports);
		} else {
			this._loggingService.logInfo('Git extension not yet active, waiting for activation...');
			gitExtension.activate().then(
				(exports) => {
					this._loggingService.logInfo('Git extension activated');
					this._initFromGitExtension(exports);
				},
				(err) => {
					this._loggingService.logInfo('Git extension activation failed: ' + err);
				}
			);
		}
	}

	private _initFromGitExtension(gitExports: GitExtension) {
		if (!gitExports.enabled) {
			this._loggingService.logInfo('Git extension is disabled');
			return;
		}

		try {
			this._git = gitExports.getAPI(1);
		} catch (e) {
			this._loggingService.logInfo('Failed to get Git API: ' + e);
			return;
		}

		this._setupSubscriptions();
		this._handleDidChangeState(this._git.state);

		// If repos were already discovered before we subscribed, notify listeners
		if (this._initialized && this._git.repositories.length > 0) {
			this._loggingService.logInfo('Repos already available: ' + this._git.repositories.length);
			this._ChangedRepositoriesEvent.fire(true);
		}
	}

	disposeSubscriptions() {
		this._loggingService.logInfo('Repositories: Dispose Subscriptions');
		this._subscriptions.forEach(subscription => {
			subscription.dispose();
		});
		this._subscriptions = [];
		this._InitializedEvent.dispose();
		this._ChangedRepositoriesEvent.dispose();
	}

	private _setupSubscriptions() {
		if (this._git && !this._gitSubscribed) {
			this._gitSubscribed = true;
			this._subscriptions.push(this._git.onDidOpenRepository(this._handleOpenRepository, this));
			this._subscriptions.push(this._git.onDidChangeState(this._handleDidChangeState, this));
		}
	}

	private _handleOpenRepository(repo: Repository) {
		if (!this._initialized) { return; }

		this._loggingService.logInfo('_handleOpenRepository: ' + repo.rootUri.toString());
		this._ChangedRepositoriesEvent.fire(true);
	}

	private _handleDidChangeState(state: APIState) {
		this._loggingService.logInfo(`_handleDidChangeState: ${state}`);
		if (state === 'initialized') {
			this._loggingService.logInfo(`-- GIT ${state} --`);
			this._initialized = true;
			this._InitializedEvent.fire(true);
		}
	}

	get isInitialized(): boolean {
		return this._initialized;
	}

	get repositories(): Repository[] {
		if (this._initialized && this._git) {
			return this._git.repositories;
		}

		return [];
	}

	repoForFile(fileUri: vscode.Uri): Repository | null {
		const sortedRepos = this.sortedByPathDepth();
		const foundRepo = sortedRepos.find(
			repo => fileUri.toString().startsWith(repo.rootUri.toString())
		);

		this._loggingService.logInfo(`Sorted repos:`, sortedRepos.map(e => e.rootUri.toString()));
		this._loggingService.logInfo(`Repo for ${fileUri.path}: ${foundRepo?.rootUri.path}`);

		return foundRepo || null;
	}

	sortedByPathDepth() {
		return [...this.repositories].sort(
			(a, b) => {
				return b.rootUri.path.length - a.rootUri.path.length;
			}
		);
	}
}
