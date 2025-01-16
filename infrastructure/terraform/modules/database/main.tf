# Provider configuration
terraform {
  required_providers {
    # Azure provider v3.0 for Cosmos DB deployment
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    # Google Cloud provider v4.0 for Firestore deployment
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

# Local variables for resource naming and tagging
locals {
  resource_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Project            = var.project_name
    Environment        = var.environment
    ManagedBy         = "Terraform"
    BackupEnabled     = "true"
    SecurityLevel     = "high"
    CostCenter        = var.cost_center
    DataClassification = "sensitive"
  }
}

# Cosmos DB Account
resource "azurerm_cosmosdb_account" "cosmos_db_account" {
  name                = "${local.resource_prefix}-cosmos"
  location            = var.region
  resource_group_name = var.resource_group
  offer_type         = var.cosmos_db_config.offer_type
  kind               = var.cosmos_db_config.kind
  
  enable_automatic_failover = true
  enable_multiple_write_locations = true
  
  # Consistency policy configuration
  consistency_policy {
    consistency_level       = var.cosmos_db_config.consistency_level
    max_interval_in_seconds = var.cosmos_db_config.max_interval_in_seconds
    max_staleness_prefix   = var.cosmos_db_config.max_staleness_prefix
  }

  # Geo-replication configuration
  dynamic "geo_location" {
    for_each = var.enable_geo_replication ? var.secondary_regions : []
    content {
      location          = geo_location.value.location
      failover_priority = geo_location.value.failover_priority
      zone_redundant    = geo_location.value.zone_redundant
    }
  }

  # Primary location configuration
  geo_location {
    location          = var.region
    failover_priority = 0
    zone_redundant    = true
  }

  # Backup configuration
  backup {
    type                = "Periodic"
    interval_in_minutes = 240
    retention_in_hours  = var.backup_retention_days * 24
    storage_redundancy  = "Geo"
  }

  # Network and security configuration
  network_acl_bypass_for_azure_services = true
  
  virtual_network_rule {
    id                                   = var.subnet_id
    ignore_missing_vnet_service_endpoint = false
  }

  ip_range_filter = join(",", var.allowed_ip_ranges)

  # Additional features
  enable_free_tier = false
  analytical_storage_enabled = true
  
  tags = local.common_tags
}

# Firestore Instance
resource "google_firestore_database" "firestore_instance" {
  name                = "${local.resource_prefix}-firestore"
  location_id         = var.firestore_config.location_id
  type                = var.firestore_config.database_type
  concurrency_mode    = var.firestore_config.concurrency_mode
  
  app_engine_integration_mode = var.firestore_config.app_engine_integration_mode
  
  # Enable point-in-time recovery
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
  
  # Enable delete protection
  delete_protection_state = "DELETE_PROTECTION_ENABLED"
  
  labels = local.common_tags
}

# Outputs
output "cosmos_db_endpoint" {
  description = "Primary endpoint for Cosmos DB account"
  value       = azurerm_cosmosdb_account.cosmos_db_account.endpoint
}

output "cosmos_db_primary_key" {
  description = "Primary access key for Cosmos DB account"
  value       = azurerm_cosmosdb_account.cosmos_db_account.primary_key
  sensitive   = true
}

output "cosmos_db_secondary_key" {
  description = "Secondary access key for Cosmos DB account"
  value       = azurerm_cosmosdb_account.cosmos_db_account.secondary_key
  sensitive   = true
}

output "cosmos_db_connection_strings" {
  description = "List of connection strings for Cosmos DB account"
  value       = azurerm_cosmosdb_account.cosmos_db_account.connection_strings
  sensitive   = true
}

output "firestore_name" {
  description = "Name of the Firestore database instance"
  value       = google_firestore_database.firestore_instance.name
}