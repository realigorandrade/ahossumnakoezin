# PRD — KWE AHOSSUM NAKÓ EZIN

## Overview
Elegant mobile app (React Native / Expo) for the Brazilian spiritual house **KWE AHOSSUM NAKÓ EZIN**, administered by Eliton d'Ajauncy. Users can register, browse spiritual services, schedule consultations by date/time/modality, accept the terms and observations, view/cancel their bookings, and edit their profile. The administrator uses a protected panel to manage all bookings, clients, working hours, blocked dates, holidays, and service prices.

## Identity
- Colors: black (`#0F0F0F`), antique gold (`#D4AF37`), white (`#F7F5F0`)
- Personality: sophisticated, minimalist and spiritual (Glass / Luxe DARK)
- Placeholder logo (gold initials "KA") — ready to be swapped for the final logo asset

## Users
- **Consulente (user)**: cadastro obrigatório com nome completo, e-mail, telefone, data de nascimento, senha e confirmação.
- **Admin (Eliton)**: e-mail `admin@kwe.com`, senha `Admin@123` (semeado no startup do backend).

## Services (3 tipos)
1. **Jogo de Tarot** — R$ 150,00 — Presencial e Online
2. **Jogo de Búzios** — R$ 180,00 — Presencial e Online
3. **Atendimento com Pombo Gira Maria Padilha** — R$ 250,00 — Apenas Presencial

Each service exposes a description, image, list of observations importantes, and modality-specific rules. The user must check "Li e concordo com as observações" before agendar.

## Booking rules
- Working hours: **Mon–Sat, 10:00–18:00**, 90-minute blocks (admin can edit).
- Same date/time cannot be booked twice (backend enforces 409).
- Slots that are already booked, blocked or fall on a holiday disappear from the availability API.
- Status enum: `aguardando_pagamento`, `confirmado`, `concluido`, `cancelado`.
- On booking creation → `aguardando_pagamento`; admin confirms payment manually.

## Screens
- `/` Welcome (Entrar / Criar conta)
- `/login` `/register`
- `/(tabs)/home` — welcome + 3 service cards
- `/service/[id]` — modality, date scroller, time grid, terms, sticky CTA
- `/(tabs)/appointments` — user bookings with status badges + cancel
- `/(tabs)/profile` — edit name/email/phone/password + logout
- `/admin` — stats, filters, confirm payment, change status, blocked dates, holidays, working hours, service prices, client list

## Tech
- Backend: FastAPI + Motor (MongoDB) + JWT (bcrypt hashing, HS256 tokens, 7d expiry). Seed on startup.
- Frontend: Expo Router (SDK 54), expo-secure-store for token, expo-linear-gradient, Cormorant Garamond display font, Ionicons.
- Payment: **MOCKED / MANUAL** — admin confirma pagamento via `POST /api/admin/bookings/{id}/confirm-payment`. Mercado Pago pode ser adicionado posteriormente.

## Business enhancement
The admin dashboard exposes total revenue (soma de confirmados + concluídos) for quick recurring insight — useful for tracking business health without exporting data.
