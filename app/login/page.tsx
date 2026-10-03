"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage(){
 const router=useRouter(); const { refreshSession } = useAuth(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const c=await signInWithEmailAndPassword(firebaseAuth,email,password);await refreshSession(c.user);router.replace("/");router.refresh();}catch{setError("Email or password is incorrect.");}finally{setBusy(false)}}
 return <div className="authPage"><div className="authCard"><span className="sectionKicker">WELCOME BACK</span><h1>Enter the galaxy.</h1><p>Sign in to sync your demo balance, history and rewards.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>{error&&<div className="formError">{error}</div>}<button className="primaryBtn wide" disabled={busy}>{busy?"SIGNING IN…":"LOG IN"}</button><Link className="forgotLink" href="/forgot-password">Forgot password?</Link></form><div className="authBottom">New here? <Link href="/register">Create account</Link></div></div></div>
}
