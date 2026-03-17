import { NextRequest, NextResponse } from "next/server";

const EVO_URL = "https://evolution-api-production-e0b8.up.railway.app";
const EVO_KEY = "6656711fd37b4eadc6a9d6a31b84c8648e19708f55e7f09b85b7b61d9660d6ad";

export async function POST(req: NextRequest) {
  try {
    const { action, instanceName, payload } = await req.json();

    let url = "";
    let method = "GET";
    let body: string | undefined;

    switch (action) {
      case "fetchInstances":
        url = `${EVO_URL}/instance/fetchInstances`;
        method = "GET";
        break;
      case "connect":
        url = `${EVO_URL}/instance/connect/${instanceName}`;
        method = "GET";
        break;
      case "create":
        url = `${EVO_URL}/instance/create`;
        method = "POST";
        body = JSON.stringify(payload);
        break;
      case "delete":
        url = `${EVO_URL}/instance/delete/${instanceName}`;
        method = "DELETE";
        break;
      case "status":
        url = `${EVO_URL}/instance/connectionState/${instanceName}`;
        method = "GET";
        break;
      case "sendText":
        url = `${EVO_URL}/message/sendText/${instanceName}`;
        method = "POST";
        body = JSON.stringify(payload);
        break;
      case "fetchChats":
        url = `${EVO_URL}/chat/findChats/${instanceName}`;
        method = "POST";
        body = JSON.stringify(payload || {});
        break;
      case "fetchMessages":
        url = `${EVO_URL}/chat/findMessages/${instanceName}`;
        method = "POST";
        body = JSON.stringify(payload || {});
        break;
      default:
        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const res = await fetch(url, {
      method,
      headers: {
        "apikey": EVO_KEY,
        "Content-Type": "application/json",
      },
      ...(body && { body }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch(e) {
    console.error("Evolution API erro:", e);
    return NextResponse.json({ error: "Erro na Evolution API" }, { status: 500 });
  }
}
// já existe - só adicionar o case de histórico
