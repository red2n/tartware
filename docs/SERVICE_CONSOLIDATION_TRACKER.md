# Service Consolidation Tracker

Last Updated: 2026-04-01

This file tracks which standalone service folders have been consolidated into host services and removed.

## Completed And Removed

| Standalone Service | Hosted In | Hosted Module Path | Standalone Folder Removed |
|---|---|---|---|
| settings-service | core-service | Apps/core-service/src/modules/settings-service | Yes |
| guest-experience-service | guests-service | Apps/guests-service/src/modules/guest-experience-service | Yes |
| recommendation-service | rooms-service | Apps/rooms-service/src/modules/recommendation-service | Yes |
| calculation-service | rooms-service | Apps/rooms-service/src/modules/calculation-service | Yes |
| service-registry | command-center-service | Apps/command-center-service/src/modules/service-registry | Yes |
| cashier-service | billing-service | Apps/billing-service/src/modules/cashier-service | Yes |
| notification-service | guests-service | Apps/guests-service/src/modules/notification-service | Yes |
| accounts-service | finance-admin-service | Apps/finance-admin-service/src/modules/accounts-service | Yes |
| revenue-service | finance-admin-service | Apps/finance-admin-service/src/modules/revenue-service | Yes |
| roll-service | command-center-service | Apps/command-center-service/src/modules/roll-service | Yes |

## Still Standalone

These are still separate service folders in Apps and have not yet been consolidated:

- api-gateway
- availability-guard-service
- billing-service
- command-center-service
- core-service
- finance-admin-service
- guests-service
- housekeeping-service
- reservations-command-service
- rooms-service

## Rule For Future Steps

After each consolidation step is validated (build passes + routing defaults updated + process count confirmed), do all three items in the same PR:

1. Add/verify hosted module in target service.
2. Remove standalone folder from Apps.
3. Update this tracker row.
