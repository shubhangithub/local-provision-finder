import {useLayoutEffect,useRef,useState} from 'react';
import '../styles/staff-sign-in.css';
export default function StaffSignIn({open,onClose,onSuccess}:{open:boolean;onClose:()=>void;onSuccess:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');
 useLayoutEffect(()=>{if(open){setUsername('');setPassword('');setError('');dialog.current?.showModal();}else dialog.current?.close();},[open]);
 return <dialog ref={dialog} className="staff-sign-in-dialog" aria-labelledby="staff-sign-in-title" onCancel={e=>{e.preventDefault();onClose();}}>
 <div className="staff-sign-in-heading"><h1 id="staff-sign-in-title">Staff sign in</h1><button className="icon-button" type="button" aria-label="Close sign in" onClick={onClose}>×</button></div>
 <p>Sign in to the staff demo workspace.</p>
 <form onSubmit={e=>{e.preventDefault();if(username.trim()==='admin'&&password==='1234'){setPassword('');onSuccess();}else{setError('Check your username and password.');}}}>
 {error&&<p id="staff-sign-in-error" className="form-error" role="alert">{error}</p>}
 <div className="field"><label htmlFor="staff-username">Username</label><input autoFocus id="staff-username" name="username" autoComplete="username" value={username} onChange={e=>{setUsername(e.target.value);setError('');}} required aria-invalid={!!error} aria-describedby={error?'staff-sign-in-error':undefined}/></div>
 <div className="field"><label htmlFor="staff-password">Password</label><input id="staff-password" name="password" type="password" autoComplete="current-password" value={password} onChange={e=>{setPassword(e.target.value);setError('');}} required aria-invalid={!!error} aria-describedby={error?'staff-sign-in-error':undefined}/></div>
 <div className="staff-sign-in-actions"><button className="button primary" type="submit">Sign in</button><button className="text-button" type="button" onClick={onClose}>Cancel</button></div>
 </form></dialog>;
}
