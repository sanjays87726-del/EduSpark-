# Terraform — AI Worker + KV

**Status: CI me `terraform validate` hota hai; kabhi asli account par apply nahi kiya gaya.**

State me `GEMINI_KEY` (secret) save hota hai → state file ko git me mat daalo (`.gitignore` me hai). Pehle remote encrypted backend socho.

## Maujooda worker/KV ko import karo (naya banane se bachne ke liye)
```bash
export TF_VAR_cloudflare_api_token=...   TF_VAR_account_id=...   TF_VAR_gemini_key=...
cd infra/terraform
terraform init
terraform import cloudflare_workers_kv_namespace.rate  <ACCOUNT_ID>/<KV_NAMESPACE_ID>
terraform import cloudflare_worker_script.ai           <ACCOUNT_ID>/bold-dust-6f37
terraform plan        # diff dhyan se padho: KV counters ya worker replace na ho
```
Plan me sirf worker code / bindings ka diff dikhe tabhi `terraform apply`.
