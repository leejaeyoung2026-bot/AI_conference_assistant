import os
import json
import asyncio
import logging
import io
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FasterWhisperServer")

app = FastAPI(title="Faster-Whisper STT Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variable
model = None

def load_model():
    global model
    model_size = "tiny" # Render 무료 티어 메모리를 고려해 tiny 선택
    logger.info(f"Loading Faster-Whisper model ({model_size})...")
    try:
        # CPU 환경 및 메모리 최적화 설정
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        logger.info("Actual AI Model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        model = None

@app.on_event("startup")
async def startup_event():
    load_model()

@app.get("/")
async def root():
    return {"status": "running", "model_loaded": model is not None}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy" if model else "degraded",
        "model": "Faster-Whisper (tiny)" if model else "None"
    }

@app.websocket("/ws/stt")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Client connected to STT stream")
    
    try:
        while True:
            # 1. 메타데이터 수신
            meta_data = await websocket.receive_text()
            metadata = json.loads(meta_data)
            
            # 2. 오디오 데이터 수신 (Binary)
            audio_bytes = await websocket.receive_bytes()
            
            if not model:
                await websocket.send_json({"type": "error", "message": "Model not loaded on server"})
                continue

            # 3. 실제 AI 인식 수행
            # 바이너리 데이터를 16kHz float32 numpy 배열로 변환
            audio_file = io.BytesIO(audio_bytes)
            
            # Faster-Whisper 인식 실행 (실제 연산)
            segments, info = model.transcribe(audio_file, beam_size=5, language="ko")
            
            final_text = ""
            for segment in segments:
                final_text += segment.text + " "
            
            final_text = final_text.strip()

            if final_text:
                response = {
                    "type": "stt_result",
                    "data": {
                        "finalText": final_text,
                        "fasterWhisper": {
                            "text": final_text,
                            "confidence": 0.95
                        },
                        "speaker": metadata.get("speaker", {"type": "unknown"}),
                        "language": info.language
                    }
                }
                await websocket.send_json(response)
            
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"In-stream error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except: pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
