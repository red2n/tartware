# Disaster Recovery Guide

## Overview

This guide covers backup, restore, and disaster recovery procedures for Tartware production deployments. The system is designed for **Recovery Point Objective (RPO) < 1 hour** and **Recovery Time Objective (RTO) < 4 hours**.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Backup Strategy                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Daily Backups        │  Weekly Backups      │  Monthly Backups     │
│  - 30 day retention   │  - 12 week retention │  - 12 month retention│
│  - Full pg_dump       │  - Full pg_dump      │  - Full pg_dump      │
│  - AES-256 encrypted  │  - S3 uploaded       │  - Offsite archived  │
├─────────────────────────────────────────────────────────────────────┤
│  WAL Archiving (Optional)                                           │
│  - Continuous archiving for PITR                                    │
│  - RPO < 5 minutes possible                                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Running a Backup

```bash
# Daily backup (default)
./scripts/disaster-recovery/backup-database.sh full

# Weekly backup
./scripts/disaster-recovery/backup-database.sh full weekly

# Tenant-specific backup
./scripts/disaster-recovery/backup-database.sh tenant <tenant-uuid>

# Schema-only backup
./scripts/disaster-recovery/backup-database.sh schema
```

### Restoring from Backup

```bash
# List available backups
./scripts/disaster-recovery/restore-database.sh list

# Restore to existing database (replace mode)
./scripts/disaster-recovery/restore-database.sh full /path/to/backup.dump

# Restore to new database (preserves original)
./scripts/disaster-recovery/restore-database.sh full /path/to/backup.dump tartware-staging new

# Validate restoration
./scripts/disaster-recovery/restore-database.sh validate
```

## Backup Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DIR` | `/var/backups/tartware` | Local backup storage directory |
| `BACKUP_ENCRYPTION_KEY` | (none) | AES-256 encryption key |
| `BACKUP_S3_BUCKET` | (none) | S3 bucket for remote storage |
| `BACKUP_S3_PREFIX` | `tartware/backups` | S3 path prefix |
| `BACKUP_WEBHOOK_URL` | (none) | Slack/webhook for notifications |
| `RETENTION_DAYS` | `30` | Daily backup retention |
| `RETENTION_WEEKLY` | `12` | Weekly backup retention (weeks) |
| `RETENTION_MONTHLY` | `12` | Monthly backup retention (months) |

### Automated Backups (Kubernetes CronJob)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: tartware-daily-backup
  namespace: tartware-system
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: tartware/backup-tools:latest
            command:
            - /scripts/backup-database.sh
            - full
            - daily
            env:
            - name: PGHOST
              value: postgres-postgresql.database.svc.cluster.local
            - name: BACKUP_ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: backup-secrets
                  key: encryption-key
            volumeMounts:
            - name: backup-storage
              mountPath: /var/backups/tartware
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure

---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: tartware-weekly-backup
  namespace: tartware-system
spec:
  schedule: "0 3 * * 0"  # 3 AM Sunday
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: tartware/backup-tools:latest
            command:
            - /scripts/backup-database.sh
            - full
            - weekly
            env:
            - name: BACKUP_S3_BUCKET
              value: tartware-backups
          restartPolicy: OnFailure
