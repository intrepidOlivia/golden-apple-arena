const goldenAppleSystem = server.registerSystem(0, 0);
const appleChestCoords = [-314, 100, 103];
const sourceChestCoords = [-312, 60, 99];
const ticksPerSec = 20;
const pollingDelaySecs = 0.2;

const globals = {
    goldenAppleChest: null,
    goldenAppleContainer: null,
    chestDesignated: false,
    retrievalChest: null,
    applePolling: null,
    finalPlayers: [],
};

// let goldenAppleChest;
// let goldenAppleContainer;
// let chestDesignated = false;

goldenAppleSystem.initialize = function() {
    // initialize variables and set up event listeners here

    // Set up chatlog debugging
    var scriptLoggerConfig = this.createEventData('minecraft:script_logger_config');
    scriptLoggerConfig.data.log_errors = true;
    scriptLoggerConfig.data.log_information = true;
    scriptLoggerConfig.data.log_warnings = true;
    this.broadcastEvent("minecraft:script_logger_config", scriptLoggerConfig);

    // Listen for player to acquire golden apple
    this.listenForEvent('minecraft:entity_acquired_item', eventData => this.onItemAcquired(eventData));

    // Listen for player to spawn into world (CLIENT EVENT ONLY)
    //this.listenForEvent('minecraft:entity_death', eventData => this.sendChatMessage(`${eventData.data.entity.__identifier__} has perished.`));

    this.listenForEvent('minecraft:block_interacted_with', eventData => this.blockInteraction(eventData));

    //this.listenForEvent('minecraft:entity_dropped_item', eventData => this.sendChatMessage(`${eventData.data.entity.__identifier__} dropped item ${eventData.data.item_stack.item}`));

    //this.listenForEvent('goldenAppleArena:on_interact', eventData => this.sendChatMessage("On Interact successfully performed."));
}

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

    // TEMPORARY
    // this.sendChatMessage("/give @p torch 1")

    if (this.isBlockSourceChest(player, block_position)) {
        // start polling to replace golden apple if it disappears
        this.checkToReplaceApple(block, player);
        return;
    }

    if (this.isBlockFinalChest(player, block_position)) {
        this.sendChatMessage(`Player ${player.id} has reached the final chest.`);
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

goldenAppleSystem.checkToReplaceApple = function (block, player) {
    if (!this.isAppleInChest(block)) {
        // drop new apple
        // TODO: currently containers are read-only. when they are editable, put apple in chest instead
        // this.createEntity("item_entity", "minecraft:golden_apple");
        const acquireItem = createComponent(player, "minecraft:entity_acquired_item");
        this.sendChatMessage("A golden apple dropped to the floor.");
    }
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

goldenAppleSystem.isBlockSourceChest = function (player, block_position) {
    if (!this.isSamePosition(sourceChestCoords, block_position)) {
        return false;
    }
    return this.isChest(player, block_position);
}

goldenAppleSystem.isChest = function (player, block_position) {
    const tickingArea = this.getComponent(player, "minecraft:tick_world");
    const block = this.getBlock(tickingArea.data.ticking_area, block_position);
    return this.hasComponent(block, "minecraft:container");
}

goldenAppleSystem.registerAppleChest = function(block) {
    globals.chestDesignated = true;
    globals.goldenAppleChest = block;
    globals.goldenAppleContainer = this.getComponent(block, "minecraft:container");
}

goldenAppleSystem.isSamePosition = function(coords, block_position) {
    return block_position.x === coords[0] && block_position.y === coords[1] && block_position.z === coords[2];
}

