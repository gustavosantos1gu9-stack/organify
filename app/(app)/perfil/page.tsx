"use client";

import { useState, useEffect } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { supabase, getAgenciaId } from "@/lib/hooks";

export default function PerfilPage() {
  const [perfil, setPerfil] = useState({ nome: "", email: "", telefone: "" });
  const [senhas, setSenhas] = useState({ atual: "", nova: "", confirmacao: "" });
  const [show, setShow] = useState({ atual: false, nova: false, conf: false });
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setPerfil({
          nome: user.user_metadata?.nome || user.user_metadata?.full_name || "",
          email: user.email || "",
          telefone: user.user_metadata?.telefone || "",
        });
      }
    }
    load();
  }, []);

  const salvarPerfil = async () => {
    setSalvandoPerfil(true);
    try {
      await supabase.auth.updateUser({
        email: perfil.email,
        data: { nome: perfil.nome, telefone: perfil.telefone },
      });
      // Atualizar também na tabela usuarios
      const agId = await getAgenciaId();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && agId) {
        await supabase.from("usuarios").update({ nome: perfil.nome, email: perfil.email })
          .eq("agencia_id", agId).eq("email", user.email!);
      }
      alert("Perfil atualizado!");
    } catch(e) { console.error(e); alert("Erro ao salvar perfil"); }
    finally { setSalvandoPerfil(false); }
  };

  const salvarSenha = async () => {
    if (!senhas.nova || senhas.nova !== senhas.confirmacao) {
      alert("As senhas não coincidem"); return;
    }
    if (senhas.nova.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres"); return;
    }
    setSalvandoSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senhas.nova });
      if (error) throw error;
      setSenhas({ atual: "", nova: "", confirmacao: "" });
      alert("Senha atualizada com sucesso!");
    } catch(e: any) { alert(e.message || "Erro ao atualizar senha"); }
    finally { setSalvandoSenha(false); }
  };

  const inputSenha = (key: "atual"|"nova"|"confirmacao", showKey: "atual"|"nova"|"conf") => (
    <div style={{ position: "relative" }}>
      <input
        className="form-input"
        type={show[showKey] ? "text" : "password"}
        placeholder="••••••••"
        value={senhas[key]}
        onChange={e => setSenhas(s => ({ ...s, [key]: e.target.value }))}
        style={{ paddingRight: "40px" }}
      />
      <button onClick={() => setShow(s => ({ ...s, [showKey]: !s[showKey] }))} style={{
        position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
        background: "none", border: "none", cursor: "pointer", color: "#606060",
      }}>
        {show[showKey] ? <EyeOff size={14}/> : <Eye size={14}/>}
      </button>
    </div>
  );

  return (
    <div className="animate-in" style={{ maxWidth: "680px" }}>
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span><span className="current">Perfil</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "28px" }}>Perfil</h1>

      {/* Informações do Perfil */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>Informação do Perfil</h2>
        <p style={{ fontSize: "13px", color: "#606060", marginBottom: "24px" }}>
          Atualize as informações do perfil da sua conta e o endereço de e-mail.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Nome</label>
            <input className="form-input" placeholder="Seu nome" value={perfil.nome}
              onChange={e => setPerfil(p => ({ ...p, nome: e.target.value }))}/>
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" placeholder="seu@email.com" value={perfil.email}
              onChange={e => setPerfil(p => ({ ...p, email: e.target.value }))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" placeholder="(00) 00000-0000" value={perfil.telefone}
              onChange={e => setPerfil(p => ({ ...p, telefone: e.target.value }))}/>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
          <button className="btn-primary" onClick={salvarPerfil} disabled={salvandoPerfil} style={{ cursor: "pointer" }}>
            <Check size={14}/> {salvandoPerfil ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Atualizar Senha */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>Atualizar a senha</h2>
        <p style={{ fontSize: "13px", color: "#606060", marginBottom: "24px" }}>
          Certifique-se de que sua conta esteja usando uma senha longa e aleatória para permanecer segura.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Senha atual</label>
            {inputSenha("atual", "atual")}
          </div>
          <div className="form-group">
            <label className="form-label">Nova senha</label>
            {inputSenha("nova", "nova")}
          </div>
          <div className="form-group">
            <label className="form-label">Confirmação de senha</label>
            {inputSenha("confirmacao", "conf")}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
          <button className="btn-primary" onClick={salvarSenha} disabled={salvandoSenha} style={{ cursor: "pointer" }}>
            <Check size={14}/> {salvandoSenha ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* 2FA */}
      <div className="card">
        <h2 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>Autenticação de dois fatores</h2>
        <p style={{ fontSize: "13px", color: "#606060", marginBottom: "24px" }}>
          Adicione segurança extra à sua conta habilitando a autenticação de dois fatores.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-primary" style={{ cursor: "pointer" }} onClick={() => alert("Em breve!")}>
            Habilitar autenticação de dois fatores
          </button>
        </div>
      </div>
    </div>
  );
}
