# RULES.md

## Time limit: 30 minutes. Priority order, stop after each works end to end:
1. Fill pipeline works with hardcoded JSON on a real form
2. Mic -> Saaras STT -> transcript shown
3. Transcript + field list -> Sarvam-105B -> JSON -> form filled
4. Polish UI per DESIGN.md
5. Stretch only if 1-4 are solid: Bulbul read-back, then Vision upload

## Files (plain JS, no build step, no frameworks)
manifest.json, background.js, content.js, sidepanel.html, sidepanel.js, config.js

## Required skills
- MV3 manifest: sidePanel, activeTab, scripting permissions; host_permissions for
  the Sarvam API; content script with all_frames: true
- Messaging: chrome.runtime.sendMessage between panel, background, content script
- Recording: MediaRecorder in the SIDE PANEL page (never a popup, never the
  service worker). Request mic permission from the panel.
- Field scan (content.js): collect input/select/textarea, skip hidden,
  tag each with data-vf-id, return {id, label, name, type, options}.
  Label fallback: <label for>, aria-label, placeholder, nearest preceding text.
  Group radios by name.
- Fill (content.js): use the native value setter, then dispatch bubbling
  `input` and `change` events (required for React-controlled inputs).
  Selects: match option value or text. Dates: YYYY-MM-DD.
- LLM prompt: give the model the field list + transcript; "Return ONLY JSON
  mapping field id to value. Use exact option values. Omit fields not
  mentioned. No markdown." Strip ``` fences before JSON.parse.
- Keep all Sarvam API calls and the API key in background.js only.
- Put every endpoint, model name and header in config.js, as constants.

## Do not guess Sarvam APIs
Endpoints, model names (Saaras, Bulbul, Sarvam-105B) and auth headers must come
from the docs/snippets pasted below. If not provided, leave a clearly
marked TODO in config.js and ask me. Do not invent them.
import fs from 'node:fs';
import { SarvamAIClient } from 'sarvamai';

const client = new SarvamAIClient({
  apiSubscriptionKey: 'YOUR_API_KEY',
});

const response = await client.textToSpeech.convertStream({
    text: `नमस्ते! Sarvam AI में आपका स्वागत है।

हम भारतीय भाषाओं के लिए voice technology बनाते हैं। यहाँ आप अपना text type करके अलग-अलग voices में सुन सकते हैं।

अपनी भाषा में AI की आवाज़ का अनुभव करें।`,
    target_language_code: "hi-IN",
    speaker: "shubh_enhi_ads",
    model: "bulbul:v4-flash",
    pace: 1,
    speech_sample_rate: 24000,
});

response.pipe(fs.createWriteStream('speech.mp3'));

import fs from 'node:fs';
import { SarvamAIClient } from 'sarvamai';

const client = new SarvamAIClient({
  apiSubscriptionKey: 'YOUR_API_KEY',
});

const file = fs.createReadStream('audio.wav');

const response = await client.speechToText.transcribe(file, {
  model: "saaras:v4",
  language_code: "en-IN",
  mode: "transcribe",
  sample_rate: 16000,
});

console.log(response.transcript);

const BASE = 'https://api.sarvam.ai/doc-ai/v1';
const HEADERS = { 'api-subscription-key': 'YOUR_API_KEY' };
const TERMINAL = new Set(['completed', 'partially_completed', 'failed', 'rejected']);

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
};

// Submit the job — one multipart request, no pre-upload needed.
// Browser: use a File from an <input type="file">. Node 18+: use fs.openAsBlob.
const form = new FormData();
form.append('file', file, 'document.pdf');
form.append("language", "hi-IN");
form.append("output_format", "html");
form.append("content_type", "printed");
form.append("auto_orient", "true");

const submit = await fetch(`${BASE}/job/digitise`, {
  method: 'POST',
  headers: HEADERS,
  body: form,
});
if (!submit.ok) throw new Error(`${submit.status} ${await submit.text()}`);
const { job_id: jobId } = await submit.json();
console.log(`Job created: ${jobId}`);

