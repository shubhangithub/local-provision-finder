import {useState} from 'react';
import type {DirectoryEnrichment} from '../lib/directory';
import type {Overwrite} from './ServiceEnrichment';
import Markdown from './Markdown';
import '../styles/about-facts.css';
interface Record_ {eligibilitySummary?:string|null;address?:string|null;cost?:string|null;openingTimes?:string|null;referralRoute?:string|null;accessibility?:string[]|null;enrichment?:DirectoryEnrichment}
/** The details of a service in one column. Enriched values replace the catalogue's; other enriched facts follow as extra rows. */
const short=(value:string,max=140)=>value.length>max ? `${value.slice(0,max).trimEnd()}…` : value;
/** For admins: what an enriched field used to say, with an undo. */
export function ChangeNote({change,label,onUndo}:{change?:Overwrite;label:string;onUndo?:(id:string)=>Promise<void>}) {
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  if (!change || !onUndo) return null;
  async function undo() {setBusy(true);setError('');try {await onUndo!(change!.id);} catch (e) {setError(e instanceof Error ? e.message : 'Could not undo.');setBusy(false);}}
  return <p className="row-diff">Was <del>{short(change.original || 'not listed')}</del> <button type="button" className="text-button" disabled={busy} onClick={() => void undo()}>Undo<span className="visually-hidden"> {label.toLowerCase()} change</span></button>{error && <span className="form-error" role="alert"> {error}</span>}</p>;
}
export default function AboutFacts({record,changes=[],onUndo}:{record:Record_;changes?:Overwrite[];onUndo?:(id:string)=>Promise<void>}) {
  const changeFor=new Map(changes.map(item => [item.field,item]));
  const web=new Map((record.enrichment?.overwrites ?? []).map(item => [item.field,item.sourceUrl]));
  const standard:{field:string;label:string;value:string|null|undefined;always?:boolean}[]=[
    {field:'eligibilitySummary',label:'Who it is for',value:record.eligibilitySummary,always:true},
    {field:'address',label:'Address',value:record.address,always:true},
    {field:'cost',label:'Cost',value:record.cost,always:true},
    {field:'openingTimes',label:'Opening times',value:record.openingTimes,always:true},
    {field:'referralRoute',label:'How to access',value:record.referralRoute},
    {field:'accessibility',label:'Accessibility',value:record.accessibility?.join('; ')},
  ];
  const extra=record.enrichment?.facts ?? [];
  const anyWeb=web.size>0 || extra.length>0;
  return <>
    <dl className="about-facts">
      {standard.filter(row => row.always || row.value).map(row => <div key={row.field}>
        <dt>{row.label}</dt>
        <dd>{!row.value ? 'Not supplied' : web.has(row.field) ? <Markdown>{row.value}</Markdown> : row.value}
          <ChangeNote change={changeFor.get(row.field)} label={row.label} onUndo={onUndo}/></dd>
      </div>)}
      {extra.map(fact => <div key={fact.key+fact.value}>
        <dt>{fact.label}{fact.outdated && <span className="fact-ended">Out of date{fact.validTo ? `: ended ${fact.validTo}` : ''}</span>}</dt>
        <dd><Markdown>{fact.value}</Markdown></dd>
      </div>)}
    </dl>
    {anyWeb && <p className="field-hint about-note">Some details were found automatically on public pages and have not been reviewed by staff. Confirm with the provider.</p>}
  </>;
}
