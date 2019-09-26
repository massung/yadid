import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { delimiter, join } from 'path';

/* When last prompted for command line arguments, these are what were used. */
let lastCmdLineArgs = '';

/* Open terminal for run/build. */
let terminal: vscode.Terminal | undefined = undefined;

/* Extension is being loaded, register commands, etc.
 */
export function activate(context: vscode.ExtensionContext) {
	let config = vscode.workspace.getConfiguration('yadid');

	// register commands
	vscode.commands.registerCommand('yadid.run.file', yadidRunFile);
	vscode.commands.registerCommand('yadid.run.fileWithArgs', yadidRunFileWithArgs);
	vscode.commands.registerCommand('yadid.build.project', yadidBuildProject);
	vscode.commands.registerCommand('yadid.build.projectWithGUI', yadidBuildProjectWithGUI);
}

/* Extension in unloading, do cleanup work here.
 */
export function deactivate() {
	// TODO:
}

/* Find the 8th executable in the PATH, if it exists, run the file.
 */
export function yadidRunFile() {
	let path = find8th();

	if (!path) {
		vscode.window.showErrorMessage(`No '8th' binary found in PATH`);
	} else {
		runFile();
	}
}

/* Prompt the user for command line arguments and then run.
 */
export function yadidRunFileWithArgs() {
	let path = find8th();

	if (!path) {
		vscode.window.showErrorMessage(`No '8th' binary found in PATH`);
	} else {
		let opts = {
			prompt: 'Command line arguments:',
			ignoreFocusOut: true,
			value: lastCmdLineArgs,
		};

		// ask for input, then run
		vscode.window
			.showInputBox(opts)
			.then(value => {
				if (value) {
					runFile(lastCmdLineArgs = value);
				}
			});
	}
}

/* Find the build binary next to 8th, if it exists, build the project.
 */
export function yadidBuildProject(gui: boolean = false) {
	let path = find8th();

	if (!path) {
		vscode.window.showErrorMessage(`No '8th' binary found in PATH`);
	} else {
		let build = findBuildBinary(path);

		if (!build) {
			vscode.window.showErrorMessage(`No 'build' binary found relative to ${path}`);
		} else {
			getCurrentWorkspaceFolder()
				.then(folder => {
					if (build && folder) {
						buildProject(build, folder, gui ? '' : '-g');
					} else {
						vscode.window.showErrorMessage(`No workspace open`);
					}
				})
		}
	}
}

/* Launch the build GUI instead of just building via terminal.
 */
export function yadidBuildProjectWithGUI() {
	yadidBuildProject(true)
}

/* Looks for the 8th executable in the path, returns the first one it finds.
 */
function find8th(): string | undefined {
	let path = undefined;
	let paths = [];
	let app = '8th';

	// on windows, the 8th executable has a file extension
	if (process.platform == 'win32') {
		app += '.exe';
	}

	// find the app executable in the path somewhere
	if (process.env['PATH']) {
		paths = process.env['PATH']
			.split(delimiter)
			.map(path => join(path, app));

		// return the first path that has an 8th binary
		path = paths.find(existsSync);
	}

	return path;
}

/* Looks for the build binary relative to the 8th executable.
 */
function findBuildBinary(path: string | undefined): string | undefined {
	if (path) {
		let build = join(path, '../../build');

		if (existsSync(build)) {
			return build;
		}
	}

	return undefined;
}

/* Determines what the "current" workspace folder is.
 */
function getCurrentWorkspaceFolder(): Thenable<vscode.WorkspaceFolder | undefined> {
	let folders = vscode.workspace.workspaceFolders;
	let editor = vscode.window.activeTextEditor;

	// must have an open workspace
	if (!folders || folders.length == 0) {
		return Promise.resolve(undefined);
	}

	// if there's an active file being edited, return that file's workspace
	if (editor) {
		if (editor.document.isDirty) {
			return editor.document
				.save()
				.then(success => {
					if (editor && success) {
						return vscode.workspace.getWorkspaceFolder(editor.document.uri);
					}
				});
		} else {
			return Promise.resolve(vscode.workspace.getWorkspaceFolder(editor.document.uri))
		}
	}

	// if there's only 1 workspace, use it
	if (folders.length == 1) {
		return Promise.resolve(folders[0]);
	}

	// let the user pick the workspace
	return vscode.window.showWorkspaceFolderPick({});
}

/* Executes the current file in the terminal.
 */
function runFile(args: string = '') {
	let editor = vscode.window.activeTextEditor;

	if (!terminal) {
		terminal = vscode.window.createTerminal('8th');
	}

	if (editor && editor.document.isDirty) {
		editor.document
			.save()
			.then(success => {
				if (terminal && editor && success) {
					terminal.show(true);
					terminal.sendText(`8th ${editor.document.fileName} ${args}`, true);
				}
			});
	} else {
		if (terminal && editor) {
			terminal.show(true);
			terminal.sendText(`8th "${editor.document.fileName}" ${args}`, true);
		}
	}
}

/* Executes the build project command in the terminal.
 */
function buildProject(buildBinary: string, folder: vscode.WorkspaceFolder, flags: string) {
	if (!terminal) {
		terminal = vscode.window.createTerminal('8th');
	}

	if (terminal) {
		terminal.show();
		terminal.sendText(`8th ${buildBinary} ${flags} "${folder.uri.fsPath}"`, true);
	}
}
