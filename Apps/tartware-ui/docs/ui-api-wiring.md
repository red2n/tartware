# UI ↔ API Wiring Map

This note captures how the Angular UI talks to the Fastify/Node APIs today. It highlights three states:

- **Wired** – the UI already calls the API and renders the data.
- **Partially wired** – the UI reads data but mutation/advanced flows are stubbed.
- **Not yet wired** – the API exists but no UI code references it.

## Mermaid overview

```mermaid
flowchart LR
    subgraph UI["Angular UI touchpoints"]
        AuthUI["AuthService\ncore/services/auth.service.ts"]
        TenantUI["TenantContext + TenantService\ncore/services/tenant*.ts"]
        ModuleUI["ModuleService\ncore/services/module.service.ts"]
        PropertyUI["PropertyService\ncore/services/property.service.ts"]
        RoomUI["RoomsComponent + RoomService\nfeatures/pms/rooms/*"]
        HousekeepingUI["HousekeepingComponent + Service\nfeatures/pms/housekeeping/*"]
        ReservationsUI["ReservationsComponent + Service\nfeatures/pms/reservations/*"]
        GuestsUI["GuestsComponent + GuestService\nfeatures/pms/guests/*"]
        BillingUI["BillingComponent + Service\nfeatures/pms/billing/*"]
        DashboardUI["DashboardComponent + Service\nfeatures/pms/dashboard/*"]
        ReportsUI["ReportService\ncore/services/report.service.ts"]
        SettingsUI["SettingsComponent + CatalogService\nfeatures/pms/settings/*"]
        AdminUI["AdminUsersComponent + AdminApiService\nfeatures/admin/*"]
        StatusUI["StatusBarComponent\ncore/components/status-bar.component.ts"]
        Backlog["(future UI wiring)"]
    end

    subgraph API["Service endpoints"]
        AuthAPI["/v1/auth/*\ncore-service/routes/auth.ts"]
        TenantAPI["/v1/tenants\ncore-service/routes/tenants.ts"]
        ModuleAPI["/v1/modules/*\ncore-service/routes/modules.ts"]
        PropertyAPI["/v1/properties\ncore-service/routes/properties.ts"]
        RoomAPI["/v1/rooms\nrooms-service/routes/rooms.ts"]
        HousekeepingAPI["/v1/housekeeping/tasks\nhousekeeping-service/routes/housekeeping.ts"]
        ReservationsAPI["/v1/reservations\ncore-service/routes/reservations.ts"]
        GuestsAPI["/v1/guests\nguests-service/routes/guests.ts"]
        BillingAPI["/v1/billing/payments\nbilling-service/routes/billing.ts"]
        DashboardAPI["/v1/dashboard/*\ncore-service/routes/dashboard.ts"]
        ReportsAPI["/v1/reports/performance\ncore-service/routes/reports.ts"]
        SettingsAPI["/v1/settings/*\nsettings-service/routes/catalog.ts"]
        AdminAPI["/v1/system/*\ncore-service/routes/system-*.ts"]
        HealthAPI["/health\ncore-service/routes/health.ts"]
        UsersAPI["/v1/users\ncore-service/routes/users.ts"]
        AssocAPI["/v1/user-tenant-associations\ncore-service/routes/user-tenant-associations.ts"]
    end

    AuthUI --> AuthAPI
    TenantUI --> TenantAPI
    ModuleUI --> ModuleAPI
    PropertyUI --> PropertyAPI
    RoomUI --> RoomAPI
    HousekeepingUI --> HousekeepingAPI
    ReservationsUI -->|"list only / actions TBD"| ReservationsAPI
    GuestsUI -->|"list only / actions TBD"| GuestsAPI
    BillingUI --> BillingAPI
    DashboardUI --> DashboardAPI
    ReportsUI --> ReportsAPI
    SettingsUI -->|"read-only catalog"| SettingsAPI
    AdminUI --> AdminAPI
    StatusUI --> HealthAPI
    Backlog -. "awaiting UI" .-> UsersAPI
    Backlog -. "awaiting UI" .-> AssocAPI

    classDef wired fill:#c6f6d5,stroke:#2f855a,color:#1a202c,font-weight:bold;
    classDef partial fill:#fefcbf,stroke:#b7791f,color:#744210,font-weight:bold;
    classDef missing fill:#fed7d7,stroke:#c53030,color:#742a2a,font-weight:bold;

    class AuthAPI,TenantAPI,ModuleAPI,PropertyAPI,RoomAPI,HousekeepingAPI,BillingAPI,DashboardAPI,ReportsAPI,AdminAPI,HealthAPI wired;
    class ReservationsAPI,GuestsAPI,SettingsAPI partial;
    class UsersAPI,AssocAPI,Backlog missing;
```

