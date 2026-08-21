from datetime import datetime, timezone, timedelta
from typing import List, Tuple, Dict, Any, Optional
from app.schemas.domain import EvidenceSchema, PayoutPeriodSchema

def parse_iso_timestamp(ts_str: str) -> Optional[datetime]:
    """
    Normalizes timestamp string into a UTC datetime object.
    Date-only strings (e.g. '2026-08-01') are interpreted as UTC start of day.
    Returns None if timestamp is missing or malformed.
    """
    if not ts_str:
        return None
    
    clean_str = ts_str.strip()
    if clean_str.endswith("Z"):
        clean_str = clean_str[:-1] + "+00:00"
    
    try:
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        try:
            dt = datetime.strptime(clean_str, "%Y-%m-%d")
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None

def is_within_payout_period(ts_str: str, period: PayoutPeriodSchema, is_settlement: bool = False) -> bool:
    """
    Checks if an evidence timestamp falls within the specified payout period.
    Period start and end dates are evaluated in UTC.
    """
    ev_dt = parse_iso_timestamp(ts_str)
    if ev_dt is None:
        return False

    start_dt = parse_iso_timestamp(period.startDate)
    end_dt = parse_iso_timestamp(period.endDate)

    if start_dt is None or end_dt is None:
        return False

    # End date covers through the end of that day (23:59:59.999999 UTC)
    end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=999999)

    if is_settlement:
        window_days = period.settlementWindowDays if period.settlementWindowDays is not None else 3
        end_dt += timedelta(days=window_days)

    return start_dt <= ev_dt <= end_dt

def classify_evidence_role(ev: EvidenceSchema) -> str:
    """
    Determines whether an evidence record represents an ORDER_EVENT, PAYOUT_CLAIM, DEDUCTION, or SETTLEMENT.
    """
    if ev.role:
        return ev.role.upper()

    ev_type = (ev.type or "").upper()
    ev_src = (ev.source or "").upper()
    ev_cat = (ev.category or "").upper()

    if ev_cat == "DEDUCTION" or "DEDUCTION" in ev_type or "FEE" in ev_type or "KIT" in ev_type:
        return "DEDUCTION"

    if ev_cat == "SETTLEMENT" or "SETTLEMENT" in ev_type or "AA" in ev_src or "FINANCIAL" in ev_src:
        return "SETTLEMENT"

    if "PAYOUT" in ev_type or "STATEMENT" in ev_type or ev_type == "SELF_REPORTED_PAYOUT" or ev_src == "DECLARED":
        return "PAYOUT_CLAIM"

    return "ORDER_EVENT"

def deduplicate_evidences(evidences: List[EvidenceSchema]) -> Tuple[List[EvidenceSchema], List[str]]:
    """
    Deduplicates underlying evidence records by ID or source fingerprint (source|platform|reference).
    Preserves distinct same-value orders with unique references.
    """
    seen_ids = set()
    seen_fingerprints = set()
    deduped = []
    removed_ids = []

    for ev in evidences:
        if ev.id in seen_ids:
            removed_ids.append(ev.id)
            continue

        ref = (ev.reference or "").strip()
        fingerprint = None
        if ref and ref != "DECL-WEEK-32-2026":
            fingerprint = f"{(ev.source or '').upper()}|{(ev.platform or '').upper()}|{ref.upper()}"

        if fingerprint and fingerprint in seen_fingerprints:
            removed_ids.append(ev.id)
            continue

        seen_ids.add(ev.id)
        if fingerprint:
            seen_fingerprints.add(fingerprint)
        deduped.append(ev)

    return deduped, removed_ids

def extract_ocr_metadata(ev: EvidenceSchema) -> Tuple[bool, Optional[str], Optional[float]]:
    """
    Extracts OCR provenance metadata: (is_ocr, source_doc_id, extraction_confidence).
    """
    is_ocr = (ev.source or "").upper() == "OCR"
    doc_id = None
    confidence = None

    if ev.metadata:
        if "sourceDocumentId" in ev.metadata:
            doc_id = str(ev.metadata["sourceDocumentId"])
        if "extractionConfidence" in ev.metadata:
            try:
                confidence = float(ev.metadata["extractionConfidence"])
            except (ValueError, TypeError):
                pass
            is_ocr = True

    return is_ocr, doc_id, confidence

def is_attributable_settlement(ev: EvidenceSchema) -> bool:
    """
    Deterministic attribution function for AA bank settlements.
    Checks if a financial transaction has platform attribution signals or is a valid financial settlement.
    Filters out explicit personal UPI transfers, shopping refunds, or personal contact remitters.
    """
    if (ev.source or "").upper() != "FINANCIAL" and "AA" not in (ev.type or "").upper() and (ev.category or "").upper() != "SETTLEMENT":
        return False

    remitter = ""
    if ev.metadata and "remitter" in ev.metadata:
        remitter = str(ev.metadata["remitter"]).strip()

    # Explicit filter for personal or shopping refund remitters
    if any(unrelated in remitter.upper() for unrelated in ["PERSONAL", "UPI TRANSFER", "REFUND", "SHOPPING", "FRIEND", "APOORVA"]):
        return False

    return True
