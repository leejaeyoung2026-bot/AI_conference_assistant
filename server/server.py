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
from concurrent.futures import ThreadPoolExecutor

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

# Global model variable and thread pool
model = None
executor = ThreadPoolExecutor(max_workers=1) # AI 연산 전용 스레드

def load_model():
    global model
    model_size = "tiny" 
    logger.info(f"Loading Faster-Whisper model ({model_size})...")
    try:
        # Render 자원 제한을 고려하여 cpu_threads 제한 (1~2개 권장)
        model = WhisperModel(model_size, device="cpu", compute_type="int8", cpu_threads=1)
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
    return {"status": "healthy" if model else "degraded"}

def run_transcription(audio_data):
    """별도 스레드에서 실행될 실제 AI 인식 로직"""
    audio_file = io.BytesIO(audio_data)
    segments, info = model.transcribe(audio_file, beam_size=3, language="ko")
    
    # 제너레이터를 리스트로 즉시 변환하여 연산 완료
    text = " ".join([segment.text for segment in segments]).strip()
    return text, info.language

@app.websocket("/ws/stt")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Client connected to STT stream")
    
    try:
        while True:
            # 1. 메타데이터 수신
            try:
                meta_data = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
                metadata = json.loads(meta_data)
            except asyncio.TimeoutError:
                continue
            
            # 2. 오디오 데이터 수신
            audio_bytes = await websocket.receive_bytes()
            
            if not model:
                await websocket.send_json({"type": "error", "message": "Model not loaded"})
                continue

            # 3. 비동기 스레드에서 AI 인식 수행 (이벤트 루프 차단 방지)
            # 이를 통해 AI 연산 중에도 Render의 헬스체크에 응답할 수 있음
            loop = asyncio.get_event_loop()
            final_text, lang = await loop.run_in_executor(executor, run_transcription, audio_bytes)

            if final_text:
                await websocket.send_json({
                    "type": "stt_result",
                    "data": {
                        "finalText": final_text,
                        "language": lang,
                        "speaker": metadata.get("speaker", {"type": "unknown"})
                    }
                })
            
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"In-stream error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except: pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)