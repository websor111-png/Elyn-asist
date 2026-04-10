from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
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
import tempfile
import httpx

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
    context: Optional[str] = None  # For medication location tracking

class ImageAnalysisResponse(BaseModel):
    description: str
    objects_detected: List[str]
    obstacles: List[str]
    guidance: str
    medication_location: Optional[str] = None

class UserSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voice_type: str = "female"
    voice_name: str = "Ely"
    preferred_language: str = "ro"
    voice_sample_registered: bool = False
    low_battery_alert: bool = True
    battery_threshold: int = 10
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserSettingsUpdate(BaseModel):
    voice_type: Optional[str] = None
    voice_name: Optional[str] = None
    preferred_language: Optional[str] = None
    voice_sample_registered: Optional[bool] = None
    low_battery_alert: Optional[bool] = None
    battery_threshold: Optional[int] = None

# Contact Model
class Contact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone_number: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ContactCreate(BaseModel):
    name: str
    phone_number: str

# Medication Reminder Model
class MedicationReminder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    medication_name: str
    dosage: str
    reminder_time: str  # Format: HH:MM
    days: List[str]  # ["monday", "tuesday", etc.] or ["daily"]
    notes: Optional[str] = None
    location_description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MedicationReminderCreate(BaseModel):
    medication_name: str
    dosage: str
    reminder_time: str
    days: List[str]
    notes: Optional[str] = None
    location_description: Optional[str] = None

# SMS Model
class SMSMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contact_name: str
    phone_number: str
    message: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "pending"

class SMSSend(BaseModel):
    contact_name: Optional[str] = None
    phone_number: Optional[str] = None
    message: str

# Speech-to-Text Model
class SpeechToTextRequest(BaseModel):
    audio_base64: str
    language: Optional[str] = None  # If None, auto-detect

class SpeechToTextResponse(BaseModel):
    text: str
    detected_language: str
    confidence: float

# ===== AI INTEGRATION =====
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

async def transcribe_audio(audio_base64: str, language: str = None) -> dict:
    """Transcribe audio using OpenAI Whisper API"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI API key not configured")
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(audio_base64)
        
        # Create temp file for audio
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name
        
        try:
            # Call OpenAI Whisper API
            async with httpx.AsyncClient(timeout=60.0) as client:
                with open(temp_path, 'rb') as audio_file:
                    files = {'file': ('audio.wav', audio_file, 'audio/wav')}
                    data = {'model': 'whisper-1'}
                    if language:
                        data['language'] = language
                    
                    response = await client.post(
                        'https://api.openai.com/v1/audio/transcriptions',
                        headers={'Authorization': f'Bearer {api_key}'},
                        files=files,
                        data=data
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        return {
                            'text': result.get('text', ''),
                            'detected_language': language or 'auto',
                            'confidence': 1.0
                        }
                    else:
                        logger.error(f"Whisper API error: {response.text}")
                        return {
                            'text': '',
                            'detected_language': 'unknown',
                            'confidence': 0.0,
                            'error': response.text
                        }
        finally:
            # Clean up temp file
            os.unlink(temp_path)
            
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        return {
            'text': '',
            'detected_language': 'unknown',
            'confidence': 0.0,
            'error': str(e)
        }

async def process_voice_command(text: str, language: str = None, contacts: list = None) -> dict:
    """Process voice command using AI"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI API key not configured")
        
        contacts_info = ""
        if contacts:
            contacts_info = "\n\nContacte disponibile:\n" + "\n".join([f"- {c['name']}: {c['phone_number']}" for c in contacts])
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"voice-cmd-{uuid.uuid4()}",
            system_message=f"""Ești Ely/Elyn, un asistent vocal inteligent pentru persoane nevăzătoare. 
            
Analizează comanda utilizatorului și răspunde în aceeași limbă în care a fost formulată comanda.
Detectează automat limba și răspunde natural.
{contacts_info}

Returnează un JSON cu următoarea structură:
{{
    "response_text": "Răspunsul vocal pentru utilizator (în limba detectată)",
    "detected_language": "codul limbii (ro, en, de, fr, es, it, etc.)",
    "action_type": "unul din: call, sms, open_app, read_messages, read_notifications, time, camera, settings, find_phone, greeting, help, add_contact, add_medication, check_medication, battery_status, unknown",
    "action_data": {{
        "contact_name": "numele contactului (dacă e apel sau SMS)",
        "phone_number": "numărul de telefon",
        "message": "mesajul de trimis (dacă e SMS)",
        "app_name": "numele aplicației (dacă e deschidere aplicație)",
        "medication_name": "numele medicamentului",
        "medication_dosage": "doza",
        "medication_time": "ora HH:MM",
        "medication_days": ["daily"] sau ["monday", "tuesday", etc.]
    }}
}}

Exemple de comenzi și acțiuni:
- "Sună pe Maria" -> action_type: "call", action_data: {{"contact_name": "Maria"}}
- "Trimite mesaj lui Ion: Vin în 5 minute" -> action_type: "sms", action_data: {{"contact_name": "Ion", "message": "Vin în 5 minute"}}
- "Adaugă contact Maria cu numărul 0722123456" -> action_type: "add_contact", action_data: {{"contact_name": "Maria", "phone_number": "0722123456"}}
- "Ce oră este?" -> action_type: "time"
- "Amintește-mi să iau Aspirina la ora 8 dimineața" -> action_type: "add_medication"
- "Unde am pus medicamentele?" -> action_type: "check_medication"
- "Cât la sută baterie am?" -> action_type: "battery_status"
- "Elyn unde ești?" / "Ely unde ești?" -> action_type: "find_phone"

Fii prietenos, cald și empatic. Răspunde clar și concis pentru a fi ușor de înțeles când este citit cu voce."""
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=f"Comandă vocală: {text}")
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

