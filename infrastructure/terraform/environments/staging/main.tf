# Staging environment Terraform configuration
# Provider versions:
# azurerm ~> 3.0
# kubernetes ~> 2.0
# helm ~> 2.0

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

# Import root module configuration
module "main" {
  source = "../../main.tf"
}

# Local variables for staging environment
locals {
  environment_config = {
    kubernetes = {
      node_pool_config = {
        name                = "staging"
        vm_size            = "Standard_D4s_v3"
        min_count          = 2
        max_count          = 5
        enable_auto_scaling = true
        availability_zones  = ["1", "2"]
        node_labels        = {
          environment = "staging"
        }
        node_taints        = []
      }
    }
    monitoring = {
      retention_days     = 30
      enable_alerting    = true
      enable_dashboard   = true
      detailed_metrics   = true
    }
    backup = {
      retention_days = 7
      geo_redundant  = false
    }
  }
}

# Kubernetes cluster module
module "kubernetes" {
  source = "../../modules/kubernetes"

  project_name       = var.project_name
  environment        = "staging"
  region            = var.region
  kubernetes_version = "1.27"
  
  node_pool_config   = local.environment_config.kubernetes.node_pool_config
  monitoring_enabled = true
  availability_zones = ["1", "2"]

  tags = {
    Environment = "staging"
    ManagedBy   = "Terraform"
    Project     = var.project_name
    Purpose     = "pre-production"
  }
}

# Database module
module "database" {
  source = "../../modules/database"

  project_name = var.project_name
  environment  = "staging"
  region      = var.region

  cosmos_db_config = {
    offer_type            = "Standard"
    kind                 = "GlobalDocumentDB"
    consistency_level    = "Session"
    max_interval_in_seconds = 5
    max_staleness_prefix   = 100
    failover_priority      = 0
  }

  backup_retention_days = local.environment_config.backup.retention_days

  tags = {
    Environment = "staging"
    ManagedBy   = "Terraform"
    Project     = var.project_name
    Purpose     = "pre-production"
  }
}

# Cache module
module "cache" {
  source = "../../modules/cache"

  project_name = var.project_name
  environment  = "staging"
  region      = var.region

  redis_cache_size    = "Standard_C1"
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"

  tags = {
    Environment = "staging"
    ManagedBy   = "Terraform"
    Project     = var.project_name
    Purpose     = "pre-production"
  }
}

# Monitoring module
module "monitoring" {
  source = "../../modules/monitoring"

  project_name = var.project_name
  environment  = "staging"
  region      = var.region

  retention_days  = local.environment_config.monitoring.retention_days
  enable_alerting = local.environment_config.monitoring.enable_alerting
  enable_dashboard = local.environment_config.monitoring.enable_dashboard

  tags = {
    Environment = "staging"
    ManagedBy   = "Terraform"
    Project     = var.project_name
    Purpose     = "pre-production"
  }
}

# Outputs
output "kubernetes_cluster_endpoint" {
  description = "AKS cluster endpoint"
  value       = module.kubernetes.cluster_endpoint
}

output "cosmos_db_connection_string" {
  description = "Cosmos DB connection string"
  value       = module.database.cosmos_db_endpoint
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis cache connection string"
  value       = module.cache.redis_connection_string
  sensitive   = true
}