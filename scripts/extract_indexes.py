#!/usr/bin/env python3
"""
Extract indexes from table files and create separate index files
"""

import re
import os
from pathlib import Path

# Tables that need index extraction (45-89)
tables_with_indexes = [
    45, 46, 47, 48, 49, 54, 55, 56, 57, 58, 59,
    64, 65, 66, 67, 68, 69, 74, 75, 76, 77, 78, 79,
    84, 85, 86, 87, 88, 89
]

base_dir = Path("/home/navin/tartware/scripts")
tables_dir = base_dir / "tables"
indexes_dir = base_dir / "indexes"

for table_num in tables_with_indexes:
    # Find the table file
    table_files = list(tables_dir.glob(f"{table_num}_*.sql"))

    if not table_files:
        print(f"Warning: No table file found for {table_num}")
        continue

    table_file = table_files[0]
    table_name = table_file.stem.replace(f"{table_num}_", "")

    print(f"Processing {table_file.name}...")

    # Read the table file
    with open(table_file, 'r') as f:
        content = f.read()

    # Find the section with indexes
    index_match = re.search(
        r'(--[^\n]*[Ii]ndexes?[^\n]*\n)(.*?)(\n--[^\n]*[Cc]omments?\n|$)',
        content,
        re.DOTALL
    )

    if not index_match:
        print(f"  No indexes section found in {table_file.name}")
        continue

    indexes_section = index_match.group(2).strip()

    # Extract CREATE INDEX statements
    index_statements = []
    for line in indexes_section.split('\n'):
        if line.strip().startswith('CREATE INDEX') or line.strip().startswith('--'):
            index_statements.append(line)

    if not index_statements:
        print(f"  No index statements found in {table_file.name}")
        continue

    # Create the index file
    index_file = indexes_dir / f"{table_num}_{table_name}_indexes.sql"

    index_content = f"""-- =====================================================
-- {table_num}_{table_name}_indexes.sql
-- {table_name.replace('_', ' ').title()} Table Indexes
-- Date: 2025-10-17
-- =====================================================

\\c tartware

\\echo 'Creating {table_name} indexes...'

"""

    # Add indexes
    index_content += '\n'.join(index_statements)

    index_content += f"\n\n\\echo '{table_name.replace('_', ' ').title()} indexes created successfully!'\n"

    # Write the index file
    with open(index_file, 'w') as f:
        f.write(index_content)

    print(f"  Created {index_file.name}")

    # Remove indexes from table file
    # Find the comment section at the end
    comments_match = re.search(r'(--[^\n]*[Cc]omments?\n.*)', content, re.DOTALL)

    if comments_match:
        # Keep everything up to the indexes section and the comments
        new_content = content[:index_match.start()] + '\n' + comments_match.group(1)
    else:
        # Just remove the indexes section
        new_content = content[:index_match.start()]

    # Write the modified table file
    with open(table_file, 'w') as f:
        f.write(new_content.rstrip() + '\n')

    print(f"  Updated {table_file.name}")

print("\nDone! Created index files for all tables.")
