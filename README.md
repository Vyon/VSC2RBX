# VSC2RBX
VSC2RBX is an extension that executes scripts from VSCode in Roblox Studio.

## How does it work?
Under the hood the extension creates a webserver to allow communication from studio to vscode via plugin. This plugin will often make requests to the webserver in an attempt to see if there are any new queued scripts to execute.

## Installation
1. Install the extension from the VSCode Marketplace.
2. To install the latest version of the roblox plugin use the `VSC2RBX Plugin Install` command
	If you don't have plugin auto reloading you may need to close studio in order for the plugin to work 

## Usage
1. If it's your first time using the extension you're gonna need to activate the extension you can activate the extension by pressing `Ctrl + Shift + P` and typing `VSC2RBX Activate`.
2. Once you've activated the extension you should see a new button on the bottom left of your screen titled `Execute Script`.
3. Press the `Execute Script` button while a script is open to execute