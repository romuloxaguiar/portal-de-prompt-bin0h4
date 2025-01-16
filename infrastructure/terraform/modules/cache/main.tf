# Azure Redis Cache Infrastructure Module
# Version: 1.0.0
# Provider: Azure (azurerm ~> 3.0)

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# Local variables for resource naming and configuration
locals {
  # Standardized cache name following Azure naming conventions
  cache_name = lower(join("-", [
    var.project_prefix,
    var.environment,
    "redis",
    var.location
  ]))

  # Merged tags for resource tracking and management
  cache_tags = merge(var.common_tags, {
    environment = var.environment
    service     = "redis-cache"
    managed_by  = "terraform"
    component   = "data-layer"
  })

  # Redis configuration settings
  redis_config = {
    maxmemory_policy                  = "volatile-lru"
    enable_authentication             = true
    notify_keyspace_events           = "KEA"
    aof_backup_enabled               = true
    aof_storage_connection_string_0  = var.backup_storage_connection_string
  }
}

# Premium tier Redis Cache instance with high availability
resource "azurerm_redis_cache" "cache" {
  name                          = local.cache_name
  location                      = var.location
  resource_group_name           = var.resource_group_name
  capacity                      = var.redis_capacity
  family                        = "P"  # Premium SKU family
  sku_name                      = "Premium"
  enable_non_ssl_port          = false
  minimum_tls_version          = "1.2"
  subnet_id                    = var.subnet_id
  private_static_ip_address    = var.private_ip_address
  public_network_access_enabled = false

  redis_configuration {
    maxmemory_reserved              = var.maxmemory_reserved
    maxmemory_delta                 = var.maxmemory_delta
    maxmemory_policy                = local.redis_config.maxmemory_policy
    maxfragmentationmemory_reserved = var.maxfragmentationmemory_reserved
    notify_keyspace_events          = local.redis_config.notify_keyspace_events
    aof_backup_enabled              = local.redis_config.aof_backup_enabled
    aof_storage_connection_string_0 = local.redis_config.aof_storage_connection_string_0
    enable_authentication           = local.redis_config.enable_authentication
  }

  patch_schedule {
    day_of_week    = var.patch_day
    start_hour_utc = var.patch_hour
  }

  # High availability and disaster recovery settings
  zones = ["1", "2", "3"]  # Multi-zone deployment
  
  identity {
    type = "SystemAssigned"
  }

  tags = local.cache_tags

  lifecycle {
    prevent_destroy = true  # Prevent accidental deletion
  }
}

# Diagnostic settings for monitoring
resource "azurerm_monitor_diagnostic_setting" "redis_diagnostics" {
  name                       = "${local.cache_name}-diagnostics"
  target_resource_id         = azurerm_redis_cache.cache.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  log {
    category = "ConnectedClientList"
    enabled  = true
    retention_policy {
      enabled = true
      days    = 30
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true
    retention_policy {
      enabled = true
      days    = 30
    }
  }
}

# Outputs for reference in other modules
output "redis_cache_id" {
  description = "The ID of the Redis Cache"
  value       = azurerm_redis_cache.cache.id
}

output "redis_cache_hostname" {
  description = "The hostname of the Redis Cache"
  value       = azurerm_redis_cache.cache.hostname
}

output "redis_cache_ssl_port" {
  description = "The SSL port of the Redis Cache"
  value       = azurerm_redis_cache.cache.ssl_port
}

output "redis_cache_connection_string" {
  description = "The primary connection string of the Redis Cache"
  value       = azurerm_redis_cache.cache.primary_connection_string
  sensitive   = true
}