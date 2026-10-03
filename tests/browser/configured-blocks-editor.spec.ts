// Original built-runtime acceptance; zero copied Source/authentication credit.
// Ordinary passkey UI, native block controls and actual Node/D1 media storage.
import {test,expect} from '@playwright/test';
import {parse,stringify} from 'devalue';
import {passkeyRuntime} from '../helpers/passkey-runtime';
import {completeFullSetup,dismissFirstWelcome} from '../helpers/full-setup-browser';
import {addVirtualWebAuthnAuthenticator} from '../helpers/virtual-authenticator';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P4z8AAAAMBAAX+1O8AAAAASUVORK5CYII=','base64');
for(const target of ['Node','D1'] as const){
 test(`${target}: reusable blocks retain versions keys order and selected media across ordinary editor saves`,async({page})=>{
  test.setTimeout(90_000);
  const h=await passkeyRuntime(target,{media:'local'}),removeAuth=await addVirtualWebAuthnAuthenticator(page);
  try{
   await page.goto(`${h.origin}/setup`);await completeFullSetup(page,'blocks-editor@example.com','Blocks editor');
   await expect(page).toHaveURL(`${h.origin}/login`);await page.getByRole('button',{name:'Sign in with a passkey'}).click();
   await expect(page).toHaveURL(`${h.origin}/`);await dismissFirstWelcome(page);
   async function query(name:string,argument:unknown){
    const response=await page.request.get(`${h.origin}/_app/remote/${h.ids[name]}?payload=${Buffer.from(stringify(argument)).toString('base64url')}`);
    const envelope=await response.json();expect(envelope.type).toBe('result');return parse(envelope.data)._;
   }
   async function mutate(name:string,form:Record<string,string>){
    const response=await page.request.post(`${h.origin}/_app/remote/${h.ids[name]}`,{headers:{origin:h.origin},form});
    const envelope=await response.json();expect(envelope.type).toBe('result');const result=parse(envelope.data)._;expect(result.issues).toBeUndefined();return result.result;
   }
   await mutate('createSchemaCollection',{slug:'block_editor_pages',label:'Pages',labelSingular:'Page',supports:JSON.stringify(['drafts','revisions'])});
   await page.goto(`${h.origin}/blocks`);
   await page.getByLabel('Block type slug',{exact:true}).fill('editor_hero');await page.getByLabel('Block type label',{exact:true}).fill('Editor hero');
   await page.getByRole('button',{name:'Add field',exact:true}).click();
   const first=page.getByRole('group',{name:'Field 1',exact:true});
   await first.getByLabel('Field slug',{exact:true}).fill('heading');await first.getByLabel('Field label',{exact:true}).fill('Heading');await first.getByLabel('Required',{exact:true}).check();
   await page.getByRole('button',{name:'Add field',exact:true}).click();
   const second=page.getByRole('group',{name:'Field 2',exact:true});
   await second.getByLabel('Field slug',{exact:true}).fill('photo');await second.getByLabel('Field label',{exact:true}).fill('Photo');await second.getByLabel('Field type',{exact:true}).selectOption('image');await second.getByLabel('Dark variant',{exact:true}).check();
   await page.getByRole('button',{name:'Create block type',exact:true}).click();await expect(page.getByRole('button',{name:'Edit Editor hero',exact:true})).toBeVisible();
   await page.getByLabel('Collection',{exact:true}).selectOption('block_editor_pages');await page.getByLabel('Block field label',{exact:true}).fill('Layout');
   await page.getByLabel('Editor hero',{exact:true}).check();await page.getByRole('button',{name:'Add Field',exact:true}).click();
   await expect(page.getByRole('status').filter({hasText:'Block field added'})).toBeVisible();
   await page.goto(`${h.origin}/content/block_editor_pages/new`);
   await page.getByRole('button',{name:'Add block',exact:true}).click();await page.getByRole('button',{name:'Editor hero',exact:true}).click();
   const cards=page.locator('[data-block-key]');await expect(cards).toHaveCount(1);await cards.first().getByLabel('Heading',{exact:true}).fill('Original hero');
   await cards.first().getByRole('button',{name:'Choose from media library',exact:true}).first().click();
   const picker=page.getByRole('dialog',{name:'Choose Photo',exact:true});await expect(picker).toBeVisible();
   await picker.getByLabel('Choose files to upload',{exact:true}).setInputFiles({name:'block-editor.png',mimeType:'image/png',buffer:png});
   await expect(picker.getByRole('button',{name:'Use selected image',exact:true})).toBeEnabled();await picker.getByRole('button',{name:'Use selected image',exact:true}).click();
   await cards.first().getByLabel('Photo (dark variant)',{exact:true}).fill('https://example.com/dark.png');
   await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page).toHaveURL(/\/content\/block_editor_pages\/[A-Z0-9]+(?:\?.*)?$/);
   const id=new URL(page.url()).pathname.split('/').at(-1)!,key={collection:'block_editor_pages',id,locale:'en'};
   const created=await query('getLifecycleContent',key),originalKey=created.data.layout[0]._key;
   const photo=created.data.layout[0].photo;
   expect(photo).toMatchObject({provider:'local',filename:'block-editor.png',mimeType:'image/png',width:1,height:1,darkVariant:{provider:'external',id:'',src:'https://example.com/dark.png'}});
   expect(photo.src).toBeUndefined();expect(photo.meta.storageKey).toEqual(expect.any(String));
   const media=await page.request.get(`${h.origin}/api/media/${photo.id}`);expect(media.status()).toBe(200);const item=(await media.json()).data.item;
   expect(photo.meta.storageKey).toBe(item.storageKey);expect(photo.blurhash).toBe(item.blurhash??undefined);expect(photo.dominantColor).toBe(item.dominantColor??undefined);
   await cards.first().getByRole('button',{name:'Duplicate block',exact:true}).click();await expect(cards).toHaveCount(2);
   const duplicateKey=await cards.nth(1).getAttribute('data-block-key');expect(duplicateKey).not.toBe(originalKey);await cards.nth(1).getByLabel('Heading',{exact:true}).fill('Duplicate hero');
   await cards.first().getByRole('button',{name:'Reorder Editor hero',exact:true}).press('Space');await cards.first().getByRole('button',{name:'Reorder Editor hero',exact:true}).press('ArrowDown');
   await expect(cards.first()).toHaveAttribute('data-block-key',duplicateKey!);
   await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Saved'})).toBeVisible();
   const ordered=await query('getLifecycleContent',key);expect(ordered.data.layout.map((block:{_key:string})=>block._key)).toEqual([duplicateKey,originalKey]);
   await page.goto(`${h.origin}/blocks`);await page.getByRole('button',{name:'Edit Editor hero',exact:true}).click();
   await page.getByRole('group',{name:'Field 1',exact:true}).getByLabel('Field slug',{exact:true}).fill('title');await page.getByRole('group',{name:'Field 1',exact:true}).getByLabel('Field label',{exact:true}).fill('Title');
   await page.getByLabel('Create a new inactive version for breaking changes',{exact:true}).check();await page.getByRole('button',{name:'Save block type',exact:true}).click();
   await expect(page.getByRole('button',{name:'Activate Editor hero version 2',exact:true})).toBeVisible();await page.getByRole('button',{name:'Activate Editor hero version 2',exact:true}).click();await expect(page.getByRole('button',{name:'Activate Editor hero version 1',exact:true})).toBeVisible();
   await page.goto(`${h.origin}/content/block_editor_pages/${id}`);await expect(cards).toHaveCount(2);await expect(cards.first().getByLabel('Heading',{exact:true})).toHaveValue('Duplicate hero');
   await page.getByRole('button',{name:'Add block',exact:true}).click();await page.getByRole('button',{name:'Editor hero',exact:true}).click();await expect(cards).toHaveCount(3);await cards.nth(2).getByLabel('Title',{exact:true}).fill('New active hero');
   await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Saved'})).toBeVisible();
   const retained=await query('getLifecycleContent',key);expect(retained.data.layout.map((block:{_version:number})=>block._version)).toEqual([1,1,2]);
   expect((await query('listContentRevisions',key)).length).toBeGreaterThan(1);
   await h.restart();await page.goto(`${h.origin}/content/block_editor_pages/${id}`);await expect(cards).toHaveCount(3);expect((await query('getLifecycleContent',key)).data).toEqual(retained.data);
   const asset=await page.request.get(`${h.origin}/_emdash/api/media/file/${item.storageKey.split('/').map(encodeURIComponent).join('/')}`);expect(asset.status()).toBe(200);expect(await asset.body()).toEqual(png);
  }finally{await removeAuth();await h.close();}
 });
}
