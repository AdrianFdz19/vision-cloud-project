'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [environment] = useState('dev');
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
  const WS_TOKEN = process.env.NEXT_PUBLIC_WS_TOKEN

  const WS_URL = `${WS_BASE_URL}/${environment}?token=${WS_TOKEN}`;

  useEffect(() => {
    if (!WS_BASE_URL) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('✅ Connected to WebSocket');
      setIsConnected(true);
      ws.send(JSON.stringify({ action: 'get-id' }));
    };

    // Unified message handler
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Message received:", data);

      // Append raw events to the console feed
      setMessages((prev) => [...prev, event.data]);

      if (data.type === "INIT") {
        console.log("🚀 Connection ID received:", data.connectionId);
        setConnectionId(data.connectionId);
      }

      if (data.message === "Análisis completado") {
        setLabels(data.data);
        setIsAnalyzing(false); // Disable spinner when AWS responds
      }
    };

    ws.onclose = () => {
      console.log('❌ Disconnected');
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

  // File selection handler with architecture guardrails
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Budget Guardrails
    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds the 5MB limit.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid format. Only JPG and PNG are supported.");
      return;
    }

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setLabels(""); // Reset previous results
  };

  // Complete upload and analysis pipeline
  const uploadAndAnalyze = async () => {
    if (!selectedImage || !connectionId) return;

    try {
      setIsAnalyzing(true);
      setLabels("");

      console.log('1. Requesting Pre-signed URL...');
      const apiRes = await fetch(
        `${REST_BASE_URL}/${environment}/upload-url?connectionId=${connectionId}&env=${environment}`
      );

      if (!apiRes.ok) throw new Error("Error fetching pre-signed URL");
      const { uploadUrl } = await apiRes.json();

      console.log('2. Uploading directly to S3...');
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedImage,
        headers: {
          'Content-Type': selectedImage.type,
        },
      });

      if (!uploadRes.ok) throw new Error("S3 payload upload failed");
      console.log('✅ Payload arrived at S3. Awaiting Rekognition stream via WebSocket...');

    } catch (error) {
      console.error("🚨 Execution pipeline failed:", error);
      alert("An error occurred while processing the image.");
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        {/* 1400px Max-Width Grid Wrapper */}
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

          {/* Left Panel: Control Pipeline */}
          <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Upload Configuration</h2>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Connection ID (WebSocket)</label>
                <input
                  type="text"
                  value={connectionId}
                  readOnly
                  placeholder="Awaiting identifier response from AWS..."
                  className="w-full p-2 bg-slate-100 border border-slate-300 rounded-md outline-none text-slate-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Image</label>
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

              {/* Local Media Viewport Preview */}
              {previewUrl && (
                <div className="mt-4 border border-slate-200 rounded-lg p-2 bg-slate-50 max-w-xs mx-auto">
                  <p className="text-xs font-medium text-slate-500 mb-1 text-center">Image Preview</p>
                  <img src={previewUrl} alt="Preview" className="rounded-md max-h-48 object-cover mx-auto" />
                </div>
              )}

              {/* Ingestion Stream Dispatcher */}
              <button
                onClick={uploadAndAnalyze}
                disabled={!selectedImage || isAnalyzing}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Analyzing with Rekognition...
                  </>
                ) : (
                  "Process Image"
                )}
              </button>
            </div>

            {/* Inference Labels Result Display */}
            {labels && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-1">Detected Labels:</h3>
                <p className="text-slate-700 text-sm font-medium">{labels}</p>
              </div>
            )}
          </section>

          {/* Right Panel: Real-time Feed Terminal Console */}
          <section className="bg-slate-900 p-8 rounded-xl shadow-inner min-h-[400px] flex flex-col🎁">
            <h2 className="text-xl font-semibold mb-4 text-emerald-400 font-mono tracking-widest uppercase text-xs">Real-time Feed</h2>
            <div className="flex-1 font-mono text-xs overflow-y-auto space-y-2 max-h-[450px]">
              {messages.length === 0 ? (
                <p className="text-slate-500 italic">Awaiting AWS events...</p>
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