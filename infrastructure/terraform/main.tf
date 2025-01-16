# Core Terraform configuration
terraform {
  # terraform v1.5.0
  required_version = "~> 1.5.0"
  
  required_providers {
    # azurerm v3.75.0
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.75.0"
    }
    # google v4.84.0
    google = {
      source  = "hashicorp/google"
      version = "~> 4.84.0"
    }
  }

  backend "azurerm" {
    # Backend configuration should be provided via backend.tfvars
  }
}

# Local variables for resource naming and configuration
locals {
  resource_prefix = "${var.project_name}-${var.environment}-${var.region}"
  
  common_tags = merge(var.tags, {
    environment = var.environment
    project     = var.project_name
    managed_by  = "terraform"
    created_at  = timestamp()
  })

  backup_config = {
    retention_days = var.environment == "prod" ? 35 : 7
    geo_redundant  = var.environment == "prod" ? true : false
  }

  monitoring_config = {
    metrics_retention = var.environment == "prod" ? 90 : 30
    detailed_logging = var.environment == "prod" ? true : false
  }
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${local.resource_prefix}-rg"
  location = var.region
  tags     = local.common_tags

  lifecycle {
    prevent_destroy = var.environment == "prod"
  }
}

# Virtual Network
resource "azurerm_virtual_network" "main" {
  name                = "${local.resource_prefix}-vnet"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  address_space       = ["10.0.0.0/16"]
  tags                = local.common_tags

  # DDoS Protection
  ddos_protection_plan {
    id     = var.environment == "prod" ? azurerm_network_ddos_protection_plan.main[0].id : null
    enable = var.environment == "prod"
  }
}

# Subnets
resource "azurerm_subnet" "kubernetes" {
  name                 = "kubernetes"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.2.0/23"]
  
  service_endpoints = [
    "Microsoft.ContainerRegistry",
    "Microsoft.KeyVault",
    "Microsoft.Storage"
  ]
}

resource "azurerm_subnet" "database" {
  name                 = "database"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.4.0/24"]
  
  service_endpoints = [
    "Microsoft.AzureCosmosDB",
    "Microsoft.KeyVault"
  ]

  delegation {
    name = "cosmosdb-delegation"
    service_delegation {
      name = "Microsoft.AzureCosmosDB/clusters"
    }
  }
}

# Kubernetes Cluster Module
module "kubernetes" {
  source = "./modules/kubernetes"

  project_name       = var.project_name
  environment        = var.environment
  region            = var.region
  resource_group_id = azurerm_resource_group.main.id
  subnet_id         = azurerm_subnet.kubernetes.id
  
  kubernetes_version = var.kubernetes_version
  node_pool_config  = var.node_pool_config
  
  availability_zones = ["1", "2", "3"]
  auto_scaling_config = {
    min_count     = 3
    max_count     = 10
    cpu_threshold = 70
  }

  tags = local.common_tags
}

# Database Module
module "database" {
  source = "./modules/database"

  project_name    = var.project_name
  environment     = var.environment
  region         = var.region
  resource_group = azurerm_resource_group.main.name
  subnet_id      = azurerm_subnet.database.id

  cosmos_db_config = var.database_tier.cosmos_db
  firestore_config = var.database_tier.firestore

  enable_geo_replication = var.enable_geo_replication
  secondary_regions     = var.secondary_regions
  backup_retention_days = local.backup_config.retention_days
  
  tags = local.common_tags
}

# Redis Cache
resource "azurerm_redis_cache" "main" {
  name                = "${local.resource_prefix}-redis"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  
  capacity            = var.redis_cache_config.capacity
  family              = var.redis_cache_config.family
  sku_name            = var.redis_cache_config.sku
  enable_non_ssl_port = false
  
  redis_configuration {
    enable_authentication = true
    maxmemory_policy     = "allkeys-lru"
  }

  patch_schedule {
    day_of_week = "Sunday"
    start_hour_utc = 2
  }

  tags = local.common_tags
}

# Monitoring Module
module "monitoring" {
  source = "./modules/monitoring"

  project_name    = var.project_name
  environment     = var.environment
  region         = var.region
  resource_group = azurerm_resource_group.main.name

  retention_days             = var.monitoring_config.retention_days
  enable_detailed_metrics   = var.monitoring_config.enable_detailed_metrics
  workspace_sku             = var.monitoring_config.log_analytics_workspace_sku
  alert_notification_emails = var.monitoring_config.alert_notification_emails

  tags = local.common_tags
}

# Outputs
output "kubernetes_cluster_endpoint" {
  value = {
    endpoint                  = module.kubernetes.cluster_endpoint
    certificate_authority_data = module.kubernetes.cluster_ca_certificate
  }
  sensitive = true
}

output "database_connection_string" {
  value = {
    primary_connection_string = module.database.primary_connection_string
    replica_connection_string = module.database.replica_connection_string
  }
  sensitive = true
}

output "redis_connection_info" {
  value = {
    hostname = azurerm_redis_cache.main.hostname
    ssl_port = azurerm_redis_cache.main.ssl_port
  }
  sensitive = true
}