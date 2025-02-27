import * as Server from "@minecraft/server";
import * as Editor from "@minecraft/server-editor";
import { Color } from "../utils";
export default (uiSession) => {
    const tool = uiSession.toolRail.addTool(
        {
            displayString: "Item Spawner (CTRL + I)",
            tooltip: "Left mouse click or drag-to-spawn",
            icon: "pack://textures/editor/item.png?filtering=point",
        },
    );
    
    const currentCursorState = uiSession.extensionContext.cursor.getState();
    currentCursorState.color = new Color(0, 1, 0, 1);
    currentCursorState.controlMode = Editor.CursorControlMode.KeyboardAndMouse;
    currentCursorState.targetMode = Editor.CursorTargetMode.Face;
    currentCursorState.visible = true;
    
    const previewSelection = uiSession.extensionContext.selectionManager.createSelection();
    previewSelection.visible = true;
    previewSelection.borderColor = new Color(0, 1, 0, 0.2);
    previewSelection.fillColor = new Color(0, 1, 0, 0.1);
    
    uiSession.scratchStorage = {
        currentCursorState,
        previewSelection,
    };
    
    tool.onModalToolActivation.subscribe(
        eventData => {
            if (eventData.isActiveTool)
                uiSession.extensionContext.cursor.setState(uiSession.scratchStorage.currentCursorState);
        },
    );
    
    uiSession.inputManager.registerKeyBinding(
        Editor.EditorInputContext.GlobalToolMode,
        uiSession.actionManager.createAction(
            {
                actionType: Editor.ActionTypes.NoArgsAction,
                onExecute: () => {
                    uiSession.toolRail.setSelectedOptionId(tool.id, true);
                },
            },
        ),
        Editor.KeyboardKey.KEY_I,
        Editor.InputModifier.Control,
    );
    
    const pane = uiSession.createPropertyPane(
        {
            titleAltText: "Item Spawner",
            width: 40,
        },
    );
    
    const settings = Editor.createPaneBindingObject(
        pane,
        {
            itemType: Server.MinecraftItemTypes.diamondSword.id,
            amount: 1,
        },
    );
    
    pane.addDropdown(
        settings,
        "itemType",
        {
            titleAltText: "Item Type",
            dropdownItems: [...Server.ItemTypes.getAll()].map(
                ({ id }) => (
                    {
                        value: id,
                        displayAltText: id,
                        displayStringId: "item." + id.replace("minecraft:", "") + ".name",
                    }
                ),
            ),
        },
    );

    pane.addNumber(
        settings,
        "amount",
        {
            titleAltText: "Amount",
            min: 1,
            max: 64,
            showSlider: true,
        }
    );
    
    tool.bindPropertyPane(pane);
    
    const onExecuteBrush = () => {
        if (!uiSession.scratchStorage?.previewSelection) {
            console.error('Item Spawner storage was not initialized.');
            return;
        };
        
        const previewSelection = uiSession.scratchStorage.previewSelection;
        const player = uiSession.extensionContext.player;
        const targetBlock = player.dimension.getBlock(uiSession.extensionContext.cursor.position);
        if (!targetBlock) return;
        const location = targetBlock.location;
        const from = {
            x: location.x,
            y: location.y,
            z: location.z,
        };
        const to = { x: from.x, y: from.y, z: from.z };
        const blockVolume = new Editor.BlockVolume(from, to);
        if (uiSession.scratchStorage.lastVolumePlaced?.equals(blockVolume.boundingBox)) return;
        
        previewSelection.pushVolume(Editor.SelectionBlockVolumeAction.add, blockVolume);
        uiSession.scratchStorage.lastVolumePlaced = blockVolume.boundingBox;
    };
    
    tool.registerMouseButtonBinding(
        uiSession.actionManager.createAction(
            {
                actionType: Editor.ActionTypes.MouseRayCastAction,
                onExecute: async (mouseRay, mouseProps) => {
                    if (mouseProps.mouseAction == Editor.MouseActionType.LeftButton) {
                        if (mouseProps.inputType == Editor.MouseInputType.ButtonDown) {
                            uiSession.scratchStorage.previewSelection.clear();
                            onExecuteBrush();
                        } else if (mouseProps.inputType == Editor.MouseInputType.ButtonUp) {
                            await Editor.executeLargeOperation(uiSession.scratchStorage.previewSelection, blockLocation => {
                                const player = uiSession.extensionContext.player;
                                const targetBlock = player.dimension.getBlock(blockLocation);
                                
                                if(targetBlock) {
                                    const item = player.dimension.spawnItem(
                                        new Server.ItemStack(settings.itemType, settings.amount),
                                        {
                                            x: targetBlock.x + 0.5,
                                            y: targetBlock.y,
                                            z: targetBlock.z + 0.5,
                                        },
                                    );
                                };
                            }).catch(() => {
                                uiSession.extensionContext.transactionManager.commitOpenTransaction();
                                uiSession.scratchStorage?.previewSelection.clear();
                            }).then(() => {
                                uiSession.extensionContext.transactionManager.commitOpenTransaction();
                                uiSession.scratchStorage?.previewSelection.clear();
                            });
                        };
                    };
                },
            },
        ),
    );
    
    tool.registerMouseDragBinding(
        uiSession.actionManager.createAction(
            {
                actionType: Editor.ActionTypes.MouseRayCastAction,
                onExecute: (mouseRay, mouseProps) => {
                    if (mouseProps.inputType === Editor.MouseInputType.Drag) onExecuteBrush();
                },
            },
        ),
    );
};