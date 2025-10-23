"""Insert function for package_components table"""

from data_store import data_store
from db_config import generate_uuid
from faker import Faker
import random

fake = Faker()


def insert_package_components(conn):
    """Insert package component records (items included in packages)"""

    if not data_store.get('packages'):
        print("\n⚠ Skipping Package Components (no packages found)")
        return

    print(f"\n✓ Inserting Package Components...")
    cur = conn.cursor()

    component_types = [
        'room', 'breakfast', 'lunch', 'dinner', 'spa_treatment',
        'golf_round', 'activity', 'transfer', 'amenity', 'upgrade'
    ]

    inclusion_types = ['included', 'optional', 'upgrade']

    total_components = 0
    for package in data_store['packages']:
        # Each package has 2-6 components
        num_components = random.randint(2, 6)

        # Always include room
        components_to_add = ['room']

        # Add other components based on package type
        if 'breakfast' in package['package_type'] or 'board' in package['package_type']:
            components_to_add.append('breakfast')
        if 'half_board' in package['package_type'] or 'full_board' in package['package_type']:
            components_to_add.extend(['lunch', 'dinner'])
        if 'spa' in package['package_type']:
            components_to_add.extend(['spa_treatment', 'amenity'])
        if 'golf' in package['package_type']:
            components_to_add.append('golf_round')
        if 'romance' in package['package_type']:
            components_to_add.extend(['dinner', 'amenity', 'upgrade'])

        # Fill up to num_components
        while len(components_to_add) < num_components:
            comp = random.choice(component_types)
            if comp not in components_to_add:
                components_to_add.append(comp)

        # Create component records
        for seq, component_type in enumerate(components_to_add[:num_components], 1):
            component_id = generate_uuid()

            # Component names
            component_names = {
                'room': 'Accommodation',
                'breakfast': 'Daily Breakfast',
                'lunch': 'Daily Lunch',
                'dinner': 'Daily Dinner',
                'spa_treatment': 'Spa Treatment',
                'golf_round': 'Golf Round',
                'activity': 'Activity/Tour',
                'transfer': 'Airport Transfer',
                'amenity': 'Welcome Amenity',
                'upgrade': 'Room Upgrade'
            }

            component_name = component_names.get(component_type, component_type.replace('_', ' ').title())

            # Pricing
            if component_type == 'room':
                cost_per_unit = 0.00  # Included in base
                inclusion_type = 'included'
            elif component_type in ['breakfast', 'lunch', 'dinner']:
                cost_per_unit = round(random.uniform(15, 40), 2)
                inclusion_type = 'included' if 'board' in package['package_type'] else random.choice(['included', 'optional'])
            elif component_type in ['spa_treatment', 'golf_round']:
                cost_per_unit = round(random.uniform(50, 150), 2)
                inclusion_type = random.choice(['included', 'optional', 'upgrade'])
            else:
                cost_per_unit = round(random.uniform(10, 80), 2)
                inclusion_type = random.choice(['included', 'optional'])

            # Quantity
            if component_type in ['breakfast', 'lunch', 'dinner']:
                quantity_per_package = 'per_night'
                default_quantity = 2  # per person
            elif component_type == 'room':
                quantity_per_package = 'per_stay'
                default_quantity = 1
            else:
                quantity_per_package = random.choice(['per_stay', 'per_person'])
                default_quantity = random.randint(1, 2)

            # Map component types to schema-valid types
            schema_component_type = {
                'room': 'service',
                'breakfast': 'meal',
                'lunch': 'meal',
                'dinner': 'meal',
                'spa_treatment': 'service',
                'golf_round': 'activity',
                'activity': 'activity',
                'transfer': 'transportation',
                'amenity': 'amenity',
                'upgrade': 'upgrade'
            }.get(component_type, 'service')

            # Map pricing types
            pricing_type = {
                'per_night': 'per_night',
                'per_stay': 'per_stay',
                'per_person': 'per_person'
            }.get(quantity_per_package, 'per_stay')

            cur.execute("""
                INSERT INTO package_components (
                    component_id, package_id,
                    component_type, component_name, component_description,
                    quantity, pricing_type,
                    unit_price, is_included, is_optional,
                    display_order, highlight,
                    is_active, is_mandatory,
                    created_at
                )
                VALUES (
                    %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s
                )
            """, (
                component_id, package['id'],
                schema_component_type, component_name, fake.text(max_nb_chars=200),
                default_quantity, pricing_type,
                cost_per_unit, inclusion_type == 'included', inclusion_type == 'optional',
                seq, component_type in ['spa_treatment', 'dinner', 'upgrade'],
                True, component_type == 'room',
                fake.date_time_between(start_date='-6m', end_date='now')
            ))

            total_components += 1

    conn.commit()
    print(f"   → Inserted {total_components} package components")
