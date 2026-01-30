#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(__dirname, "default_seed.json");

const loadDataset = () => {
  if (!fs.existsSync(SEED_FILE)) {
    throw new Error(`Seed file not found: ${SEED_FILE}`);
  }
  const raw = fs.readFileSync(SEED_FILE, "utf-8");
  return JSON.parse(raw);
};

const jsonb = (value) => (value === undefined || value === null ? null : JSON.stringify(value));

const nowDate = () => new Date().toISOString().slice(0, 10);

const pool = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? "5432"),
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "postgres",
  database: process.env.DB_NAME ?? "tartware",
  max: 2,
});

let seedActorId = "00000000-0000-0000-0000-000000000000";
let defaultTenantId = null;

const upsertTenants = async (client, tenants = []) => {
  for (const tenant of tenants) {
    await client.query(
      `
        INSERT INTO tenants AS t (
          id, tenant_id, name, slug, type, status, email, phone, website, country,
          config, subscription, metadata, created_at, updated_at, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          COALESCE($11::jsonb, '{}'::jsonb),
          COALESCE($12::jsonb, '{}'::jsonb),
          COALESCE($13::jsonb, '{}'::jsonb),
          NOW(), NOW(), $14, $14
        )
        ON CONFLICT (id) DO UPDATE
        SET
          tenant_id = EXCLUDED.tenant_id,
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          type = EXCLUDED.type,
          status = EXCLUDED.status,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          website = EXCLUDED.website,
          country = EXCLUDED.country,
          config = EXCLUDED.config,
          subscription = EXCLUDED.subscription,
          metadata = COALESCE(t.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW(),
          updated_by = $14,
          version = COALESCE(t.version, 0) + 1;
      `,
      [
        tenant.id,
        tenant.tenantId ?? tenant.id,
        tenant.name,
        tenant.slug,
        tenant.type,
        tenant.status,
        tenant.email,
        tenant.phone ?? null,
        tenant.website ?? null,
        tenant.country ?? null,
        jsonb(tenant.config),
        jsonb(tenant.subscription),
        jsonb(tenant.metadata),
        seedActorId,
      ],
    );
  }
};

const upsertProperties = async (client, properties = []) => {
  for (const property of properties) {
    await client.query(
      `
        INSERT INTO properties AS p (
          id, tenant_id, property_name, property_code, address, phone, email, website,
          property_type, star_rating, total_rooms, currency, timezone,
          config, metadata, created_at, updated_at, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, COALESCE($5::jsonb, '{}'::jsonb), $6, $7, $8,
          $9, $10, $11, $12, $13,
          COALESCE($14::jsonb, '{}'::jsonb),
          COALESCE($15::jsonb, '{}'::jsonb),
          NOW(), NOW(), $16, $16
        )
        ON CONFLICT (id) DO UPDATE
        SET
          tenant_id = EXCLUDED.tenant_id,
          property_name = EXCLUDED.property_name,
          property_code = EXCLUDED.property_code,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          website = EXCLUDED.website,
          property_type = EXCLUDED.property_type,
          star_rating = EXCLUDED.star_rating,
          total_rooms = EXCLUDED.total_rooms,
          currency = EXCLUDED.currency,
          timezone = EXCLUDED.timezone,
          config = EXCLUDED.config,
          metadata = COALESCE(p.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW(),
          updated_by = $16,
          version = COALESCE(p.version, 0) + 1;
      `,
      [
        property.id,
        property.tenantId,
        property.propertyName,
        property.propertyCode,
        jsonb(property.address),
        property.phone ?? null,
        property.email ?? null,
        property.website ?? null,
        property.propertyType ?? "hotel",
        property.starRating ?? null,
        property.totalRooms ?? 0,
        property.currency ?? "USD",
        property.timezone ?? "UTC",
        jsonb(property.config),
        jsonb(property.metadata),
        seedActorId,
      ],
    );
  }
};

