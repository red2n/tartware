# Housekeeping Operations

## Room Status Codes

| Status | Code | Description | Next Valid States |
|--------|------|-------------|-------------------|
| **Vacant Clean** | VC | Ready for sale | OCC, OOO, OOS |
| **Vacant Dirty** | VD | Needs cleaning | VC (after cleaning) |
| **Occupied Clean** | OC | Guest in-house, serviced | OD (after use), VD (checkout) |
| **Occupied Dirty** | OD | Guest in-house, needs service | OC (after cleaning) |
| **Out of Order** | OOO | Maintenance required | VC/VD (after repair) |
| **Out of Service** | OOS | Temporarily unavailable | VC/VD (when released) |
| **Inspected** | INS | QC passed, ready for VIP | VC |
| **On Change** | CHG | Checkout in progress | VD |
| **Do Not Disturb** | DND | Guest declined service | OD |
| **Sleep Out** | SO | Occupied but bed not used | Investigation |

## Housekeeping Workflow

```
┌──────────────────────────────────────────────────────────────────────┐
│                   HOUSEKEEPING TASK FLOW                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐          │
│  │   VD     │──►│ ASSIGNED │──►│INPROGRESS│──►│   DONE   │          │
│  │(Dirty)   │   │(To Staff)│   │(Cleaning)│   │(Complete)│          │
│  └──────────┘   └──────────┘   └──────────┘   └────┬─────┘          │
│                                                     │                 │
│                                                     ▼                 │
│                                              ┌──────────┐             │
│                                              │INSPECTED │─► VC        │
│                                              │ (QC Pass)│   (Ready)   │
│                                              └──────────┘             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Task Types

| Task Type | Trigger | Time Standard | Priority |
|-----------|---------|---------------|----------|
| **Checkout Clean** | Guest departed | 25-35 min | High |
| **Stayover Service** | Occupied, daily | 15-20 min | Medium |
| **Turn-down** | Evening service | 5-10 min | Scheduled |
| **Deep Clean** | Periodic (7-14 days) | 45-60 min | Low |
| **Rush/VIP** | Early arrival, VIP | ASAP | Urgent |
| **Inspection** | Post-cleaning QC | 5 min | Per policy |
| **Refresh** | Touch-up only | 10 min | As needed |

## Room Priority Assignment

| Factor | Weight | Description |
|--------|--------|-------------|
| VIP arriving | Highest | C-suite, loyalty elite, celebrity |
| Early check-in | High | Paid or requested early arrival |
| Due out → Due in | High | Room turnover pressure |
| Checkout (no arrival) | Medium | Standard priority |
| Stayover | Medium | Scheduled service |
| Late departure | Low | Service after checkout |
| Do Not Disturb | Skip | Guest declined |

## Staffing Standards

| Metric | Industry Standard |
|--------|-------------------|
| Rooms per attendant per shift | 14-18 rooms |
| Square feet per hour | 1,500-2,000 sq ft |
| Turn-time (checkout) | 25-35 minutes |
| Stayover time | 15-20 minutes |
| Supervisor ratio | 1 supervisor : 10-15 attendants |
| Inspection rate | 100% checkouts, 20% stayovers |

## Cleaning Standards

### Checkout Room Checklist

| Area | Tasks |
|------|-------|
| **Entry** | Check door lock, signage, clean threshold |
| **Bathroom** | Sanitize fixtures, replace amenities, clean mirrors |
| **Bedroom** | Strip/make bed, dust surfaces, vacuum/mop |
| **Closet** | Check hangers, safe, iron, robes |
| **Desk/Work** | Clean surfaces, check supplies |
| **Minibar** | Inventory, restock, clean |
| **Final** | Check lights, AC, drapes, overall appearance |

### Green/Opt-out Programs

| Program | Guest Benefit | Hotel Benefit |
|---------|---------------|---------------|
| Skip service | Points/credit | Labor savings |
| Reuse towels | Environmental credit | Laundry savings |
| Reuse linens | Environmental credit | Laundry savings |

## Minibar Management

| Model | Description | Pros/Cons |
|-------|-------------|-----------|
| **Manual check** | Attendant inventory during service | Accurate, labor intensive |
| **Honor bar** | Guest self-reports consumption | Low labor, inaccurate |
| **Sensor automated** | Smart fridge tracks removal | Accurate, high tech cost |
| **Pre-order only** | Stock on request | Zero waste, less convenient |

## Lost and Found

| Category | Retention Period | Disposition |
|----------|------------------|-------------|
| High value (electronics, jewelry) | 90-180 days | Return or donate |
| Medium value (clothing, bags) | 60-90 days | Return or donate |
| Low value (toiletries) | 30 days | Dispose |
| Perishables | 24 hours | Dispose |
| ID/documents | Contact guest immediately | Return or authority |

## Maintenance Requests

| Priority | Response Time | Examples |
|----------|--------------|----------|
| Emergency | Immediate | Fire, flood, safety |
| Urgent | 30 min | No heat/AC, toilet blocked |
| Standard | 4 hours | Light bulb, minor repair |
| Scheduled | Next available | Deep clean, painting |

---

[← Back to Overview](../README.md)
