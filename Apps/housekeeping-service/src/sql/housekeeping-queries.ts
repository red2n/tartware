export const HOUSEKEEPING_TASK_LIST_SQL = `
  SELECT
    h.id,
    h.tenant_id,
    h.property_id,
    p.property_name,
    h.room_number,
    h.task_type,
    h.priority,
    h.status,
    h.assigned_to,
    h.assigned_at,
    h.scheduled_date,
    h.scheduled_time,
    h.started_at,
    h.completed_at,
    h.inspected_by,
    h.inspected_at,
    h.inspection_passed,
    h.is_guest_request,
    h.special_instructions,
    h.notes,
    h.issues_found,
    h.metadata,
    h.created_at,
    h.updated_at,
    h.version
  FROM public.housekeeping_tasks h
  LEFT JOIN public.properties p
    ON h.property_id = p.id
  WHERE COALESCE(h.is_deleted, false) = false
    AND h.deleted_at IS NULL
    AND ($2::uuid IS NULL OR h.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR h.property_id = $3::uuid)
    AND (
      $4::text IS NULL
      OR h.status = UPPER($4::text)::housekeeping_status
    )
    AND (
      $5::date IS NULL
      OR h.scheduled_date = $5::date
    )
  ORDER BY h.scheduled_date DESC, h.scheduled_time DESC NULLS LAST, h.created_at DESC
  LIMIT $1
`;

// =====================================================
// MAINTENANCE REQUEST QUERIES
// =====================================================

export const MAINTENANCE_REQUEST_LIST_SQL = `
  SELECT
    m.request_id,
    m.tenant_id,
    m.property_id,
    p.property_name,
    m.request_number,
    m.request_type,
    m.request_status,
    m.priority,
    m.room_id,
    m.room_number,
    m.location_description,
    m.location_type,
    m.issue_category,
    m.issue_subcategory,
    m.issue_description,
    m.affects_occupancy,
    m.affects_guest_comfort,
    m.is_safety_issue,
    m.is_health_issue,
    m.reported_at,
    m.reported_by,
    m.reporter_role,
    m.assigned_to,
    m.assigned_at,
    m.maintenance_team,
    m.scheduled_date,
    m.estimated_duration_minutes,
    m.work_started_at,
    m.work_completed_at,
    m.actual_duration_minutes,
    m.work_performed,
    m.total_cost,
    m.currency_code,
    m.room_out_of_service,
    m.oos_from,
    m.oos_until,
    m.response_time_minutes,
    m.resolution_time_hours,
    m.is_within_sla,
    m.created_at,
    m.updated_at
  FROM public.maintenance_requests m
  LEFT JOIN public.properties p
    ON m.property_id = p.id
  WHERE COALESCE(m.is_deleted, false) = false
    AND ($2::uuid IS NULL OR m.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR m.property_id = $3::uuid)
    AND ($4::text IS NULL OR m.request_status = UPPER($4::text))
    AND ($5::text IS NULL OR m.priority = UPPER($5::text))
    AND ($6::text IS NULL OR m.issue_category = UPPER($6::text))
    AND ($7::uuid IS NULL OR m.room_id = $7::uuid)
    AND ($8::boolean IS NULL OR m.room_out_of_service = $8::boolean)
  ORDER BY
    CASE m.priority
      WHEN 'EMERGENCY' THEN 1
      WHEN 'URGENT' THEN 2
      WHEN 'HIGH' THEN 3
      WHEN 'MEDIUM' THEN 4
      WHEN 'LOW' THEN 5
    END,
    m.reported_at DESC
  LIMIT $1
`;

