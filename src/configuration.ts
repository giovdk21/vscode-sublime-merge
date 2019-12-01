'use strict';
import { workspace } from 'vscode';

const configId = 'vscsm';

export class Configuration {
	get debugEnabled() {
		return workspace.getConfiguration(configId).get<boolean>('debug') || false;
	}
}
