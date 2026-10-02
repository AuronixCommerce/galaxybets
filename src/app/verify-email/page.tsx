"use client";
import { sendEmailVerification } from "firebase/auth";
import { useAuth } from "@/components/AuthProvider";
import { useState } from "react";
export default function VerifyEmail(){const{user}=useAuth();const[msg,setMsg]=useState("");async function resend(){if(!user)return;try{await sendEmailVerification(user);setMsg("Verification email sent.");}catch{setMsg("Could not resend yet. Try again shortly.");}}return <div className="authPage"><div className="authCard"><span className="sectionKicker">EMAIL SECURITY</span><h1>Verify your email.</h1><p>Open the Firebase verification link in your inbox, then return to Galaxy Bets.</p>{msg&&<div className="formInfo">{msg}</div>}<button className="primaryBtn wide" onClick={resend} disabled={!user}>RESEND VERIFICATION</button></div></div>}
