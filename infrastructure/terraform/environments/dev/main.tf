# Development environment Terraform configuration for Prompts Portal
terraform {
  required_version = ">= 1.0"

  # Azure backend configuration for dev environment state
  backend "azurerm" {
    resource_group_name  = "prompts-portal-tfstate-rg"
    storage_account_name = "promptsportaltfstatedev"
    container_name      = "tfstate"
    key                = "dev.terraform.tfstate"
  }
}

# Local variables for development environment configuration
locals {
  environment_config = {
    project_name = "prompts-portal"
    environment  = "dev"
    region      = "us-east-1"
    tags = {
      Environment = "Development"
      ManagedBy   = "Terraform"
      Project     = "PromptsPortal"
    }
  }
}

# Root module configuration for development environment
module "root" {
  source = "../../"

  # Project and environment configuration
  project_name = local.environment_config.project_name
  environment  = local.environment_config.environment
  region      = local.environment_config.environment

  # Kubernetes configuration optimized for development
  kubernetes_version = "1.27"
  node_pool_config = {
    name                = "dev-pool"
    vm_size            = "Standard_D2s_v3"
    min_count          = 2
    max_count          = 5
    enable_auto_scaling = true
    availability_zones  = ["1", "2"]
    node_labels        = {
      environment = "development"
    }
    node_taints        = []
  }

  # Development-appropriate database configuration
  database_tier = {
    cosmos_db = {
      offer_type         = "Standard"
      kind              = "GlobalDocumentDB"
      consistency_level = "Session"
      max_throughput    = 400
      backup_retention_days = 7
      geo_locations     = []
    }
    firestore = {
      database_type               = "DATASTORE_MODE"
      concurrency_mode           = "OPTIMISTIC"
      location_id                = local.environment_config.region
      app_engine_integration_mode = "DISABLED"
    }
  }

  # Development Redis cache configuration
  redis_cache_config = {
    capacity            = 1
    family             = "C"
    sku                = "Basic"
    enable_clustering   = false
    shard_count        = 1
    enable_persistence = false
    rdb_backup_frequency = 0
  }

  # Development monitoring configuration
  monitoring_config = {
    retention_days               = 14
    enable_detailed_metrics     = true
    log_analytics_workspace_sku = "PerGB2018"
    alert_notification_emails   = ["dev-team@promptsportal.com"]
  }

  # Disable geo-replication for development
  enable_geo_replication = false
  secondary_regions     = []

  # Development environment tags
  tags = local.environment_config.tags
}

# Output the development Kubernetes cluster endpoint
output "kubernetes_cluster_endpoint" {
  description = "Development Kubernetes cluster endpoint"
  value       = module.root.kubernetes_cluster_endpoint
  sensitive   = true
}

# Output the development database connection string
output "database_connection_string" {
  description = "Development database connection string"
  value       = module.root.database_connection_string
  sensitive   = true
}

# Output the development Redis connection information
output "redis_connection_info" {
  description = "Development Redis cache connection information"
  value       = module.root.redis_connection_info
  sensitive   = true
}