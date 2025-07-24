// Imports:
import os from "os";
import vscode from "vscode";

import express from "express";

import { writeFileSync } from "fs";
import bodyParser from "body-parser";

// Constants:
const DATA_LIMIT = 5; // in kb

const PORT = 9999;
const RELEASE_URL =
	"https://github.com/Vyon/VSC2RBX/releases/download/Latest/VSC2RBX.rbxm";

// Variables:
let queue: { [key: string]: Array<string> } = {
	Edit: [],
	Server: [],
};

let target_context = "Edit";
let active_contexts: Array<string> = [];

// Main:
const app = express();
app.use(bodyParser.json());

app.get("/api/receive", (req, res) => {
	const context = req.headers["context"] as string | undefined;

	if (context !== target_context)
		return res
			.setHeader("target-context", target_context)
			.status(400)
			.send("");

	const context_queue = queue[context];

	if (context_queue.length > 0) {
		let bytes = 0;
		let scripts = [];

		// Collect scripts until the DATA_LIMIT is reached
		while (context_queue.length > 0) {
			if (bytes + context_queue[0].length >= DATA_LIMIT * 1024) break;

			let script = context_queue.shift();

			bytes += script.length;
			scripts.push(script);
		}

		res.status(200)
			.setHeader("content-type", "application/json")
			.send(JSON.stringify(scripts));
	} else {
		res.status(204).send("");
	}
});

app.get("/api/status", (_, res) => {
	return res.status(200).send(target_context);
});

app.post("/api/status", (req, res) => {
	const { Context: context, Active: active } = req.body;

	if (active && !active_contexts.includes(context)) {
		active_contexts.push(context);

		if (context === "Server") {
			target_context = "Server";
		}
	} else if (!active && active_contexts.includes(context)) {
		const index = active_contexts.indexOf(context);
		active_contexts.splice(index, 1);

		if (context === "Server") {
			target_context = "Edit";
		}

		// Reset the queue for the closed context:
		queue[context] = [];
	}

	res.status(200).send("OK");
});

app.get("/api/ping", (_, res) => {
	if (active_contexts.length === 0) {
		vscode.window.showInformationMessage("Connected to Roblox Studio!");
	}

	res.status(200).send("OK");
});

console.log(app._router.stack);

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

				// Check if there is an active server context:
				if (active_contexts.includes("Server")) {
					queue.Server.push(text);
				} else {
					queue.Edit.push(text);
				}
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

	for (const context of Object.keys(queue)) {
		queue[context] = [];
	}
}