const upsertUsers = async (client, users = []) => {
  for (const user of users) {
    await client.query(
      `
        INSERT INTO users AS u (
          id, tenant_id, username, email, password_hash, first_name, last_name, phone,
          is_active, is_verified, metadata, created_at, updated_at, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          COALESCE($9, TRUE), COALESCE($10, FALSE),
          COALESCE($11::jsonb, '{}'::jsonb),
          NOW(), NOW(), $12, $12
        )
        ON CONFLICT (id) DO UPDATE
        SET
          tenant_id = EXCLUDED.tenant_id,
          username = EXCLUDED.username,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = EXCLUDED.phone,
          is_active = EXCLUDED.is_active,
          is_verified = EXCLUDED.is_verified,
          metadata = COALESCE(u.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW(),
          updated_by = $12,
          version = COALESCE(u.version, 0) + 1;
      `,
      [
        user.id,
        user.tenantId ?? defaultTenantId,
        user.username,
        user.email,
        user.passwordHash,
        user.firstName,
        user.lastName,
        user.phone ?? null,
        user.isActive ?? true,
        user.isVerified ?? false,
        jsonb(user.metadata),
        seedActorId,
      ],
    );
  }
};

const upsertUserTenantAssociations = async (client, associations = []) => {
  for (const association of associations) {
    await client.query(
      `
        INSERT INTO user_tenant_associations AS uta (
          user_id, tenant_id, role, is_active, permissions, modules, metadata,
          created_at, updated_at, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, TRUE,
          COALESCE($4::jsonb, '{}'::jsonb),
          COALESCE($5::jsonb, '["core"]'::jsonb),
          COALESCE($6::jsonb, '{}'::jsonb),
          NOW(), NOW(), $7, $7
        )
        ON CONFLICT (user_id, tenant_id) DO UPDATE
        SET
          role = EXCLUDED.role,
          is_active = TRUE,
          permissions = EXCLUDED.permissions,
          modules = EXCLUDED.modules,
          metadata = COALESCE(uta.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW(),
          updated_by = $7,
          version = COALESCE(uta.version, 0) + 1;
      `,
      [
        association.userId,
        association.tenantId,
        association.role ?? "OWNER",
        jsonb(association.permissions),
        jsonb(association.modules ?? ["core", "reservations", "housekeeping", "billing"]),
        jsonb(association.metadata),
        seedActorId,
      ],
    );
  }
};

const upsertRoomTypes = async (client, roomTypes = []) => {
  for (const roomType of roomTypes) {
    await client.query(
      `
        INSERT INTO room_types AS rt (
          id, tenant_id, property_id, type_name, type_code, description, short_description,
          category, base_occupancy, max_occupancy, max_adults, max_children,
          size_sqm, bed_type, number_of_beds, amenities, features,
          base_price, currency, images, display_order, is_active, metadata,
          created_at, updated_at, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, COALESCE($16::jsonb, '[]'::jsonb),
          COALESCE($17::jsonb, '{}'::jsonb),
          $18, $19, COALESCE($20::jsonb, '[]'::jsonb),
          COALESCE($21, 0), TRUE,
          COALESCE($22::jsonb, '{}'::jsonb),
          NOW(), NOW(), $23, $23
        )
        ON CONFLICT (id) DO UPDATE
        SET
          tenant_id = EXCLUDED.tenant_id,
          property_id = EXCLUDED.property_id,
          type_name = EXCLUDED.type_name,
          type_code = EXCLUDED.type_code,
          description = EXCLUDED.description,
          short_description = EXCLUDED.short_description,
          category = EXCLUDED.category,
          base_occupancy = EXCLUDED.base_occupancy,
          max_occupancy = EXCLUDED.max_occupancy,
          max_adults = EXCLUDED.max_adults,
          max_children = EXCLUDED.max_children,
          size_sqm = EXCLUDED.size_sqm,
          bed_type = EXCLUDED.bed_type,
          number_of_beds = EXCLUDED.number_of_beds,
          amenities = EXCLUDED.amenities,
          features = EXCLUDED.features,
          base_price = EXCLUDED.base_price,
          currency = EXCLUDED.currency,
          images = EXCLUDED.images,
          display_order = EXCLUDED.display_order,
          metadata = COALESCE(rt.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW(),
          updated_by = $23,
          version = COALESCE(rt.version, 0) + 1;
      `,
      [
        roomType.id,
        roomType.tenantId,
        roomType.propertyId,
        roomType.typeName,
        roomType.typeCode,
        roomType.description ?? null,
        roomType.shortDescription ?? null,
        roomType.category ?? "STANDARD",
        roomType.baseOccupancy ?? 2,
        roomType.maxOccupancy ?? roomType.baseOccupancy ?? 2,
        roomType.maxAdults ?? 2,
        roomType.maxChildren ?? 0,
        roomType.sizeSqm ?? null,
        roomType.bedType ?? null,
        roomType.numberOfBeds ?? 1,
        jsonb(roomType.amenities ?? []),
        jsonb(roomType.features ?? {}),
        roomType.basePrice ?? 0,
        roomType.currency ?? "USD",
        jsonb(roomType.images ?? []),
        roomType.displayOrder ?? 0,
        jsonb(roomType.metadata),
        seedActorId,
      ],
    );
  }
};

