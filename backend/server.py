from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===== MODELS =====

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class VoiceCommandRequest(BaseModel):
    text: str
    language: Optional[str] = None

class VoiceCommandResponse(BaseModel):
    response_text: str
    detected_language: str
    action_type: str
    action_data: Optional[dict] = None

class ImageAnalysisRequest(BaseModel):
    image_base64: str
    language: Optional[str] = "ro"

class ImageAnalysisResponse(BaseModel):
    description: str
    objects_detected: List[str]
    obstacles: List[str]
    guidance: str

class UserSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voice_type: str = "female"  # "female" for Ely, "male" for Elyn
    voice_name: str = "Ely"
    preferred_language: str = "ro"
    voice_sample_registered: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserSettingsUpdate(BaseModel):
    voice_type: Optional[str] = None
    voice_name: Optional[str] = None
    preferred_language: Optional[str] = None
    voice_sample_registered: Optional[bool] = None

# ===== AI INTEGRATION =====
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

async def process_voice_command(text: str, language: str = None) -> dict:
    """Process voice command using AI"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"voice-cmd-{uuid.uuid4()}",
            system_message="""Ești Ely/Elyn, un asistent vocal inteligent pentru persoane nevăzătoare. 
            
Analizează comanda utilizatorului și răspunde în aceeași limbă în care a fost formulată comanda.
Detectează automat limba și răspunde natural.

Returnează un JSON cu următoarea structură:
{
    "response_text": "Răspunsul vocal pentru utilizator (în limba detectată)",
    "detected_language": "codul limbii (ro, en, de, fr, es, it, etc.)",
    "action_type": "unul din: call, sms, open_app, read_messages, read_notifications, time, camera, settings, find_phone, greeting, help, unknown",
    "action_data": {
        "contact_name": "numele contactului (dacă e apel sau SMS)",
        "message": "mesajul de trimis (dacă e SMS)",
        "app_name": "numele aplicației (dacă e deschidere aplicație)",
        "setting_name": "setarea de modificat (dacă sunt setări)",
        "setting_value": "valoarea nouă"
    }
}

Exemple de comenzi și acțiuni:
- "Sună pe Maria" -> action_type: "call", action_data: {"contact_name": "Maria"}
- "Trimite mesaj lui Ion: Vin în 5 minute" -> action_type: "sms"
- "Ce oră este?" -> action_type: "time"
- "Deschide WhatsApp" -> action_type: "open_app"
- "Citește mesajele" -> action_type: "read_messages"
- "Citește notificările" -> action_type: "read_notifications"
- "Activează camera" -> action_type: "camera"
- "Elyn unde ești?" / "Ely unde ești?" -> action_type: "find_phone"

