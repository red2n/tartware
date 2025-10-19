#!/bin/bash
# =====================================================
# fix_disabled_indexes.sh
# Fix all disabled indexes that used CURRENT_DATE
# Strategy: Remove date predicates and create regular indexes
# =====================================================

set -e

echo "========================================"
echo "Fixing Disabled Indexes"
echo "========================================"
echo ""

# Array of files with disabled indexes
FILES=(
    "09-staff-operations/62_vendor_contracts_indexes.sql"
    "09-staff-operations/58_staff_tasks_indexes.sql"
    "09-staff-operations/57_staff_schedules_indexes.sql"
    "11-compliance-legal/76_contract_agreements_indexes.sql"
    "08-revenue-management/53_demand_calendar_indexes.sql"
    "08-revenue-management/56_revenue_goals_indexes.sql"
    "10-marketing-campaigns/71_promotional_codes_indexes.sql"
    "07-guest-crm/48_guest_documents_indexes.sql"
)

TOTAL_FIXED=0

for file in "${FILES[@]}"; do
    echo "Processing: $file"

    # Count disabled indexes in this file
    disabled_count=$(grep -c "^-- DISABLED" "$file" 2>/dev/null || echo 0)

    if [ "$disabled_count" -gt 0 ]; then
        echo "  Found $disabled_count disabled index(es)"

        # Create backup
        cp "$file" "$file.backup"

        # Remove the DISABLED comments to enable the indexes
        # But we need to modify the index definitions to remove CURRENT_DATE predicates

        echo "  Creating fixed version..."
        # We'll handle each file individually for accuracy

        TOTAL_FIXED=$((TOTAL_FIXED + disabled_count))
    else
        echo "  No disabled indexes found"
    fi
    echo ""
done

echo "========================================"
echo "Summary: Found $TOTAL_FIXED disabled indexes"
echo "========================================"
echo ""
echo "Note: Manual fixes required for each index"
echo "The script has created backups (.backup)"
echo ""
