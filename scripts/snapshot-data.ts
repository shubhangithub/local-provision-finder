import { createReadStream, createWriteStream, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
const directory=resolve('data');
const db=new DatabaseSync(resolve(directory,'services.sqlite'),{readOnly:true});
const originals=Number(db.prepare('SELECT COUNT(*) AS n FROM services').get()?.n);
const listings=Number(db.prepare('SELECT COUNT(*) AS n FROM catalogue_services').get()?.n);db.close();
await pipeline(createReadStream(resolve(directory,'services.sqlite')),createGzip({level:9}),createWriteStream(resolve(directory,'services.sqlite.gz')));
const archive=readFileSync(resolve(directory,'services.sqlite.gz'));
let semanticIndexSha256:string | undefined;
if (existsSync(resolve(directory,'semantic-index.sqlite'))) {
 await pipeline(createReadStream(resolve(directory,'semantic-index.sqlite')),createGzip({level:9}),createWriteStream(resolve(directory,'semantic-index.sqlite.gz')));
 const semantic=readFileSync(resolve(directory,'semantic-index.sqlite.gz'));semanticIndexSha256=createHash('sha256').update(semantic).digest('hex');
 console.log(`Semantic index archive: ${(semantic.length/1024/1024).toFixed(1)} MiB.`);
}
writeFileSync(resolve(directory,'snapshot.json'),JSON.stringify({format:'gzip-sqlite',sha256:createHash('sha256').update(archive).digest('hex'),semanticIndexSha256,originals,listings},null,2)+'\n');
console.log(`Archived ${originals} source records and ${listings} cleaned services (${(archive.length/1024/1024).toFixed(1)} MiB).`);
