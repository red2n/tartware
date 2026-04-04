import type { RawCategory } from "../catalog-types.js";

export const ROOM_UNIT_INVENTORY: RawCategory = {
  code: "ROOM_UNIT_INVENTORY",
  name: "Room, Unit & Inventory",
  description:
    "Room types, unit features, availability controls, and turnover workflows for hospitality operations.",
  icon: "meeting_room",
  color: "cyan",
  tags: ["inventory", "rooms"],
  sections: [
    {
      code: "ROOM_TYPE_CONFIGURATION",
      name: "Room Type Configuration",
      description:
        "Codes/names (Deluxe, Suite); descriptions; occupancy max; base pricing; size; bed configs; groupings; virtual types.",
      icon: "layers",
      definitions: [
        {
          code: "INVENTORY.ROOM_TYPE.CATALOG",
          name: "Room Type Catalog Template",
          description:
            "Defines the master room type structure, occupancy thresholds, and derived type rules.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "PROPERTY",
          allowedScopes: ["TENANT", "PROPERTY"],
          defaultValue: {
            baseTypes: [
              {
                code: "DLX",
                name: "Deluxe Room",
                maxOccupancy: 3,
                bedConfigurations: ["KING", "TWIN"],
                amenities: ["WIFI", "SMART_TV", "DESK"],
                virtual: false,
              },
              {
                code: "STE",
                name: "Suite",
                maxOccupancy: 4,
                bedConfigurations: ["KING", "SOFABED"],
                amenities: ["WIFI", "SMART_TV", "MINIBAR", "LOUNGE_ACCESS"],
                virtual: false,
              },
              {
                code: "STE-CLUB",
                name: "Suite - Club Access",
                parentCode: "STE",
                virtual: true,
                differentiators: ["CLUB_ACCESS"],
              },
            ],
            sizeUnits: "SQM",
            defaultAmenities: ["WIFI", "CLIMATE_CONTROL"],
          },
          tags: ["inventory", "rooms"],
          moduleDependencies: ["inventory-management"],
          referenceDocs: ["https://docs.tartware.com/settings/inventory/room-types"],
        },
      ],
    },
    {
      code: "INDIVIDUAL_ROOM_UNIT_MANAGEMENT",
      name: "Individual Room/Unit Management",
      description:
        "Numbers; floor; status (Clean, Dirty, OOO, Occupied); features (ADA, pet-friendly, connecting); amenities; maintenance history.",
      icon: "key",
      definitions: [
        {
          code: "INVENTORY.UNIT.PROFILE",
          name: "Unit Profile Configuration",
          description:
            "Defines the per-unit attribute schema, status transitions, and inspection requirements.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "UNIT",
          allowedScopes: ["PROPERTY", "UNIT"],
          defaultValue: {
            attributes: [
              { key: "floor", type: "number" },
              { key: "wing", type: "text" },
              { key: "ada_compliant", type: "boolean" },
              { key: "connecting_units", type: "multi-select" },
              { key: "view_type", type: "select", options: ["CITY", "SEA", "GARDEN"] },
            ],
            statusWorkflow: ["DIRTY", "IN_PROGRESS", "CLEAN", "INSPECTED", "READY"],
            inspectionChecklistTemplate: ["SMOKE_DETECTOR", "MINIBAR", "LINEN"],
          },
          tags: ["operations", "housekeeping"],
          moduleDependencies: ["operations"],
          referenceDocs: ["https://docs.tartware.com/settings/inventory/unit-management"],
        },
      ],
    },
    {
      code: "INVENTORY_AND_AVAILABILITY",
      name: "Inventory and Availability",
      description:
        "Allotments by type; overbooking limits; stop-sales; min/max LOS; CTA/CTD; upgrade allowances.",
      icon: "event_available",
      definitions: [
        {
          code: "INVENTORY.AVAILABILITY.RULES",
          name: "Inventory Availability Rules",
          description:
            "Controls allotments, overbooking policies, and availability restrictions per property.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "PROPERTY",
          allowedScopes: ["PROPERTY"],
          defaultValue: {
            defaultRestrictions: {
              minLengthOfStay: 1,
              maxLengthOfStay: 14,
              closeToArrival: [],
              closeToDeparture: [],
            },
            overbookingPolicy: {
              allowOverbooking: true,
              maxOverbookPercent: 5,
              autoReleaseHoursBeforeArrival: 24,
            },
            upgradePaths: [{ from: "DLX", to: "STE", conditions: ["OCCUPANCY_BELOW_70"] }],
          },
          tags: ["inventory", "yield"],
          moduleDependencies: ["distribution"],
          referenceDocs: ["https://docs.tartware.com/settings/inventory/availability"],
        },
      ],
    },
    {
      code: "TURNOVER_AND_FEATURES",
      name: "Turnover and Features",
      description:
        "Checklists for move-in/out; utility allocations; historical occupancy; custom tags.",
      icon: "playlist_add_check",
      definitions: [
        {
          code: "INVENTORY.TURNOVER.CHECKLISTS",
          name: "Turnover Checklist Templates",
          description:
            "Configures move-in/out checklists, utility handoffs, and tagging conventions.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "UNIT",
          allowedScopes: ["PROPERTY", "UNIT"],
          defaultValue: {
            moveIn: ["INSPECT_SMOKE_ALARMS", "CAPTURE_METER_READING", "PHOTOS"],
            moveOut: ["RETRIEVE_KEYS", "INSPECT_DAMAGE", "FINAL_METER_READ"],
            customTags: ["PET_FRIENDLY", "VIP_UNIT", "ACCESSIBLE"],
          },
          tags: ["operations", "turnover"],
          moduleDependencies: ["operations"],
          referenceDocs: ["https://docs.tartware.com/settings/inventory/turnover"],
        },
      ],
    },
  ],
};
