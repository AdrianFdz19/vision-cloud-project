// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [environment] = useState('prod'); // Mantener fijo o dinámico según tu flujo
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [connectionId, setConnectionId] = useState('');

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [labels, setLabels] = useState<string>("");

  const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL;
  const REST_BASE_URL = process.env.NEXT_PUBLIC_REST_URL;

  const WS_URL = `${WS_BASE_URL}/${environment}`;

  useEffect(() => {
    if (!WS_BASE_URL) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('✅ Conectado al WebSocket');
      setIsConnected(true);
      ws.send(JSON.stringify({ action: 'get-id' }));
    };

    // ✅ UNIFICADO: Un solo manejador de mensajes para evitar sobrescritura
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Mensaje recibido:", data);

      // Agrega todos los eventos crudos al feed de la consola
      setMessages((prev) => [...prev, event.data]);

      if (data.type === "INIT") {
        console.log("🚀 Connection ID recibido:", data.connectionId);
        setConnectionId(data.connectionId);
      } 
      
      if (data.message === "Análisis completado") {
        setLabels(data.data);
        setIsAnalyzing(false); // 🛑 Apagamos el spinner cuando AWS responde
      }
    };

    ws.onclose = () => {
      console.log('❌ Desconectado');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('🚨 Error en WebSocket:', error);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [WS_URL, WS_BASE_URL]);

  // 1. Manejador de selección con guardarraíles
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 🛡️ Guardarraíles de presupuesto
    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo supera el límite de 5MB.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      alert("Formato inválido. Solo se admite JPG y PNG.");
      return;
    }

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setLabels(""); // Resetear resultados anteriores
  };

  // 2. Flujo completo de subida y análisis
  const uploadAndAnalyze = async () => {
    if (!selectedImage || !connectionId) return;

    try {
      setIsAnalyzing(true);
      setLabels("");

      console.log('1. Solicitando Pre-signed URL...');
      const apiRes = await fetch(
        `${REST_BASE_URL}/${environment}/upload-url?connectionId=${connectionId}&env=${environment}`
      );
      
      if (!apiRes.ok) throw new Error("Error obteniendo la URL firmada");
      const { uploadUrl } = await apiRes.json();

      console.log('2. Subiendo directamente a S3...');
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedImage,
        headers: {
          'Content-Type': selectedImage.type,
        },
      });

      if (!uploadRes.ok) throw new Error("Error en la subida a S3");
      console.log('✅ Archivo en S3. Esperando respuesta de Rekognition vía WebSocket...');

    } catch (error) {
      console.error("🚨 Fallo en el flujo:", error);
      alert("Ocurrió un error al procesar la imagen.");
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Contenedor con padding consistente de 1400px */}
      <div className="max-w-[1400px] mx-auto px-6 py-10">

        <header className="mb-12">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight">Vision AI</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {isConnected ? 'ON-LINE' : 'OFF-LINE'}
            </span>
          </div>
          <p className="text-slate-600 mt-2">Serverless Image Analysis System</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Panel Izquierdo: Controles */}
          <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Configuración de Carga</h2>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Connection ID (WebSocket)</label>
                <input
                  type="text"
                  value={connectionId}
                  readOnly
                  placeholder="Esperando identificador de AWS..."
                  className="w-full p-2 bg-slate-100 border border-slate-300 rounded-md outline-none text-slate-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Imagen</label>
                <input
                  type="file"
                  accept="image/jpeg, image/png"
                  onChange={handleFileChange}
                  disabled={!isConnected || !connectionId || isAnalyzing}
                  className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Preview Local de la Imagen */}
              {previewUrl && (
                <div className="mt-4 border border-slate-200 rounded-lg p-2 bg-slate-50 max-w-xs mx-auto">
                  <p className="text-xs font-medium text-slate-500 mb-1 text-center">Vista previa</p>
                  <img src={previewUrl} alt="Preview" className="rounded-md max-h-48 object-cover mx-auto" />
                </div>
              )}

              {/* Botón de Enviar a AWS */}
              <button
                onClick={uploadAndAnalyze}
                disabled={!selectedImage || isAnalyzing}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Analizando con Rekognition...
                  </>
                ) : (
                  "Procesar Imagen"
                )}
              </button>
            </div>

            {/* Resultado de las Etiquetas */}
            {labels && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-1">Labels Detectados:</h3>
                <p className="text-slate-700 text-sm font-medium">{labels}</p>
              </div>
            )}
          </section>

          {/* Panel Derecho: Consola Real-time Feed */}
          <section className="bg-slate-900 p-8 rounded-xl shadow-inner min-h-[400px] flex flex-col🎁">
            <h2 className="text-xl font-semibold mb-4 text-emerald-400 font-mono tracking-widest uppercase text-xs">Real-time Feed</h2>
            <div className="flex-1 font-mono text-xs overflow-y-auto space-y-2 max-h-[450px]">
              {messages.length === 0 ? (
                <p className="text-slate-500 italic">Esperando eventos de AWS...</p>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className="text-emerald-300 border-l-2 border-emerald-500 pl-3 py-1 bg-emerald-500/5 break-all">
                    {msg}
                  </div>
                ))
              )}
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}