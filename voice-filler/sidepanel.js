// sidepanel.js - Main logic for Sarkari Sahayak side panel interface

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentFields = [];
let currentValues = {};
let activeLanguage = "bn-IN";
let isMockMode = true;

// DOM Elements
const langSelect = document.getElementById("langSelect");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const modeToggle = document.getElementById("modeToggle");
const errorBox = document.getElementById("errorBox");
const micBtn = document.getElementById("micBtn");
const micHint = document.getElementById("micHint");
const transcriptBox = document.getElementById("transcriptBox");
const testFillBtn = document.getElementById("testFillBtn");
const scanFieldsBtn = document.getElementById("scanFieldsBtn");
const processTranscriptBtn = document.getElementById("processTranscriptBtn");
const readBackBtn = document.getElementById("readBackBtn");
const fieldList = document.getElementById("fieldList");
const fieldCountEl = document.getElementById("fieldCount");
const filledCountEl = document.getElementById("filledCount");
const settingsDrawer = document.getElementById("settingsDrawer");
const apiKeyInput = document.getElementById("apiKeyInput");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const ttsAudio = document.getElementById("ttsAudio");

// 1. Status updater with strict <100ms latency guarantee per DESIGN.md
function setStatus(text, type = "idle") {
  statusText.textContent = text;
  statusDot.className = "status-dot";
  if (type === "listening") statusDot.classList.add("listening");
  else if (type === "active") statusDot.classList.add("active");
  else if (type === "success") statusDot.classList.add("success");
  else if (type === "error") statusDot.classList.add("error");
}

function showError(msg) {
  if (!msg) {
    errorBox.style.display = "none";
    errorBox.textContent = "";
    return;
  }
  console.error("[Sarkari Sahayak UI Error]", msg);
  errorBox.textContent = String(msg);
  errorBox.style.display = "block";
  setStatus("Error", "error");
}

function clearError() {
  showError(null);
}

// 2. Initialize UI & Config
async function init() {
  // Populate languages
  if (window.CONFIG && CONFIG.LANGUAGES) {
    langSelect.innerHTML = "";
    CONFIG.LANGUAGES.forEach(lang => {
      const opt = document.createElement("option");
      opt.value = lang.code;
      opt.textContent = lang.name;
      if (lang.code === CONFIG.DEFAULT_LANGUAGE) opt.selected = true;
      langSelect.appendChild(opt);
    });
    activeLanguage = langSelect.value;
  }

  // Fetch current config from background
  chrome.runtime.sendMessage({ action: "GET_CONFIG" }, (response) => {
    if (chrome.runtime.lastError || !response?.success) {
      console.warn("Could not load stored config, using defaults.");
      updateModeBadge(CONFIG.MOCK);
      return;
    }
    const settings = response.settings;
    isMockMode = settings.mockMode;
    apiKeyInput.value = settings.apiKey || "";
    updateModeBadge(isMockMode);
  });

  // Automatically scan the active tab on launch
  setTimeout(scanCurrentPage, 300);
}

function updateModeBadge(mock) {
  isMockMode = mock;
  if (mock) {
    modeToggle.textContent = "Mock Mode";
    modeToggle.className = "mode-badge";
    modeToggle.title = "Mock mode active (uses canned responses). Click to configure / enable Live API.";
  } else {
    modeToggle.textContent = "Live Sarvam AI";
    modeToggle.className = "mode-badge live";
    modeToggle.title = "Live Sarvam API active. Click to view settings.";
  }
}

// Helper: detect internal browser tabs where extensions cannot run
function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("devtools://") ||
    url.startsWith("view-source:")
  );
}

// 3. Helper to communicate with the active tab & content script
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0] ? tabs[0] : null;
}

async function ensureContentScriptInjected(tabId, url) {
  if (isRestrictedUrl(url)) return false;
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "PING" }, async (resp) => {
      if (chrome.runtime.lastError || !resp?.pong) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            files: ["content.js"]
          });
          setTimeout(resolve, 150);
        } catch (e) {
          // Internal pages or permission limitations handled cleanly
          resolve(false);
        }
      } else {
        resolve(true);
      }
    });
  });
}

