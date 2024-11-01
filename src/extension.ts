// Imports:
import os from "os";
import vscode from "vscode";

import express from "express";

import { writeFileSync } from "fs";

// Constants:
const PORT = 9999;
const RELEASE_URL =
	"https://github.com/Vyon/VSC2RBX/releases/download/Latest/VSC2RBX.rbxm";

// Variables:
let queue: Array<string> = [];

// Main:
const app = express();

app.get("/api/receive", (req, res) => {
	if (queue.length > 0) {
		res.status(200).send(queue.shift());
	} else {
		res.status(204).send("");
	}
});

app.get("/api/ping", (req, res) => {
	vscode.window.showInformationMessage("Connected to Roblox Studio!");
	res.status(200).send("OK");
});

let server: any;

export function activate(context: vscode.ExtensionContext) {
	console.log("VSC2RBX activated");

	if (!server) {
		server = app.listen(PORT, () => {
			console.log("VSC2RBX is listening on port " + PORT);
		});
	}

	context.subscriptions.push(
		vscode.commands.registerCommand("vsc2rbx.execute", () => {
			const editor = vscode.window.activeTextEditor;

			if (editor) {
				console.log("Pushing script for execution.");

				const document = editor.document;
				const text = document.getText();
				queue.push(text);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("vsc2rbx.plugin", async () => {
			vscode.window.showInformationMessage("Installing plugin...");

			// fetch for some reason doesn't exist to tsc so we ignore it :smirk:
			// @ts-ignore
			const response = await fetch(RELEASE_URL).catch((error) => {
				vscode.window.showErrorMessage("Failed to install plugin!");
				console.log(error);
			});

			const file: Uint8Array = await response.bytes();

			writeFileSync(
				`${os.homedir()}\\AppData\\Local\\Roblox\\Plugins\\VSC2RBX.rbxm`,
				file
			);

			vscode.window.showInformationMessage("Plugin installed!");
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

export function deactivate() {
	if (server) {
		server.close();
		server = null;
	}

	queue = [];
}
