import vscode from "vscode";

let execute = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
execute.text = "$(debug-start) Execute Script";
execute.tooltip = "Execute the currently opened script in roblox studio.";
execute.command = "vsc2rbx.execute";
execute.show();

let context = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
context.text = "$(info) Server";
context.tooltip = "Switches between the 'Server' and 'Client' context";
context.command = "vsc2rbx.context";

let place = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
place.text = "None";
place.tooltip = "Sets the target place";
place.command = "vsc2rbx.place";

export default {
	Execute: execute,
	Context: context,
	Place: place,
};
