import ReactMarkdown from 'react-markdown';
// Text from the web is untrusted: no raw HTML, no images, only http(s) links, and only plain formatting elements.
const allowed=['p','strong','em','ul','ol','li','br','a','code','blockquote','h3','h4','h5','h6'];
const safeUrl=(url:string)=>/^https?:\/\//i.test(url) ? url : '';
export default function Markdown({children}:{children:string}) {
  return <div className="markdown"><ReactMarkdown skipHtml allowedElements={allowed} unwrapDisallowed urlTransform={safeUrl} components={{a:({href,children:label}) => href ? <a href={href} target="_blank" rel="noreferrer">{label}</a> : <>{label}</>}}>{children}</ReactMarkdown></div>;
}
