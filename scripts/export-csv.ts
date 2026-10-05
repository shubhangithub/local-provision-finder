import { readFile, writeFile } from 'node:fs/promises';
const records:Record<string,unknown>[]=JSON.parse(await readFile('data/services.cleaned.json','utf8'));
const quote=(value:unknown)=>'"'+(value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value):String(value)).replaceAll('"','""')+'"';
const fields=[...new Set(records.flatMap(record=>Object.keys(record)))];
const csv='\uFEFF'+[fields.map(quote).join(','),...records.map(row=>fields.map(field=>quote(row[field])).join(','))].join('\r\n')+'\r\n';
await writeFile('data/local-provision-services.csv',csv);
console.log(`local-provision-services.csv: ${records.length} listings, ${fields.length} columns. All imported sources combined; source references retained.`);
