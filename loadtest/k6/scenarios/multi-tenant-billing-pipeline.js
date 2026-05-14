/**
 * Multi-Tenant Billing Pipeline Load Test
 * 
 * Replicates the logic from test-multi-tenant.sh using k6.
 * Simulates a full billing lifecycle: Guest -> Reservation -> Charges -> Payment -> Invoice -> Checkout.
 * Includes cross-tenant isolation assertions.
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";
import {
    GATEWAY_URL,
    TENANT_IDS,
    PROPERTY_IDS,
    ROOM_TYPE_IDS,
    VUS,
    DURATION,
    RAMP_UP,
    DEFAULT_THRESHOLDS,
    getHeaders,
    ENDPOINTS,
} from "../lib/config.js";
import {
    uuid,
    randomInt,
    pickRandom,
    futureDate,
    randomEmail,
    randomPhone,
    sleepWithJitter,
    isSuccess,
    parseList,
} from "../lib/utils.js";
import { getToken } from "../lib/auth.js";

// Custom metrics
const pipelineLatency = new Trend("pipeline_latency");
const pipelineErrors = new Counter("pipeline_errors");
const pipelineSuccess = new Rate("pipeline_success_rate");
const isolationFailures = new Counter("isolation_failures");

export const options = {
    stages: [
        { duration: RAMP_UP, target: Math.max(1, Math.floor(VUS / 2)) },
        { duration: DURATION, target: VUS },
        { duration: "30s", target: 0 },
    ],
    thresholds: {
        ...DEFAULT_THRESHOLDS,
        pipeline_success_rate: ["rate>0.95"],
        pipeline_latency: ["p(95)<2000"],
        isolation_failures: ["count==0"],
    },
};

export default function () {
    // 1. Get Authentication
    // In a real load test, we might have pre-seeded users. 
    // Here we use the admin credentials from config.
    const token = getToken(__ENV.ADMIN_USERNAME || "setup.admin", __ENV.ADMIN_PASSWORD || "TempPass123");
    if (!token) {
        pipelineErrors.add(1);
        return;
    }
    const headers = getHeaders(token);

    // Pick a tenant and property for this VU iteration
    const tenantId = pickRandom(TENANT_IDS);
    const propertyId = pickRandom(PROPERTY_IDS);
    const roomTypeId = pickRandom(ROOM_TYPE_IDS);

    const startTime = Date.now();

    group("Billing Pipeline", () => {
        // --- STEP 1: Guest Registration ---
        const guestEmail = randomEmail();
        const guestPayload = {
            first_name: "Load",
            last_name: `Tester-${uuid().slice(0, 4)}`,
            email: guestEmail,
            phone: randomPhone(),
            nationality: "US",
        };

        const guestRes = http.post(
            `${GATEWAY_URL}${ENDPOINTS.commands}/guest.register/execute`,
            JSON.stringify({ tenant_id: tenantId, payload: guestPayload }),
            {
                headers: { ...headers, "Idempotency-Key": `guest-${uuid()}` },
                tags: { operation: "guest.register" },
            }
        );

        if (!check(guestRes, { "guest registered (202)": (r) => r.status === 202 })) {
            pipelineErrors.add(1);
            pipelineSuccess.add(false);
            return;
        }

        // Poll for guest ID (eventual consistency)
        let guestId = null;
        for (let i = 0; i < 5; i++) {
            sleep(0.5);
            const lookup = http.get(
                `${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${tenantId}&email=${encodeURIComponent(guestEmail)}`,
                { headers, tags: { operation: "guest.lookup" } }
            );
            const guests = parseList(lookup);
            if (guests.length > 0) {
                guestId = guests[0].guest_id || guests[0].id;
                break;
            }
        }

        if (!guestId) {
            pipelineErrors.add(1);
            pipelineSuccess.add(false);
            return;
        }

        // --- STEP 2: Reservation Creation ---
        const checkIn = futureDate(0);
        const checkOut = futureDate(3);
        const reservationPayload = {
            property_id: propertyId,
            guest_id: guestId,
            room_type_id: roomTypeId,
            check_in_date: checkIn,
            check_out_date: checkOut,
            status: "CONFIRMED",
            source: "DIRECT",
            total_amount: 597.00,
            currency: "USD",
        };

        const resRes = http.post(
            `${GATEWAY_URL}${ENDPOINTS.commands}/reservation.create/execute`,
            JSON.stringify({ tenant_id: tenantId, payload: reservationPayload }),
            {
                headers: { ...headers, "Idempotency-Key": `res-${uuid()}` },
                tags: { operation: "reservation.create" },
            }
        );

        if (!check(resRes, { "reservation created (202)": (r) => r.status === 202 })) {
            pipelineErrors.add(1);
            pipelineSuccess.add(false);
            return;
        }

        // Poll for reservation ID
        let reservationId = null;
        for (let i = 0; i < 5; i++) {
            sleep(0.5);
            const lookup = http.get(
                `${GATEWAY_URL}${ENDPOINTS.reservations}?tenant_id=${tenantId}&guest_id=${guestId}&limit=1`,
                { headers, tags: { operation: "reservation.lookup" } }
            );
            const reservations = parseList(lookup);
            if (reservations.length > 0) {
                reservationId = reservations[0].reservation_id || reservations[0].id;
                break;
            }
        }

        if (!reservationId) {
            pipelineErrors.add(1);
            pipelineSuccess.add(false);
            return;
        }

        // --- STEP 3: Charge Posting ---
        const charges = [
            { code: "ROOM", amount: 199.00, desc: "Room charge" },
            { code: "MINIBAR", amount: 24.50, desc: "Minibar consumption" },
            { code: "RESTAURANT", amount: 85.00, desc: "Dinner" }
        ];

        for (const charge of charges) {
            const chargeRes = http.post(
                `${GATEWAY_URL}${ENDPOINTS.commands}/billing.charge.post/execute`,
                JSON.stringify({
                    tenant_id: tenantId,
                    payload: {
                        property_id: propertyId,
                        reservation_id: reservationId,
                        amount: charge.amount,
                        charge_code: charge.code,
                        description: charge.desc
                    }
                }),
                {
                    headers: { ...headers, "Idempotency-Key": `charge-${uuid()}` },
                    tags: { operation: "billing.charge.post" },
                }
            );
            check(chargeRes, { "charge posted": (r) => r.status === 202 });
            sleep(0.1);
        }

        // --- STEP 4: Payment Capture ---
        const paymentPayload = {
            payment_reference: `CC-${uuid().slice(0, 8)}`,
            property_id: propertyId,
            reservation_id: reservationId,
            guest_id: guestId,
            amount: 300.00,
            payment_method: "CREDIT_CARD"
        };

        const payRes = http.post(
            `${GATEWAY_URL}${ENDPOINTS.commands}/billing.payment.capture/execute`,
            JSON.stringify({ tenant_id: tenantId, payload: paymentPayload }),
            {
                headers: { ...headers, "Idempotency-Key": `pay-${uuid()}` },
                tags: { operation: "billing.payment.capture" },
            }
        );
        check(payRes, { "payment captured": (r) => r.status === 202 });

        // --- STEP 5: Invoice Creation ---
        const invoicePayload = {
            property_id: propertyId,
            reservation_id: reservationId,
            guest_id: guestId,
            total_amount: 308.50, // 199 + 24.5 + 85
        };

        const invRes = http.post(
            `${GATEWAY_URL}${ENDPOINTS.commands}/billing.invoice.create/execute`,
            JSON.stringify({ tenant_id: tenantId, payload: invoicePayload }),
            {
                headers: { ...headers, "Idempotency-Key": `inv-${uuid()}` },
                tags: { operation: "billing.invoice.create" },
            }
        );
        check(invRes, { "invoice created": (r) => r.status === 202 });

        // --- STEP 6: Checkout ---
        const checkoutPayload = {
            property_id: propertyId,
            reservation_id: reservationId,
            skip_balance_check: true,
            notes: "Load test checkout"
        };

        const checkoutRes = http.post(
            `${GATEWAY_URL}${ENDPOINTS.commands}/billing.express_checkout/execute`,
            JSON.stringify({ tenant_id: tenantId, payload: checkoutPayload }),
            {
                headers: { ...headers, "Idempotency-Key": `co-${uuid()}` },
                tags: { operation: "billing.express_checkout" },
            }
        );
        check(checkoutRes, { "checkout completed": (r) => r.status === 202 });

        // --- ISOLATION CHECK ---
        // Try to access a DIFFERENT tenant's data (if available)
        const otherTenantId = TENANT_IDS.find(id => id !== tenantId);
        if (otherTenantId) {
            const isolationRes = http.get(
                `${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${otherTenantId}&limit=1`,
                { headers, tags: { operation: "isolation_check" } }
            );
            
            // Should be 403 Forbidden
            const isolationOk = check(isolationRes, {
                "cross-tenant access forbidden": (r) => r.status === 403,
            });

            if (!isolationOk) {
                isolationFailures.add(1);
            }
        }

        const duration = Date.now() - startTime;
        pipelineLatency.add(duration);
        pipelineSuccess.add(true);
    });

    sleep(sleepWithJitter(1));
}

export function handleSummary(data) {
    const metrics = data.metrics;

    return {
        stdout: `
╔══════════════════════════════════════════════════════════════════════════════╗
║                MULTI-TENANT BILLING PIPELINE SUMMARY                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Overall Success Rate: ${((metrics.pipeline_success_rate?.values.rate || 0) * 100).toFixed(1)}%
║  Average Latency:      ${(metrics.pipeline_latency?.values.avg || 0).toFixed(0)}ms
║  p95 Latency:          ${(metrics.pipeline_latency?.values["p(95)"] || 0).toFixed(0)}ms
║  Isolation Failures:   ${metrics.isolation_failures?.values.count || 0}
║  Total Errors:         ${metrics.pipeline_errors?.values.count || 0}
║  Total Requests:       ${metrics.http_reqs?.values.count || 0}
╚══════════════════════════════════════════════════════════════════════════════╝
`,
    };
}
