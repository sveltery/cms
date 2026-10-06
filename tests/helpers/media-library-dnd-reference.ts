// Test-only module identity for the whole Original vi.mock factory.
// Unmocked Dnd never supplies a substitute implementation or geometry credit.
function unavailable():never {throw new Error('Unmocked Source Dnd framework is unavailable in the Native harness');}
export const DndContext=unavailable,DragOverlay=unavailable,PointerSensor=unavailable;
export const pointerWithin=unavailable,useDraggable=unavailable,useDroppable=unavailable,useSensor=unavailable,useSensors=unavailable;
