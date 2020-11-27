'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext } from 'vscode';
import { Configuration } from './configuration';
import { LoggingService } from "./lib/LoggingService";
import { Repositories } from "./lib/Repositories";
import { RegisterCommands } from './commands';
import { StatusBar } from './status_bar';

let statusBar: StatusBar;
let repositories: Repositories;

// this method is called when the extension is activated
export function activate(context: ExtensionContext) {
	const config = new Configuration();
	const loggingService = new LoggingService(config);
	repositories = new Repositories(loggingService);
	const registerCommands = new RegisterCommands(config, context, repositories, loggingService);

	registerCommands.init();

	statusBar = new StatusBar(config, repositories, loggingService);
	context.subscriptions.push(config.onDidShowInStatusBarChange(() => {
		config.showInStatusBar ? statusBar.enable() : statusBar.disable();
	}));
}

// this method is called when the extension is deactivated
export function deactivate() {
	statusBar.disposeSubscriptions();
	repositories.disposeSubscriptions();
}
