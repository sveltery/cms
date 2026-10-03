import {RawBindingD1Dialect as NativeDialect,type D1Binding} from '../../src/lib/server/database/d1.ts';
// Constructor transport only; actual native raw D1 adapter/database methods.
export class RawBindingD1Dialect extends NativeDialect{constructor(config:{database:D1Binding}){super(config.database);}}
