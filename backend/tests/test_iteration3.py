"""Iteration 3 backend tests: 4th service, public settings/PIX, events CRUD,
gira config, notifications queue, admin service duration update.
"""
import os
import uuid
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://kwe-espiritual.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@kwe.com"
ADMIN_PASSWORD = "Admin@123"


def _next_weekday(offset=1):
    d = datetime.utcnow().date() + timedelta(days=offset)
    while d.weekday() == 6:
        d += timedelta(days=1)
    return d.isoformat()


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def user_ctx():
    email = f"TEST_i3_{uuid.uuid4().hex[:8]}@test.com"
    payload = {
        "full_name": "TEST I3 User",
        "email": email,
        "phone": "+55 11 90000-0000",
        "birthdate": "1990-01-01",
        "password": "teste123",
        "confirm_password": "teste123",
    }
    r = requests.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"Register failed: {r.text}"
    return {"token": r.json()["access_token"], "email": email}


# ---------- Services: 4 services + duration_minutes ----------
class TestServices:
    def test_list_returns_4_services_with_duration(self):
        r = requests.get(f"{API}/services")
        assert r.status_code == 200
        data = r.json()
        ids = {s["id"]: s for s in data}
        # All 4 expected services present
        for sid in ("tarot", "buzios", "pombo-gira", "banhos-ervas"):
            assert sid in ids, f"Missing service {sid}"
            assert "duration_minutes" in ids[sid], f"{sid} missing duration_minutes"
            assert isinstance(ids[sid]["duration_minutes"], int)

        # Specific durations
        assert ids["tarot"]["duration_minutes"] == 60
        assert ids["buzios"]["duration_minutes"] == 60
        assert ids["pombo-gira"]["duration_minutes"] == 90
        assert ids["banhos-ervas"]["duration_minutes"] == 30

        # banhos-ervas details
        b = ids["banhos-ervas"]
        assert b["price"] == 80.0
        assert b["modalities"] == ["presencial"]

    def test_buzios_image_is_updated(self):
        r = requests.get(f"{API}/services/buzios")
        assert r.status_code == 200
        img = r.json().get("image", "")
        # Should not be the old parachutes image
        assert "1518709594023" not in img
        assert img.startswith("http")


# ---------- Public settings ----------
class TestPublicSettings:
    def test_settings_public_no_auth(self):
        r = requests.get(f"{API}/settings")
        assert r.status_code == 200
        s = r.json()
        assert s.get("pix_key")
        assert s.get("pix_holder")
        assert s.get("support_whatsapp")
        # Default PIX values from seed
        assert s["pix_key"] == "kwe.ahossum@pix.com.br"
        # gira structure
        assert "gira" in s
        gira = s["gira"]
        assert "weekday" in gira and isinstance(gira["weekday"], int)
        assert "time" in gira
        assert "note" in gira
        # working_hours preserved
        assert "working_hours" in s


# ---------- Events ----------
class TestEvents:
    def test_events_list_public(self):
        r = requests.get(f"{API}/events")
        assert r.status_code == 200
        events = r.json()
        ids = {e["id"]: e for e in events}
        assert "obaluae-2025-08" in ids
        assert "festa-ere-2025-09" in ids
        assert "festa-mp-2025-10" in ids
        # Festa de Erê spec
        e = ids["festa-ere-2025-09"]
        assert e["date"] == "2025-09-27"
        assert e["time"] == "16:00"
        # Recurring event
        r_obaluae = ids["obaluae-2025-08"]
        assert r_obaluae.get("recurrence")


# ---------- Admin: payment-settings ----------
class TestAdminPaymentSettings:
    def test_forbidden_for_user(self, user_ctx):
        r = requests.put(
            f"{API}/admin/payment-settings",
            headers=auth(user_ctx["token"]),
            json={"pix_key": "hacker@pix.com"},
        )
        assert r.status_code == 403

    def test_admin_update_pix(self, admin_token):
        new_key = f"test-pix-{uuid.uuid4().hex[:6]}@pix.com"
        r = requests.put(
            f"{API}/admin/payment-settings",
            headers=auth(admin_token),
            json={"pix_key": new_key, "pix_holder": "TEST Holder", "support_whatsapp": "+5519999999999"},
        )
        assert r.status_code == 200
        assert r.json()["pix_key"] == new_key
        # verify via public GET
        r2 = requests.get(f"{API}/settings")
        assert r2.json()["pix_key"] == new_key
        # Restore
        requests.put(
            f"{API}/admin/payment-settings",
            headers=auth(admin_token),
            json={"pix_key": "kwe.ahossum@pix.com.br", "pix_holder": "Eliton d'Ajauncy",
                  "support_whatsapp": "+5519988371125"},
        )


