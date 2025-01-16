# Core project variables
variable "project_name" {
  description = "Name of the project used for resource naming"
  type        = string
  validation {
    condition     = length(var.project_name) > 0
    error_message = "Project name cannot be empty"
  }
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "region" {
  description = "Primary region for database deployment"
  type        = string
  validation {
    condition     = length(var.region) > 0
    error_message = "Region cannot be empty"
  }
}

variable "resource_group" {
  description = "Name of the resource group where database resources will be created"
  type        = string
}

variable "subnet_id" {
  description = "ID of the subnet where database resources will be deployed"
  type        = string
}

# Cosmos DB configuration
variable "cosmos_db_config" {
  description = "Configuration for Cosmos DB instance"
  type = object({
    offer_type             = string
    kind                  = string
    consistency_level     = string
    max_interval_in_seconds = number
    max_staleness_prefix  = number
    max_throughput        = number
    failover_priority     = number
    enable_automatic_failover = bool
    enable_multiple_write_locations = bool
  })
  default = {
    offer_type             = "Standard"
    kind                  = "GlobalDocumentDB"
    consistency_level     = "Session"
    max_interval_in_seconds = 5
    max_staleness_prefix  = 100
    max_throughput        = 4000
    failover_priority     = 0
    enable_automatic_failover = true
    enable_multiple_write_locations = false
  }
}

# Firestore configuration
variable "firestore_config" {
  description = "Configuration for Cloud Firestore instance"
  type = object({
    database_type               = string
    concurrency_mode           = string
    app_engine_integration_mode = string
    location_id                = string
    enable_apis                = bool
  })
  default = {
    database_type               = "FIRESTORE_NATIVE"
    concurrency_mode           = "OPTIMISTIC"
    app_engine_integration_mode = "DISABLED"
    location_id                = ""
    enable_apis                = true
  }
}

# High availability configuration
variable "enable_geo_replication" {
  description = "Enable geo-replication for database resources"
  type        = bool
  default     = false
}

variable "secondary_regions" {
  description = "List of secondary regions for geo-replication"
  type = list(object({
    location          = string
    failover_priority = number
    zone_redundant    = bool
  }))
  default = []
}

# Backup and retention configuration
variable "backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 30
  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Backup retention must be at least 7 days"
  }
}

variable "enable_continuous_backup" {
  description = "Enable continuous backup for point-in-time recovery"
  type        = bool
  default     = true
}

# Network security configuration
variable "allowed_ip_ranges" {
  description = "List of IP ranges allowed to access database resources"
  type        = list(string)
  default     = []
}

variable "enable_private_endpoint" {
  description = "Enable private endpoint for database resources"
  type        = bool
  default     = true
}

# Monitoring configuration
variable "enable_diagnostic_settings" {
  description = "Enable diagnostic settings for database resources"
  type        = bool
  default     = true
}

variable "log_analytics_workspace_id" {
  description = "ID of Log Analytics workspace for diagnostics"
  type        = string
  default     = ""
}

# Resource tagging
variable "tags" {
  description = "Tags to be applied to all database resources"
  type        = map(string)
  default     = {}
}