export const MAINTENANCE_REQUEST_BY_ID_SQL = `
  SELECT
    m.request_id,
    m.tenant_id,
    m.property_id,
    p.property_name,
    m.request_number,
    m.request_type,
    m.request_status,
    m.priority,
    m.room_id,
    m.room_number,
    m.location_description,
    m.location_type,
    m.issue_category,
    m.issue_subcategory,
    m.issue_description,
    m.affects_occupancy,
    m.affects_guest_comfort,
    m.is_safety_issue,
    m.is_health_issue,
    m.reported_at,
    m.reported_by,
    m.reporter_role,
    m.assigned_to,
    m.assigned_at,
    m.maintenance_team,
    m.scheduled_date,
    m.estimated_duration_minutes,
    m.work_started_at,
    m.work_completed_at,
    m.actual_duration_minutes,
    m.work_performed,
    m.total_cost,
    m.currency_code,
    m.room_out_of_service,
    m.oos_from,
    m.oos_until,
    m.response_time_minutes,
    m.resolution_time_hours,
    m.is_within_sla,
    m.notes,
    m.internal_notes,
    m.photo_urls,
    m.document_urls,
    m.parts_used,
    m.materials_used,
    m.labor_cost,
    m.parts_cost,
    m.vendor_name,
    m.vendor_contact,
    m.vendor_cost,
    m.po_number,
    m.is_warranty_work,
    m.warranty_notes,
    m.requires_follow_up,
    m.follow_up_date,
    m.follow_up_notes,
    m.verified_at,
    m.verified_by,
    m.verification_notes,
    m.is_satisfactory,
    m.is_recurring_issue,
    m.previous_request_id,
    m.recurrence_count,
    m.root_cause_analysis,
    m.metadata,
    m.created_at,
    m.created_by,
    m.updated_at,
    m.updated_by
  FROM public.maintenance_requests m
  LEFT JOIN public.properties p
    ON m.property_id = p.id
  WHERE m.request_id = $1
    AND m.tenant_id = $2
    AND COALESCE(m.is_deleted, false) = false
`;

// =====================================================
// INCIDENT REPORT QUERIES
// =====================================================

export const INCIDENT_REPORT_LIST_SQL = `
  SELECT
    i.incident_id,
    i.tenant_id,
    i.property_id,
    p.property_name,
    i.incident_number,
    i.incident_title,
    i.incident_type,
    i.incident_category,
    i.severity,
    i.severity_score,
    i.incident_datetime,
    i.incident_date,
    i.incident_time,
    i.incident_location,
    i.room_number,
    i.floor_number,
    i.area_name,
    i.guest_involved,
    i.staff_involved,
    i.third_party_involved,
    i.witness_count,
    i.injuries_sustained,
    i.injury_severity,
    i.medical_attention_required,
    i.property_damage,
    i.estimated_damage_cost,
    i.incident_status,
    i.investigation_required,
    i.investigation_completed,
    i.police_notified,
    i.police_report_number,
    i.insurance_claim_filed,
    i.insurance_claim_number,
    i.created_at,
    i.updated_at,
    i.created_by
  FROM public.incident_reports i
  LEFT JOIN public.properties p
    ON i.property_id = p.id
  WHERE COALESCE(i.is_deleted, false) = false
    AND ($2::uuid IS NULL OR i.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR i.property_id = $3::uuid)
    AND ($4::text IS NULL OR i.incident_status = LOWER($4::text))
    AND ($5::text IS NULL OR i.severity = LOWER($5::text))
    AND ($6::text IS NULL OR i.incident_type = LOWER($6::text))
    AND ($7::date IS NULL OR i.incident_date = $7::date)
    AND ($8::date IS NULL OR i.incident_date >= $8::date)
    AND ($9::date IS NULL OR i.incident_date <= $9::date)
  ORDER BY i.incident_datetime DESC
  LIMIT $1
`;