const upsertRooms = async (client, rooms = []) => {
  for (const room of rooms) {
    await client.query(
      `
        INSERT INTO rooms AS r (
          id, tenant_id, property_id, room_type_id, room_number, room_name, floor,
          status, housekeeping_status, maintenance_status, features, metadata,
          created_at, updated_at, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          COALESCE($11::jsonb, '{}'::jsonb),
          COALESCE($12::jsonb, '{}'::jsonb),
          NOW(), NOW(), $13, $13
        )
        ON CONFLICT (property_id, room_number) DO UPDATE
        SET
          tenant_id = EXCLUDED.tenant_id,
          room_type_id = EXCLUDED.room_type_id,
          room_name = EXCLUDED.room_name,
          floor = EXCLUDED.floor,
          status = EXCLUDED.status,
          housekeeping_status = EXCLUDED.housekeeping_status,
          maintenance_status = EXCLUDED.maintenance_status,
          features = EXCLUDED.features,
          metadata = COALESCE(r.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW(),
          updated_by = $13,
          version = COALESCE(r.version, 0) + 1;
      `,
      [
        room.id,
        room.tenantId,
        room.propertyId,
        room.roomTypeId,
        room.roomNumber,
        room.roomName ?? null,
        room.floor ?? null,
        room.status ?? "AVAILABLE",
        room.housekeepingStatus ?? "CLEAN",
        room.maintenanceStatus ?? "OPERATIONAL",
        jsonb(room.features ?? {}),
        jsonb(room.metadata),
        seedActorId,
      ],
    );
  }
};

const upsertRoomAmenityCatalog = async (client, amenities = []) => {
  for (const amenity of amenities) {
    await client.query(
      `
        INSERT INTO room_amenity_catalog AS rac (
          id, tenant_id, property_id, amenity_code, display_name, description,
          category, icon, tags, sort_order, is_default, is_active, is_required,
          metadata, created_at, updated_at, created_by, updated_by
        )
        VALUES (
          COALESCE($1::uuid, uuid_generate_v4()),
          $2, $3, $4, $5, $6,
          COALESCE($7, 'GENERAL'), $8,
          COALESCE($9::text[], '{}'::text[]),
          COALESCE($10, 0),
          COALESCE($11, TRUE),
          COALESCE($12, TRUE),
          COALESCE($13, FALSE),
          COALESCE($14::jsonb, '{}'::jsonb),
          NOW(), NOW(), $15, $15
        )
        ON CONFLICT (property_id, amenity_code) DO UPDATE
        SET
          tenant_id = EXCLUDED.tenant_id,
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          icon = EXCLUDED.icon,
          tags = EXCLUDED.tags,
          sort_order = EXCLUDED.sort_order,
          is_default = EXCLUDED.is_default,
          is_active = EXCLUDED.is_active,
          is_required = EXCLUDED.is_required,
          metadata = COALESCE(rac.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW(),
          updated_by = $15;
      `,
      [
        amenity.id ?? null,
        amenity.tenantId,
        amenity.propertyId,
        amenity.amenityCode,
        amenity.displayName,
        amenity.description ?? null,
        amenity.category ?? "GENERAL",
        amenity.icon ?? null,
        amenity.tags ?? [],
        amenity.sortOrder ?? 0,
        amenity.isDefault ?? true,
        amenity.isActive ?? true,
        amenity.isRequired ?? false,
        jsonb(amenity.metadata),
        seedActorId,
      ],
    );
  }
};

