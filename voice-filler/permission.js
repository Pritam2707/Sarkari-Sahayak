// permission.js - One-time microphone setup handler

const allowBtn = document.getElementById("allowBtn");
const statusDiv = document.getElementById("status");

allowBtn.onclick = async () => {
  statusDiv.className = "";
  statusDiv.textContent = "Requesting microphone permission...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());

    statusDiv.className = "granted";
    statusDiv.innerHTML = "✓ Microphone permission granted! You can now close this tab and use the side panel.";
    allowBtn.style.display = "none";
  } catch (err) {
    console.error("Microphone setup error:", err);
    statusDiv.className = "failed";
    statusDiv.textContent = `Failed: ${err.name} - ${err.message}`;
  }
};
