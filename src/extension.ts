// Imports:
import os from "os";
import vscode from "vscode";

import axios from "axios";
import express from "express";

import { writeFileSync } from "fs";

// Constants:
const PORT = 9999;
const RELEASE_URL = "https://api.github.com/repos/Vyon/VSC2RBX/releases/latest";

// Variables:
let queue: Array<string> = [];

// Main:
const App = express();

App.get("/api/receive", (req, res) => {
	if (queue.length > 0) {
		res.status(200).send(queue.shift());
	} else {
		res.status(204).send("");
	}
});

App.get("/api/ping", (req, res) => {
	vscode.window.showInformationMessage("Connected to Roblox Studio!");
	res.status(200).send("OK");
});

App.listen(PORT, () => {
	console.log("VSC2RBX is listening on port " + PORT);
});

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand("vsc2rbx.execute", () => {
			const editor = vscode.window.activeTextEditor;

			if (editor) {
				const document = editor.document;
				const text = document.getText();
				queue.push(text);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("vsc2rbx.plugin", () => {
			vscode.window.showInformationMessage("Installing plugin...");

			axios
				.get(RELEASE_URL)
				.then(async (response) => {
					const plugin_source_url =
						response.data.assets[0].browser_download_url;

					const plugin_source = await axios.get(plugin_source_url);

					writeFileSync(
						`${os.homedir()}\\AppData\\Local\\Roblox\\Plugins\\VSC2RBX.rbxm`,
						plugin_source.data
					);

					vscode.window.showInformationMessage("Plugin installed!");
				})
				.catch((error) => {
					vscode.window.showErrorMessage("Failed to install plugin!");
					console.log(error);
				});
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("vsc2rbx.activate", () => {
			vscode.window.showInformationMessage("Extension is activated");
		})
	);

	let item = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left
	);
	item.text = "$(debug-start) Execute Script";
	item.tooltip = "Execute the currently opened script in roblox studio.";
	item.command = "vsc2rbx.execute";
	item.show();
}

export function deactivate() {}
