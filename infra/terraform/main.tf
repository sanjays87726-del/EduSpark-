# EduSpark AI Worker + KV (rate-limit counters)
# PEHLE import karo (README dekho), phir `terraform plan` — seedha apply mat karna.

resource "cloudflare_workers_kv_namespace" "rate" {
  account_id = var.account_id
  title      = "eduspark-rate"
}

# Cloudflare provider v5 renamed cloudflare_worker_script -> cloudflare_workers_script.
# Keep the existing Terraform state address during the provider migration.
moved {
  from = cloudflare_worker_script.ai
  to   = cloudflare_workers_script.ai
}

resource "cloudflare_workers_script" "ai" {
  account_id         = var.account_id
  script_name        = var.worker_name
  content            = file("${path.module}/../../worker.js")
  main_module        = "worker.js"
  compatibility_date = "2025-01-01"

  bindings = [
    {
      name         = "RATE"
      type         = "kv_namespace"
      namespace_id = cloudflare_workers_kv_namespace.rate.id
    },
    {
      name = "GEMINI_KEY"
      type = "secret_text"
      text = var.gemini_key
    },
    {
      name = "DAILY_LIMIT"
      type = "plain_text"
      text = tostring(var.daily_limit)
    }
  ]
}
