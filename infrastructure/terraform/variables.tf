# Core project variables
variable "project_name" {
  description = "Name of the project used for resource naming and tagging"
  type        = string
  validation {
    condition     = length(var.project_name) > 0 && length(var.project_name) <= 63 && can(regex("^[a-zA-Z0-9-]*$", var.project_name))
    error_message = "Project name must be between 1 and 63 characters and contain only alphanumeric characters and hyphens"
  }
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod) determining resource configurations"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "region" {
  description = "Primary region for resource deployment with multi-AZ support"
  type        = string
  validation {
    condition     = can(regex("^[a-z]{2,}-[a-z]{2,}-[0-9]{1}$", var.region))
    error_message = "Region must be in format: region-zone-number (e.g., us-east-1)"
  }
}

# Kubernetes configuration
variable "kubernetes_version" {
  description = "Kubernetes version for cluster deployment with upgrade path support"
  type        = string
  default     = "1.27"
  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+$", var.kubernetes_version))
    error_message = "Kubernetes version must be in format: major.minor"
  }
}

variable "node_pool_config" {
  description = "Configuration for Kubernetes node pools with auto-scaling"
  type = map(object({
    name                = string
    vm_size            = string
    min_count          = number
    max_count          = number
    enable_auto_scaling = bool
    availability_zones = list(string)
    node_labels        = map(string)
    node_taints        = list(string)
  }))
  default = {
    default = {
      name                = "default"
      vm_size            = "Standard_D2s_v3"
      min_count          = 3
      max_count          = 10
      enable_auto_scaling = true
      availability_zones  = ["1", "2", "3"]
      node_labels        = {}
      node_taints        = []
    }
    analytics = {
      name                = "analytics"
      vm_size            = "Standard_D4s_v3"
      min_count          = 2
      max_count          = 8
      enable_auto_scaling = true
      availability_zones  = ["1", "2"]
      node_labels        = { workload = "analytics" }
      node_taints        = ["analytics=true:NoSchedule"]
    }
  }
}

# Database configuration
variable "database_tier" {
  description = "Database service tier configuration for Cosmos DB and Firestore"
  type = object({
    cosmos_db = object({
      offer_type            = string
      kind                 = string
      consistency_level    = string
      max_throughput       = number
      backup_retention_days = number
      geo_locations = list(object({
        location          = string
        failover_priority = number
      }))
    })
    firestore = object({
      database_type               = string
      concurrency_mode           = string
      location_id                = string
      app_engine_integration_mode = string
    })
  })
  default = {
    cosmos_db = {
      offer_type            = "Standard"
      kind                 = "GlobalDocumentDB"
      consistency_level    = "Session"
      max_throughput       = 4000
      backup_retention_days = 7
      geo_locations        = []
    }
    firestore = {
      database_type               = "DATASTORE_MODE"
      concurrency_mode           = "OPTIMISTIC"
      location_id                = ""
      app_engine_integration_mode = "DISABLED"
    }
  }
}

# Redis cache configuration
variable "redis_cache_config" {
  description = "Redis cache configuration with clustering and persistence"
  type = object({
    capacity            = number
    family             = string
    sku                = string
    enable_clustering   = bool
    shard_count        = number
    enable_persistence = bool
    rdb_backup_frequency = number
  })
  default = {
    capacity            = 1
    family             = "C"
    sku                = "Standard"
    enable_clustering   = false
    shard_count        = 1
    enable_persistence = true
    rdb_backup_frequency = 60
  }
}

# Monitoring configuration
variable "monitoring_config" {
  description = "Monitoring and logging configuration"
  type = object({
    retention_days               = number
    enable_detailed_metrics     = bool
    log_analytics_workspace_sku = string
    alert_notification_emails   = list(string)
  })
  default = {
    retention_days               = 30
    enable_detailed_metrics     = true
    log_analytics_workspace_sku = "PerGB2018"
    alert_notification_emails   = []
  }
}

# Geo-replication configuration
variable "enable_geo_replication" {
  description = "Enable geo-replication for databases and storage"
  type        = bool
  default     = true
}

variable "secondary_regions" {
  description = "List of secondary regions for geo-replication"
  type = list(object({
    name              = string
    failover_priority = number
    zone_redundant    = bool
  }))
  default = []
}

# Resource tagging
variable "tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default = {
    managed_by   = "terraform"
    environment  = ""
    project      = ""
  }
}