// 4. Scan Form Fields (Step 3a)
async function scanCurrentPage() {
  clearError();
  setStatus("Scanning...", "active");

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      setStatus("Ready", "idle");
      return;
    }

    if (isRestrictedUrl(tab.url)) {
      setStatus("Ready", "idle");
      fieldList.innerHTML = `
        <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 14px; line-height: 1.6;">
          Browser internal page detected.<br>
          <span style="font-size: 11px;">Extensions cannot run on <code>chrome://</code> pages.</span><br><br>
          <button id="openDemoTabBtn" class="btn btn-primary" style="margin: 0 auto; padding: 6px 12px; font-size: 11px;">
            Open Test Form Tab
          </button>
        </div>
      `;
      const btn = document.getElementById("openDemoTabBtn");
      if (btn) {
        btn.onclick = () => {
          chrome.tabs.create({ url: chrome.runtime.getURL("demo-form.html") });
        };
      }
      return;
    }

    await ensureContentScriptInjected(tab.id, tab.url);

    chrome.tabs.sendMessage(tab.id, { action: "SCAN_FIELDS" }, (res) => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message;
        if (msg.includes("Receiving end does not exist")) {
          let hint = "Please refresh (F5) the form tab once to connect.";
          if (tab.url && tab.url.startsWith("file://")) {
            hint += " (For file:// URLs, enable 'Allow access to file URLs' in chrome://extensions).";
          }
          showError(hint);
        } else {
          showError("Form scan error: " + msg);
        }
        setStatus("Ready", "idle");
        return;
      }

      if (res && res.success) {
        currentFields = res.fields || [];
        renderFieldList(currentFields, currentValues);
        setStatus("Ready", "idle");
      } else {
        showError(res?.error || "Failed to scan fields.");
        setStatus("Ready", "idle");
      }
    });
  } catch (err) {
    showError(err.message);
    setStatus("Ready", "idle");
  }
}

// Render Field List in Side Panel
function renderFieldList(fields, filledMap = {}) {
  fieldCountEl.textContent = fields.length;
  let filledCount = 0;

  if (fields.length === 0) {
    fieldList.innerHTML = `
      <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 12px;">
        No form fields detected. Click "Scan Form" on an active form page.
      </div>
    `;
    filledCountEl.textContent = "0 filled";
    return;
  }

  fieldList.innerHTML = "";
  fields.forEach(field => {
    const isFilled = filledMap[field.id] !== undefined && filledMap[field.id] !== "";
    if (isFilled) filledCount++;

    const item = document.createElement("div");
    item.className = "field-item";

    const info = document.createElement("div");
    info.className = "field-info";

    const label = document.createElement("div");
    label.className = "field-label";
    label.textContent = field.label || field.name || field.id;

    const val = document.createElement("div");
    val.className = "field-val";
    val.textContent = isFilled ? String(filledMap[field.id]) : (field.currentValue || field.type);

    info.appendChild(label);
    info.appendChild(val);

    const icon = document.createElement("div");
    icon.className = `field-status-icon ${isFilled ? "filled" : "empty"}`;
    icon.textContent = isFilled ? "✓" : "○";

    item.appendChild(info);
    item.appendChild(icon);

    // Click item to highlight field on the webpage
    item.addEventListener("click", async () => {
      const tab = await getActiveTab();
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: "HIGHLIGHT_FIELD", id: field.id });
      }
    });

    fieldList.appendChild(item);
  });

  filledCountEl.textContent = `${filledCount} filled`;
}

// 5. Test Hardcoded Fill (Requirement 3a)
async function testHardcodedFill() {
  clearError();
  setStatus("Filling...", "active");

  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active tab.");
    if (isRestrictedUrl(tab.url)) {
      showError("Cannot interact with internal browser tabs. Please switch to a web form tab.");
      setStatus("Ready", "idle");
      return;
    }

    await ensureContentScriptInjected(tab.id, tab.url);

    // Send hardcoded payload from config.js
    const payload = CONFIG.HARDCODED_TEST_PAYLOAD;

    chrome.tabs.sendMessage(tab.id, { action: "FILL_FIELDS", values: payload }, (res) => {
      if (chrome.runtime.lastError) {
        showError("Fill error: " + chrome.runtime.lastError.message);
        setStatus("Error", "error");
        return;
      }

      if (res && res.success) {
        console.log("[Sarkari Sahayak] Test fill completed:", res);
        if (!res.filled || res.filled.length === 0) {
          showError("No fields could be matched for test fill. Make sure an active form is open.");
          setStatus("0 Filled", "warn");
        } else {
          res.filled.forEach(item => {
            currentValues[item.id] = item.value;
          });
          renderFieldList(currentFields, currentValues);
          setStatus(`Filled (${res.filled.length})`, "success");
        }
      } else {
        showError(res?.error || "Fill failed.");
        setStatus("Error", "error");
      }
    });
  } catch (err) {
    showError(err.message);
    setStatus("Error", "error");
  }
}

let recordingTimer = null;
let recordingSeconds = 0;
const MAX_RECORDING_SECONDS = 28; // Sarvam STT synchronous limit is 30 seconds

