output "kv_namespace_id" {
  value = cloudflare_workers_kv_namespace.rate.id
}

output "worker_name" {
  value = cloudflare_worker_script.ai.name
}
