--[==[

	[init.server.luau]:
		Entry point for the VSC2RBX plugin.

	[Author(s)]:
		- Vyon (https://github.com/Vyon)

--]==]

if game:GetService("RunService"):IsRunning() and game:GetService("RunService"):IsClient() then --> Just doesn't work on the client theres nothing that can be done about it either.
	return
end

-- Services:
local HttpService = game:GetService("HttpService")

-- Modules:
local loadstring = require(script.vLuau)

-- Constants:
local PORT = 9999
local ROOT_URL = `http://localhost:{PORT}/api`

local MAIN_URL = `{ROOT_URL}/receive`
local PING_URL = `{ROOT_URL}/ping`

local REFRESH = 0.1

-- Private Functions:
local function PerformRequest(Params: {
	Url: string,
	Method: string,
})
	return HttpService:RequestAsync(Params)
end

local function IsHttpEnabled(Init: boolean?)
	local Success = pcall(function()
		PerformRequest({
			Url = PING_URL,
			Method = "GET",
		})
	end)

	if Init and not Success then
		warn("[VSC2RBX]: Failed to connect to the server. Please make sure that the server is running.")
		return Success
	end

	return Success
end

-- Init:
local Enabled = IsHttpEnabled(true)

if not Enabled then
	while not IsHttpEnabled() do
		task.wait(1)
	end
end

while true do
	local Success, Response = pcall(function()
		return PerformRequest({
			Url = MAIN_URL,
			Method = "GET",
		}).Body
	end)

	if Success and Response ~= "" then
		local Ran, Error = pcall(function()
			-- We don't errors to be displayed in the console, so we wrap it in a pcall.
			return loadstring(Response, getfenv(), "VSC2RBX")()
		end)

		if not Ran then
			print(Error)
		end
	end

	task.wait(REFRESH)
end
