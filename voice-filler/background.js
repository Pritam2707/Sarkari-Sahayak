// background.js - Service worker handling Sarvam AI APIs and extension events

// Import config
importScripts("config.js");

console.log("[Sarkari Sahayak] Service worker initialized. MOCK mode:", CONFIG.MOCK);

// Ensure side panel opens on action icon click
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn("[Sarkari Sahayak] Failed to set sidePanel behavior:", err);
    });
  }
});

// Helper to retrieve active API Key and Mock status from storage (or fallback to config.js)
async function getActiveSettings() {
  const stored = await chrome.storage.local.get(["sarvam_api_key", "sarvam_mock_mode"]);
  return {
    apiKey: stored.sarvam_api_key || CONFIG.API_KEY || "",
    mockMode: stored.sarvam_mock_mode !== undefined ? stored.sarvam_mock_mode : CONFIG.MOCK
  };
}

// Convert Base64 Data URL to Blob
function base64ToBlob(base64Data, contentType) {
  const sliceSize = 512;
  const byteCharacters = atob(base64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

// 1. Saaras STT
async function transcribeAudio(audioBase64, mimeType, languageCode) {
  const { apiKey, mockMode } = await getActiveSettings();
  console.log(`[Sarkari Sahayak] Starting STT. Language: ${languageCode}, Mock: ${mockMode}`);

  if (mockMode) {
    console.log("[Sarkari Sahayak] [MOCK STT] Returning canned transcript for:", languageCode);
    const mockLang = CONFIG.MOCK_DATA[languageCode] || CONFIG.MOCK_DATA[CONFIG.DEFAULT_LANGUAGE];
    return {
      success: true,
      transcript: mockLang.transcript,
      mock: true
    };
  }

  if (!apiKey || apiKey.startsWith("YOUR_")) {
    throw new Error("Missing Sarvam API Key. Please provide a valid key in settings.");
  }

  // Sanitize MIME type to strip codecs parameters (e.g., 'audio/webm;codecs=opus' -> 'audio/webm')
  let cleanMime = (mimeType || "").split(";")[0].trim().toLowerCase();
  if (!cleanMime || !cleanMime.startsWith("audio/")) {
    cleanMime = "audio/webm";
  }
  const ext = cleanMime.includes("wav") ? "wav" : "webm";

  // Prepare audio Blob with exact allowed MIME type
  const blob = base64ToBlob(audioBase64, cleanMime);
  const formData = new FormData();
  formData.append("file", blob, `recording.${ext}`);
  formData.append("model", CONFIG.MODELS.STT);
  formData.append("language_code", languageCode || CONFIG.DEFAULT_LANGUAGE);
  formData.append("mode", "transcribe");

  console.log(`[Sarkari Sahayak] Fetching ${CONFIG.ENDPOINTS.STT}...`);
  const response = await fetch(CONFIG.ENDPOINTS.STT, {
    method: "POST",
    headers: {
      [CONFIG.AUTH_HEADER_NAME]: apiKey
    },
    body: formData
  });

  const responseText = await response.text();
  console.log(`[Sarkari Sahayak] STT Raw Status: ${response.status}`, responseText);

  if (!response.ok) {
    let errMessage = responseText;
    try {
      const errJson = JSON.parse(responseText);
      if (errJson?.error?.message) {
        errMessage = errJson.error.message;
      }
    } catch (_) {}
    throw new Error(`Sarvam STT (${response.status}): ${errMessage}`);
  }

  const result = JSON.parse(responseText);
  return {
    success: true,
    transcript: result.transcript || result.text || "",
    raw: result
  };
}

// 2. Sarvam-105B LLM Understanding & Mapping
async function mapTranscriptToFields(fields, transcript, languageCode) {
  const { apiKey, mockMode } = await getActiveSettings();
  console.log(`[Sarkari Sahayak] Mapping fields. Count: ${fields.length}, Mock: ${mockMode}`);

  if (mockMode) {
    console.log("[Sarkari Sahayak] [MOCK LLM] Simulating Sarvam-105B field mapping...");
    const mockDataset = (CONFIG.MOCK_DATA[languageCode] || CONFIG.MOCK_DATA[CONFIG.DEFAULT_LANGUAGE]).fieldValues;
    const mappedValues = {};

    // Map fields matching keys in mockDataset
    fields.forEach(field => {
      const fieldKey = (field.name || field.domId || field.label || "").toLowerCase();
      for (const [mockKey, mockVal] of Object.entries(mockDataset)) {
        if (fieldKey.includes(mockKey) || mockKey.includes(fieldKey)) {
          mappedValues[field.id] = mockVal;
          break;
        }
      }
    });

    // If no direct matches, fill first few fields with sample data for demonstration
    if (Object.keys(mappedValues).length === 0 && fields.length > 0) {
      fields.slice(0, 4).forEach((field, idx) => {
        const sampleVals = Object.values(mockDataset);
        mappedValues[field.id] = sampleVals[idx % sampleVals.length];
      });
    }

    return {
      success: true,
      values: mappedValues,
      mock: true
    };
  }

  if (!apiKey || apiKey.startsWith("YOUR_")) {
    throw new Error("Missing Sarvam API Key. Please provide a valid key in settings.");
  }

  // Create lightweight field description for LLM prompt
  const compactFields = fields.map(f => ({
    id: f.id,
    label: f.label,
    name: f.name,
    type: f.type,
    options: f.options ? f.options.map(o => ({ value: o.value, text: o.text || o.label })) : undefined
  }));

  const systemPrompt = `You are a specialized form filling AI for Indian users.
Analyze the user's spoken transcript (which may be in Bengali, Hindi, English, or other Indian languages) and extract values for the given form fields.

Field Definitions:
${JSON.stringify(compactFields, null, 2)}

CRITICAL RULES:
1. Return ONLY valid JSON mapping field "id" to the extracted value.
2. For select/radio fields with predefined options, you MUST choose the exact matching "value" string from the provided options.
3. For dates, format as YYYY-MM-DD.
4. For phone numbers, format as 10 digits without country code or spaces unless requested.
5. Omit fields not mentioned in the transcript.
6. Do NOT include markdown blocks, backticks, or explanatory text. Output ONLY the raw JSON object.`;

  const userPrompt = `Transcript: "${transcript}"`;

  console.log(`[Sarkari Sahayak] Fetching ${CONFIG.ENDPOINTS.CHAT} with model ${CONFIG.MODELS.CHAT}...`);
  const response = await fetch(CONFIG.ENDPOINTS.CHAT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [CONFIG.AUTH_HEADER_NAME]: apiKey,
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: CONFIG.MODELS.CHAT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1500
    })
  });

  const responseText = await response.text();
  console.log(`[Sarvam 105B] Raw Status: ${response.status}`, responseText);

  if (!response.ok) {
    let errMessage = responseText;
    try {
      const errJson = JSON.parse(responseText);
      if (errJson?.error?.message) {
        errMessage = errJson.error.message;
      }
    } catch (_) {}
    throw new Error(`Sarvam LLM (${response.status}): ${errMessage}`);
  }

  const result = JSON.parse(responseText);
  const rawContent = result.choices?.[0]?.message?.content || "{}";
  console.log("[Sarvam 105B] Model Raw Content:", rawContent);

  // Clean markdown fences
  let cleanJsonStr = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
  const jsonMatch = cleanJsonStr.match(/[\{\[][\s\S]*[\}\]]/);
  if (jsonMatch) {
    cleanJsonStr = jsonMatch[0];
  }

  let parsedValues = {};
  try {
    parsedValues = JSON.parse(cleanJsonStr);
  } catch (parseErr) {
    console.error("[Sarkari Sahayak] JSON parse error on response:", cleanJsonStr);
    throw new Error("Could not parse JSON from Sarvam-105B response: " + cleanJsonStr.slice(0, 100));
  }

  // Unwrap if nested in { "fields": ... } or { "values": ... } or { "data": ... }
  if (parsedValues.fields && typeof parsedValues.fields === "object" && !Array.isArray(parsedValues.fields)) {
    parsedValues = parsedValues.fields;
  } else if (parsedValues.values && typeof parsedValues.values === "object" && !Array.isArray(parsedValues.values)) {
    parsedValues = parsedValues.values;
  } else if (parsedValues.data && typeof parsedValues.data === "object" && !Array.isArray(parsedValues.data)) {
    parsedValues = parsedValues.data;
  }

  // If array of { id, value }, convert to key-value object
  if (Array.isArray(parsedValues)) {
    const dict = {};
    parsedValues.forEach(item => {
      const k = item.id || item.name || item.field || item.key;
      if (k && item.value !== undefined) dict[k] = item.value;
    });
    parsedValues = dict;
  }

  console.log("[Sarkari Sahayak] Final extracted fields dict:", parsedValues);

  return {
    success: true,
    values: parsedValues,
    raw: result
  };
}