const upsertRates = async (client, rates = []) => {
  for (const rate of rates) {
    const validFrom = rate.validFrom ?? nowDate();
    await client.query(
      `
        INSERT INTO rates AS rt (
          tenant_id, property_id, room_type_id, rate_name, rate_code, description,
          strategy, rate_type, priority, base_rate, currency, single_occupancy_rate, double_occupancy_rate,
          extra_person_rate, valid_from, min_length_of_stay, meal_plan,
          cancellation_policy, channels, customer_segments, tax_inclusive,
          display_order, status, metadata, created_at, updated_at, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15::date, $16, $17,
          COALESCE($18::jsonb, '{}'::jsonb),
          COALESCE($19::jsonb, '[]'::jsonb),
          COALESCE($20::jsonb, '[]'::jsonb),
          COALESCE($21, FALSE),
          COALESCE($22, 0),
          'ACTIVE',
          COALESCE($23::jsonb, '{}'::jsonb),
          NOW(), NOW(), $24, $24
        )
        ON CONFLICT (property_id, rate_code) DO UPDATE
        SET
          tenant_id = EXCLUDED.tenant_id,
          room_type_id = EXCLUDED.room_type_id,
          rate_name = EXCLUDED.rate_name,
          description = EXCLUDED.description,
          strategy = EXCLUDED.strategy,
          rate_type = EXCLUDED.rate_type,
          priority = EXCLUDED.priority,
          base_rate = EXCLUDED.base_rate,
          currency = EXCLUDED.currency,
          single_occupancy_rate = EXCLUDED.single_occupancy_rate,
          double_occupancy_rate = EXCLUDED.double_occupancy_rate,
          extra_person_rate = EXCLUDED.extra_person_rate,
          valid_from = EXCLUDED.valid_from,
          min_length_of_stay = EXCLUDED.min_length_of_stay,
          meal_plan = EXCLUDED.meal_plan,
          cancellation_policy = EXCLUDED.cancellation_policy,
          channels = EXCLUDED.channels,
          customer_segments = EXCLUDED.customer_segments,
          tax_inclusive = EXCLUDED.tax_inclusive,
          display_order = EXCLUDED.display_order,
          metadata = COALESCE(rt.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW(),
          updated_by = $24,
          version = COALESCE(rt.version, 0) + 1;
      `,
      [
        rate.tenantId,
        rate.propertyId,
        rate.roomTypeId,
        rate.rateName,
        rate.rateCode,
        rate.description ?? null,
        rate.strategy ?? "FIXED",
        rate.rateType ?? "BAR",
        rate.priority ?? 100,
        rate.baseRate ?? 0,
        rate.currency ?? "USD",
        rate.singleOccupancyRate ?? null,
        rate.doubleOccupancyRate ?? null,
        rate.extraPersonRate ?? null,
        validFrom,
        rate.minLengthOfStay ?? 1,
        rate.mealPlan ?? null,
        jsonb(rate.cancellationPolicy),
        jsonb(rate.channels ?? []),
        jsonb(rate.customerSegments ?? []),
        rate.taxInclusive ?? false,
        rate.displayOrder ?? 0,
        jsonb(rate.metadata),
        seedActorId,
      ],
    );
  }
};

const upsertBookingSources = async (client, sources = []) => {
  for (const source of sources) {
    await client.query(
      `
        INSERT INTO booking_sources AS bs (
          tenant_id, property_id, source_code, source_name, source_type,
          category, channel_name, commission_type, commission_percentage,
          is_active, is_bookable, metadata
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          TRUE, TRUE,
          COALESCE($10::jsonb, '{}'::jsonb)
        )
        ON CONFLICT (tenant_id, property_id, source_code) DO UPDATE
        SET
          source_name = EXCLUDED.source_name,
          source_type = EXCLUDED.source_type,
          category = EXCLUDED.category,
          channel_name = EXCLUDED.channel_name,
          commission_type = EXCLUDED.commission_type,
          commission_percentage = EXCLUDED.commission_percentage,
          metadata = COALESCE(bs.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          version = COALESCE(bs.version, 0) + 1;
      `,
      [
        source.tenantId,
        source.propertyId,
        source.sourceCode,
        source.sourceName,
        source.sourceType,
        source.category ?? null,
        source.channelName ?? null,
        source.commissionType ?? "NONE",
        source.commissionPercentage ?? null,
        jsonb(source.metadata),
      ],
    );
  }
};

