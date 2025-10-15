# 🧪 Tartware PMS - Verification Guide

Quick reference for validating your database installation.

## 📋 Quick Start

### 1️⃣ Complete Verification (Recommended)

```bash
cd /home/navin/tartware/scripts
psql -U postgres -d tartware -f verify-all.sql
```

**What it checks:**
- ✅ Tables (22 expected)
- ✅ Indexes (~250+ expected)
- ✅ Constraints (~60+ FK expected)
- ✅ Procedures (14 expected)
- ✅ Soft delete implementation
- ✅ Multi-tenancy setup
- ✅ Overall quality score

**Expected output:** Grade A+ (100/100) for complete installation

---

## 🎯 Component-Level Verification

### Tables Verification

```bash
psql -U postgres -d tartware -f tables/verify-tables.sql
```

**Validates:**
- Table existence (22 tables)
- Column structure and data types
- Soft delete implementation (18 tables)
- Multi-tenancy (20 tables with tenant_id)
- Primary keys (UUID)
- Audit fields (created_at, updated_at, etc.)
- JSONB columns
- Unique constraints
- Table sizes

**Expected:**
- ✅ 22 tables created
- ✅ 18 with soft delete
- ✅ 20 with tenant_id
- ✅ All UUID primary keys
- ✅ Complete audit trails

---

### Indexes Verification

```bash
psql -U postgres -d tartware -f indexes/verify-indexes.sql
```

**Validates:**
- Index counts by table (~250+ total)
- Foreign key index coverage (100%)
- Partial indexes for soft delete
- Composite indexes
- Index sizes and bloat
- Unused indexes
- JSONB GIN indexes
- Trigram text search indexes
- Coverage analysis

**Expected:**
- ✅ 250+ indexes created
- ✅ All foreign keys indexed
- ✅ Partial indexes for active records
- ✅ No missing critical indexes
- ⚠️ Unused indexes normal for new database

---

### Constraints Verification

```bash
psql -U postgres -d tartware -f constraints/verify-constraints.sql
```

**Validates:**
- Foreign key constraints (~60+)
- DELETE RESTRICT policy (100%)
- UPDATE CASCADE policy (100%)
- Multi-tenancy enforcement
- Orphaned record checks
- Constraint naming conventions
- Self-referencing constraints
- Cross-schema constraints

**Expected:**
- ✅ 60+ foreign key constraints
- ✅ 100% DELETE RESTRICT
- ✅ 100% UPDATE CASCADE
- ✅ No orphaned records
- ✅ Consistent naming

---

### Procedures Verification

```bash
psql -U postgres -d tartware -f procedures/verify-procedures.sql
```

**Validates:**
- Procedure existence (14 functions)
- Procedure categories:
  - Guest Management (3)
  - Channel Sync (3)
  - Rate Management (4)
  - Analytics (4)
- Function signatures
- Implementation language (plpgsql)
- Basic functionality tests
- Table dependencies
- Documentation comments
- PostgreSQL version (MERGE requires 15+)

**Expected:**
- ✅ 14 procedures created
- ✅ All using plpgsql
- ✅ PostgreSQL 15+ for MERGE support
- ✅ All basic tests pass

---

## 📊 Interpretation Guide

### Quality Score Grading

| Score | Grade | Status | Action |
|-------|-------|--------|--------|
| 100 | A+ (PERFECT) | ✅ Production Ready | None - deploy! |
| 90-99 | A (EXCELLENT) | ✅ Production Ready | Optional refinements |
| 80-89 | B (GOOD) | ⚠️ Minor Issues | Review recommendations |
| 70-79 | C (ACCEPTABLE) | ⚠️ Improvements Needed | Fix before production |
| <70 | F (INCOMPLETE) | ❌ Critical Issues | Re-run installation |

---

## 🔍 Common Issues & Solutions

### Issue: Missing Tables

**Symptom:** Table count < 22

**Solution:**
```bash
cd /home/navin/tartware/scripts
# Re-run table creation
for f in tables/*.sql; do
    psql -U postgres -d tartware -f "$f"
done
```

---

### Issue: Missing Indexes

**Symptom:** Index count < 250

**Solution:**
```bash
cd /home/navin/tartware/scripts
psql -U postgres -d tartware -f indexes/00-create-all-indexes.sql
```

---

### Issue: Missing Constraints

**Symptom:** Constraint count < 60

**Solution:**
```bash
cd /home/navin/tartware/scripts
psql -U postgres -d tartware -f constraints/00-create-all-constraints.sql
```

---

### Issue: Missing Procedures

**Symptom:** Procedure count < 14 or MERGE not supported

**Check PostgreSQL version:**
```bash
psql -U postgres -d tartware -c "SELECT version();"
```

**If < PostgreSQL 15:**
```bash
# Upgrade to PostgreSQL 15+ for MERGE support
# MERGE command requires PostgreSQL 15 or higher
```

**If version OK, re-run:**
```bash
cd /home/navin/tartware/scripts
psql -U postgres -d tartware -f procedures/00-create-all-procedures.sql
```

---

## 🚀 Production Readiness Checklist

Run this checklist before deploying to production:

```bash
# 1. Complete verification
psql -U postgres -d tartware -f verify-all.sql

# 2. Check for errors in logs
# Review output for any ERROR or WARNING messages

# 3. Verify sample data (if Phase 3 completed)
psql -U postgres -d tartware -c "
SELECT
    (SELECT COUNT(*) FROM tenants) as tenants,
    (SELECT COUNT(*) FROM properties) as properties,
    (SELECT COUNT(*) FROM guests) as guests,
    (SELECT COUNT(*) FROM reservations) as reservations;
"

# 4. Test stored procedures
psql -U postgres -d tartware -c "
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
"

# 5. Verify backup strategy
# Ensure pg_dump works:
pg_dump -U postgres -d tartware -f /tmp/tartware_backup.sql

# 6. Performance baseline
psql -U postgres -d tartware -c "
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
FROM pg_tables
WHERE schemaname IN ('public', 'availability')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
"
```

---

## 📞 Support & Documentation

- **Main README:** `/scripts/README.md`
- **Soft Delete Policy:** `/scripts/SOFT_DELETE_POLICY.md`
- **Tables Documentation:** `/scripts/tables/README.md`
- **Indexes Documentation:** `/scripts/indexes/README.md`
- **Constraints Documentation:** `/scripts/constraints/README.md`
- **Procedures Documentation:** `/scripts/procedures/README.md`

---

## 🎯 Next Steps After Verification

If all verifications pass (Grade A or A+):

1. **Phase 3: Sample Data**
   - Generate multi-tenant test data
   - Create complete reservation lifecycle
   - Populate analytics metrics

2. **Integration Testing**
   - Test stored procedures with real data
   - Validate channel sync workflows
   - Test analytics aggregations

3. **Performance Testing**
   - Load testing with realistic data volumes
   - Query optimization
   - Index tuning

4. **Production Deployment**
   - Backup current database
   - Deploy to production
   - Monitor performance

---

**Last Updated:** 2025-10-15
**Database Version:** PostgreSQL 16
**Tartware Version:** 1.0
