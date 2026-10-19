variable "cloudflare_api_token" {
  description = "Cloudflare API token (Workers Scripts:Edit, Workers KV Storage:Edit)"
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "worker_name" {
  description = "Worker ka naam — maujooda worker ke liye wahi rakho (naam badla to naya worker + naya URL banega)"
  type        = string
  default     = "bold-dust-6f37"
}

variable "gemini_key" {
  description = "Gemini API key (Worker secret). NOTE: Terraform state me save hota hai — state ko kabhi commit mat karo"
  type        = string
  sensitive   = true
}

variable "daily_limit" {
  description = "Har student ke liye roz ke AI jawab"
  type        = number
  default     = 5
}
