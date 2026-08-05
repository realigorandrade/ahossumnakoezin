"""Backend tests for KWE AHOSSUM NAKÓ EZIN spiritual booking app."""
import os
import uuid
import time
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://kwe-espiritual.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@kwe.com"
ADMIN_PASSWORD = "Admin@123"


def _next_weekday(offset=1):
    """Return next weekday date string YYYY-MM-DD (Mon-Sat)."""
    d = datetime.utcnow().date() + timedelta(days=offset)
    while d.weekday() == 6:  # skip Sunday
        d += timedelta(days=1)
    return d.isoformat()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def user_creds():
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
    return {"email": email, "password": "teste123", "full_name": "TEST Maria",
            "phone": "+55 11 90000-0000", "birthdate": "1990-05-15"}


@pytest.fixture(scope="module")
def user_token(user_creds):
    payload = {**user_creds, "confirm_password": user_creds["password"]}
    r = requests.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"Register failed: {r.text}"
    return r.json()["access_token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Health ----------
def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ---------- Auth ----------
def test_register_password_mismatch():
    r = requests.post(f"{API}/auth/register", json={
        "full_name": "X", "email": f"TEST_mm_{uuid.uuid4().hex[:6]}@t.com",
        "phone": "1", "birthdate": "1990-01-01",
        "password": "abc123", "confirm_password": "xyz999"
    })
    assert r.status_code == 400


def test_login_admin(admin_token):
    assert isinstance(admin_token, str) and len(admin_token) > 10


def test_login_bad_password():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_auth_me(user_token, user_creds):
    r = requests.get(f"{API}/auth/me", headers=auth(user_token))
    assert r.status_code == 200
    assert r.json()["email"] == user_creds["email"]
    assert r.json()["role"] == "user"


def test_update_profile(user_token):
    r = requests.put(f"{API}/auth/profile", headers=auth(user_token),
                     json={"phone": "+55 11 91111-2222"})
    assert r.status_code == 200
    assert r.json()["phone"] == "+55 11 91111-2222"


# ---------- Services ----------
def test_services_list():
    r = requests.get(f"{API}/services")
    assert r.status_code == 200
    data = r.json()
    ids = {s["id"]: s for s in data}
    assert "tarot" in ids and ids["tarot"]["price"] == 150.0
    assert "buzios" in ids and ids["buzios"]["price"] == 180.0
    assert "pombo-gira" in ids and ids["pombo-gira"]["price"] == 250.0
    assert ids["pombo-gira"]["modalities"] == ["presencial"]


def test_service_detail_observations():
    r = requests.get(f"{API}/services/tarot")
    assert r.status_code == 200
    assert isinstance(r.json().get("observations"), list)
    assert len(r.json()["observations"]) > 0


# ---------- Slots ----------
def test_slots_weekday():
    d = _next_weekday(1)
    r = requests.get(f"{API}/slots", params={"date": d})
    assert r.status_code == 200
    slots = r.json()["slots"]
    assert "10:00" in slots
    # 90-min blocks from 10:00 to 18:00 => 10, 11:30, 13, 14:30, 16, (17:30 end=19 > 18) so no 17:30
    assert "11:30" in slots


def test_slots_invalid_date():
    r = requests.get(f"{API}/slots", params={"date": "bad-date"})
    assert r.status_code == 400


# ---------- Bookings ----------
@pytest.fixture(scope="module")
def booking(user_token):
    d = _next_weekday(3)
    r = requests.post(f"{API}/bookings", headers=auth(user_token), json={
        "service_id": "tarot", "date": d, "time": "10:00",
        "modality": "online", "terms_accepted": True
    })
    assert r.status_code == 200, f"Create booking failed: {r.text}"
    return r.json()


def test_booking_created(booking):
    assert booking["status"] == "aguardando_pagamento"
    assert booking["price"] == 150.0
    assert booking["service_id"] == "tarot"


def test_booking_terms_required(user_token):
    d = _next_weekday(4)
    r = requests.post(f"{API}/bookings", headers=auth(user_token), json={
        "service_id": "tarot", "date": d, "time": "10:00",
        "modality": "online", "terms_accepted": False
    })
    assert r.status_code == 400


def test_booking_double_book_conflict(user_token, booking):
    r = requests.post(f"{API}/bookings", headers=auth(user_token), json={
        "service_id": "tarot", "date": booking["date"], "time": booking["time"],
        "modality": "online", "terms_accepted": True
    })
    assert r.status_code == 409


def test_slots_exclude_booked(booking):
    r = requests.get(f"{API}/slots", params={"date": booking["date"]})
    assert r.status_code == 200
    assert booking["time"] not in r.json()["slots"]


def test_booking_invalid_modality(user_token):
    d = _next_weekday(5)
    r = requests.post(f"{API}/bookings", headers=auth(user_token), json={
        "service_id": "pombo-gira", "date": d, "time": "10:00",
        "modality": "online", "terms_accepted": True
    })
    assert r.status_code == 400


def test_my_bookings(user_token, booking):
    r = requests.get(f"{API}/bookings/me", headers=auth(user_token))
    assert r.status_code == 200
    assert any(b["id"] == booking["id"] for b in r.json())


# ---------- Admin authorization ----------
def test_admin_endpoint_forbidden_for_user(user_token):
    r = requests.get(f"{API}/admin/bookings", headers=auth(user_token))
    assert r.status_code == 403


def test_admin_stats(admin_token):
    r = requests.get(f"{API}/admin/stats", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    for k in ("pending", "confirmed_today", "total_bookings", "total_clients", "total_revenue"):
        assert k in data


def test_admin_list_bookings_filter(admin_token, booking):
    r = requests.get(f"{API}/admin/bookings", headers=auth(admin_token),
                     params={"status": "aguardando_pagamento"})
    assert r.status_code == 200
    assert any(b["id"] == booking["id"] for b in r.json())


def test_admin_confirm_payment(admin_token, booking):
    r = requests.post(f"{API}/admin/bookings/{booking['id']}/confirm-payment",
                      headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["status"] == "confirmado"


def test_admin_change_status(admin_token, booking):
    r = requests.put(f"{API}/admin/bookings/{booking['id']}/status",
                     headers=auth(admin_token), json={"status": "concluido"})
    assert r.status_code == 200
    assert r.json()["status"] == "concluido"


def test_admin_service_price_update(admin_token):
    r = requests.put(f"{API}/admin/services/tarot", headers=auth(admin_token),
                     json={"price": 155.0})
    assert r.status_code == 200
    assert r.json()["price"] == 155.0
    # Restore
    requests.put(f"{API}/admin/services/tarot", headers=auth(admin_token), json={"price": 150.0})


def test_admin_working_hours(admin_token):
    r = requests.put(f"{API}/admin/working-hours", headers=auth(admin_token), json={
        "start": "10:00", "end": "18:00", "slot_minutes": 90, "weekdays": [0, 1, 2, 3, 4, 5]
    })
    assert r.status_code == 200


def test_admin_blocked_and_holiday_crud(admin_token):
    d = _next_weekday(10)
    r = requests.post(f"{API}/admin/blocked", headers=auth(admin_token),
                      json={"date": d, "time": "10:00"})
    assert r.status_code == 200
    bid = r.json()["id"]
    # confirm slot disappears
    s = requests.get(f"{API}/slots", params={"date": d}).json()["slots"]
    assert "10:00" not in s
    r2 = requests.delete(f"{API}/admin/blocked/{bid}", headers=auth(admin_token))
    assert r2.status_code == 200

    r3 = requests.post(f"{API}/admin/holidays", headers=auth(admin_token),
                       json={"date": d, "label": "TEST Holiday"})
    assert r3.status_code == 200
    hid = r3.json()["id"]
    s2 = requests.get(f"{API}/slots", params={"date": d}).json()["slots"]
    assert s2 == []
    requests.delete(f"{API}/admin/holidays/{hid}", headers=auth(admin_token))


# ---------- Cancel booking ----------
def test_cancel_booking(user_token):
    d = _next_weekday(6)
    r = requests.post(f"{API}/bookings", headers=auth(user_token), json={
        "service_id": "buzios", "date": d, "time": "10:00",
        "modality": "presencial", "terms_accepted": True
    })
    assert r.status_code == 200
    bid = r.json()["id"]
    r2 = requests.delete(f"{API}/bookings/{bid}", headers=auth(user_token))
    assert r2.status_code == 200
    # Verify status changed
    lst = requests.get(f"{API}/bookings/me", headers=auth(user_token)).json()
    b = next((x for x in lst if x["id"] == bid), None)
    assert b and b["status"] == "cancelado"
