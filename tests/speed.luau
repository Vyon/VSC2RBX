local Players = game:GetService("Players")

local TARGET_WALKSPEED = 100

for _, Player in Players:GetPlayers() do
	local Character = Player.Character

	if not Character then
		continue
	end

	local Humanoid = Character:FindFirstChild("Humanoid") :: Humanoid?

	if not Humanoid then
		continue
	end

	Humanoid.WalkSpeed = TARGET_WALKSPEED
end
