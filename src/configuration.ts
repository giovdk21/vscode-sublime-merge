'use strict';
import { ConfigurationChangeEvent, Event, EventEmitter, workspace } from 'vscode';

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

	get smergeExecutablePath(): string {
		return workspace.getConfiguration(configId).get<string>('smergeExecutablePath') || 'smerge';
	}

	get debugEnabled() {
		return workspace.getConfiguration(configId).get<boolean>('debug') || false;
	}

	private _showInStatusBarChangeEvent = new EventEmitter<ConfigurationChangeEvent>();
	public readonly onDidShowInStatusBarChange: Event<ConfigurationChangeEvent> = this._showInStatusBarChangeEvent.event;

	private _watchForChanges() {
		workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
			if (e.affectsConfiguration(configId + '.showInStatusBar')) {
				this._showInStatusBarChangeEvent.fire(e);
			}
		});
	}
}