// 6. Mic Recording & Saaras STT (Step 3b)
async function startRecording() {
  clearError();
  audioChunks = [];

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
      recordingSeconds = 0;

      // Turn off microphone tracks
      stream.getTracks().forEach(track => track.stop());
      micBtn.classList.remove("recording");
      isRecording = false;
      micHint.textContent = "Processing audio...";

      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      if (audioBlob.size === 0) {
        showError("No audio recorded. Please try again.");
        setStatus("Ready", "idle");
        micHint.textContent = "Tap mic to speak your details";
        return;
      }

      // Convert to Base64 to send to service worker
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(",")[1];
        await processAudioTranscription(base64Audio, "audio/webm");
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorder.start();
    isRecording = true;
    recordingSeconds = 0;
    micBtn.classList.add("recording");
    micHint.textContent = `Listening... 0s / ${MAX_RECORDING_SECONDS}s`;
    setStatus("Listening", "listening");

    recordingTimer = setInterval(() => {
      recordingSeconds++;
      if (recordingSeconds >= MAX_RECORDING_SECONDS) {
        micHint.textContent = `Limit reached (${MAX_RECORDING_SECONDS}s). Processing...`;
        stopRecording();
      } else {
        const left = MAX_RECORDING_SECONDS - recordingSeconds;
        micHint.textContent = `Listening... ${recordingSeconds}s / ${MAX_RECORDING_SECONDS}s (${left}s left)`;
      }
    }, 1000);
  } catch (err) {
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }
    console.error("[Sarkari Sahayak] Microphone Error:", err.name, err.message, err);
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      showError(`Microphone permission denied (${err.name}). Chrome side panels require granting permission once via a tab.`);
      // Insert convenient one-click setup button
      const setupBtn = document.createElement("button");
      setupBtn.className = "btn btn-primary";
      setupBtn.style.marginTop = "8px";
      setupBtn.style.width = "100%";
      setupBtn.textContent = "🎙️ Open Microphone Permission Page";
      setupBtn.onclick = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("permission.html") });
      };
      errorBox.appendChild(setupBtn);
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      showError(`Microphone not detected (${err.name}). Please connect a mic and check sound settings.`);
    } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      showError(`Microphone in use by another app (${err.name}). Please close Zoom, Discord, etc.`);
    } else {
      showError(`Microphone Error [${err.name}]: ${err.message}`);
    }
    setStatus("Mic Blocked", "error");
    isRecording = false;
    micBtn.classList.remove("recording");
    micHint.textContent = "Tap mic to speak your details";
  }
}

function stopRecording() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

// Send audio to Saaras STT in background.js
async function processAudioTranscription(audioBase64, mimeType) {
  setStatus("Transcribing", "active");

  chrome.runtime.sendMessage(
    {
      action: "TRANSCRIBE_AUDIO",
      audioBase64: audioBase64,
      mimeType: mimeType,
      languageCode: activeLanguage
    },
    async (response) => {
      if (chrome.runtime.lastError) {
        showError("STT background error: " + chrome.runtime.lastError.message);
        setStatus("Error", "error");
        micHint.textContent = "Tap mic to speak your details";
        return;
      }

      if (response && response.success) {
        const transcript = response.transcript || "";
        transcriptBox.innerText = transcript;
        micHint.textContent = "Transcript ready!";
        setStatus("Transcript Received", "success");

        // Automatically trigger Step 3c: Sarvam-105B understanding & fill
        if (transcript.trim()) {
          setTimeout(() => processAndFillTranscript(transcript), 200);
        }
      } else {
        showError(response?.error || "STT Transcription failed.");
        setStatus("Error", "error");
        micHint.textContent = "Tap mic to speak your details";
      }
    }
  );
}