```

## Disaster Recovery Procedures

### Scenario 1: Database Corruption

**Symptoms**: Query errors, data inconsistency, PostgreSQL refusing to start

**Recovery Steps**:

1. **Stop application services**
   ```bash
   kubectl scale deployment --all -n tartware-system --replicas=0
   ```

2. **Identify last good backup**
   ```bash
   ./scripts/disaster-recovery/restore-database.sh list
   ```

3. **Restore to temporary database first**
   ```bash
   ./scripts/disaster-recovery/restore-database.sh full /path/to/backup.dump tartware_recovery new
   ```

4. **Validate restored data**
   ```bash
   ./scripts/disaster-recovery/restore-database.sh validate tartware_recovery
   ```

5. **Promote recovery database**
   ```bash
   psql -c "ALTER DATABASE tartware RENAME TO tartware_corrupted"
   psql -c "ALTER DATABASE tartware_recovery RENAME TO tartware"
   ```

6. **Resume services**
   ```bash
   kubectl scale deployment --all -n tartware-system --replicas=-1
   ```

### Scenario 2: Accidental Data Deletion

**Symptoms**: Missing records, user reports of lost data

**Recovery Steps**:

1. **Identify affected tables and time range**
   ```sql
   SELECT tablename, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup;
   ```

2. **For soft-deleted data** (if within retention):
   ```sql
   UPDATE reservations SET deleted_at = NULL WHERE deleted_at > '2024-01-15';
   ```

3. **For hard-deleted data**, restore specific tables:
   ```bash
   ./scripts/disaster-recovery/restore-database.sh tables /path/to/backup.dump reservations guests
   ```

4. **For Point-in-Time Recovery** (if WAL archiving enabled):
   ```bash
   ./scripts/disaster-recovery/restore-database.sh pitr /path/to/base.dump "2024-01-15 14:30:00"
   ```

### Scenario 3: Complete Infrastructure Loss

**Symptoms**: Kubernetes cluster unavailable, all services down

**Recovery Steps**:

1. **Provision new infrastructure**
   ```bash
   ./executables/setup-kubernetes/setup-kubernetes.sh
   ```

2. **Deploy infrastructure components**
   ```bash
   cd platform && helmfile sync
   ```

3. **Restore database from S3**
   ```bash
   aws s3 cp s3://tartware-backups/daily/latest.dump /tmp/
   ./scripts/disaster-recovery/restore-database.sh full /tmp/latest.dump
   ```

4. **Deploy applications**
   ```bash
   helm upgrade --install tartware ./platform/helm -n tartware-system
   ```

5. **Verify health**
   ```bash
   kubectl get pods -n tartware-system
   curl https://api.tartware.local/health
   ```

### Scenario 4: Tenant Data Recovery

**Symptoms**: Single tenant reports issues, other tenants unaffected

**Recovery Steps**:

1. **Backup tenant data first** (current state)
   ```bash
   ./scripts/disaster-recovery/backup-database.sh tenant <tenant-id>
   ```

2. **Extract tenant data from full backup** to review:
   ```bash
   pg_restore --list /path/to/backup.dump | grep <tenant-id>
   ```

3. **For targeted restoration**, create a staging environment and run comparison queries.

## WAL Archiving Setup (PITR)

For sub-minute RPO, enable PostgreSQL WAL archiving:

### PostgreSQL Configuration

```ini
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://tartware-wal-archive/%f'
archive_timeout = 60

# For continuous archiving to local storage:
# archive_command = 'cp %p /archive/%f'
```

### Recovery Configuration

```ini
# recovery.conf (PostgreSQL < 12) or postgresql.auto.conf
restore_command = 'aws s3 cp s3://tartware-wal-archive/%f %p'
recovery_target_time = '2024-01-15 14:30:00'
recovery_target_action = 'promote'
```

## Monitoring Backup Health

### Prometheus Alerts

```yaml
groups:
- name: backup-alerts
  rules:
  - alert: BackupMissing
    expr: time() - max(backup_last_success_timestamp) > 86400
    for: 1h
    labels:
      severity: critical
    annotations:
      summary: "No successful backup in 24 hours"

  - alert: BackupFailed
    expr: backup_last_status == 0
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Last backup failed"
```

### Dashboard Query (backup_status_dashboard view)

```sql
SELECT * FROM backup_status_dashboard;
SELECT * FROM backup_rpo_status WHERE rpo_status != 'OK';
```

## Runbook Checklist

### Daily Verification

- [ ] Check backup completion notifications
- [ ] Verify backup file sizes are reasonable
- [ ] Confirm S3 upload success (if configured)

### Weekly Tasks

- [ ] Test restore to staging environment
- [ ] Verify checksum integrity
- [ ] Review backup retention compliance

### Monthly Tasks

- [ ] Full disaster recovery drill
- [ ] Update recovery documentation
- [ ] Review and optimize backup strategy

## Contact

- **On-Call DBA**: dba-oncall@tartware.local
- **DevOps Team**: devops@tartware.local
- **Escalation**: infra-escalation@tartware.local

## Related Documentation

- [Kubernetes Deployment Guide](./KUBERNETES_DEPLOYMENT.md)
- [Database Schema](../scripts/tables/00-create-all-tables.sql)
- [Migration Runner](../scripts/migrate.sh)