// 3. Bulbul TTS Read-back (Stretch)
async function generateSpeech(text, languageCode) {
  const { apiKey, mockMode } = await getActiveSettings();
  if (mockMode) {
    return { success: true, mock: true, message: "TTS Simulated in Mock Mode." };
  }

  const response = await fetch(CONFIG.ENDPOINTS.TTS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [CONFIG.AUTH_HEADER_NAME]: apiKey
    },
    body: JSON.stringify({
      text: text,
      target_language_code: languageCode || CONFIG.DEFAULT_LANGUAGE,
      speaker: CONFIG.TTS_SPEAKER,
      model: CONFIG.MODELS.TTS,
      pace: 1.0,
      speech_sample_rate: 24000
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sarvam TTS Error: ${errText}`);
  }

  // Returns audio stream or base64
  const audioBlob = await response.blob();
  const buffer = await audioBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Audio = btoa(binary);

  return {
    success: true,
    audioDataUrl: `data:audio/mp3;base64,${base64Audio}`
  };
}

// Main message dispatcher
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      if (request.action === "GET_CONFIG") {
        const settings = await getActiveSettings();
        sendResponse({ success: true, settings, config: CONFIG });
        return;
      }

      if (request.action === "SET_CONFIG") {
        if (request.apiKey !== undefined) {
          await chrome.storage.local.set({ sarvam_api_key: request.apiKey });
        }
        if (request.mockMode !== undefined) {
          await chrome.storage.local.set({ sarvam_mock_mode: request.mockMode });
        }
        const updated = await getActiveSettings();
        sendResponse({ success: true, settings: updated });
        return;
      }

      if (request.action === "TRANSCRIBE_AUDIO") {
        const result = await transcribeAudio(request.audioBase64, request.mimeType, request.languageCode);
        sendResponse(result);
        return;
      }

      if (request.action === "MAP_FIELDS") {
        const result = await mapTranscriptToFields(request.fields, request.transcript, request.languageCode);
        sendResponse(result);
        return;
      }

      if (request.action === "TTS_READBACK") {
        const result = await generateSpeech(request.text, request.languageCode);
        sendResponse(result);
        return;
      }
    } catch (err) {
      console.error("[Sarkari Sahayak] Background handler error:", err);
      sendResponse({ success: false, error: err.message || String(err) });
    }
  })();

  return true; // Keep sendResponse open for async operations
});