async def analyze_image_for_blind(image_base64: str, language: str = "ro", context: str = None) -> dict:
    """Analyze image for obstacles and objects to help blind users"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI API key not configured")
        
        medication_context = ""
        if context == "medication":
            medication_context = """
CONTEXT SPECIAL: Utilizatorul caută să memoreze unde pune medicamentele.
Pe lângă descrierea normală, adaugă și câmpul "medication_location" cu o descriere 
detaliată a locului unde se află medicamentele (ex: "pe raftul din stânga dulapului alb din bucătărie")."""
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"image-analysis-{uuid.uuid4()}",
            system_message=f"""Ești un asistent vizual pentru persoane nevăzătoare. 
Analizează imaginea și descrie CE VEZI în mod CLAR și UTIL pentru navigare.
{medication_context}

Răspunde în limba: {language}

Returnează JSON cu:
{{
    "description": "Descriere clară și concisă a scenei (max 2 propoziții)",
    "objects_detected": ["listă cu obiectele principale detectate"],
    "obstacles": ["obstacole sau pericole detectate care trebuie evitate"],
    "guidance": "Instrucțiuni clare de navigare/ghidare pentru persoana nevăzătoare",
    "medication_location": "Descriere detaliată a locului unde sunt medicamentele (doar dacă contextul este medication)"
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
                "guidance": "Nu am putut analiza complet imaginea.",
                "medication_location": None
            }
            
    except Exception as e:
        logger.error(f"Error analyzing image: {e}")
        return {
            "description": "Eroare la analiza imaginii",
            "objects_detected": [],
            "obstacles": [],
            "guidance": "Te rog încearcă din nou.",
            "medication_location": None
        }

# ===== API ROUTES =====

@api_router.get("/")
async def root():
    return {"message": "Ely/Elyn Voice Assistant API", "version": "2.0.0", "brand": "Brend Elyn", "creator": "Creiat de Ciorpac Sorin"}

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
    # Get contacts for context
    contacts = await db.contacts.find().to_list(100)
    contacts_list = [{"name": c["name"], "phone_number": c["phone_number"]} for c in contacts]
    
    result = await process_voice_command(request.text, request.language, contacts_list)
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
    result = await analyze_image_for_blind(request.image_base64, request.language, request.context)
    return ImageAnalysisResponse(
        description=result.get("description", ""),
        objects_detected=result.get("objects_detected", []),
        obstacles=result.get("obstacles", []),
        guidance=result.get("guidance", ""),
        medication_location=result.get("medication_location")
    )

# ===== SPEECH-TO-TEXT API =====

@api_router.post("/speech/transcribe", response_model=SpeechToTextResponse)
async def transcribe_speech(request: SpeechToTextRequest):
    """Transcribe audio to text using OpenAI Whisper"""
    result = await transcribe_audio(request.audio_base64, request.language)
    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])
    return SpeechToTextResponse(
        text=result.get("text", ""),
        detected_language=result.get("detected_language", "unknown"),
        confidence=result.get("confidence", 0.0)
    )

@api_router.post("/speech/transcribe-and-process")
async def transcribe_and_process(request: SpeechToTextRequest):
    """Transcribe audio and immediately process as voice command"""
    # First transcribe
    transcription = await transcribe_audio(request.audio_base64, request.language)
    if 'error' in transcription or not transcription.get('text'):
        return {
            "transcription": transcription,
            "command_response": None,
            "error": "Failed to transcribe audio"
        }
    
    # Then process as voice command
    contacts = await db.contacts.find().to_list(100)
    contacts_list = [{"name": c["name"], "phone_number": c["phone_number"]} for c in contacts]
    
    command_result = await process_voice_command(
        transcription['text'], 
        transcription.get('detected_language'),
        contacts_list
    )
    
    return {
        "transcription": {
            "text": transcription['text'],
            "detected_language": transcription.get('detected_language', 'auto'),
            "confidence": transcription.get('confidence', 1.0)
        },
        "command_response": {
            "response_text": command_result.get("response_text", ""),
            "detected_language": command_result.get("detected_language", "ro"),
            "action_type": command_result.get("action_type", "unknown"),
            "action_data": command_result.get("action_data")
        }
    }