// Poll until the job reaches a terminal status.
let status;
do {
  await new Promise((r) => setTimeout(r, 2000));
  status = await get(`/job/${jobId}/status`);
  const { pages_processed: done, pages_total: total } = status.usage;
  console.log(`${status.status} — ${done}/${total} pages`);
} while (!TERMINAL.has(status.status));

if (status.status === 'failed' || status.status === 'rejected') {
  throw new Error(`Job ${status.status}`);
}

// Mint a download URL for the rendered output and fetch it.
const link = await get(`/job/${jobId}/download-url`);
const output = await fetch(link.url, { headers: link.headers ?? {} });
const bytes = await output.arrayBuffer();
console.log(`Downloaded ${bytes.byteLength} bytes`);

import { SarvamAIClient } from 'sarvamai';

const client = new SarvamAIClient({
  apiSubscriptionKey: 'YOUR_API_KEY',
});

const response = await client.text.translate({
  input: "Hey, talk like you normally do.\n\nKal office mein 3 meetings thi.\n2 chai breaks.\n1 deadline miss hui.\nAur haan — salary ₹45,000 credit ho gayi 😌\n\nWrite it in Hindi, English, Tamil, Telugu — or mix it freely.\nSee how:\n\"₹45,000\"\nbecomes\n\"४५,००० रुपये\"\n\nChoose your tone (Formal, Modern Colloquial, Classical Colloquial, Code Mixed),\npick numerals (Native or International),\nand adjust speaker gender where it fits.\n\nSarvam understands real Indian language.\nNot clean. Not perfect. Just real.\n\nGo ahead.\nType it how you'd say it.",
  source_language_code: "en-IN",
  target_language_code: "hi-IN",
  model: "mayura:v1",
  numerals_format: "native",
  mode: "formal",
});

console.log(response.translated_text);
import { SarvamAIClient } from "sarvamai";

const client = new SarvamAIClient({
    apiSubscriptionKey: "YOUR_SARVAM_API_KEY",
});

async function main() {
    const response = await client.chat.completions({
        model: "sarvam-105b",
        messages: [
            {
                role: "user",
                content: "Explain the economic impact of GST implementation in India.",
            },
        ],
        temperature: 0.5,
        top_p: 1,
        max_tokens: 2000,
    });

    console.log(response.choices[0].message.content);
}

main();
import { SarvamAIClient } from "sarvamai";

const client = new SarvamAIClient({
    apiSubscriptionKey: "YOUR_SARVAM_API_KEY"
});

async function main() {
    const response = await client.chat.completions({
        model: "sarvam-105b",
        messages: [
            { role: "system", content: "You are a senior legal advisor specializing in Indian corporate law." },
            { role: "user", content: "What are the key compliance requirements for a startup in India?" },
            { role: "assistant", content: "Key compliance requirements include company registration under the Companies Act 2013, GST registration, PF/ESI registration for employees, and annual filings with MCA." },
            { role: "user", content: "Can you elaborate on the annual filing requirements and deadlines?" }
        ],
        temperature: 0.3,
        top_p: 1,
        max_tokens: 2000
    });
    
    console.log(response.choices[0].message.content);
}

main();
import { SarvamAIClient } from "sarvamai";

const client = new SarvamAIClient({
    apiSubscriptionKey: "YOUR_SARVAM_API_KEY"
});

async function main() {
    const stream = await client.chat.completions({
        model: "sarvam-105b",
        messages: [
            { role: "user", content: "Write a detailed analysis of India's digital transformation journey." }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
    });

    for await (const chunk of stream) {
        if (chunk.choices?.[0]?.delta?.content) {
            process.stdout.write(chunk.choices[0].delta.content);
        }
    }
    console.log();
}

main();






## Quality bar
- Complete working files, no partial snippets
- Log every API response to the console for debugging
- Mock mode: if config.MOCK = true, skip the APIs and use canned transcript +
  JSON, so the demo works if the network fails