{{- define "eduspark.name" -}}eduspark{{- end -}}

{{- define "eduspark.image" -}}
{{- $tag := .tag | default .root.Values.image.tag | default .root.Chart.AppVersion -}}
{{ .root.Values.image.repository }}:{{ $tag }}
{{- end -}}

{{/* Ek Deployment: context = dict root, name, color, track, replicas(optional), tag, hpa(bool) */}}
{{- define "eduspark.deployment" -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .name }}
  labels:
    app.kubernetes.io/name: {{ include "eduspark.name" .root }}
    app.kubernetes.io/instance: {{ .root.Release.Name }}
    app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
    eduspark/color: {{ .color }}
    eduspark/track: {{ .track }}
spec:
  {{- if not .hpa }}
  replicas: {{ .replicas }}
  {{- end }}
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: {{ .root.Values.strategy.maxSurge }}
      maxUnavailable: {{ .root.Values.strategy.maxUnavailable }}
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ include "eduspark.name" .root }}
      app.kubernetes.io/instance: {{ .root.Release.Name }}
      eduspark/color: {{ .color }}
      eduspark/track: {{ .track }}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: {{ include "eduspark.name" .root }}
        app.kubernetes.io/instance: {{ .root.Release.Name }}
        eduspark/color: {{ .color }}
        eduspark/track: {{ .track }}
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 101
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: {{ include "eduspark.name" .root }}
              app.kubernetes.io/instance: {{ .root.Release.Name }}
      containers:
        - name: web
          image: {{ include "eduspark.image" (dict "root" .root "tag" .tag) | quote }}
          imagePullPolicy: {{ .root.Values.image.pullPolicy }}
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet: { path: /healthz, port: 8080 }
            initialDelaySeconds: 2
            periodSeconds: 5
          livenessProbe:
            httpGet: { path: /healthz, port: 8080 }
            initialDelaySeconds: 10
            periodSeconds: 10
          resources:
            {{- toYaml .root.Values.resources | nindent 12 }}
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
{{- end -}}
