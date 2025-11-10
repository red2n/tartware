#!/usr/bin/env tsx
/**
 * Schema Generator Utility
 * Auto-generates Zod schemas from PostgreSQL information_schema
 *
 * Usage: tsx src/utilities/schema-generator.ts [category]
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection from environment
const client = new Client({
	host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
	database: process.env.DB_NAME || "tartware",
	user: process.env.DB_USER || "postgres",
	password: process.env.DB_PASSWORD || "postgres",
});

// Category to table mapping
const CATEGORY_TABLES: Record<string, string[]> = {
	"02-inventory": [
		"room_types",
		"rooms",
		"rates",
		"room_availability",
		"rate_overrides",
		"revenue_forecasts",
		"competitor_rates",
		"demand_calendar",
		"pricing_rules",
		"rate_recommendations",
		"revenue_goals",
		"companies",
		"group_bookings",
		"group_room_blocks",
		"packages",
		"package_components",
		"package_bookings",
		"travel_agent_commissions",
		"commission_statements",
		"commission_rules",
		"meeting_rooms",
		"event_bookings",
		"banquet_event_orders",
	],
	"03-bookings": [
		"reservations",
		"reservation_status_history",
		"deposit_schedules",
		"allotments",
		"booking_sources",
		"market_segments",
		"guest_preferences",
		"guest_communications",
		"communication_templates",
		"guest_feedback",
		"guest_loyalty_programs",
		"guest_documents",
		"guest_notes",
		"automated_messages",
		"reservation_traces",
		"waitlist_entries",
	],
	"04-financial": [
		"payments",
		"invoices",
		"invoice_items",
		"folios",
		"charge_postings",
		"refunds",
		"tax_configurations",
		"financial_closures",
		"commission_tracking",
		"cashier_sessions",
		"accounts_receivable",
		"credit_limits",
		"payment_tokens",
		"general_ledger_batches",
		"general_ledger_entries",
	],
	"05-operations": [
		"services",
		"reservation_services",
		"housekeeping_tasks",
		"maintenance_requests",
		"staff_schedules",
		"staff_tasks",
		"shift_handovers",
		"lost_and_found",
		"incident_reports",
		"vendor_contracts",
		"mobile_keys",
		"qr_codes",
		"push_notifications",
		"app_usage_analytics",
		"smart_room_devices",
		"room_energy_usage",
		"guest_room_preferences",
		"device_events_log",
		"mobile_check_ins",
		"digital_registration_cards",
		"contactless_requests",
		"asset_inventory",
		"predictive_maintenance_alerts",
		"maintenance_history",
		"minibar_items",
		"minibar_consumption",
		"vehicles",
		"transportation_requests",
		"shuttle_schedules",
		"spa_treatments",
		"spa_appointments",
	],
	"06-integrations": [
		"channel_mappings",
		"ota_configurations",
		"ota_rate_plans",
		"ota_reservations_queue",
		"gds_connections",
		"gds_message_log",
		"gds_reservation_queue",
		"ota_inventory_sync",
		"channel_rate_parity",
		"channel_commission_rules",
		"marketing_campaigns",
		"campaign_segments",
		"promotional_codes",
		"referral_tracking",
		"social_media_mentions",
		"integration_mappings",
		"api_logs",
		"webhook_subscriptions",
		"data_sync_status",
		"ai_demand_predictions",
		"demand_scenarios",
		"ai_model_performance",
		"dynamic_pricing_rules_ml",
		"price_adjustments_history",
		"pricing_experiments",
		"guest_behavior_patterns",
		"personalized_recommendations",
		"guest_interaction_events",
		"sentiment_analysis",
		"sentiment_trends",
		"review_response_templates",
	],
	"07-analytics": [
		"analytics_metrics",
		"analytics_metric_dimensions",
		"analytics_reports",
		"report_property_ids",
		"performance_reports",
		"report_schedules",
		"performance_thresholds",
		"performance_baselines",
		"performance_alerts",
		"alert_rules",
		"audit_logs",
		"business_dates",
		"night_audit_log",
		"gdpr_consent_logs",
		"police_reports",
		"contract_agreements",
		"insurance_claims",
		"guest_journey_tracking",
		"revenue_attribution",
		"forecasting_models",
		"ab_test_results",
		"sustainability_metrics",
		"green_certifications",
		"carbon_offset_programs",
		"sustainability_initiatives",
	],
};

// Map PostgreSQL types to Zod base schemas
function mapPostgresToZod(
	dataType: string,
	udtName: string,
	isNullable: boolean,
): string {
	let zodType: string;

	// Handle custom ENUM types
	if (dataType === "USER-DEFINED") {
		const enumName = udtName
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join("");
		zodType = `${enumName}Enum`;
	} else {
		switch (udtName) {
			case "uuid":
				zodType = "uuid";
				break;
			case "varchar":
			case "text":
			case "bpchar":
				zodType = "z.string()";
				break;
			case "int2":
			case "int4":
				zodType = "z.number().int()";
				break;
			case "int8":
				zodType = "z.bigint()";
				break;
			case "numeric":
				zodType = "money";
				break;
			case "bool":
				zodType = "z.boolean()";
				break;
			case "timestamp":
			case "timestamptz":
				zodType = "z.coerce.date()";
				break;
			case "date":
				zodType = "z.coerce.date()";
				break;
			case "time":
				zodType = "z.string()"; // Time strings
				break;
			case "jsonb":
				zodType = "z.record(z.unknown())"; // Generic JSONB
				break;
			case "_varchar":
			case "_text":
				zodType = "z.array(z.string())";
				break;
			case "_uuid":
				zodType = "z.array(uuid)";
				break;
			case "_date":
				zodType = "z.array(z.coerce.date())";
				break;
			case "_int4":
				zodType = "z.array(z.number().int())";
				break;
			default:
				zodType = "z.unknown()";
		}
	}

	return isNullable ? `${zodType}.optional()` : zodType;
}

async function generateSchema(
	tableName: string,
	category: string,
): Promise<void> {
	console.log(`Generating schema for ${tableName}...`);

	// Get table columns
	const result = await client.query<{
		column_name: string;
		data_type: string;
		udt_name: string;
		is_nullable: string;
		column_default: string | null;
	}>(
		`
    SELECT
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position
    `,
		[tableName],
	);

	const columns = result.rows;

	// Generate schema name
	const schemaName = tableName
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");

	// Generate imports
	const baseSchemaImports = new Set<string>();
	const enumImports = new Set<string>();

	const schemaFields: string[] = [];

	for (const col of columns) {
		const { column_name, data_type, udt_name, is_nullable } = col;
		const zodType = mapPostgresToZod(
			data_type,
			udt_name,
			is_nullable === "YES",
		);

		// Track imports
		if (zodType.includes("uuid")) baseSchemaImports.add("uuid");
		if (zodType.includes("money")) baseSchemaImports.add("money");
		if (zodType.includes("Enum")) {
			const enumName = zodType.replace(".optional()", "");
			enumImports.add(enumName);
		}

		schemaFields.push(`  ${column_name}: ${zodType},`);
	}

	// Build import statements
	let importStatements = "import { z } from 'zod';\n";

	if (baseSchemaImports.size > 0) {
		importStatements += `import {\n  ${Array.from(baseSchemaImports).join(",\n  ")}\n} from '../../shared/base-schemas.js';\n`;
	}

	if (enumImports.size > 0) {
		importStatements += `import { ${Array.from(enumImports).join(", ")} } from '../../shared/enums.js';\n`;
	}

	// Generate schema content
	const content = `/**
 * ${schemaName} Schema
 * @table ${tableName}
 * @category ${category}
 * @synchronized ${new Date().toISOString().split("T")[0]}
 */

