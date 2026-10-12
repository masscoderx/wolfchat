# Wolfchat

Wolfchat is a local AI chat and document-analysis web app. Use general chat for explanations, planning, writing, and follow-up questions, or switch to My files for cited answers grounded in uploaded PDFs, CSVs, TXT, and Markdown. Numeric CSV columns can be plotted as bar or line charts. A local Ollama model powers chat and is checked automatically on startup.

## Run locally

Requirements: Node.js 20 or newer.

```powershell
npm install
npm run dev
```

Open the local address printed by Vite in your browser. To create a production build, run `npm run build`.

## Optional local model

Install [Ollama](https://ollama.com/) and pull a model, for example:

```powershell
ollama pull qwen2.5:3b
```

The app connects to Ollama at startup using the saved local address and model name. Use the model control in the top bar to change these settings. General chat keeps recent conversation turns in context. My files mode sends only retrieved excerpts and optional CSV samples to the model. Nothing is sent to a hosted API.

## How analysis works

Files are read in the browser and held in memory for the current tab session. Without a connected Ollama model, My files mode ranks text passages by matching words in your question and shows those passages as evidence; general chat requires the model. With Ollama connected, My files mode asks the model to answer using matched passages and cite their labels. PDF text extraction works for text-based PDFs, not image-only scans. CSV charts use the first column as labels and show up to 80 rows at a time. The local model does not have live internet access, and its answers can still be mistaken.

This first version is intended as an inspectable, private baseline. Validate any conclusions against the original files.