# ---------- Admin: gira ----------
class TestAdminGira:
    def test_forbidden_for_user(self, user_ctx):
        r = requests.put(f"{API}/admin/gira", headers=auth(user_ctx["token"]),
                         json={"weekday": 3, "time": "20:00", "note": "X"})
        assert r.status_code == 403

    def test_admin_update_gira(self, admin_token):
        r = requests.put(f"{API}/admin/gira", headers=auth(admin_token),
                         json={"weekday": 4, "time": "20:15", "note": "TEST gira note"})
        assert r.status_code == 200
        g = r.json()["gira"]
        assert g["weekday"] == 4
        assert g["time"] == "20:15"
        assert g["note"] == "TEST gira note"
        # Restore
        requests.put(f"{API}/admin/gira", headers=auth(admin_token),
                     json={"weekday": 2, "time": "19:30", "note": "Horário sujeito a alterações."})


# ---------- Admin: events CRUD ----------
class TestAdminEventsCRUD:
    def test_event_lifecycle(self, admin_token):
        # Create
        payload = {
            "title": "TEST Evento",
            "description": "Descrição de teste",
            "date": "2030-01-15",
            "time": "20:00",
            "category": "festa",
        }
        r = requests.post(f"{API}/admin/events", headers=auth(admin_token), json=payload)
        assert r.status_code == 200
        ev = r.json()
        assert ev["title"] == "TEST Evento"
        eid = ev["id"]

        # Verify via GET
        r_list = requests.get(f"{API}/events")
        assert any(e["id"] == eid for e in r_list.json())

        # Update
        r_upd = requests.put(f"{API}/admin/events/{eid}", headers=auth(admin_token),
                             json={"title": "TEST Evento Atualizado", "date": "2030-02-20",
                                   "time": "21:00", "category": "festa"})
        assert r_upd.status_code == 200
        assert r_upd.json()["title"] == "TEST Evento Atualizado"

        # Delete
        r_del = requests.delete(f"{API}/admin/events/{eid}", headers=auth(admin_token))
        assert r_del.status_code == 200

        # Verify removed
        r_after = requests.get(f"{API}/events")
        assert not any(e["id"] == eid for e in r_after.json())

    def test_add_event_forbidden_for_user(self, user_ctx):
        r = requests.post(f"{API}/admin/events", headers=auth(user_ctx["token"]),
                          json={"title": "X"})
        assert r.status_code == 403


# ---------- Admin services: duration_minutes update ----------
class TestServiceDurationUpdate:
    def test_update_duration(self, admin_token):
        r = requests.put(f"{API}/admin/services/tarot", headers=auth(admin_token),
                         json={"duration_minutes": 75})
        assert r.status_code == 200
        assert r.json()["duration_minutes"] == 75
        # Restore
        requests.put(f"{API}/admin/services/tarot", headers=auth(admin_token),
                     json={"duration_minutes": 60})


# ---------- Notifications queue ----------
class TestNotifications:
    def test_registration_enqueues_new_user(self, admin_token):
        # Create a fresh user
        email = f"TEST_notif_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "full_name": "TEST Notif",
            "email": email,
            "phone": "+55 11 99999-0000",
            "birthdate": "1990-01-01",
            "password": "teste123",
            "confirm_password": "teste123",
        }
        r = requests.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 200

        # Check notifications
        r_notif = requests.get(f"{API}/admin/notifications", headers=auth(admin_token))
        assert r_notif.status_code == 200
        notifs = r_notif.json()
        # Find one matching
        matches = [n for n in notifs if n["kind"] == "new_user"
                   and n["payload"].get("email", "").lower() == email.lower()]
        assert matches, f"No new_user notification for {email}"
        assert matches[0]["status"] == "pending"

    def test_booking_enqueues_new_booking(self, admin_token, user_ctx):
        d = _next_weekday(7)
        r = requests.post(f"{API}/bookings", headers=auth(user_ctx["token"]), json={
            "service_id": "banhos-ervas", "date": d, "time": "11:30",
            "modality": "presencial", "terms_accepted": True,
        })
        assert r.status_code == 200, f"Booking failed: {r.text}"
        booking_id = r.json()["id"]

        # Check notifications
        r_notif = requests.get(f"{API}/admin/notifications", headers=auth(admin_token))
        assert r_notif.status_code == 200
        booking_notifs = [n for n in r_notif.json() if n["kind"] == "new_booking"
                          and n["payload"].get("service") == "Banhos, Ervas e Firmezas"]
        assert booking_notifs, "No new_booking notification enqueued"
        assert booking_notifs[0]["status"] == "pending"

        # Cleanup
        requests.delete(f"{API}/bookings/{booking_id}", headers=auth(user_ctx["token"]))

    def test_notifications_forbidden_for_user(self, user_ctx):
        r = requests.get(f"{API}/admin/notifications", headers=auth(user_ctx["token"]))
        assert r.status_code == 403
