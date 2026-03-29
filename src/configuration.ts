'use strict';
import { ConfigurationChangeEvent, Disposable, Event, EventEmitter, workspace } from 'vscode';

type PlatformsConfigObj = {
	linux?: string;
	osx?: string;
	windows?: string;
}

const configId = 'vscsm';

export class Configuration {
	constructor() {
		this._watchForChanges();
	}

	get showInStatusBar(): boolean {
		return workspace.getConfiguration(configId).get<boolean>('showInStatusBar') || false;
	}

	get showBranchNameInStatusBar(): boolean {
		return workspace.getConfiguration(configId).get<boolean>('showBranchName') || false;
	}

	get statusBarItemPosition(): string {
		return workspace.getConfiguration(configId).get<string>('statusBarItemPosition') || 'right';
	}

	get smergeExecutablePath(): string | PlatformsConfigObj {
		return workspace.getConfiguration(configId).get<string | PlatformsConfigObj>('smergeExecutablePath') || 'smerge';
	}

	get debugEnabled() {
		return workspace.getConfiguration(configId).get<boolean>('debug') || false;
	}

	private _showInStatusBarChangeEvent = new EventEmitter<ConfigurationChangeEvent>();
	public readonly onDidShowInStatusBarChange: Event<ConfigurationChangeEvent> = this._showInStatusBarChangeEvent.event;

	private _configWatcher: Disposable | undefined;

	private _watchForChanges() {
		this._configWatcher = workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
			if (e.affectsConfiguration(configId + '.showInStatusBar')) {
				this._showInStatusBarChangeEvent.fire(e);
			}
		});
	}

	dispose() {
		this._configWatcher?.dispose();
		this._showInStatusBarChangeEvent.dispose();
	}
}
