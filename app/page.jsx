"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Login from "./components/Login";
import RolDagitici from "./components/RolDagitici";

export default function Page() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <div className="kok">
      {session === undefined ? <div className="merkez">Yükleniyor…</div>
        : !session ? <Login /> : <RolDagitici session={session} />}
    </div>
  );
}

/* ===================== Rol dağıtıcı ===================== */
