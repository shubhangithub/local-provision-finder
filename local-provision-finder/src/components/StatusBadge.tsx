const labels:Record<string,string>={submitted:'Awaiting review',pending:'Awaiting review',draft:'Draft',checking:'Being checked',published:'Published',resolved:'Reviewed',rejected:'Rejected',dismissed:'Dismissed'};
export default function StatusBadge({status}:{status:string}){return <span className="status-badge" data-status={status}>{labels[status]??status}</span>;}
