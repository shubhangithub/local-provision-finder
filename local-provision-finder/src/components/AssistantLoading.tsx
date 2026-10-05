import '../styles/assistant-loading.css';
export default function AssistantLoading({children}:{children:React.ReactNode}) {
 return <p className="assistant-loading" role="status"><span className="assistant-spinner" aria-hidden="true"/><span>{children}</span></p>;
}
