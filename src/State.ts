// Imports:
import Buttons from "./Buttons";

// Types:
type Dict<T> = { [key: string]: T };
export type ExecutionContext = "Edit" | "Server" | "Client";

export interface IPlaceInfo {
	Name: string;
	PlaceId: number;
	TargetContext: string;
	ActiveContexts: Array<ExecutionContext>;
}

// Main:
export class State {
	TargetPlaceId?: string;
	ActiveContexts: Array<string> = [];

	TargetContext = "Edit";
	ActivePlaces = {} as Dict<IPlaceInfo>;

	Queue = {
		Edit: [],
		Server: [],
		Client: [],
	};

	constructor() {}

	Execute(info: { Code: string; File: string }) {
		console.log(
			`Queueing script for execution in the '${this.TargetContext}' context.`
		);

		this.Queue[this.TargetContext].push({
			TargetPlaceId: this.TargetPlaceId,
			Code: info.Code,
			File: info.File,
		});
	}

	AddPlace(name: string, place_key: string) {
		let place_info = {
			Name: name,
			PlaceId: parseInt(place_key),
			TargetContext: "Edit",
			ActiveContexts: [],
		};

		this.ActivePlaces[place_key] = place_info;

		console.log(`Place state registered: ${name} (${place_key})`);

		// Set the target place id to the newly created one:
		if (!this.TargetPlaceId) {
			this.SetTargetPlace(place_key);
		}

		return place_info;
	}

	OnContextUpdate() {
		let has_server = this.ActiveContexts.includes("Server");
		let has_client = this.ActiveContexts.includes("Client");

		if (this.TargetContext === "Edit") {
			if (has_client) {
				this.TargetContext = "Client";
			} else if (has_server) {
				this.TargetContext = "Server";
			}
		}

		// Update context btn visibility:
		Buttons.Context.text = `$(info) ${this.TargetContext}`;

		if (has_server && has_client) {
			Buttons.Context.show();
		} else {
			Buttons.Context.hide();
		}
	}

	OnPlaceUpdate() {
		if (this.TargetPlaceId) {
			console.log("Updated target place");

			for (const context of Object.keys(this.Queue)) {
				this.Queue[context] = [];
			}

			let place_info = this.ActivePlaces[this.TargetPlaceId];
			Buttons.Place.text = place_info.Name;
			Buttons.Place.show();
		} else {
			Buttons.Place.hide();
		}
	}

	SetTargetContext(context: ExecutionContext) {
		let place_info = this.TargetPlaceId
			? this.ActivePlaces[this.TargetPlaceId]
			: undefined;

		if (place_info) {
			place_info.TargetContext = context;
		}

		this.TargetContext = context;
		Buttons.Context.text = `$(info) ${context}`;
	}

	SetTargetPlace(target_place_key?: string) {
		let place_info = target_place_key
			? this.ActivePlaces[target_place_key]
			: undefined;

		if (place_info) {
			this.TargetPlaceId = target_place_key;
			this.TargetContext = place_info.TargetContext;
			this.ActiveContexts = place_info.ActiveContexts;

			// Is the TargetContext also active in this context?
			if (!this.ActiveContexts.includes(this.TargetContext)) {
				this.TargetContext = "Edit";
			}
		} else {
			this.TargetPlaceId = undefined;
			this.ActiveContexts = [];
		}

		this.OnPlaceUpdate();
		this.OnContextUpdate();
	}
}
