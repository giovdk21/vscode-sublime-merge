'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext } from 'vscode';
import { Configuration } from './configuration';
import { LoggingService } from "./lib/LoggingService";
import { registerCommands } from './commands';
import { StatusBar } from './status_bar';

let statusBar: StatusBar;

// this method is called when the extension is activated
export function activate(context: ExtensionContext) {
	const config = new Configuration();
	const loggingService = new LoggingService(config);

	registerCommands(context);

	statusBar = new StatusBar(config.showInStatusBar, loggingService);
	context.subscriptions.push(config.onDidShowInStatusBarChange(() => {
		config.showInStatusBar ? statusBar.enable() : statusBar.disable();
	}));
}

// this method is called when the extension is deactivated
export function deactivate() {
	statusBar.disposeSubscriptions();
}
