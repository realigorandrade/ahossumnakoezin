from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timedelta, timezone, date

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'kwe-ahossum-secret-change-in-prod-2026')
JWT_ALG = 'HS256'
ACCESS_TOKEN_HOURS = 24 * 7

app = FastAPI()
api_router = APIRouter(prefix="/api")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ---------- Helpers ----------
def now_utc():
    return datetime.now(timezone.utc)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(pw: str, stored: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), stored.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now_utc(),
        "exp": now_utc() + timedelta(hours=ACCESS_TOKEN_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Token inválido")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    return user


async def admin_required(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Acesso restrito ao administrador")
    return user


# ---------- Models ----------
class RegisterIn(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    birthdate: str  # ISO date YYYY-MM-DD
    password: str
    confirm_password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None


class BookingCreate(BaseModel):
    service_id: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    modality: Literal["presencial", "online"]
    terms_accepted: bool


class BookingStatusUpdate(BaseModel):
    status: Literal["aguardando_pagamento", "confirmado", "concluido", "cancelado"]


class ServiceUpdate(BaseModel):
    price: Optional[float] = None
    observations: Optional[List[str]] = None
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    image: Optional[str] = None
    modalities: Optional[List[str]] = None
    short_desc: Optional[str] = None


class BlockedSlotIn(BaseModel):
    date: str
    time: Optional[str] = None  # if None, blocks entire day


class WorkingHoursUpdate(BaseModel):
    start: str  # HH:MM
    end: str    # HH:MM
    slot_minutes: int = 90
    weekdays: List[int]  # 0=Mon .. 6=Sun


class HolidayIn(BaseModel):
    date: str
    label: str


class ServiceUpdateFull(BaseModel):
    name: Optional[str] = None
    short_desc: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    modalities: Optional[List[str]] = None
    image: Optional[str] = None
    observations: Optional[List[str]] = None


class EventIn(BaseModel):
    title: str
    description: Optional[str] = ""
    date: Optional[str] = None      # YYYY-MM-DD (single date)
    time: Optional[str] = None      # HH:MM
    recurrence: Optional[str] = None  # e.g. "Todas as segundas-feiras"
    month: Optional[str] = None     # display month label
    category: Optional[str] = "geral"


class GiraUpdate(BaseModel):
    weekday: int  # 0=Mon..6=Sun
    time: str
    note: Optional[str] = ""


class PaymentSettingsIn(BaseModel):
    pix_key: Optional[str] = None
    pix_holder: Optional[str] = None
    support_whatsapp: Optional[str] = None


# ---------- Auth ----------
@api_router.post("/auth/register")
async def register(body: RegisterIn):
    if body.password != body.confirm_password:
        raise HTTPException(400, "As senhas não coincidem")
    if len(body.password) < 6:
        raise HTTPException(400, "A senha deve ter no mínimo 6 caracteres")
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(409, "E-mail já cadastrado")
    user = {
        "id": str(uuid.uuid4()),
        "full_name": body.full_name.strip(),
        "email": email,
        "phone": body.phone.strip(),
        "birthdate": body.birthdate,
        "password_hash": hash_password(body.password),
        "role": "user",
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    await enqueue_notification("new_user", {
        "name": user["full_name"], "email": user["email"], "phone": user["phone"],
    })
    token = create_token(user["id"], user["role"])
    return {
        "access_token": token,
        "user": {
            "id": user["id"], "full_name": user["full_name"], "email": user["email"],
            "phone": user["phone"], "birthdate": user["birthdate"], "role": user["role"],
        }
    }


@api_router.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "E-mail ou senha incorretos")
    token = create_token(user["id"], user["role"])
    return {
        "access_token": token,
        "user": {
            "id": user["id"], "full_name": user["full_name"], "email": user["email"],
            "phone": user["phone"], "birthdate": user.get("birthdate", ""), "role": user["role"],
        }
    }


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@api_router.put("/auth/profile")
async def update_profile(body: ProfileUpdate, user=Depends(get_current_user)):
    updates = {}
    if body.full_name is not None:
        updates["full_name"] = body.full_name.strip()
    if body.phone is not None:
        updates["phone"] = body.phone.strip()
    if body.email is not None:
        new_email = body.email.lower()
        if new_email != user["email"]:
            exists = await db.users.find_one({"email": new_email, "id": {"$ne": user["id"]}})
            if exists:
                raise HTTPException(409, "E-mail já em uso")
            updates["email"] = new_email
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(400, "Senha muito curta")
        updates["password_hash"] = hash_password(body.password)
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated


# ---------- Services ----------
@api_router.get("/services")
async def list_services():
    services = await db.services.find({}, {"_id": 0}).to_list(50)
    return services


@api_router.get("/services/{service_id}")
async def get_service(service_id: str):
    svc = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Serviço não encontrado")
    return svc


@api_router.put("/admin/services/{service_id}")
async def admin_update_service(service_id: str, body: ServiceUpdate, admin=Depends(admin_required)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nada para atualizar")
    result = await db.services.update_one({"id": service_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Serviço não encontrado")
    svc = await db.services.find_one({"id": service_id}, {"_id": 0})
    return svc


# ---------- Settings / Working Hours ----------
async def get_settings():
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {
            "id": "global",
            "working_hours": {
                "start": "10:00", "end": "18:00", "slot_minutes": 90,
                "weekdays": [0, 1, 2, 3, 4, 5],  # Mon-Sat
            },
            "pix_key": "ahossumnakoezin@gmail.com",
            "pix_holder": "Eliton Batista",
            "support_whatsapp": "+5519988371125",
            "gira": {
                "weekday": 2,        # 0=Mon..6=Sun (2=Wed)
                "time": "19:30",
                "note": "Horário sujeito a alterações.",
            },
        }
        await db.settings.insert_one(s)
        s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    # Ensure new keys exist even in already-seeded DBs
    updates = {}
    if "pix_key" not in s:
        updates["pix_key"] = "ahossumnakoezin@gmail.com"
    if "pix_holder" not in s:
        updates["pix_holder"] = "Eliton Batista"
    if "support_whatsapp" not in s:
        updates["support_whatsapp"] = "+5519988371125"
    if "gira" not in s:
        updates["gira"] = {"weekday": 2, "time": "19:30", "note": "Horário sujeito a alterações."}
    if updates:
        await db.settings.update_one({"id": "global"}, {"$set": updates})
        s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    return s


@api_router.get("/settings")
async def read_settings():
    """Public settings (PIX key, WhatsApp support, working hours, gira schedule)."""
    return await get_settings()


@api_router.put("/admin/payment-settings")
async def update_payment_settings(body: PaymentSettingsIn, admin=Depends(admin_required)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nada para atualizar")
    await db.settings.update_one({"id": "global"}, {"$set": updates}, upsert=True)
    return await get_settings()


@api_router.put("/admin/gira")
async def update_gira(body: GiraUpdate, admin=Depends(admin_required)):
    await db.settings.update_one(
        {"id": "global"},
        {"$set": {"gira": body.dict()}},
        upsert=True,
    )
    return await get_settings()


# ---------- Events ----------
@api_router.get("/events")
async def list_events():
    items = await db.events.find({}, {"_id": 0}).to_list(500)
    # Sort by date if present, else by created_at
    def _key(e):
        return (e.get("date") or "9999-99-99", e.get("time") or "99:99")
    items.sort(key=_key)
    return items


@api_router.post("/admin/events")
async def add_event(body: EventIn, admin=Depends(admin_required)):
    entry = {"id": str(uuid.uuid4()), **body.dict(), "created_at": now_utc().isoformat()}
    await db.events.insert_one(entry)
    entry.pop("_id", None)
    return entry


@api_router.put("/admin/events/{eid}")
async def edit_event(eid: str, body: EventIn, admin=Depends(admin_required)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    result = await db.events.update_one({"id": eid}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Evento não encontrado")
    return await db.events.find_one({"id": eid}, {"_id": 0})


@api_router.delete("/admin/events/{eid}")
async def del_event(eid: str, admin=Depends(admin_required)):
    await db.events.delete_one({"id": eid})
    return {"ok": True}


# ---------- Admin: create/delete services ----------
@api_router.post("/admin/services")
async def admin_create_service(body: ServiceUpdate, admin=Depends(admin_required)):
    data = {k: v for k, v in body.dict().items() if v is not None}
    if "name" not in data:
        raise HTTPException(400, "Nome é obrigatório")
    data["id"] = str(uuid.uuid4())[:8]
    data.setdefault("modalities", ["presencial"])
    data.setdefault("observations", [])
    data.setdefault("duration_minutes", 60)
    data.setdefault("price", 0)
    data.setdefault("image", "")
    data.setdefault("short_desc", "")
    data.setdefault("description", "")
    await db.services.insert_one(data)
    return {k: v for k, v in data.items() if k != "_id"}


@api_router.delete("/admin/services/{service_id}")
async def admin_delete_service(service_id: str, admin=Depends(admin_required)):
    await db.services.delete_one({"id": service_id})
    return {"ok": True}


# ---------- Notification queue (structure for WhatsApp) ----------
async def enqueue_notification(kind: str, payload: dict):
    """Store a notification event so admin can review or a future WhatsApp worker
    can deliver via +5519988371125. Structure only — no live send here."""
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "kind": kind,
        "payload": payload,
        "status": "pending",
        "created_at": now_utc().isoformat(),
    })


@api_router.get("/admin/notifications")
async def admin_notifications(admin=Depends(admin_required)):
    items = await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.put("/admin/working-hours")
async def set_working_hours(body: WorkingHoursUpdate, admin=Depends(admin_required)):
    await db.settings.update_one(
        {"id": "global"},
        {"$set": {"working_hours": body.dict()}},
        upsert=True,
    )
    return await get_settings()


# ---------- Blocked / Holidays ----------
@api_router.get("/admin/blocked")
async def list_blocked(admin=Depends(admin_required)):
    return await db.blocked.find({}, {"_id": 0}).to_list(1000)


@api_router.post("/admin/blocked")
async def add_blocked(body: BlockedSlotIn, admin=Depends(admin_required)):
    entry = {"id": str(uuid.uuid4()), "date": body.date, "time": body.time}
    await db.blocked.insert_one(entry)
    entry.pop("_id", None)
    return entry


@api_router.delete("/admin/blocked/{block_id}")
async def del_blocked(block_id: str, admin=Depends(admin_required)):
    await db.blocked.delete_one({"id": block_id})
    return {"ok": True}


@api_router.get("/admin/holidays")
async def list_holidays(admin=Depends(admin_required)):
    return await db.holidays.find({}, {"_id": 0}).to_list(1000)


@api_router.post("/admin/holidays")
async def add_holiday(body: HolidayIn, admin=Depends(admin_required)):
    entry = {"id": str(uuid.uuid4()), "date": body.date, "label": body.label}
    await db.holidays.insert_one(entry)
    entry.pop("_id", None)
    return entry


@api_router.delete("/admin/holidays/{hid}")
async def del_holiday(hid: str, admin=Depends(admin_required)):
    await db.holidays.delete_one({"id": hid})
    return {"ok": True}


# ---------- Available Slots ----------
def gen_time_slots(start: str, end: str, slot_min: int) -> List[str]:
    sh, sm = map(int, start.split(":"))
    eh, em = map(int, end.split(":"))
    start_min = sh * 60 + sm
    end_min = eh * 60 + em
    out = []
    cur = start_min
    while cur + slot_min <= end_min:
        out.append(f"{cur // 60:02d}:{cur % 60:02d}")
        cur += slot_min
    return out


@api_router.get("/slots")
async def available_slots(date_str: str = Query(..., alias="date")):
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Data inválida (use YYYY-MM-DD)")
    settings = await get_settings()
    wh = settings["working_hours"]
    weekday = d.weekday()
    if weekday not in wh["weekdays"]:
        return {"date": date_str, "slots": []}
    # Holidays
    hol = await db.holidays.find_one({"date": date_str})
    if hol:
        return {"date": date_str, "slots": []}
    # All-day block?
    day_block = await db.blocked.find_one({"date": date_str, "time": None})
    if day_block:
        return {"date": date_str, "slots": []}
    all_slots = gen_time_slots(wh["start"], wh["end"], wh["slot_minutes"])
    # Filter blocked times
    blocked_times = set()
    async for b in db.blocked.find({"date": date_str, "time": {"$ne": None}}):
        blocked_times.add(b["time"])
    # Filter already-booked (any active status)
    async for booking in db.bookings.find({
        "date": date_str,
        "status": {"$in": ["aguardando_pagamento", "confirmado", "concluido"]}
    }):
        blocked_times.add(booking["time"])
    # For today: also filter past hours
    now_local = now_utc()
    available = []
    for s in all_slots:
        if s in blocked_times:
            continue
        available.append(s)
    return {"date": date_str, "slots": available}


# ---------- Bookings ----------
@api_router.post("/bookings")
async def create_booking(body: BookingCreate, user=Depends(get_current_user)):
    if not body.terms_accepted:
        raise HTTPException(400, "É necessário aceitar as observações")
    svc = await db.services.find_one({"id": body.service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Serviço não encontrado")
    if body.modality not in svc["modalities"]:
        raise HTTPException(400, "Modalidade inválida para este serviço")
    # Check slot availability
    exists = await db.bookings.find_one({
        "date": body.date, "time": body.time,
        "status": {"$in": ["aguardando_pagamento", "confirmado", "concluido"]}
    })
    if exists:
        raise HTTPException(409, "Este horário já foi reservado")
    # Verify slot is in generated slots
    settings = await get_settings()
    wh = settings["working_hours"]
    try:
        d = datetime.strptime(body.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Data inválida")
    if d.weekday() not in wh["weekdays"]:
        raise HTTPException(400, "Data indisponível (fora do horário de atendimento)")
    all_slots = gen_time_slots(wh["start"], wh["end"], wh["slot_minutes"])
    if body.time not in all_slots:
        raise HTTPException(400, "Horário inválido")
    blocked = await db.blocked.find_one({"date": body.date, "$or": [{"time": None}, {"time": body.time}]})
    if blocked:
        raise HTTPException(400, "Data ou horário bloqueado")
    hol = await db.holidays.find_one({"date": body.date})
    if hol:
        raise HTTPException(400, "Data indisponível (feriado)")

    booking = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "user_email": user["email"],
        "user_phone": user["phone"],
        "service_id": svc["id"],
        "service_name": svc["name"],
        "price": svc["price"],
        "date": body.date,
        "time": body.time,
        "modality": body.modality,
        "status": "aguardando_pagamento",
        "created_at": now_utc().isoformat(),
    }
    await db.bookings.insert_one(booking)
    await enqueue_notification("new_booking", {
        "user_name": booking["user_name"], "user_phone": booking["user_phone"],
        "service": booking["service_name"], "date": booking["date"],
        "time": booking["time"], "modality": booking["modality"],
        "price": booking["price"],
    })
    booking.pop("_id", None)
    return booking


@api_router.get("/bookings/me")
async def my_bookings(user=Depends(get_current_user)):
    items = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.delete("/bookings/{bid}")
async def cancel_my_booking(bid: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid})
    if not b:
        raise HTTPException(404, "Agendamento não encontrado")
    if b["user_id"] != user["id"]:
        raise HTTPException(403, "Sem permissão")
    if b["status"] == "concluido":
        raise HTTPException(400, "Agendamento já concluído")
    await db.bookings.update_one({"id": bid}, {"$set": {"status": "cancelado"}})
    return {"ok": True}


# ---------- Admin Bookings ----------
@api_router.get("/admin/bookings")
async def admin_list_bookings(
    date_filter: Optional[str] = Query(None, alias="date"),
    service_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    admin=Depends(admin_required),
):
    q = {}
    if date_filter:
        q["date"] = date_filter
    if service_id:
        q["service_id"] = service_id
    if status_filter:
        q["status"] = status_filter
    items = await db.bookings.find(q, {"_id": 0}).sort("date", -1).to_list(1000)
    return items


@api_router.put("/admin/bookings/{bid}/status")
async def admin_change_status(bid: str, body: BookingStatusUpdate, admin=Depends(admin_required)):
    result = await db.bookings.update_one({"id": bid}, {"$set": {"status": body.status}})
    if result.matched_count == 0:
        raise HTTPException(404, "Agendamento não encontrado")
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    return b


@api_router.post("/admin/bookings/{bid}/confirm-payment")
async def admin_confirm_payment(bid: str, admin=Depends(admin_required)):
    result = await db.bookings.update_one(
        {"id": bid, "status": "aguardando_pagamento"},
        {"$set": {"status": "confirmado", "payment_confirmed_at": now_utc().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Agendamento não encontrado ou já processado")
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    return b


@api_router.get("/admin/clients")
async def admin_list_clients(admin=Depends(admin_required)):
    items = await db.users.find({"role": "user"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return items


@api_router.get("/admin/stats")
async def admin_stats(admin=Depends(admin_required)):
    today = now_utc().date().isoformat()
    pending = await db.bookings.count_documents({"status": "aguardando_pagamento"})
    confirmed_today = await db.bookings.count_documents({"date": today, "status": "confirmado"})
    total = await db.bookings.count_documents({})
    clients = await db.users.count_documents({"role": "user"})
    # Revenue: sum of confirmed + concluido
    revenue = 0
    async for b in db.bookings.find({"status": {"$in": ["confirmado", "concluido"]}}):
        revenue += b.get("price", 0)
    return {
        "pending": pending,
        "confirmed_today": confirmed_today,
        "total_bookings": total,
        "total_clients": clients,
        "total_revenue": revenue,
    }


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"message": "KWE AHOSSUM NAKÓ EZIN API", "ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------- Startup seed ----------
@app.on_event("startup")
async def seed_data():
    # Seed admin
    admin_email = "admin@kwe.com"
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "full_name": "Eliton d'Ajauncy",
            "email": admin_email,
            "phone": "+55 00 00000-0000",
            "birthdate": "1980-01-01",
            "password_hash": hash_password("Admin@123"),
            "role": "admin",
            "created_at": now_utc().isoformat(),
        })
        logger.info("Admin seeded: admin@kwe.com / Admin@123")

    # Seed services
    obs_online_presencial = [
        "O atendimento somente será confirmado após o pagamento.",
        "Compareça no horário marcado.",
        "Em caso de atraso superior a 15 minutos, será necessário novo agendamento.",
        "Caso seja atendimento online, o link será enviado após a confirmação do pagamento.",
        "Não há devolução do valor em caso de desistência.",
        "Reagendamento deve ser solicitado com pelo menos 24 horas de antecedência.",
    ]
    obs_presencial_only = [
        "Atendimento exclusivamente presencial.",
        "Compareça com 15 minutos de antecedência.",
        "O atendimento somente será confirmado após o pagamento.",
        "Em caso de atraso superior a 15 minutos será necessário novo agendamento.",
        "Não há devolução do valor pago.",
        "Reagendamento apenas com 24 horas de antecedência.",
    ]
    services = [
        {
            "id": "tarot",
            "name": "Jogo de Tarot",
            "short_desc": "Consulta espiritual através do Tarot para orientação, autoconhecimento e direcionamentos.",
            "description": "Consulta espiritual através do Tarot para orientação, autoconhecimento e direcionamentos.",
            "price": 150.00,
            "duration_minutes": 60,
            "modalities": ["presencial", "online"],
            "image": "https://images.unsplash.com/photo-1613738053817-7f0983aa456d?fm=jpg&q=85&w=1400&auto=format&fit=crop",
            "observations": obs_online_presencial,
            "category": "consulta",
        },
        {
            "id": "buzios",
            "name": "Jogo de Búzios",
            "short_desc": "Consulta espiritual através do Jogo de Búzios para orientação, autoconhecimento e direcionamentos.",
            "description": "Consulta espiritual através do Jogo de Búzios para orientação, autoconhecimento e direcionamentos.",
            "price": 180.00,
            "duration_minutes": 60,
            "modalities": ["presencial", "online"],
            "image": "https://images.unsplash.com/photo-1776164893324-19d102148b2a?fm=jpg&q=85&w=1400&auto=format&fit=crop",
            "observations": obs_online_presencial,
            "category": "consulta",
        },
        {
            "id": "pombo-gira",
            "name": "Atendimento com Pombo Gira Maria Padilha",
            "short_desc": "Atendimento espiritual realizado com a entidade Pombo Gira Maria Padilha.",
            "description": "Atendimento espiritual realizado com a entidade Pombo Gira Maria Padilha.",
            "price": 250.00,
            "duration_minutes": 90,
            "modalities": ["presencial"],
            "image": "https://images.unsplash.com/photo-1615793171257-3fd80dd14091?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwxfHxteXN0aWMlMjBjYW5kbGVzJTIwZGFyayUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzg1ODkwNjI2fDA&ixlib=rb-4.1.0&q=85",
            "observations": obs_presencial_only,
            "category": "consulta",
        },
        {
            "id": "banhos-ervas",
            "name": "Banhos, Ervas e Firmezas",
            "short_desc": "Preparo de banhos energéticos, ervas sagradas e firmezas para limpeza, proteção e prosperidade.",
            "description": "Preparo de banhos energéticos, ervas sagradas e firmezas espirituais para limpeza, proteção, abertura de caminhos e prosperidade. Consulte a casa para escolher o banho ou firmeza adequado ao seu momento.",
            "price": 80.00,
            "duration_minutes": 30,
            "modalities": ["presencial"],
            "image": "https://images.unsplash.com/photo-1470137237906-d8a4f71e1966?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400",
            "observations": [
                "Atendimento exclusivamente presencial.",
                "Compareça com 10 minutos de antecedência.",
                "O preparo somente será entregue após a confirmação do pagamento.",
                "Não há devolução do valor pago.",
                "Reagendamento apenas com 24 horas de antecedência.",
            ],
            "category": "banhos",
        },
    ]
    # Remove old combined service if it exists
    await db.services.delete_one({"id": "buzios-tarot"})
    for svc in services:
        existing_svc = await db.services.find_one({"id": svc["id"]})
        if not existing_svc:
            await db.services.insert_one(svc)
        else:
            # Backfill duration/image/category for existing services
            patch = {}
            if "duration_minutes" not in existing_svc:
                patch["duration_minutes"] = svc["duration_minutes"]
            if "category" not in existing_svc:
                patch["category"] = svc["category"]
            if svc["id"] == "buzios" and existing_svc.get("image", "").find("1518709594023") >= 0:
                patch["image"] = svc["image"]
            if svc["id"] == "tarot" and existing_svc.get("image", "").find("1613738053817") >= 0:
                patch["image"] = svc["image"]
            if patch:
                await db.services.update_one({"id": svc["id"]}, {"$set": patch})

    # Seed events
    events_seed = [
        {
            "id": "obaluae-2025-08",
            "title": "Rezas de Obaluaê",
            "description": "Rezas dedicadas a Obaluaê durante todo o mês de agosto.",
            "recurrence": "Todas as segundas-feiras",
            "month": "Agosto",
            "date": None, "time": "19:30",
            "category": "reza",
        },
        {
            "id": "festa-ere-2025-09",
            "title": "Festa de Erê",
            "description": "Celebração da Festa de Erê na casa espiritual.",
            "date": "2025-09-27", "time": "16:00",
            "month": "Setembro",
            "recurrence": None,
            "category": "festa",
        },
        {
            "id": "festa-mp-2025-10",
            "title": "Festa de Maria Padilha",
            "description": "Celebração da Festa de Maria Padilha.",
            "date": "2025-10-24", "time": None,
            "month": "Outubro",
            "recurrence": None,
            "category": "festa",
        },
    ]
    for ev in events_seed:
        existing_ev = await db.events.find_one({"id": ev["id"]})
        if not existing_ev:
            await db.events.insert_one(ev)
    await get_settings()  # initialize default settings
    logger.info("Seed completed")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
