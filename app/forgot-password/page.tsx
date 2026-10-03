"use client";
import Link from "next/link";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
export default function ForgotPassword(){const[email,setEmail]=useState("");const[msg,setMsg]=useState("");const[busy,setBusy]=useState(false);async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);try{await sendPasswordResetEmail(firebaseAuth,email);setMsg("If that account exists, Firebase has sent a reset email.");}catch{setMsg("Could not send reset email right now.");}finally{setBusy(false)}}return <div className="authPage"><div className="authCard"><span className="sectionKicker">ACCOUNT RECOVERY</span><h1>Reset password.</h1><p>Enter the email connected to your Galaxy Bets account.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>{msg&&<div className="formInfo">{msg}</div>}<button className="primaryBtn wide" disabled={busy}>{busy?"SENDING…":"SEND RESET EMAIL"}</button></form><div className="authBottom"><Link href="/login">Back to login</Link></div></div></div>}
