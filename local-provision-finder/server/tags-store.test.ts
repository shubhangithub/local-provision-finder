import { afterEach,describe,expect,it } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TagsStore,normaliseTags } from './tags-store';
const paths:string[]=[];
afterEach(()=>paths.splice(0).forEach(path=>rmSync(path,{recursive:true,force:true})));
describe('staff service tags',()=>{
 it('persists separate service labels across reopening and supports removing all tags',()=>{const directory=mkdtempSync(join(tmpdir(),'dwp-tags-'));paths.push(directory);const path=join(directory,'tags.sqlite');const db=new TagsStore(path);db.save('one',['  Anxiety support  ','Evening sessions','anxiety SUPPORT']);db.save('two',['Childcare']);db.close();const reopened=new TagsStore(path);expect(reopened.get('one')).toEqual(['Anxiety support','Evening sessions']);expect(reopened.list(['two']).get('two')).toEqual(['Childcare']);expect(reopened.list(['two']).has('one')).toBe(false);reopened.save('one',[]);expect(reopened.get('one')).toEqual([]);expect(reopened.get('two')).toEqual(['Childcare']);reopened.close();});
 it('rejects invalid input without replacing previously saved tags',()=>{const directory=mkdtempSync(join(tmpdir(),'dwp-tags-'));paths.push(directory);const db=new TagsStore(join(directory,'tags.sqlite'));db.save('one',['Housing']);for (const input of [[''],['x'.repeat(41)],['\u0000'],Array(21).fill('tag'),[4],null]) expect(()=>db.save('one',input)).toThrow();expect(db.get('one')).toEqual(['Housing']);expect(normaliseTags(['Travel  help',' travel help '])).toEqual(['Travel help']);db.close();});
});
