--[==[

	[init.server.luau]:
		Entry point for the VSC2RBX plugin.

	[Author(s)]:
		- Vyon (https://github.com/Vyon)

--]==]

-- Services:
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- Modules:
local loadstring = require(script.vLuau)

-- Constants:
local PORT = 9999
local ROOT_URL = `http://localhost:{PORT}/api`

local PING_URL = `{ROOT_URL}/ping`
local MAIN_URL = `{ROOT_URL}/receive`
local STATUS_URL = `{ROOT_URL}/status`

local UPDATE_INTERVAL = 0.25
local CHECK_CONTEXT_RATE = 5

-- Variables:
local TargetContext = "Edit" --> This is the default target context
local StatusThread

-- Private Functions:
local function GetContext()
	if RunService:IsRunning() then
		return RunService:IsServer() and "Server" or "Client"
	end

	return "Edit"
end

local function PerformRequest(Params: {
	Url: string,
	Method: string,
})
	return HttpService:RequestAsync(Params)
end

local function IsHttpEnabled(Init: boolean?)
	local Success, Reason = pcall(function()
		PerformRequest({
			Url = PING_URL,
			Method = "GET",
		})
	end)

	if Init and not Success then
		warn("[VSC2RBX]: Failed to connect to the server:", Reason)
		return Success
	end

	return Success
end

local function SetContextState(NewState: boolean)
	PerformRequest({
		Url = STATUS_URL,
		Method = "POST",
		Headers = {
			["content-type"] = "application/json",
		},
		Body = HttpService:JSONEncode({
			Context = GetContext(),
			Active = NewState,
		}),
	})
end

-- Init:
local Context = GetContext()

-- Setup client communicator:
if Context == "Server" then
	local VSCRBX = Instance.new("RemoteFunction")
	VSCRBX.Name = "__VSC2RBX"
	VSCRBX.Parent = ReplicatedStorage

	VSCRBX.OnServerInvoke = function(_, ...)
		local Args = { ... }

		local _, Result = pcall(function()
			return PerformRequest(table.unpack(Args))
		end)

		return Result
	end
elseif Context == "Client" then
	local VSCRBX: RemoteFunction = ReplicatedStorage:WaitForChild("__VSC2RBX", 300)

	PerformRequest = function(...)
		return VSCRBX:InvokeServer(...)
	end
end

-- Test if http is enabled:
if Context ~= "Client" then
	local Enabled = IsHttpEnabled(true)

	if not Enabled then
		while not IsHttpEnabled() do
			task.wait(1)
		end
	end
end

-- Setup context related stuff:
SetContextState(true)

StatusThread = task.defer(function()
	while true do
		local Success, Response = pcall(function()
			return PerformRequest({
				Url = STATUS_URL,
				Method = "GET",
			}).Body
		end)

		if Success and Response and table.find({ "Edit", "Server", "Client" }, Response) then
			TargetContext = Response
		end

		task.wait(CHECK_CONTEXT_RATE)
	end
end)

plugin.Unloading:Once(function()
	task.cancel(StatusThread)
	SetContextState(false)
end)

-- Main update loop:
while true do
	local IsTarget = Context == TargetContext

	if not IsTarget then
		task.wait(UPDATE_INTERVAL)
		continue
	end

	local Success, Response = pcall(function(): { string }
		local Response = PerformRequest({
			Url = MAIN_URL,
			Method = "GET",
			Headers = {
				context = Context,
			},
		})

		local TargetContextValue = Response.Headers["target-context"]

		if TargetContextValue and TargetContextValue ~= Context then
			TargetContext = TargetContextValue

			return {}
		end

		return HttpService:JSONDecode(Response.Body)
	end)

	if Success and #Response > 0 then
		for _, Script in Response do
			task.defer(function()
				local Ran, Error = pcall(function()
					-- We don't errors to be displayed in the console, so we wrap it in a pcall.
					return loadstring(Script, getfenv(), "VSC2RBX")()
				end)

				if not Ran then
					local Line = Error:match("Line: (%d+)")

					warn(`Executed script errored on line {Line}: {Error:match("}: (.*)")}`)
				end
			end)
		end
	end

	task.wait(UPDATE_INTERVAL)
end
