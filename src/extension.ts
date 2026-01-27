import * as vscode from 'vscode';

const LOG_PREFIX = '[IRIS-TE]';

export function activate(context: vscode.ExtensionContext) {
	console.debug(`${LOG_PREFIX} Extension activated`);

	const disposable = vscode.commands.registerCommand('iris-table-editor.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from IRIS Table Editor!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
	console.debug(`${LOG_PREFIX} Extension deactivated`);
}
