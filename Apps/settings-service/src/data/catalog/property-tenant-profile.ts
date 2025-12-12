import type { RawCategory } from "../catalog-types.js";

export const PROPERTY_TENANT_PROFILE: RawCategory = {
  code: "PROPERTY_TENANT_PROFILE",
  name: "Property & Tenant Profiles",
  description:
    "Property master data, tenant/guest profiles, personalization, and compliance templates.",
  icon: "apartment",
  color: "teal",
  tags: ["profiles", "personalization"],
  sections: [
    {
      code: "PROPERTY_PROFILE",
      name: "Property Profile",
      description:
        "Name, code, type (hotel, residential, resort); address, geolocation; contact info; star rating; room count; check-in/out times; time zone; legal/tax IDs; operating hours.",
      icon: "location_city",
      definitions: [
        {
          code: "PROFILE.PROPERTY.MASTER",
          name: "Property Master Profile Template",
          description: "Defines the canonical property profile structure and mandatory attributes.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "PROPERTY",
          allowedScopes: ["TENANT", "PROPERTY"],
          defaultValue: {
            requiredFields: [
              "property_name",
              "property_code",
              "property_type",
              "time_zone",
              "check_in_time",
              "check_out_time",
            ],
            optionalFields: ["star_rating", "branding_theme", "social_media_links"],
            geo: { lat: null, lng: null },
            taxIdentification: {
              required: true,
              fields: ["registration_number", "tax_id"],
            },
          },
          tags: ["profiles", "operations"],
          moduleDependencies: ["core-platform"],
          referenceDocs: ["https://docs.tartware.com/settings/property/profile"],
        },
      ],
    },
    {
      code: "TENANT_GUEST_PROFILE_FIELDS",
      name: "Tenant/Guest Profile Fields",
      description:
        "Mandatory fields (contact, emergency, ID docs); custom fields (pets, vehicles, nationality); VIP status; history tracking.",
      icon: "contacts",
      definitions: [
        {
          code: "PROFILE.GUEST.FIELDS",
          name: "Guest Profile Field Catalog",
          description: "Configures base guest fields, custom attributes, and retention behavior.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT", "TENANT_TEMPLATE"],
          overrideScopes: ["USER"],
          defaultValue: {
            baseFields: ["first_name", "last_name", "email", "phone", "nationality"],
            customFields: [
              { key: "pet_preference", type: "select", options: ["NONE", "DOG", "CAT"] },
              { key: "vehicle_plate", type: "text" },
            ],
            retentionPolicyDays: 1095,
            highlightedFlags: ["VIP_STATUS", "LOYALTY_TIER"],
          },
          formSchema: {
            type: "fieldCatalog",
            fieldTypes: ["text", "date", "select", "boolean"],
            allowConditionalLogic: true,
          },
          tags: ["profiles", "personalization"],
          moduleDependencies: ["guest-experience"],
          referenceDocs: ["https://docs.tartware.com/settings/guest/profile-fields"],
        },
      ],
    },
    {
      code: "PREFERENCES_PERSONALIZATION",
      name: "Preferences & Personalization",
      description:
        "Room preferences; dietary/allergies; communication channels; special occasions; loyalty status.",
      icon: "favorite",
      definitions: [
        {
          code: "PROFILE.GUEST.PREFERENCES",
          name: "Guest Preference Library",
          description: "Stores available preference categories and personalization tokens.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            categories: [
              {
                key: "ROOM",
                options: ["HIGH_FLOOR", "SEA_VIEW", "QUIET_WING", "ADJOINING"],
              },
              {
                key: "DIET",
                options: ["VEGAN", "GLUTEN_FREE", "HALAL", "KOSHER"],
              },
              {
                key: "COMMUNICATION",
                options: ["EMAIL", "SMS", "WHATSAPP", "PUSH"],
              },
            ],
            personalNotesLimit: 1000,
          },
          tags: ["personalization", "guest-experience"],
          moduleDependencies: ["guest-experience"],
          referenceDocs: ["https://docs.tartware.com/settings/guest/preferences"],
        },
      ],
    },
    {
      code: "COMPLIANCE_RULES",
      name: "Compliance Rules",
      description:
        "Fair housing; eviction notices; GDPR consents; data retention; tax exemptions by nationality/guest type.",
      icon: "gavel",
      definitions: [
        {
          code: "PROFILE.COMPLIANCE.RULES",
          name: "Profile Compliance & Retention",
          description:
            "Defines regulatory policies for data retention, consent capture, and disclosure workflows.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            gdpr: {
              consentTypes: ["MARKETING", "THIRD_PARTY_SHARING"],
              autoExpireDays: 730,
            },
            fairHousing: {
              requireDisclosure: true,
              documentTemplates: ["notice_of_entry", "eviction_notice"],
            },
            retention: {
              activeTenantDays: 1825,
              inactiveTenantDays: 1095,
            },
          },
          tags: ["compliance-gdpr", "legal"],
          moduleDependencies: ["core-platform"],
          referenceDocs: ["https://docs.tartware.com/settings/compliance/profile"],
          sensitivity: "CONFIDENTIAL",
        },
      ],
    },
  ],
};
