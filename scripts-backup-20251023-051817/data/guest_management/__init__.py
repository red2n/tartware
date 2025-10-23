"""Guest Management Data Loaders"""

from .insert_guest_communications import insert_guest_communications
from .insert_guest_feedback import insert_guest_feedback
from .insert_guest_preferences import insert_guest_preferences
from .insert_guest_loyalty_programs import insert_guest_loyalty_programs
from .insert_guest_documents import insert_guest_documents
from .insert_guest_notes import insert_guest_notes
from .insert_guest_journey_tracking import insert_guest_journey_tracking
from .insert_communication_templates import insert_communication_templates
from .insert_automated_messages import insert_automated_messages
from .insert_gdpr_consent_logs import insert_gdpr_consent_logs


__all__ = [
    "insert_guest_communications",
    "insert_guest_feedback",
    "insert_guest_preferences",
    "insert_guest_loyalty_programs",
    "insert_guest_documents",
    "insert_guest_notes",
    "insert_guest_journey_tracking",
    "insert_communication_templates",
    "insert_automated_messages",
    "insert_gdpr_consent_logs",
]
