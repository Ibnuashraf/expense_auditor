"""
policy_engine.py — Auditra Policy Audit Engine

Strict implementation of: AUDITRA GLOBAL TRAVEL & EXPENSE POLICY (Version 2.1)
Grade-based lookup matrix mapping.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional

from app.rag_retriever import is_semantically_prohibited
from app.gemini_service import _get_gemini_client

logger = logging.getLogger(__name__)

# =============================================================================
# SECTION 2 — EMPLOYEE GRADE INDEX MAPPING
# E-1 to E-9 maps to indices 0 to 8 for list lookups
# =============================================================================

def _grade_index(grade: str) -> int:
    """Map E-1..E-9 to list index 0..8. Defaults to E-1 (strictest)."""
    if not grade:
        return 0
    match = re.search(r"E-([1-9])", grade.upper())
    if match:
        return int(match.group(1)) - 1
    return 0

# =============================================================================
# SECTION 3 — MEAL ALLOWANCES (Per person, per meal)
# =============================================================================

# §3.1 India Meals (INR)
# Index: [E-1/2, E-3/4, E-5, E-6, E-7, E-8, E-9]
MEALS_INDIA_INR = {
    "mumbai":          [350, 600,  900, 1200, 1600, 2000, 2500],
    "delhi":           [350, 600,  900, 1200, 1600, 2000, 2500],
    "ncr":             [350, 600,  900, 1200, 1600, 2000, 2500],
    "bengaluru":       [300, 550,  850, 1100, 1450, 1800, 2200],
    "bangalore":       [300, 550,  850, 1100, 1450, 1800, 2200],
    "pune":            [280, 500,  800, 1050, 1400, 1750, 2100],
    "hyderabad":       [280, 500,  800, 1050, 1400, 1750, 2100],
    "chennai":         [260, 480,  750, 1000, 1350, 1700, 2000],
    "kolkata":         [250, 450,  700,  950, 1300, 1650, 1950],
    "tier-2 city":     [200, 380,  600,  800, 1100, 1400, 1700],
    "other":           [180, 350,  550,  750, 1000, 1300, 1600],
}

# §3.2 International Meals (USD)
MEALS_INTL_USD = {
    "united states":   [ 25,  40,  60,  80, 110, 140, 180],
    "usa":             [ 25,  40,  60,  80, 110, 140, 180],
    "united kingdom":  [ 22,  36,  55,  75, 100, 130, 165],
    "uk":              [ 22,  36,  55,  75, 100, 130, 165],
    "europe":          [ 20,  34,  52,  70,  95, 120, 155],
    "schengen":        [ 20,  34,  52,  70,  95, 120, 155],
    "singapore":       [ 22,  36,  55,  75, 100, 130, 165],
    "uae":             [ 20,  35,  55,  72,  98, 125, 160],
    "dubai":           [ 20,  35,  55,  72,  98, 125, 160],
    "southeast asia":  [ 15,  25,  40,  55,  75, 100, 130],
    "other":           [ 15,  24,  38,  52,  70,  90, 120],
}

# =============================================================================
# SECTION 4 — ACCOMMODATION LIMITS (Per night)
# =============================================================================

# §4.1 India Hotels (INR)
HOTELS_INDIA_INR = {
    "mumbai":          [3500, 5000, 7000, 9000, 12000, 16000, 22000],
    "delhi":           [3500, 5000, 7000, 9000, 12000, 16000, 22000],
    "bengaluru":       [3000, 4500, 6500, 8500, 11000, 14500, 20000],
    "bangalore":       [3000, 4500, 6500, 8500, 11000, 14500, 20000],
    "pune":            [2800, 4000, 6000, 8000, 10500, 14000, 18500],
    "hyderabad":       [2800, 4000, 6000, 8000, 10500, 14000, 18500],
    "hyd":             [2800, 4000, 6000, 8000, 10500, 14000, 18500],
    "chennai":         [2800, 4000, 6000, 8000, 10500, 14000, 18500],
    "che":             [2800, 4000, 6000, 8000, 10500, 14000, 18500],
    "tier-2 city":     [2000, 3200, 4800, 6500,  8500, 11000, 15000],
    "other":           [1800, 2800, 4200, 5800,  7500, 10000, 13500],
}

# §4.2 International Hotels (USD)
HOTELS_INTL_USD = {
    "united states":   [150, 200, 250, 320, 400, 500, 700],
    "usa":             [150, 200, 250, 320, 400, 500, 700],
    "united kingdom":  [140, 185, 230, 300, 375, 470, 650],
    "uk":              [140, 185, 230, 300, 375, 470, 650],
    "europe":          [130, 175, 215, 280, 355, 450, 620],
    "schengen":        [130, 175, 215, 280, 355, 450, 620],
    "singapore":       [145, 190, 240, 310, 390, 490, 680],
    "hk":              [145, 190, 240, 310, 390, 490, 680],
    "uae":             [140, 185, 230, 300, 375, 470, 650],
    "dubai":           [140, 185, 230, 300, 375, 470, 650],
    "southeast asia":  [ 90, 130, 170, 220, 280, 360, 500],
    "other":           [ 80, 115, 155, 200, 255, 330, 460],
}

# =============================================================================
# SECTION 5 — TRANSPORT & TRAVEL
# =============================================================================

# §5.2 Ground Transport (INR)
TRANSPORT_INR = {
    "airport taxi":    [800, 800, 1200, 1500, 2000, 2500, 999999], # E-9=Any
    "cab":             [400, 400,  600,  800, 1200, 1500, 999999], # E-9=Any
    "rideshare":       [400, 400,  600,  800, 1200, 1500, 999999], # E-9=Any
    "auto":            [200, 200,  200,  300,  500,  500, 999999], # Local transport fallback
}

# =============================================================================
# SECTION 6 — ENTERTAINMENT & CLIENT EXPENSES
# =============================================================================
# 0 value means not permitted without VP approval

ENTERTAINMENT_LIMITS = {
    "client meal inr": [0, 0, 1800, 2500, 3500, 5000, 999999],
    "client meal usd": [0, 0,   80,  120,  175,  250, 999999],
    "corporate gift":  [0, 0, 1500, 2500, 4000, 6000, 999999],
    "tickets":         [0, 2000, 3500, 5000, 8000, 12000, 999999],
}

# (Removed PROHIBITED_KEYWORDS regex set since we now use Semantic Embeddings in RAG Service)

# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class Violation:
    severity: str        # "rejected" | "flagged"
    rule: str            # e.g. "§7"
    message: str         # policy explanation


@dataclass
class PolicyResult:
    status:            str                        # "approved" | "flagged" | "rejected"
    risk_level:        str                        # simplified mapping for UI: "low" -> approved, "medium" -> flagged, "high" -> rejected
    explanation:       str
    policy_rule:       str
    currency_detected: str = "INR"
    region_detected:   str = "other"
    violations:        list = field(default_factory=list)

    @property
    def risk_score(self) -> int:
        return 0 # Deprecated

    @property
    def approval_required(self) -> str:
        return "manager" # Deprecated

    def to_dict(self) -> dict:
        return {
            "status":            self.status,
            "risk_level":        self.risk_level,
            "explanation":       self.explanation,
            "policy_rule":       self.policy_rule,
            "currency_detected": self.currency_detected,
            "region_detected":   self.region_detected,
            "violations": [
                {"severity": v.severity, "rule": v.rule, "message": v.message}
                for v in self.violations
            ],
        }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def convert_to_inr(amount: float, currency: str) -> float:
    """Normalize currency to INR to standardize internal limits."""
    c = currency.upper().strip()
    if c == "INR": return amount
    if c == "USD": return amount * 83.0
    if c == "EUR": return amount * 90.0
    if c == "GBP": return amount * 105.0
    return amount  # fallback

def detect_currency(amount: float, raw_text: str, merchant: str, default_curr="INR") -> str:
    combined = (raw_text + " " + merchant).lower()
    if any(s in combined for s in ["$", "usd", "us dollar"]):
        return "USD"
    if any(s in combined for s in ["£", "gbp"]):
        return "GBP"
    if any(s in combined for s in ["€", "eur", "euro"]):
        return "EUR"
    return default_curr


def detect_region(currency: str, raw_text: str, merchant: str) -> str:
    combined = (raw_text + " " + merchant).lower()
    if currency == "USD":
        for k in MEALS_INTL_USD.keys():
            if k in combined: return k
        return "united states" # default for USD
    else:
        for k in MEALS_INDIA_INR.keys():
            if k in combined and k != "other": return k
        return "other"


def _parse_date(date_str: str) -> Optional[date]:
    formats = [
        "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y",
        "%d %b %Y", "%b %d, %Y"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None


# =============================================================================
# MAIN AUDIT ENGINE
# =============================================================================

def run_policy_audit(
    merchant:             str,
    amount:               float,
    date_str:             str,
    category:             str,
    business_purpose:     str,
    grade:                str = "E-1",
    raw_text:             str = "",
    receipt_path:         Optional[str] = None,
    recent_expense_dates: Optional[list[str]] = None,
    policy_snippets:      Optional[list[str]] = None,
) -> PolicyResult:
    """
    Evaluates an expense against the AUDITRA GLOBAL T&E POLICY (v2.1).
    """
    violations: list[Violation] = []
    combined_text = f"{raw_text} {merchant} {business_purpose}".lower()
    
    # Map grade (e.g. "E-5" -> maps to index 2 for E-5, wait let's calculate exact index.
    # Policy ranges: E-1/2 (idx 0), E-3/4 (idx 1), E-5 (idx 2), E-6 (idx 3), E-7 (idx 4), E-8 (idx 5), E-9 (idx 6)
    idx_map = {
        1: 0, 2: 0,
        3: 1, 4: 1,
        5: 2, 6: 3, 7: 4, 8: 5, 9: 6
    }
    raw_idx = _grade_index(grade) + 1  # 1 to 9
    list_idx = idx_map.get(raw_idx, 0)
    
    currency = detect_currency(amount, raw_text, merchant)
    region = detect_region(currency, raw_text, merchant)
    
    # ─── §8 — MANADATORY FIELDS ──────────────────────────────────────────────
    if not receipt_path:
        violations.append(Violation("rejected", "§8 – Receipt Requirements", "Expenses without a valid receipt (no receipts = no reimbursement)"))
    
    if not merchant or not date_str or not amount:
        violations.append(Violation("flagged", "§8 – Missing OCR Data", "Required fields (Merchant, Date, Amount) could not be fully extracted."))
        
    purpose_words = len(business_purpose.split())
    if purpose_words < 10:
        violations.append(Violation("flagged", "§8 – Justification Too Short", "Business purpose must be stated in plain text (min 10 words)."))
        
    # ─── §7 & §8 Time Limits ──────────────────────────────────────────────────
    if date_str:
        d = _parse_date(date_str)
        if d:
            days_old = (date.today() - d).days
            if days_old > 60:
                violations.append(Violation("rejected", "§7 – Prohibited Expense", "Claims submitted more than 60 days after the expense date are permanently rejected."))

    # ─── §7 — SEMANTIC PROHIBITED ITEMS ───────────────────────────────────────
    # Instead of regex, we ask semantic check for overlap on the purpose and items
    if is_semantically_prohibited(business_purpose):
        violations.append(Violation("rejected", "§7 – Prohibited Expense", f"Business purpose semantically matches prohibited categories."))
        status = "rejected"
        risk_level = "high"

    # ─── AMOUNT LIMIT EXCEEDED LOGIC ──────────────────────────────────────────
    limit = None
    applied_rule = "None"
    
    if amount and amount > 0:
        # Meals
        if category == "Meals":
            if currency == "INR":
                limit_list = MEALS_INDIA_INR.get(region, MEALS_INDIA_INR["other"])
                limit = limit_list[list_idx]
                applied_rule = f"§3.1 India Meals ({region.title()})"
            else:
                limit_list = MEALS_INTL_USD.get(region, MEALS_INTL_USD["other"])
                limit = limit_list[list_idx]
                applied_rule = f"§3.2 International Meals ({region.title()})"
                
            # Room service/delivery check
            if any(w in combined_text for w in ["delivery", "room service", "zomato", "swiggy", "ubereats"]):
                limit = limit * 0.8  # Capped at 80%

        # Lodging
        elif category == "Lodging":
            if currency == "INR":
                limit_list = HOTELS_INDIA_INR.get(region, HOTELS_INDIA_INR["other"])
                limit = limit_list[list_idx]
                applied_rule = f"§4.1 India Hotels ({region.title()})"
            else:
                limit_list = HOTELS_INTL_USD.get(region, HOTELS_INTL_USD["other"])
                limit = limit_list[list_idx]
                applied_rule = f"§4.2 International Hotels ({region.title()})"

        # Transport
        elif category == "Transport" and currency == "INR":
            # Very simplistic ground transport mapping
            for key, l_array in TRANSPORT_INR.items():
                if key in combined_text:
                    limit = l_array[list_idx]
                    applied_rule = f"§5.2 Ground Transport ({key.title()})"
                    break
        
        # Entertainment / Tickets
        elif category == "Entertainment":
            key = "client meal usd" if currency == "USD" else "client meal inr"
            if "ticket" in combined_text or "event" in combined_text or "conference" in combined_text:
                key = "tickets"
            if "gift" in combined_text:
                key = "corporate gift"
                
            limit = ENTERTAINMENT_LIMITS[key][list_idx]
            applied_rule = f"§6 Entertainment ({key.title()})"
            
            if limit == 0:
                violations.append(Violation("rejected", applied_rule, f"Grade {grade} is not permitted to claim {key.title()} without explicit VP-level pre-approval."))
                limit = None # Don't run standard limit check
            
        # Execute limit evaluation
        if limit is not None:
            if amount > limit:
                violations.append(Violation(
                    "rejected", 
                    f"Limit Exceeded ({applied_rule})", 
                    f"Amount {amount} {currency} exceeds the maximum limit of {limit} {currency} for grade {grade}."
                ))
        elif not violations:
            # If no limit mapping found and no other violations, we flag for manual review
            violations.append(Violation("flagged", "§9 – Uncharted Category", "Could not fully map expense amount to a specific policy rule limit."))

    # ─── DUPLICATE / FREQUENCY ───────────────────────────────────────────────
    if recent_expense_dates and date_str:
        occurrences = recent_expense_dates.count(date_str)
        if occurrences >= 2:
            violations.append(Violation("flagged", "§8 – Anomaly Detection", "Unusually high frequency of claims on the exact same date (>=3 total). Flagged as duplicate anomaly."))
        elif occurrences == 1:
            violations.append(Violation("flagged", "§8 – Duplicate Detection", "System flags receipts with matching date (same day frequency alert). Manual review required."))

    # ─── DETERMINE FINAL STATUS ───────────────────────────────────────────────
    status = "approved"
    risk_level = "low"
    
    has_flags = any(v.severity == "flagged" for v in violations)
    has_rejects = any(v.severity == "rejected" for v in violations)
    
    if has_rejects:
        status = "rejected"
        risk_level = "high"
    elif has_flags:
        status = "flagged"
        risk_level = "medium"

    # ─── HYBRID GROUNDED EXPLANATION ──────────────────────────────────────────
    # We use passed policy documents for grounding
    context_text = "\n\n---\n\n".join(policy_snippets) if policy_snippets else ""
    
    explanation = ""
    policy_rule = "§9 Audit Verdicts"
    
    client = _get_gemini_client()
    if client and context_text and status != "approved":
        prompt = f"""