## Status details

| Domain / Endpoint | Status | UI touchpoint(s) | Evidence |
| --- | --- | --- | --- |
| Auth (`/v1/auth/*`) | Wired | `AuthService` (`src/app/core/services/auth.service.ts`) handles `/auth/login` and `/auth/change-password`. | UI methods call the endpoints directly; Fastify route defined in `Apps/core-service/src/routes/auth.ts`. |
| Tenants (`/v1/tenants`) | Wired | `TenantService` + `TenantContextService` fetch and cache tenants (`src/app/core/services/tenant*.ts`). | Fastify route `Apps/core-service/src/routes/tenants.ts`. |
| Modules (`/v1/modules/catalog`, `/tenants/:id/modules`) | Wired | `ModuleService` (`src/app/core/services/module.service.ts`). | API routes `Apps/core-service/src/routes/modules.ts` and `routes/tenants.ts`. |
| Properties (`/v1/properties`) | Wired | `PropertyService` + PMS layout property selector (`src/app/core/services/property.service.ts`, `features/pms/pms-layout.component.ts`). | API route `Apps/core-service/src/routes/properties.ts`. |
| Rooms (`/v1/rooms`) | Wired | `RoomsComponent` + `RoomService` (`features/pms/rooms/*`, `core/services/room.service.ts`). | Route `Apps/rooms-service/src/routes/rooms.ts`. |
| Housekeeping (`/v1/housekeeping/tasks`) | Wired | `HousekeepingComponent` + `HousekeepingService` (`features/pms/housekeeping/*`). | Route `Apps/housekeeping-service/src/routes/housekeeping.ts`. |
| Reservations (`/v1/reservations`) | **Partially wired** | `ReservationService` feeds the grid, but `viewReservation`, `editReservation`, `cancelReservation` in `features/pms/reservations/reservations.component.ts:207-216` only log to console. | API list endpoint exists in `Apps/core-service/src/routes/reservations.ts`; mutation flows still TODO on UI. |
| Guests (`/v1/guests`) | **Partially wired** | `GuestService` loads data, yet `viewGuest` / `messageGuest` in `features/pms/guests/guests.component.ts:153-166` are placeholders. | API list endpoint: `Apps/guests-service/src/routes/guests.ts`. |
| Billing (`/v1/billing/payments`) | Wired | `BillingComponent` + `BillingService` (`features/pms/billing/*`, `core/services/billing.service.ts`). | Route file `Apps/billing-service/src/routes/billing.ts`. |
| Dashboard (`/v1/dashboard/*`) | Wired | `DashboardService` powering `DashboardComponent` (`features/pms/dashboard/dashboard.component.ts`). | API routes `Apps/core-service/src/routes/dashboard.ts`. |
| Reports (`/v1/reports/performance`) | Wired | `ReportService` (`src/app/core/services/report.service.ts`). | Route `Apps/core-service/src/routes/reports.ts`. |
| Settings catalog (`/v1/settings/*`) | **Partially wired** | `SettingsComponent` renders catalog/value data, but `updateTenantProfile` in `features/pms/settings/settings.component.ts:166-168` is a stub. | API served by `Apps/settings-service/src/routes/catalog.ts`. |
| Platform admin (`/v1/system/*`) | Wired | `AdminUsersComponent` + `AdminApiService` (`src/app/core/services/admin-api.service.ts`, `features/admin/admin-users.component.ts`). | Routes under `Apps/core-service/src/routes/system-*.ts`. |
| Health (`/health`) | Wired | `StatusBarComponent` polls health endpoint (`src/app/core/components/status-bar.component.ts:218-329`). | Route `Apps/core-service/src/routes/health.ts`. |
| Users (`/v1/users`) | **Not wired** | No references to `/v1/users` under `Apps/tartware-ui/src` (`rg -n "/v1/users" Apps/tartware-ui/src` returns nothing). | API route exists in `Apps/core-service/src/routes/users.ts`. |
| User ↔ Tenant associations (`/v1/user-tenant-associations`) | **Not wired** | No UI service hits this endpoint (`rg -n "user-tenant-associations" Apps/tartware-ui/src` yields no matches). | Route lives in `Apps/core-service/src/routes/user-tenant-associations.ts`. |

### How to extend

- When wiring a new UI flow, add the service/component path to the table above so auditors can trace it quickly.
- Consider exporting this Mermaid diagram in release notes whenever a module crosses from “backlog” to “wired.”
- If you add new API routes under `Apps/core-service/src/routes`, run `rg "/v1/"` in `Apps/tartware-ui/src` to verify the UI actually references them before calling the wiring complete.