// 7. Transcript -> Sarvam-105B -> JSON -> Form Fill (Step 3c)
async function processAndFillTranscript(transcript) {
  const text = transcript || transcriptBox.innerText.trim();
  if (!text) {
    showError("Please record or enter a voice transcript first.");
    return;
  }

  clearError();
  setStatus("Understanding", "active");

  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active tab.");
    if (isRestrictedUrl(tab.url)) {
      showError("Cannot interact with internal browser tabs. Please switch to a web form tab.");
      setStatus("Ready", "idle");
      return;
    }

    await ensureContentScriptInjected(tab.id, tab.url);

    // 1. Scan fresh fields from tab
    chrome.tabs.sendMessage(tab.id, { action: "SCAN_FIELDS" }, (scanRes) => {
      if (chrome.runtime.lastError || !scanRes?.success) {
        showError("Failed to scan form: " + (chrome.runtime.lastError?.message || scanRes?.error));
        setStatus("Error", "error");
        return;
      }

      currentFields = scanRes.fields || [];
      if (currentFields.length === 0) {
        showError("No form fields detected on page to fill.");
        setStatus("Ready", "idle");
        return;
      }

      // 2. Call Sarvam-105B via background
      chrome.runtime.sendMessage(
        {
          action: "MAP_FIELDS",
          fields: currentFields,
          transcript: text,
          languageCode: activeLanguage
        },
        (mapRes) => {
          if (chrome.runtime.lastError || !mapRes?.success) {
            showError("Sarvam-105B Error: " + (chrome.runtime.lastError?.message || mapRes?.error));
            setStatus("Error", "error");
            return;
          }

          const extractedValues = mapRes.values || {};
          console.log("[Sarkari Sahayak] Extracted field values:", extractedValues);

          // 3. Send values to content script to fill & highlight
          chrome.tabs.sendMessage(tab.id, { action: "FILL_FIELDS", values: extractedValues }, (fillRes) => {
            if (chrome.runtime.lastError || !fillRes?.success) {
              showError("Form fill error: " + (chrome.runtime.lastError?.message || fillRes?.error));
              setStatus("Error", "error");
              return;
            }

            // Update local state and UI
            fillRes.filled.forEach(f => {
              currentValues[f.id] = f.value;
            });
            renderFieldList(currentFields, currentValues);

            if (!fillRes.filled || fillRes.filled.length === 0) {
              const keys = Object.keys(extractedValues);
              if (keys.length === 0) {
                showError("Model returned empty fields for this transcript. Try speaking clearly: name, mobile, address, etc.");
              } else {
                showError(`Extracted data (${keys.join(", ")}) did not match fields on this page.`);
              }
              setStatus("0 Filled", "warn");
            } else {
              setStatus(`Filled (${fillRes.filled.length})`, "success");
            }
          });
        }
      );
    });
  } catch (err) {
    showError(err.message);
    setStatus("Error", "error");
  }
}

// 8. Stretch: Bulbul TTS Read-back
async function readBackForm() {
  clearError();
  const filledEntries = Object.entries(currentValues);
  if (filledEntries.length === 0) {
    showError("No fields filled yet to read back.");
    return;
  }

  // Construct summary text for speech
  let summaryText = "";
  if (activeLanguage.startsWith("bn")) {
    summaryText = "ফর্মের বিবরণ: " + filledEntries.map(([k, v]) => {
      const field = currentFields.find(f => f.id === k);
      return `${field?.label || k}: ${v}`;
    }).join(", ");
  } else if (activeLanguage.startsWith("hi")) {
    summaryText = "फॉर्म का विवरण: " + filledEntries.map(([k, v]) => {
      const field = currentFields.find(f => f.id === k);
      return `${field?.label || k}: ${v}`;
    }).join(", ");
  } else {
    summaryText = "Form details: " + filledEntries.map(([k, v]) => {
      const field = currentFields.find(f => f.id === k);
      return `${field?.label || k}: ${v}`;
    }).join(", ");
  }

  setStatus("Speaking...", "active");

  chrome.runtime.sendMessage(
    {
      action: "TTS_READBACK",
      text: summaryText,
      languageCode: activeLanguage
    },
    (res) => {
      if (chrome.runtime.lastError || !res?.success) {
        showError("TTS Error: " + (chrome.runtime.lastError?.message || res?.error));
        setStatus("Ready", "idle");
        return;
      }

      if (res.audioDataUrl) {
        ttsAudio.src = res.audioDataUrl;
        ttsAudio.play();
        setStatus("Playing Audio", "success");
        ttsAudio.onended = () => setStatus("Ready", "idle");
      } else {
        setStatus("TTS Simulated (Mock)", "idle");
      }
    }
  );
}

// 9. Event Listeners
micBtn.addEventListener("click", () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

testFillBtn.addEventListener("click", testHardcodedFill);
scanFieldsBtn.addEventListener("click", scanCurrentPage);
processTranscriptBtn.addEventListener("click", () => processAndFillTranscript());
readBackBtn.addEventListener("click", readBackForm);

langSelect.addEventListener("change", (e) => {
  activeLanguage = e.target.value;
  console.log("[Sarkari Sahayak] Language set to:", activeLanguage);
});

modeToggle.addEventListener("click", () => {
  settingsDrawer.classList.toggle("open");
});

closeSettingsBtn.addEventListener("click", () => {
  settingsDrawer.classList.remove("open");
});

saveKeyBtn.addEventListener("click", () => {
  const newKey = apiKeyInput.value.trim();
  const newMock = newKey ? false : true;
  chrome.runtime.sendMessage(
    {
      action: "SET_CONFIG",
      apiKey: newKey,
      mockMode: newMock
    },
    (res) => {
      if (res?.success) {
        updateModeBadge(res.settings.mockMode);
        settingsDrawer.classList.remove("open");
        setStatus("Settings Saved", "success");
        setTimeout(() => setStatus("Ready", "idle"), 1500);
      }
    }
  );
});

// Run Init
document.addEventListener("DOMContentLoaded", init);

// Auto-scan form whenever user switches to a different browser tab
chrome.tabs.onActivated.addListener(() => {
  scanCurrentPage();
});
