# Terraform configuration for AKS cluster deployment
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

# Local variables for resource naming and configuration
locals {
  cluster_name         = "${var.project_name}-${var.environment}-aks"
  node_pool_name       = "${var.node_pool_config.name}-${var.environment}"
  monitoring_namespace = "monitoring"
}

# Data source for existing resource group
data "azurerm_resource_group" "main" {
  name = "${var.project_name}-${var.environment}-rg"
}

# AKS cluster resource
resource "azurerm_kubernetes_cluster" "main" {
  name                = local.cluster_name
  location            = var.region
  resource_group_name = data.azurerm_resource_group.main.name
  dns_prefix          = "${var.project_name}-${var.environment}"
  kubernetes_version  = var.kubernetes_version

  default_node_pool {
    name                = var.node_pool_config.name
    vm_size             = var.node_pool_config.vm_size
    enable_auto_scaling = true
    min_count          = var.node_pool_config.min_count
    max_count          = var.node_pool_config.max_count
    os_disk_size_gb    = var.node_pool_config.os_disk_size_gb
    max_pods           = var.node_pool_config.max_pods
    zones              = var.availability_zones
    node_labels = {
      "environment" = var.environment
      "nodepool"    = var.node_pool_config.name
    }
    node_taints = []
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin     = var.network_config.network_plugin
    network_policy    = var.network_config.network_policy
    service_cidr      = var.network_config.service_cidr
    dns_service_ip    = var.network_config.dns_service_ip
    docker_bridge_cidr = var.network_config.docker_bridge_cidr
    load_balancer_sku = "standard"
  }

  addon_profile {
    oms_agent {
      enabled = var.monitoring_enabled
    }
    azure_policy {
      enabled = true
    }
  }

  auto_scaler_profile {
    balance_similar_node_groups = true
    expander                   = "random"
    max_graceful_termination_sec = 600
    scale_down_delay_after_add    = "10m"
    scale_down_delay_after_delete = "10s"
    scale_down_delay_after_failure = "3m"
    scan_interval                = "10s"
    scale_down_unneeded         = "10m"
    scale_down_utilization_threshold = 0.5
  }

  tags = var.tags
}

# Monitoring stack deployment using Helm
resource "helm_release" "monitoring_stack" {
  count = var.monitoring_enabled ? 1 : 0

  name             = "monitoring"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  namespace        = local.monitoring_namespace
  create_namespace = true
  version          = "45.0.0"  # Specify a stable version

  values = [
    file("${path.module}/values/monitoring.yaml")
  ]

  set {
    name  = "grafana.enabled"
    value = "true"
  }

  set {
    name  = "prometheus.enabled"
    value = "true"
  }

  set {
    name  = "alertmanager.enabled"
    value = "true"
  }

  depends_on = [azurerm_kubernetes_cluster.main]
}

# Output values for use in other modules
output "cluster_id" {
  description = "The ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.id
}

output "cluster_endpoint" {
  description = "The endpoint for the Kubernetes API server"
  value       = azurerm_kubernetes_cluster.main.kube_config.0.host
}

output "cluster_ca_certificate" {
  description = "The base64 encoded certificate authority data for the cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate
}

output "kube_config" {
  description = "The full kubeconfig for the cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}