var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_genai = require("@google/genai");
var import_promises = __toESM(require("fs/promises"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use((0, import_cors.default)());
app.use(import_express.default.json());
var ai = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
var DATA_FILE = import_path.default.join(process.cwd(), "public", "deals.json");
app.get("/api/deals", async (req, res) => {
  try {
    const data = await import_promises.default.readFile(DATA_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: "Failed to read deals data" });
  }
});
app.post("/api/ai/insights", async (req, res) => {
  try {
    const { deals, query } = req.body;
    if (!deals || !Array.isArray(deals)) {
      return res.status(400).json({ error: "Invalid deals data" });
    }
    const prompt = `
      You are an AI assistant for a personal website promotion aggregator.
      Analyze the following deals and answer the user's query.
      
      Query: ${query || "Provide a summary of the best deals available right now."}
      
      Deals:
      ${JSON.stringify(deals, null, 2)}
      
      Rules:
      1. Provide a concise, helpful response.
      2. Highlight the most valuable or relevant deals.
      3. Do not invent deals that are not in the provided list.
      4. Format your response in Markdown.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt
    });
    res.json({ result: response.text });
  } catch (error) {
    console.error("AI Insights error:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
