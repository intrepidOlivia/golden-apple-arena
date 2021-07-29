const goldenAppleSystem = server.registerSystem(0, 0);
const appleChestCoords = [74, 131, - 511];
const ticksPerSec = 20;
const pollingDelaySecs = 0.2;

const globals = {
    goldenAppleChest: null,
    applePolling: null,
    finalPlayers: [],
};

goldenAppleSystem.initialize = function () {

    // Set up chatlog debugging
    var scriptLoggerConfig = this.createEventData('minecraft:script_logger_config');
    scriptLoggerConfig.data.log_errors = true;
    scriptLoggerConfig.data.log_information = true;
    scriptLoggerConfig.data.log_warnings = true;
    this.broadcastEvent("minecraft:script_logger_config", scriptLoggerConfig);

    // Listen for player to acquire golden apple
    // TODO: Implement more granular apple-checking after event bug is fixed
    // Bug filed for this event: https://bugs.mojang.com/browse/MCPE-136964
    //this.listenForEvent('minecraft:entity_acquired_item', eventData => this.onItemAcquired(eventData));

    this.listenForEvent('minecraft:block_interacted_with', eventData => this.blockInteraction(eventData));
};

let appleTimer = 0;
goldenAppleSystem.update = function () {
    // Check for game completion?
    if (globals.applePolling) {
        appleTimer += (1 / ticksPerSec);
        if (appleTimer >= pollingDelaySecs) {
            globals.applePolling();
            appleTimer = 0;
        }
    }
};

goldenAppleSystem.shutdown = function () {
    // Cleanup
};

goldenAppleSystem.onItemAcquired = function (eventData) {
    this.sendChatMessage(`Entity ${eventData.data.entity.id} acquired item ${eventData.data.item_stack.item} via ${eventData.data.acquisition_method}`);
};

goldenAppleSystem.sendChatMessage = function (message) {
    let eventData = this.createEventData("minecraft:display_chat_event");
    if (eventData) {
        eventData.data.message = message;
        this.broadcastEvent("minecraft:display_chat_event", eventData);
    }
};

goldenAppleSystem.blockInteraction = function (eventData) {
    const { player, block_position } = eventData.data;
    const block = this.getBlockFromInteraction(player, block_position);

    if (this.isBlockFinalChest(player, block_position)) {
        this.sendChatMessage(`Player ${player.id} has opened the final chest.`);
        if (!this.isAppleInChest(block)) {
            this.startFinalPolling(player, block);
            return;
        }
    }
};

goldenAppleSystem.getContainerFromBlock = function (block) {
    if (this.hasComponent(block, "minecraft:container")) {
        return this.getComponent(block, "minecraft:container");
    }
    return null;
};

goldenAppleSystem.getBlockFromInteraction = function (player, block_position) {
    const tickingArea = this.getComponent(player, "minecraft:tick_world");
    return this.getBlock(tickingArea.data.ticking_area, block_position);
};

goldenAppleSystem.startFinalPolling = function (player, block) {
    if (!globals.finalPlayers.find(p => p.id === player.id)) {
        const currentAppleCount = this.getAppleCount(player);
        if (currentAppleCount < 1) {
            this.sendChatMessage(`Player ${player.id} had no golden apples.`);
            return;
        }
        player.penultimateAppleCount = currentAppleCount;
        globals.finalPlayers.push(player);
    }
    globals.applePolling = () => {
        // Check if apple appeared in chest
        if (this.isAppleInChest(block)) {
            if (globals.finalPlayers.length < 1) {
                this.sendChatMessage("Something went wrong. No winner could be determined.");
            }
            
            if (globals.finalPlayers.length === 1) {
                this.sendChatMessage(`Player ${globals.finalPlayers[0].id} has won!!`);
            } else {
                const winningPlayers = [];
                globals.finalPlayers.forEach(p => {
                    const finalAppleCount = this.getAppleCount(p);
                    if (finalAppleCount < p.penultimateAppleCount) {
                        winningPlayers.push(p);
                    }
                });
                if (winningPlayers.length < 1) {
                    this.sendChatMessage("Something went wrong. No winner could be determined.");
                } else if (winningPlayers.length > 1) {
                    this.sendChatMessage("Ambiguous victory! The following players were at the final chest: " + winningPlayers.map(p => p.id).join(", "));
                } else {
                    this.sendChatMessage(`Player ${winningPlayers[0].id} has won!!`);
                }
            }

            this.stopFinalPolling();
        }
    };
};

goldenAppleSystem.getAppleCount = function(player) {
    const inventoryContainer = this.getComponent(player, "minecraft:inventory_container");
    const hotbarContainer = this.getComponent(player, "minecraft:hotbar_container");
    let appleCount = 0;
    for (let i = 0; i < inventoryContainer.data.length; i++) {
        const stack = inventoryContainer.data[i];
        if (stack.item === "minecraft:golden_apple") {
            appleCount += stack.count;
        }
    }
    for (let i = 0; i < hotbarContainer.data.length; i++) {
        const stack = hotbarContainer.data[i];
        if (stack.item === "minecraft:golden_apple") {
            appleCount += stack.count;
        }
    }
    return appleCount;
}

goldenAppleSystem.isAppleInChest = function (block) {
    const container = this.getComponent(block, 'minecraft:container');
    let hasApple = false;
    for (let i = 0; i < container.data.length; i++) {
        const stack = container.data[i];
        if (stack.item === 'minecraft:golden_apple') {
            hasApple = true;
            this.sendChatMessage("A golden apple has been placed in the final chest.");
            break;
        }
    }
    return hasApple;
}

goldenAppleSystem.stopFinalPolling = function () {
    globals.applePolling = null;
    globals.winningPlayers = [];
    globals.finalPlayers = [];
};

goldenAppleSystem.isBlockFinalChest = function(player, block_position) {
    if (!this.isSamePosition(appleChestCoords, block_position)) {
        return false;
    }
    return this.isChest(player, block_position);
}

goldenAppleSystem.isChest = function (player, block_position) {
    const tickingArea = this.getComponent(player, "minecraft:tick_world");
    const block = this.getBlock(tickingArea.data.ticking_area, block_position);
    return this.hasComponent(block, "minecraft:container");
}

goldenAppleSystem.isSamePosition = function(coords, block_position) {
    return block_position.x === coords[0] && block_position.y === coords[1] && block_position.z === coords[2];
}

