"use client";
import Link from "next/link";
import { useState } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/AuthProvider";

export default function RegisterPage(){
 const { refreshSession }=useAuth(); const [username,setUsername]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{if(password.length<8)throw new Error();const c=await createUserWithEmailAndPassword(firebaseAuth,email,password);await updateProfile(c.user,{displayName:username});await sendEmailVerification(c.user);await refreshSession(c.user);location.href="/";}catch{setError("Could not create account. Use a valid email and 8+ character password.");}finally{setBusy(false)}}
 return <div className="authPage"><div className="authCard"><span className="sectionKicker">NEW EXPLORER</span><h1>Create your account.</h1><p>Start with 10,000 GC demo credits. Galaxy Credits have no cash value.</p><form onSubmit={submit}><label>Username<input value={username} onChange={e=>setUsername(e.target.value)} required minLength={3}/></label><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}/></label><label className="check"><input type="checkbox" required/><span>I am 18+ and accept the demo-play terms.</span></label>{error&&<div className="formError">{error}</div>}<button className="primaryBtn wide" disabled={busy}>{busy?"CREATING…":"CREATE ACCOUNT"}</button></form><div className="authBottom">Already registered? <Link href="/login">Log in</Link></div></div></div>
}
