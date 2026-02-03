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
logger = logging.getLogger("EnsembleSTTServer")

app = FastAPI(title="Ensemble STT Server")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models
models = {
    "sensevoice": None,
    "faster_whisper": None,
    "qwen_asr": None
}

# Load models (Mock implementation for now to ensure connection works)
async def load_models():
    logger.info("Loading STT models...")
    # In a real implementation, you would load the models here
    # try:
    #     from faster_whisper import WhisperModel
    #     models["faster_whisper"] = WhisperModel("small", device="cpu", compute_type="int8")
    #     logger.info("Faster-Whisper loaded")
    # except Exception as e:
    #     logger.warning(f"Failed to load Faster-Whisper: {e}")
    
    logger.info("Models loaded (Simulation Mode enabled if models are missing)")

@app.on_event("startup")
async def startup_event():
    await load_models()

@app.get("/")
async def root():
    return {"status": "running", "service": "Ensemble STT Server"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "message": "Ensemble STT Server is running (Simulation Mode)",
        "models": ["SenseVoice-Small", "Faster-Whisper", "Qwen3-ASR"]
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
            logger.info(f"Received metadata: {metadata}")
            
            # 2. Receive Audio Data (Binary)
            audio_bytes = await websocket.receive_bytes()
            logger.info(f"Received audio bytes: {len(audio_bytes)} bytes")
            
            # 3. Process Audio (Simulation for now)
            # In a real-world scenario, you would decode the bytes (webm/opus) to PCM 
            # and pass it to the models.
            
            # Simulate processing time
            await asyncio.sleep(0.5)
            
            # Create a mock response closely matching the protocol in ensemble-stt.js
            response = {
                "type": "ensemble_result",
                "data": {
                    "finalText": f"Server processed {len(audio_bytes)} bytes of audio.",
                    "senseVoice": "SenseVoice prediction",
                    "fasterWhisper": "Faster-Whisper prediction",
                    "qwenASR": "Qwen3-ASR prediction",
                    "speaker": metadata.get("speaker", "unknown"),
                    "confidence": 0.95,
                    "events": []
                }
            }
            
            await websocket.send_json(response)
            
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Error: {e}")
        try:
            await websocket.send_json({
                "type": "error", 
                "code": "processing_error", 
                "message": str(e)
            })
        except:
            pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
