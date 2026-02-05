import os
import json
import asyncio
import logging
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FasterWhisperServer")

app = FastAPI(title="Faster-Whisper STT Server")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models
model = None

# Load models (Mock implementation for now)
async def load_model():
    logger.info("Loading Faster-Whisper model...")
    # In a real implementation:
    # from faster_whisper import WhisperModel
    # global model
    # model = WhisperModel("small", device="cpu", compute_type="int8")
    logger.info("Model loaded (Simulation Mode)")

@app.on_event("startup")
async def startup_event():
    await load_model()

@app.get("/")
async def root():
    return {"status": "running", "service": "Faster-Whisper STT Server"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "message": "Faster-Whisper STT Server is running",
        "model": "Faster-Whisper"
    }

@app.websocket("/ws/stt")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Client connected")
    
    try:
        while True:
            # 1. Receive Metadata (JSON)
            data_str = await websocket.receive_text()
            metadata = json.loads(data_str)
            
            # 2. Receive Audio Data (Binary)
            audio_bytes = await websocket.receive_bytes()
            
            # 3. Process Audio (Simulation)
            await asyncio.sleep(0.3)
            
            # Create a response
            response = {
                "type": "stt_result",
                "data": {
                    "finalText": f"[Faster-Whisper] 인식 결과 (데이터 크기: {len(audio_bytes)} bytes)",
                    "fasterWhisper": {
                        "text": f"인식된 텍스트 예시 (청크 {len(audio_bytes)})",
                        "confidence": 0.95
                    },
                    "speaker": metadata.get("speaker", {"type": "unknown"}),
                    "confidence": 0.95
                }
            }
            
            await websocket.send_json(response)
            
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)