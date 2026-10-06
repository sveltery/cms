import {RawBindingD1Dialect as NativeDialect,type D1Binding} from '../../../src/lib/server/database/d1.ts';
/** The Original constructor's object shape on the actual Native raw adapter. */
export class RawBindingD1Dialect extends NativeDialect {
 constructor(config:{database:D1Binding}){super(config.database);}
}
