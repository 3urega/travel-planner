#!/usr/bin/env python3
"""Puente JSON ↔ librería `flights` (fli). Lee stdin (JSON), escribe stdout (JSON). No MCP."""

from __future__ import annotations

import hashlib
import json
import sys
from typing import Any

# Ciudades / metacódigos habituales → IATA reconocido por el enum `Airport`.
# Incluye nombres en mayúsculas tal como llegan tras normalizar el string del usuario.
_AIRPORT_ALIASES: dict[str, str] = {
    "PAR": "CDG",
    "PARIS": "CDG",
    "LON": "LHR",
    "LONDON": "LHR",
    "NYC": "JFK",
    "TYO": "NRT",
    "TOKYO": "NRT",
    "MIL": "MXP",
    "MILAN": "MXP",
    "ROM": "FCO",
    "ROME": "FCO",
    "ROMA": "FCO",
    "BER": "BER",
    "BERLIN": "BER",
    "BARCELONA": "BCN",
    "MADRID": "MAD",
    "LISBON": "LIS",
    "LISBOA": "LIS",
    "DUBLIN": "DUB",
    "COPENHAGEN": "CPH",
    "COPENHAGUE": "CPH",
    "COPHENNAGE": "CPH",
    "SEVILLA": "SVQ",
    "VALENCIA": "VLC",
    "BILBAO": "BIO",
    "MALAGA": "AGP",
    "MÁLAGA": "AGP",
}

# Quitar tildes comunes para resolver alias aunque el enum solo reciba ASCII.
_ACCENT_FOLD = str.maketrans(
    "ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝàáâãäåèéêëìíîïòóôõöùúûüýÿÇçÑñ",
    "AAAAAAEEEEIIIIOOOOOUUUUYaaaaaaeeeeiiiiooooouuuuyyCcNn",
)


def _emit_error(code: str, message: str) -> None:
    sys.stdout.write(
        json.dumps({"ok": False, "code": code, "message": message}, ensure_ascii=False)
    )


def _resolve_airport(code: str) -> Any:
    from fli.models import Airport

    c = (code or "").strip().upper().translate(_ACCENT_FOLD)
    if not c:
        raise ValueError("Código de aeropuerto vacío")
    c = _AIRPORT_ALIASES.get(c, c)
    try:
        return Airport[c]
    except KeyError as e:
        raise ValueError(f"Código IATA no soportado por el bridge: {code}") from e


def _seat_type(cabin: str | None) -> Any:
    from fli.models import SeatType

    if not cabin:
        return SeatType.ECONOMY
    m = cabin.strip().lower()
    if "business" in m or "ejecutiv" in m:
        return SeatType.BUSINESS
    if "first" in m or "primera" in m:
        return SeatType.FIRST
    if "premium" in m:
        return SeatType.PREMIUM_ECONOMY
    return SeatType.ECONOMY


def _max_stops(non_stop: bool | None) -> Any:
    from fli.models import MaxStops

    if non_stop:
        return MaxStops.NON_STOP
    return MaxStops.ANY


def _flight_result_to_offer(
    fr: Any,
    origin_code: str,
    dest_code: str,
    queried_at: str,
) -> dict[str, Any]:
    legs = fr.legs
    if not legs:
        raise ValueError("Resultado sin segmentos")

    first = legs[0]
    last = legs[-1]

    airline = first.airline
    airline_label = getattr(airline, "value", str(airline))

    dep = first.departure_datetime
    arr = last.arrival_datetime
    dep_s = dep.strftime("%H:%M") if hasattr(dep, "strftime") else str(dep)
    arr_s = arr.strftime("%H:%M") if hasattr(arr, "strftime") else str(arr)

    stops = int(fr.stops)
    duration_min = int(fr.duration)
    price = float(fr.price)

    id_seed = (
        f"{first.departure_airport.name}-{last.arrival_airport.name}-"
        f"{dep.isoformat() if hasattr(dep, 'isoformat') else dep_s}-"
        f"{price}-{airline_label}"
    )
    offer_id = hashlib.sha256(id_seed.encode()).hexdigest()[:20]

    display = (
        f"{airline_label} {dep_s}→{arr_s} · "
        f"{stops} escala(s) · ${price:.0f}"
    )

    return {
        "id": offer_id,
        "airline": airline_label,
        "priceUsd": price,
        "departureTime": dep_s,
        "arrivalTime": arr_s,
        "stops": stops,
        "durationMinutes": duration_min,
        "originCode": origin_code,
        "destinationCode": dest_code,
        "displayLabel": display,
        "providerTag": "fli",
        "queriedAt": queried_at,
    }


def run_search(payload: dict[str, Any]) -> list[dict[str, Any]]:
    from datetime import datetime, timezone

    from fli.models import (
        FlightSearchFilters,
        FlightSegment,
        PassengerInfo,
        PriceLimit,
        TripType,
    )
    from fli.models.google_flights.base import Currency
    from fli.search.flights import SearchFlights

    from_ = payload.get("from")
    to = payload.get("to")
    date = payload.get("date")
    if not from_ or not to or not date:
        raise ValueError("Faltan campos obligatorios: from, to, date")

    dep_ap = _resolve_airport(str(from_))
    arr_ap = _resolve_airport(str(to))
    origin_code = dep_ap.name
    dest_code = arr_ap.name

    adults = int(payload.get("adults") or 1)
    budget = payload.get("budget")
    non_stop = payload.get("nonStop")
    cabin = payload.get("cabin")

    price_limit = None
    if budget is not None:
        try:
            max_p = int(float(budget))
            if max_p > 0:
                price_limit = PriceLimit(max_price=max_p, currency=Currency.USD)
        except (TypeError, ValueError):
            pass

    # Cada fila es [Airport, int]; el segundo valor es el formato que espera la API (p. ej. 0).
    segment = FlightSegment(
        departure_airport=[[dep_ap, 0]],
        arrival_airport=[[arr_ap, 0]],
        travel_date=str(date),
    )

    filters = FlightSearchFilters(
        trip_type=TripType.ONE_WAY,
        passenger_info=PassengerInfo(adults=adults),
        flight_segments=[segment],
        stops=_max_stops(bool(non_stop) if non_stop is not None else False),
        seat_type=_seat_type(str(cabin) if cabin else None),
        price_limit=price_limit,
    )

    queried_at = datetime.now(timezone.utc).isoformat()
    sf = SearchFlights()
    raw = sf.search(filters, top_n=int(payload.get("topN") or 8))

    if raw is None:
        return []

    offers: list[dict[str, Any]] = []
    for item in raw:
        if isinstance(item, tuple):
            continue
        offers.append(
            _flight_result_to_offer(
                item, origin_code=origin_code, dest_code=dest_code, queried_at=queried_at
            )
        )
    return offers


def main() -> None:
    try:
        data = sys.stdin.read()
        if not data.strip():
            _emit_error("invalid_input", "Cuerpo vacío en stdin")
            return
        payload = json.loads(data)
    except json.JSONDecodeError as e:
        _emit_error("invalid_input", f"JSON inválido: {e}")
        return

    try:
        offers = run_search(payload)
        sys.stdout.write(
            json.dumps({"ok": True, "offers": offers}, ensure_ascii=False)
        )
    except ValueError as e:
        _emit_error("invalid_input", str(e))
    except Exception as e:
        _emit_error("provider_error", str(e))


if __name__ == "__main__":
    main()
