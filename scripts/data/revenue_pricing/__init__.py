"""Revenue Pricing Data Loaders"""

from .insert_allotments import insert_allotments
from .insert_revenue_forecasts import insert_revenue_forecasts
from .insert_competitor_rates import insert_competitor_rates
from .insert_demand_calendar import insert_demand_calendar
from .insert_pricing_rules import insert_pricing_rules
from .insert_promotional_codes import insert_promotional_codes
from .insert_rate_recommendations import insert_rate_recommendations
from .insert_forecasting_models import insert_forecasting_models
from .insert_revenue_attribution import insert_revenue_attribution
from .insert_revenue_goals import insert_revenue_goals


__all__ = [
    "insert_allotments",
    "insert_revenue_forecasts",
    "insert_competitor_rates",
    "insert_demand_calendar",
    "insert_pricing_rules",
    "insert_promotional_codes",
    "insert_rate_recommendations",
    "insert_forecasting_models",
    "insert_revenue_attribution",
    "insert_revenue_goals",
]
