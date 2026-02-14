import * as vscode from 'vscode';
import { TableEditorProvider } from './providers/TableEditorProvider';

const LOG_PREFIX = '[IRIS-TE]';

export function activate(context: vscode.ExtensionContext) {
	console.debug(`${LOG_PREFIX} Extension activating`);

	// Register the webview view provider
	const provider = new TableEditorProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			TableEditorProvider.viewType,
			provider
		)
	);

	// Register command to open/focus the panel
	context.subscriptions.push(
		vscode.commands.registerCommand('iris-table-editor.openTableEditor', async () => {
			console.debug(`${LOG_PREFIX} Open Table Editor command executed`);
			// First reveal the sidebar container, then focus the view
			await vscode.commands.executeCommand('workbench.view.extension.iris-table-editor');
			provider.revealView();
		})
	);

	console.debug(`${LOG_PREFIX} Extension activated`);
}

export function deactivate() {
	console.debug(`${LOG_PREFIX} Extension deactivated`);
}
