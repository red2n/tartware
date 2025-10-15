# Tartware Property Management System

**Enterprise-Grade Multi-Tenant Property Management System**

Version: 1.0.0
Last Updated: October 15, 2025

---

## 🏨 Overview

Tartware PMS is an enterprise-grade, cloud-native Property Management System designed following global hospitality industry standards. Built with PostgreSQL 16, it provides comprehensive multi-tenant support for hotel chains, franchises, and independent properties worldwide.

## 🌟 Key Features

- **Multi-Tenant Architecture** - Support for hotel chains, franchises, and management companies
- **Multi-Property Management** - Manage unlimited properties under one tenant
- **Real-Time Availability** - Dynamic room availability tracking and allocation
- **Advanced Rate Management** - Support for dynamic, seasonal, and strategic pricing
- **Comprehensive Reservations** - Full booking lifecycle management
- **Payment Processing** - Multiple payment methods and transaction types
- **Analytics & Reporting** - Business intelligence and KPI tracking
- **Housekeeping Management** - Task tracking and room status automation
- **Channel Management** - OTA and distribution channel integration
- **Role-Based Access Control** - Granular permissions management

## 📚 Documentation

### Getting Started
- [Quick Start Guide](getting-started.md)
- [Installation Guide](installation.md)
- [Configuration](configuration.md)

### Architecture & Design
- [Industry Standards Compliance](industry-standards.md) ⭐
- [Database Architecture](database-architecture.md)
- [Data Model Reference](data-model.md)
- [Multi-Tenancy Design](multi-tenancy.md)

### API & Integration
- [API Documentation](api-reference.md)
- [Channel Manager Integration](channel-integration.md)
- [Payment Gateway Integration](payment-integration.md)

### Operations
- [User Management](user-management.md)
- [Security Best Practices](security.md)
- [Backup & Recovery](backup-recovery.md)
- [Monitoring & Alerts](monitoring.md)

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Tartware PMS Platform                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Tenant A   │  │   Tenant B   │  │   Tenant C   │      │
│  │  (Marriott)  │  │   (Hilton)   │  │ (Independent)│      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐      │
│  │ Property 1   │  │ Property 1   │  │ Property 1   │      │
│  │ Property 2   │  │ Property 2   │  └──────────────┘      │
│  │ Property 3   │  └──────────────┘                         │
│  └──────────────┘                                            │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                PostgreSQL 16 Database                        │
│        Multi-Tenant Data Isolation & ACID Compliance        │
└─────────────────────────────────────────────────────────────┘
```

## 🌍 Industry Standards Compliance

Tartware PMS follows the architectural patterns and best practices established by leading global PMS providers:

| Standard | Provider | Region | Status |
|----------|----------|--------|--------|
| **Oracle OPERA Cloud** | Oracle Hospitality | Global (Hyatt, Marriott) | ✅ Compliant |
| **Cloudbeds Platform** | Cloudbeds | North America | ✅ Compliant |
| **Protel PMS** | Protel | Europe | ✅ Compliant |
| **RMS Cloud** | RMS | Asia-Pacific | ✅ Compliant |

[Read detailed compliance documentation →](industry-standards.md)

## 🗄️ Database Overview

### Technology Stack
- **Database**: PostgreSQL 16
- **Extensions**: uuid-ossp
- **Data Types**: UUID, JSONB, ENUM, Arrays
- **Architecture**: Multi-tenant with row-level isolation

### Core Components

#### 1. Multi-Tenancy Layer
- `tenants` - Organization/enterprise definitions
- `users` - System users with authentication
- `user_tenant_associations` - Role-based access control

#### 2. Property Management
- `properties` - Individual hotel properties
- `room_types` - Room category definitions
- `rooms` - Physical room inventory

#### 3. Reservations & Bookings
- `guests` - Guest profiles and preferences
- `reservations` - Booking records
- `reservation_status_history` - Status change tracking

#### 4. Financial Management ⭐ EXPANDED
- `payments` - Payment transactions
- `invoices` - Billing documents
- `invoice_items` - Line item details
- **NEW**: `folios` - Guest account ledgers
- **NEW**: `charge_postings` - Individual charges to folios
- **NEW**: `refunds` - Refund transaction tracking
- **NEW**: `deposit_schedules` - Automated deposit collection

#### 5. Revenue Management ⭐ NEW
- `rates` - Pricing strategies
- `allotments` - Block bookings and room allotments
- `booking_sources` - Channel tracking and commission management
- `market_segments` - Market segmentation for analysis
- `rate_overrides` - Manual rate adjustments with approval workflow

#### 6. Guest Services ⭐ EXPANDED
- `guests` - Guest profiles
- `guest_preferences` - Individual preferences and personalization
- Loyalty building and service tracking

#### 7. Operations Management ⭐ EXPANDED
- `housekeeping_tasks` - Task tracking
- `maintenance_requests` - Property maintenance with priority management
- `business_dates` - Business date management
- `night_audit_log` - Night audit execution tracking

#### 8. Availability System
- `availability.room_availability` - Real-time inventory
- Dynamic allocation and blocking

#### 9. Analytics & Reporting
- `analytics_metrics` - KPI tracking
- `analytics_reports` - Business intelligence

#### 10. System Monitoring ⭐ NEW
- Performance reporting and alerting
- Database health monitoring
- Threshold management and baselines

**Total Tables**: 37 (Phase 1+2 complete)
**Total Indexes**: 350+
**Foreign Key Constraints**: 150+

[View complete database schema →](database-architecture.md)

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- PostgreSQL client (optional)
- 2GB RAM minimum
- Linux/macOS/Windows with WSL

### Installation

```bash
# Clone the repository
git clone https://github.com/red2n/tartware.git
cd tartware

