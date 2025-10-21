"""Insert function for communication_templates table"""
from data_store import data_store
from db_config import generate_uuid


def insert_communication_templates(conn):
    """Insert communication template records"""
    print(f"\n✓ Inserting Communication Templates...")
    cur = conn.cursor()

    templates = [
        ('Booking Confirmation', 'BOOKING_CONFIRMATION', 'EMAIL',
         'Your Reservation is Confirmed',
         'Thank you for your booking. Your confirmation number is {{confirmation_number}}.'),
        ('Check-in Reminder', 'CHECKIN_REMINDER', 'EMAIL',
         'Check-in Tomorrow',
         'We look forward to welcoming you tomorrow at {{property_name}}.'),
        ('Pre-Arrival', 'PRE_ARRIVAL', 'SMS',
         'Arrival Information',
         'Your room will be ready at {{checkin_time}}. See you soon!'),
        ('Post-Checkout', 'POST_CHECKOUT', 'EMAIL',
         'Thank You for Staying',
         'Thank you for choosing {{property_name}}. We hope to see you again.'),
        ('Payment Receipt', 'PAYMENT_RECEIPT', 'EMAIL',
         'Payment Confirmation',
         'Your payment of {{amount}} has been received. Transaction ID: {{transaction_id}}.'),
    ]

    count = 0
    for property in data_store['properties']:
        for name, code, channel, subject, body in templates:
            cur.execute("""
                INSERT INTO communication_templates (id, tenant_id, property_id, template_name,
                                                    template_code, communication_type, subject, body,
                                                    is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                generate_uuid(),
                property['tenant_id'],
                property['id'],
                name,
                code,
                channel,
                subject,
                body,
                True
            ))
            count += 1

    conn.commit()
    print(f"   → Inserted {count} communication templates")