const upsertMarketSegments = async (client, segments = []) => {
  for (const segment of segments) {
    await client.query(
      `
        INSERT INTO market_segments AS ms (
          tenant_id, property_id, segment_code, segment_name, segment_type,
          rate_multiplier, marketing_priority, metadata
        )
        VALUES (
          $1, $2, $3, $4, $5,
          COALESCE($6, 1.0), COALESCE($7, 0),
          COALESCE($8::jsonb, '{}'::jsonb)
        )
        ON CONFLICT (tenant_id, property_id, segment_code) DO UPDATE
        SET
          segment_name = EXCLUDED.segment_name,
          segment_type = EXCLUDED.segment_type,
          rate_multiplier = EXCLUDED.rate_multiplier,
          marketing_priority = EXCLUDED.marketing_priority,
          metadata = COALESCE(ms.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW();
      `,
      [
        segment.tenantId,
        segment.propertyId,
        segment.segmentCode,
        segment.segmentName,
        segment.segmentType,
        segment.rateMultiplier ?? 1.0,
        segment.marketingPriority ?? 0,
        jsonb(segment.metadata),
      ],
    );
  }
};

const upsertServices = async (client, services = []) => {
  for (const service of services) {
    await client.query(
      `
        INSERT INTO services AS s (
          tenant_id, property_id, service_name, service_code, category, subcategory,
          description, price, currency, pricing_unit, is_taxable, tax_rate,
          requires_booking, duration_minutes, metadata,
          created_at, updated_at, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, NULL,
          $6, $7, $8, $9, COALESCE($10, FALSE), COALESCE($11::numeric, 0)::numeric,
          COALESCE($12, FALSE), COALESCE($13::integer, 0),
          COALESCE($14::jsonb, '{}'::jsonb),
          NOW(), NOW(), $15, $15
        )
        ON CONFLICT (property_id, service_code) DO UPDATE
        SET
          tenant_id = EXCLUDED.tenant_id,
          service_name = EXCLUDED.service_name,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          currency = EXCLUDED.currency,
          pricing_unit = EXCLUDED.pricing_unit,
          is_taxable = EXCLUDED.is_taxable,
          tax_rate = EXCLUDED.tax_rate,
          requires_booking = EXCLUDED.requires_booking,
          duration_minutes = EXCLUDED.duration_minutes,
          metadata = COALESCE(s.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW(),
          updated_by = $15,
          version = COALESCE(s.version, 0) + 1;
      `,
      [
        service.tenantId,
        service.propertyId,
        service.serviceName,
        service.serviceCode,
        service.category,
        service.description ?? null,
        service.price ?? 0,
        service.currency ?? "USD",
        service.pricingUnit ?? "per_unit",
        service.isTaxable ?? false,
        service.taxRate ?? 0,
        service.requiresBooking ?? false,
        service.durationMinutes ?? 0,
        jsonb(service.metadata),
        seedActorId,
      ],
    );
  }
};

const seed = async () => {
  console.log("→ Loading industry-standard default dataset (JSON)...");
  const dataset = loadDataset();
  seedActorId = dataset.users?.[0]?.id ?? seedActorId;
  defaultTenantId = dataset.tenants?.[0]?.id ?? defaultTenantId;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await upsertTenants(client, dataset.tenants);
    await upsertProperties(client, dataset.properties);
    await upsertUsers(client, dataset.users);
    await upsertUserTenantAssociations(client, dataset.userTenantAssociations);
    await upsertRoomTypes(client, dataset.roomTypes);
    await upsertRooms(client, dataset.rooms);
    await upsertRoomAmenityCatalog(client, dataset.roomAmenityCatalog);
    await upsertRates(client, dataset.rates);
    await upsertBookingSources(client, dataset.bookingSources);
    await upsertMarketSegments(client, dataset.marketSegments);
    await upsertServices(client, dataset.services);
    await client.query("COMMIT");
    console.log("✓ Default operating data applied successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("✗ Failed to seed default data:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

seed().catch((error) => {
  console.error("✗ Unexpected error while seeding defaults:", error);
  process.exitCode = 1;
});
