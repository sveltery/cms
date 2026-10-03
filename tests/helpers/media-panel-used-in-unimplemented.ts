// Source vi.mock identity only: the Panel test supplies its exact mocked child.
// Native MediaDetails has no usage child today. This export throws if an unmocked importer attempts to claim one.
export function MediaUsedIn():never {throw new Error('Native usage component remains unimplemented');}
