// Imports:
import os from "os";
import vscode from "vscode";

import express from "express";

import { writeFileSync } from "fs";
import bodyParser from "body-parser";

// Types:
type ExecutionContext = "Edit" | "Server" | "Client";

// Constants:
const DATA_LIMIT = 5; // in kb

const PORT = 9999;
const RELEASE_URL =
	"https://github.com/Vyon/VSC2RBX/releases/download/Latest/VSC2RBX.rbxm";

// Variables:
let server: any;
let state: {
	TargetContext: ExecutionContext;
	ActiveContexts: Array<ExecutionContext>;
	Queue: {
		[K in ExecutionContext]: Array<string>;
	};

	OnContextUpdate(active: Array<string>): void;
};

// Main:
const app = express();
app.use(bodyParser.json());

app.get("/api/receive", (req, res) => {
	const context = req.headers["context"] as string | undefined;

	if (context !== state.TargetContext)
		return res
			.setHeader("target-context", state.TargetContext)
			.status(400)
			.send("");

	const context_queue = state.Queue[context];

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

app.get("/api/active", (_, res) => {
	return res.status(200).send(state.ActiveContexts);
});

app.get("/api/status", (_, res) => {
	return res.status(200).send(state.TargetContext);
});

app.post("/api/status", (req, res) => {
	const { Context: context, Active: active } = req.body;

	if (active && !state.ActiveContexts.includes(context)) {
		state.ActiveContexts.push(context);

		if (context !== "Edit") {
			state.TargetContext = context;
		}
	} else if (!active && state.ActiveContexts.includes(context)) {
		const index = state.ActiveContexts.indexOf(context);
		state.ActiveContexts.splice(index, 1);

		if (context === "Server" || context === "Client") {
			state.TargetContext = "Edit";
		}

		// Reset the queue for the closed context:
		state.Queue[context] = [];
	}

	state.OnContextUpdate(state.ActiveContexts);

	res.status(200).send("OK");
});

app.get("/api/ping", (_, res) => {
	if (state.ActiveContexts.length === 0) {
		vscode.window.showInformationMessage("Connected to Roblox Studio!");
	}

	res.status(200).send("OK");
});

export function activate(context: vscode.ExtensionContext) {
	console.log("VSC2RBX activated");

	// Setup status bar items:
	let item = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left
	);
	item.text = "$(debug-start) Execute Script";
	item.tooltip = "Execute the currently opened script in roblox studio.";
	item.command = "vsc2rbx.execute";
	item.show();

	let toggle_context = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left
	);
	toggle_context.text = "$(info) Server";
	toggle_context.tooltip =
		"Switches between the 'Server' and 'Client' context";
	toggle_context.command = "vsc2rbx.togglecontext";

	// Start server & create ext state:
	if (!server) {
		state = {
			TargetContext: "Edit",
			ActiveContexts: [],

			Queue: {
				Edit: [],
				Server: [],
				Client: [],
			},
			OnContextUpdate: function (active) {
				if (active.includes("Server") && active.includes("Client")) {
					toggle_context.show();
				} else {
					toggle_context.hide();
				}
			},
		};

		server = app.listen(PORT, () => {
			console.log("VSC2RBX is listening on port " + PORT);
		});
	}

	// Create commands:
	context.subscriptions.push(
		vscode.commands.registerCommand("vsc2rbx.togglecontext", () => {
			if (state.TargetContext === "Edit") return;

			let new_target =
				state.TargetContext === "Server" ? "Client" : "Server";

			state.TargetContext = new_target as ExecutionContext;
			toggle_context.text = `$(info) ${state.TargetContext}`;
		}),
		vscode.commands.registerCommand("vsc2rbx.execute", () => {
			const editor = vscode.window.activeTextEditor;

			if (editor) {
				console.log(
					`Queueing script for execution in the '${state.TargetContext}' context.`
				);

				const document = editor.document;
				const text = document.getText();

				// Check if there is an active server context:
				state.Queue[state.TargetContext].push(text);
			}
		}),
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
		}),
		vscode.commands.registerCommand("vsc2rbx.activate", () => {
			vscode.window.showInformationMessage("Extension is activated");
		})
	);
}

export function deactivate() {
	if (server) {
		server.close();
		server = null;
	}

	delete state.TargetContext;
	delete state.OnContextUpdate;

	state.ActiveContexts = [];

	for (const context of Object.keys(state.Queue)) {
		state.Queue[context] = [];
	}

	state = undefined;
}
