"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { supabase } from "@/lib/hooks";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checando, setChecando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/login");
      else setChecando(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) router.push("/login");
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checando) return (
    <div style={{ minHeight:"100vh", background:"#0f0f0f", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:"40px", height:"40px", borderRadius:"50%", border:"3px solid #2e2e2e", borderTop:"3px solid #22c55e", animation:"spin 1s linear infinite" }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#0f0f0f" }}>
      <Sidebar />
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <Topbar />
        <main style={{ flex:1, padding:"28px 32px", overflowX:"hidden" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