export const INCIDENT_REPORT_BY_ID_SQL = `
  SELECT
    i.incident_id,
    i.tenant_id,
    i.property_id,
    p.property_name,
    i.incident_number,
    i.incident_title,
    i.incident_type,
    i.incident_category,
    i.incident_subcategory,
    i.severity,
    i.severity_score,
    i.incident_datetime,
    i.incident_date,
    i.incident_time,
    i.discovered_date,
    i.discovered_time,
    i.discovered_by,
    i.discovered_by_name,
    i.time_to_discovery_minutes,
    i.incident_location,
    i.room_number,
    i.room_id,
    i.floor_number,
    i.area_name,
    i.specific_location,
    i.incident_description,
    i.sequence_of_events,
    i.contributing_factors,
    i.root_cause,
    i.guest_involved,
    i.guest_id,
    i.guest_name,
    i.guest_room_number,
    i.staff_involved,
    i.staff_ids,
    i.staff_names,
    i.third_party_involved,
    i.third_party_details,
    i.witness_count,
    i.witnesses,
    i.injuries_sustained,
    i.injury_details,
    i.injury_severity,
    i.medical_attention_required,
    i.medical_attention_provided,
    i.medical_provider,
    i.ambulance_called,
    i.hospital_name,
    i.medical_report_number,
    i.fatality_involved,
    i.fatality_details,
    i.coroner_notified,
    i.property_damage,
    i.damage_description,
    i.estimated_damage_cost,
    i.actual_damage_cost,
    i.financial_loss,
    i.insurance_claim_filed,
    i.insurance_claim_number,
    i.insurance_company,
    i.claim_amount,
    i.immediate_actions_taken,
    i.first_responder,
    i.first_responder_name,
    i.emergency_services_called,
    i.emergency_service_types,
    i.police_notified,
    i.police_report_number,
    i.police_department,
    i.officer_name,
    i.officer_badge_number,
    i.police_report_filed,
    i.incident_status,
    i.investigation_required,
    i.investigation_started,
    i.investigation_start_date,
    i.investigated_by,
    i.investigator_name,
    i.investigation_completed,
    i.investigation_completion_date,
    i.investigation_findings,
    i.investigation_report_url,
    i.follow_up_required,
    i.follow_up_actions,
    i.follow_up_completed,
    i.corrective_actions_required,
    i.corrective_actions,
    i.preventive_measures,
    i.corrective_actions_implemented,
    i.implementation_date,
    i.implementation_verified,
    i.verified_by,
    i.management_notified,
    i.management_notified_at,
    i.management_id,
    i.owner_notified,
    i.owner_notified_at,
    i.corporate_notified,
    i.corporate_notified_at,
    i.regulatory_reporting_required,
    i.regulatory_authorities_notified,
    i.osha_reportable,
    i.osha_report_filed,
    i.osha_report_number,
    i.media_attention,
    i.media_statement_issued,
    i.media_contact,
    i.public_relations_involved,
    i.legal_action_taken,
    i.legal_case_number,
    i.attorney_assigned,
    i.lawsuit_filed,
    i.settlement_reached,
    i.settlement_amount,
    i.photos_taken,
    i.photo_count,
    i.photo_urls,
    i.video_footage_available,
    i.video_urls,
    i.documents_attached,
    i.document_urls,
    i.evidence_collected,
    i.evidence_description,
    i.evidence_location,
    i.reviewed,
    i.reviewed_by,
    i.reviewed_at,
    i.review_notes,
    i.approved,
    i.approved_by,
    i.approved_at,
    i.closed,
    i.closed_by,
    i.closed_at,
    i.closure_notes,
    i.lessons_learned,
    i.training_required,
    i.training_topics,
    i.policy_changes_needed,
    i.policy_recommendations,
    i.related_incidents,
    i.is_recurring_incident,
    i.previous_similar_incidents,
    i.is_confidential,
    i.confidentiality_level,
    i.access_restricted_to,
    i.metadata,
    i.tags,
    i.notes,
    i.created_at,
    i.updated_at,
    i.created_by,
    i.updated_by
  FROM public.incident_reports i
  LEFT JOIN public.properties p
    ON i.property_id = p.id
  WHERE i.incident_id = $1
    AND i.tenant_id = $2
    AND COALESCE(i.is_deleted, false) = false
`;
