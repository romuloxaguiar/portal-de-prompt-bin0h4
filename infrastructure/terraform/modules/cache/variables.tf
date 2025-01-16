# Redis Cache Module Variables
# Version: 1.0.0
# Purpose: Defines configurable parameters for Redis cache deployment in Azure

variable "project_name" {
  description = "Name of the project used for resource naming"
  type        = string
  validation {
    condition     = length(var.project_name) > 0 && length(var.project_name) <= 24
    error_message = "Project name must be between 1 and 24 characters"
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

variable "resource_group_name" {
  description = "Name of the Azure resource group where Redis cache will be deployed"
  type        = string
}

variable "location" {
  description = "Azure region for Redis cache deployment"
  type        = string
}

variable "redis_family" {
  description = "Redis cache family (C for Basic/Standard, P for Premium)"
  type        = string
  default     = "C"
  validation {
    condition     = contains(["C", "P"], var.redis_family)
    error_message = "Redis family must be either C or P"
  }
}

variable "redis_cache_size" {
  description = "SKU size of Redis cache (Basic, Standard, Premium)"
  type        = string
  default     = "Standard"
  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.redis_cache_size)
    error_message = "Redis cache size must be one of: Basic, Standard, Premium"
  }
}

variable "redis_capacity" {
  description = "Redis cache capacity (0-6 for Basic/Standard, 1-4 for Premium)"
  type        = number
  default     = 1
  validation {
    condition     = var.redis_capacity >= 0 && var.redis_capacity <= 6
    error_message = "Redis capacity must be between 0 and 6"
  }
}

variable "enable_non_ssl_port" {
  description = "Enable non-SSL port (6379) for Redis cache access"
  type        = bool
  default     = false
}

variable "minimum_tls_version" {
  description = "Minimum TLS version for Redis cache"
  type        = string
  default     = "1.2"
  validation {
    condition     = contains(["1.0", "1.1", "1.2"], var.minimum_tls_version)
    error_message = "TLS version must be one of: 1.0, 1.1, 1.2"
  }
}

variable "subnet_id" {
  description = "ID of the subnet where Redis cache will be deployed"
  type        = string
}

variable "private_ip_address" {
  description = "Static private IP address for the Redis cache"
  type        = string
  default     = null
}

variable "maxmemory_reserved" {
  description = "Amount of memory reserved for non-cache operations"
  type        = number
  default     = 50
}

variable "maxmemory_delta" {
  description = "Maximum amount of memory delta for Redis cache"
  type        = number
  default     = 50
}

variable "maxfragmentationmemory_reserved" {
  description = "Amount of memory reserved for fragmentation"
  type        = number
  default     = 50
}

variable "backup_storage_connection_string" {
  description = "Connection string for Redis backup storage account"
  type        = string
  default     = ""
  sensitive   = true
}

variable "patch_day" {
  description = "Day of week for Redis cache patching"
  type        = string
  default     = "Sunday"
  validation {
    condition     = contains(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], var.patch_day)
    error_message = "Patch day must be a valid day of the week"
  }
}

variable "patch_hour" {
  description = "Hour (UTC) for Redis cache patching"
  type        = number
  default     = 2
  validation {
    condition     = var.patch_hour >= 0 && var.patch_hour <= 23
    error_message = "Patch hour must be between 0 and 23"
  }
}

variable "log_analytics_workspace_id" {
  description = "ID of Log Analytics workspace for diagnostics"
  type        = string
}

variable "common_tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default     = {}
}