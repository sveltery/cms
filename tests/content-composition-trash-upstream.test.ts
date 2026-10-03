// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete source declarations; fixture/framework substitutions are in the ledger.
import {describe,beforeEach,afterEach} from 'node:test';
import {expect,it,compositionFixture} from './helpers/content-composition-fixture.ts';
let fixture:any;let ctx:any;
beforeEach(async()=>{fixture=await compositionFixture();ctx={db:fixture};for(const s of [{locale:'en',slug:'hello-en',title:'Hello'},{locale:'fr',slug:'hello-fr',title:'Bonjour'},{locale:'de',slug:'hallo-de',title:'Hallo'}]){const item=await fixture.repo.create({type:'posts',slug:s.slug,locale:s.locale,data:{title:s.title},status:'published'});await fixture.seedTrash('posts',item.id);}});
afterEach(async()=>{await fixture.database.close();});
function handleContentListTrashed(db:any,type:string,params:any):Promise<{success:boolean;data:{items:any[]}}>{return db.trashHandler(type,params);}
function handleContentCountTrashed(db:any,type:string,params:any={}){return db.trashCountHandler(type,params);}
it("lists only the trashed entries in the requested locale", async () => {
		const result = await handleContentListTrashed(ctx.db, "posts", { locale: "fr" });

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.items.map((item) => item.slug)).toEqual(["hello-fr"]);
	});

it("lists every locale when no locale is given", async () => {
		const result = await handleContentListTrashed(ctx.db, "posts", {});

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(new Set(result.data.items.map((item) => item.slug))).toEqual(
			new Set(["hello-en", "hello-fr", "hallo-de"]),
		);
	});

it("returns each item's locale so the trash list can display it", async () => {
		const result = await handleContentListTrashed(ctx.db, "posts", { locale: "de" });

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.items[0]?.locale).toBe("de");
	});

it("counts only the trashed entries in the requested locale", async () => {
		const scoped = await handleContentCountTrashed(ctx.db, "posts", { locale: "en" });
		const all = await handleContentCountTrashed(ctx.db, "posts");

		expect(scoped.success && scoped.data.count).toBe(1);
		expect(all.success && all.data.count).toBe(3);
	});