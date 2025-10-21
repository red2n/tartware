"""Compliance Legal Data Loaders"""

from .insert_police_reports import insert_police_reports
from .insert_contract_agreements import insert_contract_agreements
from .insert_insurance_claims import insert_insurance_claims
from .insert_lost_and_found import insert_lost_and_found


__all__ = [
    "insert_police_reports",
    "insert_contract_agreements",
    "insert_insurance_claims",
    "insert_lost_and_found",
]
