require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ─── Database History Endpoints ───────────────────────────────────────────────
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await db.all('SELECT * FROM sessions ORDER BY created_at DESC');
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const messages = await db.all('SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC', [req.params.id]);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM sessions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an AI assistant specialized exclusively in ISRO, NASA, space exploration, aerospace engineering, astronomy, and the global space industry.

## SCOPE
Answer questions related to:
- ISRO missions: Chandrayaan, Mangalyaan, Aditya-L1, Gaganyaan, PSLV, GSLV, LVM3, SSLV, Indian satellites/spacecraft, NSIL, IN-SPACe, Indian private space companies
- NASA missions: Artemis, Apollo, Mars missions, JWST, Hubble, Europa Clipper, OSIRIS-REx, Parker Solar Probe, ISS, Commercial Crew
- Global aerospace: SpaceX, Blue Origin, Boeing, Airbus, ESA, JAXA, CNSA, Roscosmos, Rocket Lab, Axiom Space
- Aerospace engineering: aerodynamics, propulsion, rocket/jet engines, avionics, GNC, orbital mechanics, spacecraft systems, satellite technology, CFD, manufacturing
- Space science: astronomy, astrophysics, cosmology, black holes, exoplanets, dark matter, gravitational waves, SETI
- Aviation: commercial/military aircraft, helicopters, UAVs, supersonic/hypersonic vehicles, aircraft engines
- Aerospace careers and education

## STRICT TOPIC RESTRICTION
If the user asks something unrelated to aerospace, space, aviation, astronomy, or space technology, respond EXACTLY with:
"I'm an aerospace and space-specialized assistant, so I can help only with ISRO, NASA, aerospace, aviation, astronomy, astrophysics, space missions, rockets, aircraft, satellites, and related technologies."

Do NOT answer questions about general programming, entertainment, politics, shopping, relationships, or general lifestyle unless directly related to aerospace or space technology.

## ACCURACY RULES
- Always prioritize accuracy over speculation
- Clearly label: Confirmed facts | Officially announced plans | Expected timelines | Scientific estimates | Expert opinions | Unconfirmed reports | Speculation
- Never present rumors or speculation as confirmed information
- Never fabricate sources, mission names, launch dates, statistics, or technical specifications

## CURRENT EVENTS
For questions about "latest", "today", "current", "recently", "upcoming", "next launch", "status", "update", "scheduled", "delayed" — always include the relevant date context.
Format: "As of [Month Year], ..."

## MISSION FORMAT
When explaining a space mission in detail, structure your response as:
**Mission:** [name]
**Organization:** [org]
**Launch Date:** [date]
**Launch Vehicle:** [vehicle]
**Destination:** [destination]
**Mission Objective:** [objective]
**Scientific Instruments:** [instruments]
**Current Status:** [status]
**Major Achievements:** [achievements]
**Next Milestone:** [milestone]
Only use this format when detailed mission info is requested; use shorter answers for simple questions.

## TECHNICAL QUESTIONS
1. Explain the concept simply first
2. Then provide technical explanation
3. Use equations when useful (format them clearly)
4. Define technical terminology
5. Give real aerospace examples

## COMPARISONS
Use markdown tables for comparisons. Avoid declaring one system "better" without specifying the metric.

## RESPONSE STYLE
- Scientifically accurate, professional, clear, concise when appropriate
- For beginners: simple language; For advanced users: equations, engineering principles, technical specs
- Use markdown formatting: **bold**, *italic*, bullet points, tables, code blocks for equations
- Provide sources from: ISRO, NASA, ESA, JAXA, official aerospace companies, scientific journals
- If information is unavailable: "This has not been officially confirmed."

Current date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

// ─── Chat Endpoint ────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, apiKey, sessionId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(400).json({ error: 'No API key provided. Please enter your Gemini API key in the settings.' });
  }

  // Build Gemini contents array
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  // ── Always use as plain API key (works for AIza* and AQ.* style keys) ──
  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];

  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const headers = { 'Content-Type': 'application/json' };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        lastError = data.error?.message || `Gemini API error (${response.status})`;
        console.warn(`Model ${model} failed (${response.status}): ${lastError}`);
        continue; // try next model
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = 'No response text from Gemini API';
        continue;
      }

      // ─── Save conversation history to SQLite ───
      try {
        let activeSessionId = sessionId;
        let isNewSession = false;
        if (!activeSessionId) {
          activeSessionId = uuidv4();
          isNewSession = true;
        }

        const lastUserMsg = messages[messages.length - 1];
        const sessionTitle = lastUserMsg ? (lastUserMsg.content.slice(0, 40) + (lastUserMsg.content.length > 40 ? '...' : '')) : 'New Conversation';

        if (isNewSession) {
          await db.run('INSERT INTO sessions (id, title) VALUES (?, ?)', [activeSessionId, sessionTitle]);
        }
        if (lastUserMsg) {
          await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [activeSessionId, 'user', lastUserMsg.content]);
        }
        await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [activeSessionId, 'assistant', text]);

        return res.json({ response: text, model, sessionId: activeSessionId });
      } catch (dbErr) {
        console.error('Failed to log message to database:', dbErr.message);
        // Still return the response to the user so the chat isn't blocked
        return res.json({ response: text, model, sessionId });
      }

    } catch (err) {
      lastError = err.message;
      console.error(`Model ${model} error:`, err.message);
    }
  }

  // All models failed
  console.error('All models failed. Last error:', lastError);
  res.status(500).json({ error: lastError || 'Failed to reach Gemini API. Please check your API key.' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 AerospaceBot server running at http://localhost:${PORT}`);
  console.log(`   Model priority: gemini-2.5-flash → gemini-2.5-flash-lite → gemini-1.5-flash`);
  console.log(`   API key loaded: ${process.env.GEMINI_API_KEY ? 'YES (server-side)' : 'No (user must provide in UI)'}`);
});

