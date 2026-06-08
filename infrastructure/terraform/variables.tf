variable "do_token" {
  description = "DigitalOcean Personal Access Token"
  type        = string
  sensitive   = true
}

variable "spaces_access_key" {
  description = "DO Spaces access key ID"
  type        = string
  sensitive   = true
}

variable "spaces_secret_key" {
  description = "DO Spaces secret access key"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "blr1"
}

variable "spaces_bucket_name" {
  description = "Name for the Spaces data-lake bucket (must be globally unique)"
  type        = string
  default     = "ev-research-data-lake"
}
