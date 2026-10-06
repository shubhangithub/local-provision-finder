import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// Text from the web is untrusted: no raw HTML, no images, only http(s) links, and only plain formatting elements.
const allowed=['p','strong','em','del','ul','ol','li','br','a','code','blockquote','h3','h4','h5','h6','table','thead','tbody','tr','th','td'];
const safeUrl=(url:string)=>/^https?:\/\//i.test(url) ? url : '';
export default function Markdown({children}:{children:string}) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml allowedElements={allowed} unwrapDisallowed urlTransform={safeUrl} components={{
    a:({href,children:label}) => href ? <a href={href} target="_blank" rel="noreferrer">{label}</a> : <>{label}</>,
    // A wide table scrolls inside its own box so it never makes the page scroll sideways.
    table:({children:rows}) => <div className="markdown-table" tabIndex={0} role="region" aria-label="Table, scrolls sideways"><table>{rows}</table></div>,
  }}>{children}</ReactMarkdown></div>;
}
