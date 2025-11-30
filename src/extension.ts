// Imports:
import os from "os";
import vscode from "vscode";

import express from "express";

import { writeFileSync } from "fs";
import bodyParser from "body-parser";
import { ExecutionContext, State } from "./State";
import Buttons from "./Buttons";

// Constants:
const DATA_LIMIT = 5; // in kb

const PORT = 9999;
const RELEASE_URL =
	"https://github.com/Vyon/VSC2RBX/releases/download/Latest/VSC2RBX.rbxm";

// Variables:
let server: any;
let state: State;

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

	const place_id = req.headers["roblox-id"] as string | undefined;

	if (place_id !== state.TargetPlaceId)
		return res
			.setHeader("target-place", state.TargetPlaceId ?? "")
			.status(400)
			.send("");

	const context_queue = state.Queue[context];

	if (context_queue.length > 0) {
		let bytes = 0;
		let scripts = [];

		// Collect scripts until the DATA_LIMIT is reached
		while (context_queue.length > 0) {
			if (
				bytes !== 0 && // Let atleast 1 script go through if said script is over the data limit
				bytes + context_queue[0].Code.length >= DATA_LIMIT * 1024
			)
				break;

			let script = context_queue.shift();

			bytes += script.Code.length;
			scripts.push({
				File: script.File,
				Code: script.Code,
			});
		}

		res.status(200)
			.setHeader("content-type", "application/json")
			.send(JSON.stringify(scripts));
	} else {
		res.status(204).send("");
	}
});

app.get("/api/places", (_, res) => {
	return res.status(200).send(state.ActivePlaces);
});

app.get("/api/active", (_, res) => {
	return res.status(200).send(state.ActiveContexts);
});

app.get("/api/status", (_, res) => {
	return res.status(200).send(state.TargetContext);
});

app.post("/api/status", (req, res) => {
	const place_name = req.headers["roblox-name"] as string;
	const place_id = req.headers["roblox-id"] as string;
	let place_key = place_id;

	const { Context: context, Active: active } = req.body;
	const is_closing = context == "Edit" && !active; // Pretty good sign that studio is closing

	let place_info = state.ActivePlaces[place_key];
	let is_target = state.TargetPlaceId === place_key;

	if (place_info) {
		console.log(
			`Place name updated: ${place_info.Name} -> ${place_name} (${place_info.PlaceId})`
		);

		place_info.Name = place_name;
		Buttons.Place.text = place_name;
	} else if (!is_closing) {
		place_info = state.AddPlace(place_name, place_id);
	} else {
		// The session is ending but we still need some kind of place_info
		place_info = {
			Name: place_name,
			PlaceId: parseInt(place_id),
			TargetContext: "Edit",
			ActiveContexts: [],
		};
	}

	if (is_closing) {
		// There is no place info & we're pretty confident the studio is being closed
		if (is_target) {
			// Set a new place as the target
			let list = Object.values(state.ActivePlaces);

			if (list.length === 0) {
				state.SetTargetPlace();
			} else {
				let next = list.shift();

				state.SetTargetPlace(next.PlaceId.toString());
			}
		}

		delete state.ActivePlaces[place_key];

		res.status(200).send("OK");
		return;
	}

	let contexts = place_info.ActiveContexts;

	if (active && !contexts.includes(context)) {
		contexts.push(context);

		if (is_target && context !== "Edit") {
			state.SetTargetContext(context);
		}
	} else if (!active && contexts.includes(context)) {
		const index = contexts.indexOf(context);
		contexts.splice(index, 1);

		// The play session is closing:
		if (context === "Server" || context === "Client") {
			if (is_target) state.SetTargetContext("Edit");
		}

		// Reset the queue for the closed context:
		state.Queue[context] = [];
	}

	if (is_target) {
		state.OnContextUpdate();
	}

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

	// Start server & create ext state:
	if (!server) {
		state = new State();

		server = app.listen(PORT, () => {
			console.log("VSC2RBX is listening on port " + PORT);
		});
	}

	// Create commands:
	context.subscriptions.push(
		vscode.commands.registerCommand("vsc2rbx.context", () => {
			if (state.TargetContext === "Edit") return;

			let new_target =
				state.TargetContext === "Server" ? "Client" : "Server";

			state.SetTargetContext(new_target as ExecutionContext); // Dumb
		}),

		vscode.commands.registerCommand("vsc2rbx.place", async () => {
			let list = [];
			let lookup = {};

			for (let [key, info] of Object.entries(state.ActivePlaces)) {
				let name = `${info.Name} (${key})`;

				list.push(name);
				lookup[name] = key;
			}

			const selected_place = await vscode.window.showQuickPick(list, {
				placeHolder: "Select a new place",
			});

			if (selected_place) {
				let place_key = lookup[selected_place];

				state.SetTargetPlace(place_key);
			}
		}),
		vscode.commands.registerCommand("vsc2rbx.execute", () => {
			const editor = vscode.window.activeTextEditor;

			if (editor) {
				const document = editor.document;
				const text = document.getText();

				state.Execute({
					Code: text,
					File: document.fileName,
				});
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

	for (const context of Object.keys(state.Queue)) {
		state.Queue[context] = [];
	}

	state = undefined;
}
