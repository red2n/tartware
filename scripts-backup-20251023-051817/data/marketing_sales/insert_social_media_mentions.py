"""Insert function for social_media_mentions table"""


from data_store import data_store
from db_config import generate_uuid
from faker import Faker

fake = Faker()
import random


def insert_social_media_mentions(conn):
    """Insert social media mention records"""
    print(f"\n✓ Inserting Social Media Mentions...")
    cur = conn.cursor()

    platforms = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube']
    sentiments = ['positive', 'neutral', 'negative', 'mixed']
    post_types = ['post', 'comment', 'review', 'story', 'video', 'photo', 'reel', 'tweet', 'share', 'mention', 'tag']
    count = 0

    for property in data_store['properties']:
        for i in range(random.randint(20, 50)):
            posted_at = fake.date_time_between(start_date="-3m", end_date="now")

            cur.execute("""
                INSERT INTO social_media_mentions (
                    mention_id, tenant_id, property_id,
                    platform, post_type, post_url,
                    author_username, author_display_name,
                    content_text, sentiment, sentiment_score,
                    likes_count, comments_count, shares_count,
                    posted_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                random.choice(platforms),
                random.choice(post_types),
                fake.url(),
                fake.user_name(),
                fake.name(),
                fake.text(max_nb_chars=280),
                random.choice(sentiments),
                round(random.uniform(-1.0, 1.0), 2),
                random.randint(0, 1000),
                random.randint(0, 100),
                random.randint(0, 50),
                posted_at
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} social media mentions")
