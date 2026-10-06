// Verbatim Source asInlineTransaction function body; Native type import only.
import type {Kysely} from 'kysely';
type DatabaseSchema=Record<string,any>;
export function asInlineTransaction(db: Kysely<DatabaseSchema>): Kysely<DatabaseSchema> {
	return new Proxy(db, {
		get(target, prop) {
			if (prop === "isTransaction") return true;
			// Kysely reads private fields off `this`, which a proxy doesn't carry,
			// so both getters and methods have to see the real instance.
			const value = Reflect.get(target, prop);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}
