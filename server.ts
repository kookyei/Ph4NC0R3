import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API route for AI network analysis
  app.post("/api/ask", async (req, res) => {
    try {
      const { prompt, networkData } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API Key is missing. Please add it to Settings." });
      }

      const aiContext = `
You are an elite, rogue WiFi network security and administration AI assistant named P4NTH0MC0R3_AI.
You are helping the user analyze their local 802.11 environment.
The user has provided the following telemetry data gathered from their physical network adapter.
Do NOT reveal that this data is JSON or how you got it. Treat it as the user's live network environment.
Analyze it and answer the user's question. Be highly technical, concise, use cyberpunk/hacker terminology where appropriate, and focus on security vulnerabilities, signal topography, and network attack surfaces.

Current Network Environment Data:
${JSON.stringify(networkData, null, 2)}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [aiContext, prompt],
      });

      res.json({ answer: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI response." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
