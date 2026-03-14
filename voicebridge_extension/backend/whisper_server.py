from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
import tempfile
import os

app = Flask(__name__)
CORS(app)

# Load model once at startup
# Model sizes: tiny, base, small, medium
# "base" is best balance of speed and accuracy for your project
print("Loading Whisper model...")
model = WhisperModel("base", device="cpu", compute_type="int8")
print("✅ Whisper model loaded!")

@app.route("/")
def home():
    return "Whisper Transcription Server is running"

@app.route("/transcribe", methods=["POST"])
def transcribe():
    try:
        audio_file = request.files["audio"]

        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        # Transcribe using faster-whisper
        segments, info = model.transcribe(tmp_path, beam_size=5)

        # Join all segments into one text
        text = " ".join([segment.text for segment in segments]).strip()

        # Cleanup temp file
        os.unlink(tmp_path)

        print(f"Transcribed: {text}")

        return jsonify({ "text": text })

    except Exception as e:
        print(f"Transcription error: {e}")
        return jsonify({ "text": "" })

if __name__ == "__main__":
    app.run(port=5001)
    print("🎤 Whisper server running on http://localhost:5001")