# ===== CONTACTS API =====

@api_router.get("/contacts", response_model=List[Contact])
async def get_contacts():
    """Get all contacts"""
    contacts = await db.contacts.find().to_list(100)
    return [Contact(**contact) for contact in contacts]

@api_router.post("/contacts", response_model=Contact)
async def create_contact(contact: ContactCreate):
    """Create a new contact"""
    contact_obj = Contact(**contact.dict())
    await db.contacts.insert_one(contact_obj.dict())
    return contact_obj

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str):
    """Delete a contact"""
    result = await db.contacts.delete_one({"id": contact_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted"}

# ===== MEDICATION REMINDERS API =====

@api_router.get("/medications", response_model=List[MedicationReminder])
async def get_medications():
    """Get all medication reminders"""
    medications = await db.medications.find().to_list(100)
    return [MedicationReminder(**med) for med in medications]

@api_router.post("/medications", response_model=MedicationReminder)
async def create_medication(medication: MedicationReminderCreate):
    """Create a new medication reminder"""
    med_obj = MedicationReminder(**medication.dict())
    await db.medications.insert_one(med_obj.dict())
    return med_obj

@api_router.put("/medications/{medication_id}")
async def update_medication(medication_id: str, medication: MedicationReminderCreate):
    """Update a medication reminder"""
    update_data = medication.dict()
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.medications.find_one_and_update(
        {"id": medication_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Medication not found")
    return MedicationReminder(**result)

@api_router.delete("/medications/{medication_id}")
async def delete_medication(medication_id: str):
    """Delete a medication reminder"""
    result = await db.medications.delete_one({"id": medication_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    return {"message": "Medication reminder deleted"}

@api_router.get("/medications/due")
async def get_due_medications():
    """Get medications due now (within 5 minutes)"""
    now = datetime.utcnow()
    current_time = now.strftime("%H:%M")
    current_day = now.strftime("%A").lower()
    
    medications = await db.medications.find({"is_active": True}).to_list(100)
    due_medications = []
    
    for med in medications:
        if "daily" in med.get("days", []) or current_day in med.get("days", []):
            reminder_time = med.get("reminder_time", "")
            if reminder_time:
                # Check if within 5 minutes
                reminder_hour, reminder_min = map(int, reminder_time.split(":"))
                current_hour, current_min = map(int, current_time.split(":"))
                
                diff = abs((reminder_hour * 60 + reminder_min) - (current_hour * 60 + current_min))
                if diff <= 5:
                    due_medications.append(MedicationReminder(**med))
    
    return due_medications

# ===== SMS API =====

@api_router.post("/sms/send")
async def send_sms(sms: SMSSend):
    """Send an SMS (stores in database, actual sending done on device)"""
    # Find contact if only name provided
    phone = sms.phone_number
    if not phone and sms.contact_name:
        contact = await db.contacts.find_one({"name": {"$regex": sms.contact_name, "$options": "i"}})
        if contact:
            phone = contact["phone_number"]
        else:
            raise HTTPException(status_code=404, detail=f"Contact {sms.contact_name} not found")
    
    if not phone:
        raise HTTPException(status_code=400, detail="No phone number provided")
    
    sms_obj = SMSMessage(
        contact_name=sms.contact_name or "Unknown",
        phone_number=phone,
        message=sms.message
    )
    
    await db.sms_messages.insert_one(sms_obj.dict())
    return {"message": "SMS prepared for sending", "sms": sms_obj.dict()}

@api_router.get("/sms/history", response_model=List[SMSMessage])
async def get_sms_history():
    """Get SMS history"""
    messages = await db.sms_messages.find().sort("sent_at", -1).to_list(50)
    return [SMSMessage(**msg) for msg in messages]

# User Settings
@api_router.get("/settings")
async def get_settings():
    """Get user settings"""
    settings = await db.user_settings.find_one({})
    if not settings:
        default_settings = UserSettings()
        await db.user_settings.insert_one(default_settings.dict())
        return default_settings
    return UserSettings(**settings)

@api_router.put("/settings")
async def update_settings(update: UserSettingsUpdate):
    """Update user settings"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
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
        "language": settings.preferred_language,
        "brand": "Brend Elyn",
        "creator": "Creiat de Ciorpac Sorin"
    }

# Brand Info
@api_router.get("/brand")
async def get_brand_info():
    """Get brand information"""
    return {
        "brand_name": "Brend Elyn",
        "creator": "Creiat de Ciorpac Sorin",
        "version": "2.0.0",
        "app_name": "Elyn Voice Assistant"
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