${importStatements}
/**
 * Complete ${schemaName} schema
 */
export const ${schemaName}Schema = z.object({
${schemaFields.join("\n")}
});

export type ${schemaName} = z.infer<typeof ${schemaName}Schema>;

/**
 * Schema for creating a new ${tableName.replace(/_/g, " ")}
 */
export const Create${schemaName}Schema = ${schemaName}Schema.omit({
  // TODO: Add fields to omit for creation
});

export type Create${schemaName} = z.infer<typeof Create${schemaName}Schema>;

/**
 * Schema for updating a ${tableName.replace(/_/g, " ")}
 */
export const Update${schemaName}Schema = ${schemaName}Schema.partial();

export type Update${schemaName} = z.infer<typeof Update${schemaName}Schema>;
`;

	// Write to file
  const fileName = `${tableName.replace(/_/g, "-")}.ts`;
	const filePath = path.join(__dirname, "..", "schemas", category, fileName);

	await fs.writeFile(filePath, content, "utf-8");
	console.log(`✅ Generated ${filePath}`);
}

async function main() {
	const category = process.argv[2] || "02-inventory";

	if (!CATEGORY_TABLES[category]) {
		console.error(`Unknown category: ${category}`);
		console.error(
			`Available categories: ${Object.keys(CATEGORY_TABLES).join(", ")}`,
		);
		process.exit(1);
	}

	console.log(`Generating schemas for category: ${category}`);
	console.log(`Tables: ${CATEGORY_TABLES[category].length}`);

	try {
		await client.connect();
		console.log("✅ Connected to database");

		for (const tableName of CATEGORY_TABLES[category]) {
			await generateSchema(tableName, category);
		}

		console.log(
			`\n✅ Generated ${CATEGORY_TABLES[category].length} schemas for ${category}`,
		);
	} catch (error) {
		console.error("❌ Error:", error);
		process.exit(1);
	} finally {
		await client.end();
	}
}

void main();