# Start services
sudo docker compose up -d

# Verify deployment
sudo docker ps
```

### Access Points

- **PostgreSQL**: `localhost:5432`
  - User: `postgres`
  - Password: `postgres`
  - Database: `tartware`

- **PgAdmin**: `http://localhost:5050` (or WSL IP)
  - Email: `admin@admin.com`
  - Password: `admin`

[Complete installation guide →](installation.md)

## 📊 Key Metrics

The system tracks essential hospitality KPIs:

- **Occupancy Rate** - Room utilization percentage
- **ADR** - Average Daily Rate
- **RevPAR** - Revenue Per Available Room
- **Total Revenue** - Gross revenue tracking
- **Booking Count** - Reservation volume
- **Cancellation Rate** - Booking cancellation percentage
- **Length of Stay** - Average guest stay duration
- **Lead Time** - Booking advance window

## 🔐 Security Features

- **Multi-Tenant Isolation** - Complete data separation between tenants
- **Row-Level Security** - Tenant-based access control
- **UUID Primary Keys** - Non-sequential identifiers
- **Soft Deletes** - Data retention and audit trails
- **Optimistic Locking** - Concurrent update protection
- **JSONB Encryption Support** - Sensitive data protection
- **Audit Trails** - Complete change tracking

## 🛠️ Development

### Database Migrations

```bash
# Create database
psql -U postgres -c "CREATE DATABASE tartware;"

# Run schema
psql -U postgres -d tartware -f 02-core-tables.sql

# Load sample data
psql -U postgres -d tartware -f 03-sample-data.sql
```

### Backup & Restore

```bash
# Backup
pg_dump -U postgres tartware > backup.sql

# Restore
psql -U postgres tartware < backup.sql
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: [https://red2n.github.io/tartware](https://red2n.github.io/tartware)
- **Issues**: [GitHub Issues](https://github.com/red2n/tartware/issues)
- **Discussions**: [GitHub Discussions](https://github.com/red2n/tartware/discussions)

## 🙏 Acknowledgments

This project follows industry standards established by:
- Oracle Hospitality (OPERA Cloud)
- Cloudbeds
- Protel GmbH
- RMS Cloud

---

**Built with ❤️ for the Global Hospitality Industry**