Given the following Corporate expense policy context:
---
{context_text}
---
The employee (Grade: {grade}) claimed {amount} {currency} for {category} at {merchant}.
The AI engine marked this claim as {status.upper()}.
Reasoning inputs: {[v.message for v in violations]}

Draft a professional, 1-sentence explanation citing the exact section and rule from the context text that justifies the {status} verdict.
Only output the sentence.
"""
        try:
            res = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            explanation = res.text.strip()
            
            # Extract section if generated
            import re
            sec_hit = re.search(r"§\s*\d+(?:\.\d+)?", explanation)
            if sec_hit: policy_rule = sec_hit.group(0)
            elif violations: policy_rule = violations[0].rule
                
        except Exception:
            pass

    if not explanation:
        if status == "approved":
            explanation = f"Approved: The claim is fully compliant. Amount is within policy limits for grade {grade}."
        else:
            primary = next((v for v in violations if v.severity == "rejected"), violations[0] if violations else None)
            explanation = f"{status.title()}: {primary.message if primary else 'Review needed'}"
            if primary: policy_rule = primary.rule
            if len(violations) > 1:
                explanation += f" (+{len(violations)-1} other issues)"

    return PolicyResult(
        status=status,
        risk_level=risk_level,
        explanation=explanation,
        policy_rule=policy_rule,
        currency_detected=currency,
        region_detected=region,
        violations=violations
    )
