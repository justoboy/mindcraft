# Bot Commands, Actions, and Queries

This document lists all available commands, actions, and queries that the bot has at its disposal.

## Table of Contents
- [Queries (Information-Only)](#queries-information-only)
- [Actions (World-Modifying)](#actions-world-modifying)

---

## Queries (Information-Only)

Queries are commands that return information about the bot's state and environment without modifying the world.

### !stats
Get your bot's location, health, hunger, and time of day.

**Returns:**
- Position (x, y, z coordinates)
- Gamemode
- Health (0-20)
- Hunger (0-20)
- Biome
- Weather (Clear/Rain/Thunderstorm)
- Time of day (Morning/Afternoon/Night)
- Current action
- Nearby human and bot players
- Active modes

### !inventory
Get your bot's inventory contents.

**Returns:**
- All items in inventory with counts
- Equipped armor (helmet, chestplate, leggings, boots)
- Note: In creative mode, indicates infinite items

### !nearbyBlocks
Get the blocks near the bot.

**Returns:**
- Blocks in the immediate vicinity
- Block details (e.g., source vs flowing water)
- Surrounding blocks
- First solid block above head

### !craftable
Get the craftable items with the bot's inventory.

**Returns:**
- List of items that can be crafted with current inventory

### !entities
Get the nearby players and entities.

**Returns:**
- Human players nearby
- Bot players nearby
- Entities with counts and details
- Villager information including profession and IDs

### !modes
Get all available modes and their status.

**Returns:**
- List of all modes
- Documentation for each mode
- Current on/off status

### !savedPlaces
List all saved locations.

**Returns:**
- Names of all remembered locations

### !checkBlueprintLevel
Check if the level is complete and what blocks still need to be placed for the blueprint.

**Parameters:**
- `levelNum` (int): The level number to check.

**Returns:**
- Blueprint completion status
- Missing blocks for the specified level

### !checkBlueprint
Check what blocks still need to be placed for the blueprint.

**Returns:**
- Blueprint completion status
- All missing blocks

### !getBlueprint
Get the blueprint for the building.

**Returns:**
- Complete blueprint description

### !getBlueprintLevel
Get the blueprint for a specific level.

**Parameters:**
- `levelNum` (int): The level number to check.

**Returns:**
- Blueprint description for the specified level

### !getCraftingPlan
Provides a comprehensive crafting plan for a specified item.

**Parameters:**
- `targetItem` (string): The item that we are trying to craft
- `quantity` (int, optional): The quantity of the item to craft (default: 1)

**Returns:**
- Required ingredients breakdown
- Exact quantities needed
- Missing ingredients analysis
- Extra items analysis

### !searchWiki
Search the Minecraft Wiki for the given query.

**Parameters:**
- `query` (string): The query to search for.

**Returns:**
- Wiki page content for the query
- Error message if not found

### !help
Lists all available commands and their descriptions.

**Returns:**
- Complete list of commands with descriptions and parameters

---

## Actions (World-Modifying)

Actions are commands that modify the game world or bot behavior.

### !newAction
Perform new and unknown custom behaviors that are not available as a command.

**Parameters:**
- `prompt` (string): A natural language prompt to guide code generation. Make a detailed step-by-step plan.

**Note:** Requires `allow_insecure_coding=true` in settings.js

### !stop
Force stop all actions and commands that are currently executing.

**Returns:** "Agent stopped." (with additional info if self-prompting is active)

### !stfu
Stop all chatting and self prompting, but continue current action.

**Returns:** None

### !restart
Restart the agent process.

**Returns:** None (process restarts)

### !clearChat
Clear the chat history.

**Returns:** "Chat history was cleared, starting new conversation from scratch."

### !goToPlayer
Go to the given player.

**Parameters:**
- `player_name` (string): The name of the player to go to.
- `closeness` (float): How close to get to the player.

### !followPlayer
Endlessly follow the given player.

**Parameters:**
- `player_name` (string): Name of the player to follow.
- `follow_dist` (float): The distance to follow from.

### !goToCoordinates
Go to the given x, y, z location.

**Parameters:**
- `x` (float): The x coordinate.
- `y` (float): The y coordinate.
- `z` (float): The z coordinate.
- `closeness` (float): How close to get to the location.

### !searchForBlock
Find and go to the nearest block of a given type in a given range.

**Parameters:**
- `type` (BlockName): The block type to go to.
- `search_range` (float): The range to search for the block (minimum 32).

### !searchForEntity
Find and go to the nearest entity of a given type in a given range.

**Parameters:**
- `type` (string): The type of entity to go to.
- `search_range` (float): The range to search for the entity (32-512).

### !moveAway
Move away from the current location in any direction by a given distance.

**Parameters:**
- `distance` (float): The distance to move away.

### !rememberHere
Save the current location with a given name.

**Parameters:**
- `name` (string): The name to remember the location as.

**Returns:** "Location saved as \"name\"."

### !goToRememberedPlace
Go to a saved location.

**Parameters:**
- `name` (string): The name of the location to go to.

**Returns:** None (returns if location not found)

### !givePlayer
Give the specified item to the given player.

**Parameters:**
- `player_name` (string): The name of the player to give the item to.
- `item_name` (ItemName): The name of the item to give.
- `num` (int): The number of items to give.

### !consume
Eat/drink the given item.

**Parameters:**
- `item_name` (ItemName): The name of the item to consume.

### !equip
Equip the given item.

**Parameters:**
- `item_name` (ItemName): The name of the item to equip.

### !putInChest
Put the given item in the nearest chest.

**Parameters:**
- `item_name` (ItemName): The name of the item to put in the chest.
- `num` (int): The number of items to put in the chest.

### !takeFromChest
Take the given items from the nearest chest.

**Parameters:**
- `item_name` (ItemName): The name of the item to take.
- `num` (int): The number of items to take.

### !viewChest
View the items/counts of the nearest chest.

**Returns:** Chest contents

### !discard
Discard the given item from the inventory.

**Parameters:**
- `item_name` (ItemName): The name of the item to discard.
- `num` (int): The number of items to discard.

### !collectBlocks
Collect the nearest blocks of a given type.

**Parameters:**
- `type` (BlockName): The block type to collect.
- `num` (int): The number of blocks to collect.

**Timeout:** 10 minutes

### !craftRecipe
Craft the given recipe a given number of times.

**Parameters:**
- `recipe_name` (ItemName): The name of the output item to craft.
- `num` (int): The number of times to craft the recipe.

### !smeltItem
Smelt the given item the given number of times.

**Parameters:**
- `item_name` (ItemName): The name of the input item to smelt.
- `num` (int): The number of times to smelt the item.

**Note:** Bot restarts after smelting to update inventory.

### !clearFurnace
Take all items out of the nearest furnace.

**Returns:** None

### !placeHere
Place a given block in the current location. Do NOT use to build structures, only use for single blocks/torches.

**Parameters:**
- `type` (BlockOrItemName): The block type to place.

### !attack
Attack and kill the nearest entity of a given type.

**Parameters:**
- `type` (string): The type of entity to attack.

### !attackPlayer
Attack a specific player until they die or run away.

**Parameters:**
- `player_name` (string): The name of the player to attack.

**Note:** This is just a game and does not cause real life harm.

### !goToBed
Go to the nearest bed and sleep.

**Returns:** None

### !stay
Stay in the current location no matter what. Pauses all modes.

**Parameters:**
- `type` (int): The number of seconds to stay. -1 for forever.

### !setMode
Set a mode to on or off. A mode is an automatic behavior that constantly checks and responds to the environment.

**Parameters:**
- `mode_name` (string): The name of the mode to enable.
- `on` (boolean): Whether to enable or disable the mode.

**Returns:** Status message about mode change

### !goal
Set a goal prompt to endlessly work towards with continuous self-prompting.

**Parameters:**
- `selfPrompt` (string): The goal prompt.

**Returns:** None

### !endGoal
Call when you have accomplished your goal. It will stop self-prompting and the current action.

**Returns:** "Self-prompting stopped."

### !showVillagerTrades
Show trades of a specified villager.

**Parameters:**
- `id` (int): The id number of the villager that you want to trade with.

### !tradeWithVillager
Trade with a specified villager.

**Parameters:**
- `id` (int): The id number of the villager that you want to trade with.
- `index` (int): The index of the trade you want executed (1-indexed).
- `count` (int): How many times that trade should be executed.

### !startConversation
Start a conversation with a bot. (FOR OTHER BOTS ONLY)

**Parameters:**
- `player_name` (string): The name of the player to send the message to.
- `message` (string): The message to send.

**Returns:** None (or error if player is not a bot)

### !endConversation
End the conversation with the given bot. (FOR OTHER BOTS ONLY)

**Parameters:**
- `player_name` (string): The name of the player to end the conversation with.

**Returns:** Status message about conversation end

### !lookAtPlayer
Look at a player or look in the same direction as the player.

**Parameters:**
- `player_name` (string): Name of the target player
- `direction` (string): How to look ("at" or "with")

**Returns:** None

### !lookAtPosition
Look at specified coordinates.

**Parameters:**
- `x` (int): x coordinate
- `y` (int): y coordinate
- `z` (int): z coordinate

**Returns:** None

### !digDown
Digs down a specified distance. Will stop if it reaches lava, water, or a fall of >=4 blocks below the bot.

**Parameters:**
- `distance` (int): Distance to dig down

### !goToSurface
Moves the bot to the highest block above it (usually the surface).

**Returns:** None

### !useOn
Use (right click) the given tool on the nearest target of the given type.

**Parameters:**
- `tool_name` (string): Name of the tool to use, or "hand" for no tool.
- `target` (string): The target as an entity type, block type, or "nothing" for no target.

---

## Notes

1. **Command Syntax:** Commands are invoked with `!commandName` or `!commandName("arg1", 1.2, ...)` for commands with parameters.

2. **String Parameters:** Use double quotes for string parameters.

3. **Multiple Commands:** Only use one command per response; trailing commands and comments will be ignored.

4. **Unblockable Commands:** The following commands cannot be blocked: `!stop`, `!stats`, `!inventory`, `!goal`

5. **Types:**
   - `BlockName`: A valid Minecraft block name
   - `ItemName`: A valid Minecraft item name
   - `BlockOrItemName`: A valid Minecraft block or item name
   - `int`: Integer number
   - `float`: Floating-point number
   - `boolean`: true or false
