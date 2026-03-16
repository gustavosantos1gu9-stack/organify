"use client";

import { useState } from "react";
import { MessageCircle, Bot, CreditCard, QrCode } from "lucide-react";

export default function IntegracoesPage() {
  const [waTab, setWaTab] = useState<"conexao" | "cobrancas" | "api">("conexao");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiAtivo, setOpenaiAtivo] = useState(false);
  const [asaasToken, setAsaasToken] = useState("");
  const [cobrancaMsg, setCobrancaMsg] = useState(
    `Olá, NOME_CLIENTE!\nSegue lembrete da sua cobrança: CATEGORIA\nValor: VALOR\nVencimento: DATA_VENCIMENTO\nDocumento: DOCUMENTO_CLIENTE\nPara pagamento: LINK_PAGAMENTO_OU_CHAVE\nEm caso de dúvidas, entre em contato conosco.`
  );
  const [diasAntes, setDiasAntes] = useState("3");
  const [lembreteVencida, setLembreteVencida] = useState("2");
  const [notifVespera, setNotifVespera] = useState(true);
  const [notifVencimento, setNotifVencimento] = useState(true);

  const apiEndpoint = "https://app.organifybr.com/api/leads/SuaChaveAPI";
  const apiExample = `{
  "name": "teste", // obrigatório
  "document": "11111111111", // cpf ou cnpj,
  "email": "teste@email.com",
  "phone": "3899999-9999",
  "whatsapp": true,
  "source": "Facebook",
  "social_media": "@exemplo",
  "company": "exemplo",
  "opportunity_value": "R$ 1500,00",
  "invoicing": "R$ 1500,00",
  "observations": "Exemplo..."
}`;

  return (
    <div className="animate-in">
      <div className="breadcrumb">
        <a href="/">Início</a><span>›</span>
        <a href="/configuracoes/agencia">Configurações</a><span>›</span>
        <span className="current">Integrações</span>
      </div>
      <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "28px" }}>Integrações</h1>

      {/* WhatsApp */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <MessageCircle size={20} color="#22c55e" />
          <h2 style={{ fontSize: "16px", fontWeight: "600" }}>WhatsApp</h2>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0", borderBottom: "1px solid #2e2e2e", marginBottom: "24px" }}>
          {(["conexao", "cobrancas", "api"] as const).map((tab) => (
            <button key={tab} onClick={() => setWaTab(tab)}
              style={{
                padding: "8px 20px", background: "none", border: "none", cursor: "pointer",
                fontSize: "13px", fontWeight: "500",
                color: waTab === tab ? "#f0f0f0" : "#606060",
                borderBottom: waTab === tab ? "2px solid #22c55e" : "2px solid transparent",
                marginBottom: "-1px", transition: "all 0.15s",
              }}>
              {tab === "conexao" ? "Conexão" : tab === "cobrancas" ? "Cobranças" : "API"}
            </button>
          ))}
        </div>

        {waTab === "conexao" && (
          <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label">Instância</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <select className="form-input" style={{ flex: 1 }}>
                    <option>Instância #108 • Desconectada</option>
                  </select>
                  <button className="btn-primary">Adicionar</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input className="form-input" placeholder="Ex: Atendimento Principal" style={{ flex: 1 }} />
                  <button className="btn-primary">Salvar</button>
                </div>
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <div style={{ width: "160px", height: "160px", background: "#fff", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
                <QrCode size={120} color="#000" />
              </div>
              <button className="btn-secondary" style={{ width: "100%", marginTop: "8px", justifyContent: "center" }}>Atualizar</button>
            </div>
          </div>
        )}

        {waTab === "cobrancas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Instância para cobranças</label>
              <select className="form-input"><option value="">Selecione</option></select>
            </div>
            <div className="form-group">
              <label className="form-label">Mensagem</label>
              <textarea className="form-input" rows={8} value={cobrancaMsg} onChange={(e) => setCobrancaMsg(e.target.value)} style={{ resize: "vertical", fontFamily: "monospace", fontSize: "13px" }} />
              <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>
                Placeholders: LINK_PAGAMENTO_OU_CHAVE, NOME_CLIENTE, DOCUMENTO_CLIENTE, DATA_VENCIMENTO, CATEGORIA, VALOR
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Primeira notificação: quantidade de dias</label>
                <input type="number" className="form-input" value={diasAntes} onChange={(e) => setDiasAntes(e.target.value)} />
                <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>Envia X dias antes do vencimento.</p>
              </div>
              <div className="form-group">
                <label className="form-label">Lembrete de cobrança vencida: a cada X dias</label>
                <input type="number" className="form-input" value={lembreteVencida} onChange={(e) => setLembreteVencida(e.target.value)} />
                <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>Limite vitalício de envios vencidos por cobrança: 3</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "24px" }}>
              {[{ label: "Notificação na véspera", val: notifVespera, set: setNotifVespera }, { label: "Notificação na data de vencimento", val: notifVencimento, set: setNotifVencimento }].map((item) => (
                <label key={item.label} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#a0a0a0" }}>
                  <label className="toggle">
                    <input type="checkbox" checked={item.val} onChange={(e) => item.set(e.target.checked)} />
                    <span className="toggle-slider" />
                  </label>
                  {item.label}
                </label>
              ))}
            </div>
            <p style={{ fontSize: "12px", color: "#606060" }}>Notificações de cobranças são enviadas diariamente entre 8:00 e 20:00</p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn-primary">Salvar</button>
            </div>
          </div>
        )}

        {waTab === "api" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Instância</label>
              <select className="form-input"><option value="">Selecione</option></select>
              <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>Define a instância usada nas notificações da api de leads.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Usuário</label>
              <select className="form-input"><option>Gustavo</option></select>
              <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>Opcional. Se vazio, todos os usuários com telefone receberão a notificação.</p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn-primary">Salvar API</button>
            </div>
          </div>
        )}
      </div>

      {/* OpenAI */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: openaiAtivo ? "#22c55e" : "#ef4444" }} />
          <Bot size={18} color="#a0a0a0" />
          <h2 style={{ fontSize: "16px", fontWeight: "600" }}>OpenAI</h2>
        </div>
        <p style={{ fontSize: "13px", color: "#606060", marginBottom: "20px" }}>Configure a integração OpenAI para sua instância WhatsApp</p>
        <div style={{ borderBottom: "1px solid #2e2e2e", marginBottom: "20px" }}>
          <button style={{ padding: "8px 20px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#f0f0f0", borderBottom: "2px solid #22c55e", marginBottom: "-1px" }}>Credenciais</button>
        </div>
        <div className="form-group" style={{ marginBottom: "16px" }}>
          <label className="form-label">API Key</label>
          <input className="form-input" placeholder="sk-..." type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
          <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>A API Key será criptografada e não poderá ser visualizada após salvar</p>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#a0a0a0" }}>
            <label className="toggle">
              <input type="checkbox" checked={openaiAtivo} onChange={(e) => setOpenaiAtivo(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
            {openaiAtivo ? "Ativo" : "Inativo"}
          </label>
          <button className="btn-primary">Salvar</button>
        </div>
        {!openaiAtivo && (
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", padding: "12px 16px", fontSize: "13px", color: "#f59e0b" }}>
            Registre suas credenciais OpenAI para configurar um assistente de IA
          </div>
        )}
      </div>

      {/* Asaas */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
          <CreditCard size={18} color="#a0a0a0" />
          <h2 style={{ fontSize: "16px", fontWeight: "600" }}>Asaas</h2>
        </div>
        <p style={{ fontSize: "13px", color: "#606060", marginBottom: "20px" }}>Integração com a plataforma de cobranças Asaas</p>
        <div className="form-group" style={{ marginBottom: "8px" }}>
          <label className="form-label">Token API</label>
          <input className="form-input" placeholder="Token do Asaas" type="password" value={asaasToken} onChange={(e) => setAsaasToken(e.target.value)} />
          <p style={{ fontSize: "11px", color: "#606060", marginTop: "4px" }}>Não é possível visualizar o token API após salvar!</p>
          <p style={{ fontSize: "11px", color: "#f59e0b", marginTop: "4px" }}>
            Informativo asaas: Atenção: Para sua segurança, chaves de API sem uso são desabilitadas após 3 meses e permanentemente expiradas após 6 meses.
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
          <button className="btn-secondary">Sincronizar Asaas</button>
          <button className="btn-primary">Salvar</button>
        </div>
      </div>

      {/* API Endpoint */}
      <div className="card">
        <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>API</h2>
        <div className="form-group" style={{ marginBottom: "16px" }}>
          <label className="form-label">Endpoint Leads</label>
          <input className="form-input" value={apiEndpoint} readOnly style={{ fontFamily: "monospace", fontSize: "12px", color: "#22c55e" }} onClick={(e) => (e.target as HTMLInputElement).select()} />
        </div>
        <div className="form-group">
          <label className="form-label">Requisição</label>
          <pre style={{ background: "#141414", border: "1px solid #2e2e2e", borderRadius: "8px", padding: "16px", fontSize: "12px", color: "#a0a0a0", overflow: "auto", fontFamily: "monospace", lineHeight: "1.8" }}>
            {apiExample}
          </pre>
        </div>
      </div>
    </div>
  );
}
