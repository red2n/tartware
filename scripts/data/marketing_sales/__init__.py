"""Marketing Sales Data Loaders"""

from .insert_marketing_campaigns import insert_marketing_campaigns
from .insert_campaign_segments import insert_campaign_segments
from .insert_referral_tracking import insert_referral_tracking
from .insert_social_media_mentions import insert_social_media_mentions
from .insert_commission_tracking import insert_commission_tracking


__all__ = [
    "insert_marketing_campaigns",
    "insert_campaign_segments",
    "insert_referral_tracking",
    "insert_social_media_mentions",
    "insert_commission_tracking",
]
