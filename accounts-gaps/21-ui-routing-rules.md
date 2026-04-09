# GAP-21: UI — Folio Routing Rules Management

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Ref:** BA §3.3

## Current State (Backend ✅ → UI ❌)
- Backend has full CRUD: `routing_rule.create`, `routing_rule.update`, `routing_rule.delete`, `routing_rule.clone_template`
- Read routes: `GET /v1/billing/routing-rules` (list), `GET /v1/billing/routing-rules/:id` (detail)
- Template system: create templates, clone to active rules
- Routing evaluation engine fully functional
- **No UI for routing rule management**

## Work Required

### UI — In folio detail or dedicated section
1. Routing rules list for a folio (active rules)
2. Create rule form: charge code pattern, routing type (percentage/fixed/full), destination folio, priority
3. Edit rule (update active status, amounts, patterns)
4. Delete rule (soft delete)
5. Template management: browse templates, clone to folio
6. Rule testing: "What would happen if I post charge X?" preview