Fii prietenos, cald și empatic. Răspunde clar și concis pentru a fi ușor de înțeles când este citit cu voce."""
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=f"Comandă vocală: {text}")
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        try:
            # Try to extract JSON from response
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            result = json.loads(response_text.strip())
            return result
        except json.JSONDecodeError:
            # If not valid JSON, create a simple response
            return {
                "response_text": response,
                "detected_language": language or "ro",
                "action_type": "unknown",
                "action_data": None
            }
            
    except Exception as e:
        logger.error(f"Error processing voice command: {e}")
        return {
            "response_text": "Îmi pare rău, a apărut o eroare. Te rog încearcă din nou.",
            "detected_language": "ro",
            "action_type": "error",
            "action_data": {"error": str(e)}
        }

async def analyze_image_for_blind(image_base64: str, language: str = "ro") -> dict:
    """Analyze image for obstacles and objects to help blind users"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"image-analysis-{uuid.uuid4()}",
            system_message=f"""Ești un asistent vizual pentru persoane nevăzătoare. 
Analizează imaginea și descrie CE VEZI în mod CLAR și UTIL pentru navigare.

Răspunde în limba: {language}

Returnează JSON cu:
{{
    "description": "Descriere clară și concisă a scenei (max 2 propoziții)",
    "objects_detected": ["listă cu obiectele principale detectate"],
    "obstacles": ["obstacole sau pericole detectate care trebuie evitate"],
    "guidance": "Instrucțiuni clare de navigare/ghidare pentru persoana nevăzătoare"
}}

IMPORTANT:
- Descrie distanțele aproximative (aproape, la câțiva metri, departe)
- Menționează direcțiile (în față, la stânga, la dreapta)
- Evidențiază PERICOLELE mai întâi (scări, borduri, obstacole)
- Folosește un limbaj simplu și direct
- Fii specific despre culori și forme pentru orientare"""
        ).with_model("openai", "gpt-4o")
        
        image_content = ImageContent(image_base64=image_base64)
        user_message = UserMessage(
            text="Analizează această imagine și ajută-mă să mă orientez. Ce vezi?",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        try:
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            result = json.loads(response_text.strip())
            return result
        except json.JSONDecodeError:
            return {
                "description": response,
                "objects_detected": [],
                "obstacles": [],
                "guidance": "Nu am putut analiza complet imaginea."
            }
            
    except Exception as e:
        logger.error(f"Error analyzing image: {e}")
        return {
            "description": "Eroare la analiza imaginii",
            "objects_detected": [],
            "obstacles": [],
            "guidance": "Te rog încearcă din nou."
        }

# ===== API ROUTES =====

@api_router.get("/")
async def root():
    return {"message": "Ely/Elyn Voice Assistant API", "version": "1.0.0"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Voice Command Processing
@api_router.post("/voice/command", response_model=VoiceCommandResponse)
async def process_voice(request: VoiceCommandRequest):
    """Process a voice command and return the appropriate action"""
    result = await process_voice_command(request.text, request.language)
    return VoiceCommandResponse(
        response_text=result.get("response_text", ""),
        detected_language=result.get("detected_language", "ro"),
        action_type=result.get("action_type", "unknown"),
        action_data=result.get("action_data")
    )

# Image Analysis for Navigation
@api_router.post("/vision/analyze", response_model=ImageAnalysisResponse)
async def analyze_image(request: ImageAnalysisRequest):
    """Analyze an image to help blind users navigate"""
    result = await analyze_image_for_blind(request.image_base64, request.language)
    return ImageAnalysisResponse(
        description=result.get("description", ""),
        objects_detected=result.get("objects_detected", []),
        obstacles=result.get("obstacles", []),
        guidance=result.get("guidance", "")
    )

# User Settings
@api_router.get("/settings")
async def get_settings():
    """Get user settings"""
    settings = await db.user_settings.find_one({})
    if not settings:
        # Create default settings
        default_settings = UserSettings()
        await db.user_settings.insert_one(default_settings.dict())
        return default_settings
    return UserSettings(**settings)

@api_router.put("/settings")
async def update_settings(update: UserSettingsUpdate):
    """Update user settings"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Update voice name based on type
    if update.voice_type == "female":
        update_data["voice_name"] = "Ely"
    elif update.voice_type == "male":
        update_data["voice_name"] = "Elyn"
    
    result = await db.user_settings.find_one_and_update(
        {},
        {"$set": update_data},
        upsert=True,
        return_document=True
    )
    
    if result:
        return UserSettings(**result)
    return await get_settings()

# Greeting endpoint
@api_router.get("/greeting")
async def get_greeting():
    """Get the assistant greeting based on current settings"""
    settings = await get_settings()
    voice_name = settings.voice_name
    
    greetings = {
        "ro": f"Bună! Eu sunt {voice_name}, asistentul tău vocal. Spune-mi ce pot face pentru tine.",
        "en": f"Hello! I am {voice_name}, your voice assistant. Tell me what I can do for you.",
        "de": f"Hallo! Ich bin {voice_name}, dein Sprachassistent. Sag mir, was ich für dich tun kann.",
        "fr": f"Bonjour! Je suis {voice_name}, ton assistant vocal. Dis-moi ce que je peux faire pour toi.",
        "es": f"¡Hola! Soy {voice_name}, tu asistente de voz. Dime qué puedo hacer por ti.",
        "it": f"Ciao! Sono {voice_name}, il tuo assistente vocale. Dimmi cosa posso fare per te."
    }
    
    return {
        "greeting": greetings.get(settings.preferred_language, greetings["ro"]),
        "voice_name": voice_name,
        "voice_type": settings.voice_type,
        "language": settings.preferred_language
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
