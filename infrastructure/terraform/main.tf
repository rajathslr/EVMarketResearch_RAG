terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token             = var.do_token
  spaces_access_id  = var.spaces_access_key
  spaces_secret_key = var.spaces_secret_key
}

# Spaces skipped -- using local file storage for demo (raw data on local machine)

# --- Managed Postgres (pgvector) ---

resource "digitalocean_database_cluster" "postgres" {
  name       = "ev-research-db"
  engine     = "pg"
  version    = "16"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1
}

resource "digitalocean_database_db" "ev_research" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "ev_research"
}

resource "digitalocean_database_user" "pipeline" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "pipeline"
}

# No firewall = allow all IPs (DO's recommended approach for open access)
# Auth + SSL are still enforced by DO Managed Postgres

# --- Outputs ---

output "db_host" {
  description = "Postgres host -- add to .env as DB_HOST"
  value       = digitalocean_database_cluster.postgres.host
  sensitive   = true
}

output "db_port" {
  description = "Postgres port"
  value       = digitalocean_database_cluster.postgres.port
}

output "db_password" {
  description = "Pipeline user password -- add to .env as DB_PASSWORD"
  value       = digitalocean_database_user.pipeline.password
  sensitive   = true
}

output "db_uri" {
  description = "Full connection URI -- add to .env as DATABASE_URL"
  value       = "postgresql://pipeline:${digitalocean_database_user.pipeline.password}@${digitalocean_database_cluster.postgres.host}:${digitalocean_database_cluster.postgres.port}/ev_research?sslmode=require"
  sensitive   = true
}


output "admin_uri" {
  description = "Admin connection URI (doadmin)"
  value       = digitalocean_database_cluster.postgres.uri
  sensitive   = true
}
