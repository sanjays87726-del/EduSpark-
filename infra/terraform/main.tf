# EduSpark AI Worker + KV (rate-limit counters)
# PEHLE import karo (README dekho), phir `terraform plan` — seedha apply mat karna.

resource "cloudflare_workers_kv_namespace" "rate" {
  account_id = var.account_id
  title      = "eduspark-rate"
}

resource "cloudflare_worker_script" "ai" {
  account_id         = var.account_id
  name               = var.worker_name
  content            = file("${path.module}/../../worker.js")
  module             = true
  compatibility_date = "2025-01-01"

  kv_namespace_binding {
    name         = "RATE"
    namespace_id = cloudflare_workers_kv_namespace.rate.id
  }

  secret_text_binding {
    name = "GEMINI_KEY"
    text = var.gemini_key
  }

  plain_text_binding {
    name = "DAILY_LIMIT"
    text = tostring(var.daily_limit)
  }
}
