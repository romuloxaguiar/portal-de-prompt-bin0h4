# Output configuration for Prompts Portal infrastructure
# Defines exposed values after deployment for application integration

# Kubernetes cluster outputs
output "kubernetes_cluster_endpoint" {
  description = "Kubernetes cluster API endpoint for application deployment"
  value       = module.kubernetes.cluster_endpoint
  sensitive   = false
}

output "kubernetes_cluster_name" {
  description = "Name of the deployed Kubernetes cluster"
  value       = module.kubernetes.cluster_name
  sensitive   = false
}

# Database outputs
output "cosmos_db_endpoint" {
  description = "Primary and secondary Cosmos DB endpoints for application connection with failover support"
  value = {
    primary   = module.database.cosmos_db_endpoints.primary
    secondary = module.database.cosmos_db_endpoints.secondary
  }
  sensitive = false
}

output "cosmos_db_connection_string" {
  description = "Secure Cosmos DB connection string with read-write permissions"
  value       = module.database.cosmos_db_connection_string
  sensitive   = true
}

output "firestore_project_id" {
  description = "Google Cloud project ID for Firestore analytics data storage"
  value       = module.database.firestore_project_id
  sensitive   = false
}

# Cache outputs
output "redis_cache_host" {
  description = "Redis cache hostname with failover support for high availability"
  value = {
    primary_host = module.cache.redis_host
    ssl_port     = module.cache.redis_ssl_port
    replica_host = var.enable_geo_replication ? module.cache.redis_replica_host : null
  }
  sensitive = false
}

output "redis_cache_auth_token" {
  description = "Secure Redis cache authentication token with automatic rotation"
  value       = module.cache.redis_auth_token
  sensitive   = true
}

# Monitoring outputs
output "monitoring_grafana_endpoint" {
  description = "Grafana dashboard endpoint for monitoring access"
  value       = module.monitoring.grafana_endpoint
  sensitive   = false
}

output "monitoring_prometheus_endpoint" {
  description = "Prometheus endpoint for metrics collection"
  value       = module.monitoring.prometheus_endpoint
  sensitive   = false
}

# Resource group output
output "resource_group_name" {
  description = "Name of the Azure resource group containing all resources"
  value       = azurerm_resource_group.main.name
  sensitive   = false
}

# Network outputs
output "vnet_name" {
  description = "Name of the virtual network hosting the infrastructure"
  value       = azurerm_virtual_network.main.name
  sensitive   = false
}

output "subnet_ids" {
  description = "Map of subnet names to their IDs for network configuration"
  value = {
    kubernetes = azurerm_subnet.kubernetes.id
    database   = azurerm_subnet.database.id
  }
  sensitive = false
}

# Security outputs
output "key_vault_uri" {
  description = "URI of the Azure Key Vault for secrets management"
  value       = module.kubernetes.key_vault_uri
  sensitive   = false
}

# Deployment metadata
output "deployment_info" {
  description = "Metadata about the infrastructure deployment"
  value = {
    project_name = var.project_name
    environment  = var.environment
    region      = var.region
    timestamp   = timestamp()
  }
  sensitive = false
}

# High availability configuration
output "ha_configuration" {
  description = "High availability and failover configuration details"
  value = {
    geo_replication_enabled = var.enable_geo_replication
    secondary_regions      = var.secondary_regions
    availability_zones    = module.kubernetes.availability_zones
  }
  sensitive = false
}