# Production environment Terraform configuration
# Terraform v1.5.0
# Azure RM Provider v3.75.0
# Google Provider v4.84.0

terraform {
  required_version = "~> 1.5.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.75.0"
    }
    google = {
      source  = "hashicorp/google" 
      version = "~> 4.84.0"
    }
  }
}

# Production environment configuration
locals {
  environment_config = {
    environment = "prod"
    regions     = ["eastus", "westus"]
    availability_zones = ["1", "2", "3"]
    kubernetes_version = "1.27"
    monitoring_retention_days = 90
  }

  # Production node pool configuration
  node_pool_config = {
    default = {
      name = "default"
      vm_size = "Standard_D4s_v3"
      min_count = 3
      max_count = 10
      enable_auto_scaling = true
      availability_zones = ["1", "2", "3"]
      node_labels = {
        pool = "default"
      }
      node_taints = []
    }
    analytics = {
      name = "analytics"
      vm_size = "Standard_D8s_v3"
      min_count = 2
      max_count = 8
      enable_auto_scaling = true
      availability_zones = ["1", "2", "3"]
      node_labels = {
        workload = "analytics"
      }
      node_taints = ["analytics=true:NoSchedule"]
    }
  }

  # Production database configuration
  database_config = {
    cosmos_db = {
      tier = "Production"
      offer_type = "Standard"
      kind = "GlobalDocumentDB"
      consistency_level = "Strong"
      max_throughput = 10000
      backup_retention_days = 30
      geo_redundant_backup = true
      geo_locations = [
        {
          location = "eastus"
          failover_priority = 0
        },
        {
          location = "westus"
          failover_priority = 1
        }
      ]
    }
    firestore = {
      mode = "NATIVE"
      location_id = "us-east1"
      concurrency_mode = "OPTIMISTIC"
      app_engine_integration_mode = "DISABLED"
    }
  }
}

# Production Kubernetes cluster
module "kubernetes_prod" {
  source = "../../modules/kubernetes"

  project_name = var.project_name
  environment = local.environment_config.environment
  regions = local.environment_config.regions
  availability_zones = local.environment_config.availability_zones
  kubernetes_version = local.environment_config.kubernetes_version
  node_pool_config = local.node_pool_config

  # Production-specific configurations
  monitoring_enabled = true
  network_policy_enabled = true
  pod_security_policy_enabled = true
  
  # High availability settings
  auto_scaling_config = {
    cpu_threshold = 70
    memory_threshold = 80
  }
}

# Production database infrastructure
module "database_prod" {
  source = "../../modules/database"

  project_name = var.project_name
  environment = local.environment_config.environment
  regions = local.environment_config.regions
  
  cosmos_db_config = local.database_config.cosmos_db
  firestore_config = local.database_config.firestore

  # Production security settings
  encryption_enabled = true
  network_isolation_enabled = true
  
  # High availability settings
  enable_geo_replication = true
  failover_policies = {
    automatic = true
    grace_period = "PT1H"
  }
}

# Production Redis cache
module "cache_prod" {
  source = "../../modules/cache"

  project_name = var.project_name
  environment = local.environment_config.environment
  regions = local.environment_config.regions

  # Production cache settings
  sku = "Premium"
  capacity = 2
  family = "P"
  enable_non_ssl_port = false
  enable_geo_replication = true
  
  # High availability settings
  shard_count = 3
  persistence_enabled = true
  rdb_backup_frequency = 60
}

# Production monitoring infrastructure
module "monitoring_prod" {
  source = "../../modules/monitoring"

  project_name = var.project_name
  environment = local.environment_config.environment
  retention_days = local.environment_config.monitoring_retention_days

  # Production monitoring settings
  enable_alerting = true
  enable_log_analytics = true
  enable_distributed_tracing = true
  
  # Alert configuration
  alert_config = {
    cpu_threshold = 80
    memory_threshold = 85
    error_rate_threshold = 1
  }

  # Log analytics settings
  log_analytics_workspace_sku = "PerGB2018"
  workspace_retention_days = 90
}

# Production environment outputs
output "kubernetes_cluster_endpoints" {
  description = "Kubernetes cluster API endpoints by region"
  value = module.kubernetes_prod.cluster_endpoints
}

output "cosmos_db_endpoints" {
  description = "Cosmos DB endpoints by region"
  value = module.database_prod.cosmos_db_endpoints
  sensitive = true
}

output "redis_cache_endpoints" {
  description = "Redis cache endpoints by region"
  value = module.cache_prod.cache_endpoints
  sensitive = true
}

output "monitoring_dashboards_url" {
  description = "URL for Grafana monitoring dashboards"
  value = module.monitoring_prod.grafana_url
}