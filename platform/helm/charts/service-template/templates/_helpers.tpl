{{/*
Expand the name of the chart.
*/}}
{{- define "service.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "service.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "service.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "service.labels" -}}
helm.sh/chart: {{ include "service.chart" . }}
{{ include "service.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.

WARNING: these land in Deployment.spec.selector, which is immutable once a
Deployment exists. Never add to this helper — put new labels in
"service.meshLabels" instead, which is applied to the pod template only.
*/}}
{{- define "service.selectorLabels" -}}
app.kubernetes.io/name: {{ include "service.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Mesh / network-boundary labels applied to the pod template.

These are what NetworkPolicy and Istio AuthorizationPolicy select on:

  app:  matched by the per-service policies and by the availability-guard
        gRPC exception.
  tier: matched by the namespace-wide "domain services accept traffic only
        from api-gateway" rule.

Before this helper existed the policies in platform/kubernetes/ selected
labels no Helm-deployed pod carried, so they matched zero pods and
enforced nothing. Removing these labels silently restores that failure
mode — the policies do not error, they just stop applying.
*/}}
{{- define "service.meshLabels" -}}
app: {{ include "service.name" . }}
tier: {{ .Values.istio.tier | quote }}
app.kubernetes.io/part-of: tartware
{{- end }}

{{/*
The SPIFFE identity this workload will present on every mesh connection.
Derived from the ServiceAccount, so it changes if serviceAccount.name is
overridden — keep authorization-policies.yaml in sync when it is.
*/}}
{{- define "service.spiffeId" -}}
{{- printf "cluster.local/ns/%s/sa/%s" .Release.Namespace (include "service.serviceAccountName" .) }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "service.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
