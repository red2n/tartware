"""Staff Operations Data Loaders"""

from .insert_staff_schedules import insert_staff_schedules
from .insert_staff_tasks import insert_staff_tasks
from .insert_shift_handovers import insert_shift_handovers
from .insert_maintenance_requests import insert_maintenance_requests
from .insert_incident_reports import insert_incident_reports
from .insert_vehicles import insert_vehicles
from .insert_shuttle_schedules import insert_shuttle_schedules
from .insert_transportation_requests import insert_transportation_requests


__all__ = [
    "insert_staff_schedules",
    "insert_staff_tasks",
    "insert_shift_handovers",
    "insert_maintenance_requests",
    "insert_incident_reports",
    "insert_vehicles",
    "insert_shuttle_schedules",
    "insert_transportation_requests",
]
