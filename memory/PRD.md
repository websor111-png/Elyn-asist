# Ely/Elyn - Asistent Vocal pentru Nevăzători

## Descriere
Aplicație de accesibilitate cu AI pentru persoane nevăzătoare, care oferă control vocal complet al telefonului.

## Funcționalități Implementate

### 1. Asistent Vocal AI
- **Comenzi vocale multi-limbă**: Detectare automată a limbii (RO, EN, DE, FR, ES, IT)
- **Răspuns în aceeași limbă**: AI răspunde în limba în care a fost întrebat
- **Acțiuni suportate**:
  - Anunțare oră
  - Apelare contacte
  - Trimitere SMS
  - Deschidere aplicații
  - Citire notificări
  - Setări telefon
  - Căutare telefon

### 2. Ghidare Vizuală cu Cameră
- Recunoaștere obiecte prin AI Vision
- Detectare obstacole
- Ghidare audio pentru navigare
- Suport cameră frontală/spate

### 3. Voce Personalizabilă
- **Ely** - Voce feminină
- **Elyn** - Voce masculină
- Salut personalizat: "Bună, eu sunt Ely/Elyn, asistentul tău vocal..."

### 4. Funcție "Găsește Telefonul"
- Răspunde când este strigat pe nume
- Vorbește continuu până când utilizatorul confirmă că l-a găsit

### 5. Interfață Accesibilă
- Butoane mari (min 44px) pentru touch
- Contrast ridicat
- Feedback haptic (vibrații)
- Design minimalist

## Tehnologii Utilizate
- **Frontend**: React Native / Expo
- **Backend**: FastAPI + MongoDB
- **AI**: OpenAI GPT-4o (via Emergent LLM Key)
- **Text-to-Speech**: expo-speech
- **Cameră**: expo-camera

## Limbi Suportate
- Română 🇷🇴
- English 🇬🇧
- Deutsch 🇩🇪
- Français 🇫🇷
- Español 🇪🇸
- Italiano 🇮🇹

## API Endpoints

### GET /api/
Informații despre API

### GET /api/greeting
Obține salutul asistentului

### GET /api/settings
Obține setările utilizatorului

### PUT /api/settings
Actualizează setările (voce, limbă)

### POST /api/voice/command
Procesează comandă vocală
```json
{
  "text": "Ce oră este?",
  "language": "ro"
}
```

### POST /api/vision/analyze
Analizează imagine pentru navigare
```json
{
  "image_base64": "...",
  "language": "ro"
}
```

## Status
✅ MVP Complet - Aplicație funcțională
