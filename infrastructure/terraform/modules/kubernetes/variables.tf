# Core Terraform variable definitions for Kubernetes module
# Version: ~> 1.0

# Required Variables
variable "project_name" {
  description = "Name of the project used for resource naming"
  type        = string

  validation {
    condition     = length(var.project_name) > 0 && length(var.project_name) <= 16
    error_message = "Project name must be between 1 and 16 characters"
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

variable "region" {
  description = "Azure region for the Kubernetes cluster deployment"
  type        = string

  validation {
    condition     = can(regex("^[a-z]+-[a-z]+[0-9]*$", var.region))
    error_message = "Region must be a valid Azure region name"
  }
}

# Optional Variables with Defaults
variable "kubernetes_version" {
  description = "Kubernetes version to use for the AKS cluster"
  type        = string
  default     = "1.27"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+$", var.kubernetes_version))
    error_message = "Kubernetes version must be in the format X.Y"
  }
}

variable "node_pool_config" {
  description = "Configuration for the default node pool"
  type = object({
    name            = string
    vm_size         = string
    min_count       = number
    max_count       = number
    os_disk_size_gb = number
    max_pods        = number
  })

  default = {
    name            = "default"
    vm_size         = "Standard_D2s_v3"
    min_count       = 3
    max_count       = 10
    os_disk_size_gb = 128
    max_pods        = 110
  }

  validation {
    condition = (
      var.node_pool_config.min_count <= var.node_pool_config.max_count &&
      var.node_pool_config.min_count >= 1 &&
      var.node_pool_config.os_disk_size_gb >= 128 &&
      var.node_pool_config.max_pods >= 30 &&
      var.node_pool_config.max_pods <= 250
    )
    error_message = "Invalid node pool configuration. Please check the requirements for min_count, max_count, os_disk_size_gb, and max_pods."
  }
}

variable "availability_zones" {
  description = "List of availability zones for the cluster nodes"
  type        = list(string)
  default     = ["1", "2", "3"]

  validation {
    condition     = length(var.availability_zones) > 0
    error_message = "At least one availability zone must be specified"
  }
}

variable "network_config" {
  description = "Network configuration for the AKS cluster"
  type = object({
    network_plugin      = string
    network_policy     = string
    service_cidr       = string
    dns_service_ip     = string
    docker_bridge_cidr = string
  })

  default = {
    network_plugin      = "azure"
    network_policy     = "calico"
    service_cidr       = "10.0.0.0/16"
    dns_service_ip     = "10.0.0.10"
    docker_bridge_cidr = "172.17.0.1/16"
  }

  validation {
    condition = (
      contains(["azure", "kubenet"], var.network_config.network_plugin) &&
      contains(["azure", "calico"], var.network_config.network_policy) &&
      can(cidrhost(var.network_config.service_cidr, 0))
    )
    error_message = "Invalid network configuration. Please check network_plugin, network_policy, and CIDR values."
  }
}

variable "monitoring_enabled" {
  description = "Enable monitoring stack deployment (Prometheus + Grafana)"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}

  validation {
    condition     = length(var.tags) <= 50
    error_message = "Maximum number of tags is 50"
  }
}

# Local variables for internal module use
locals {
  cluster_name = "${var.project_name}-${var.environment}-aks"
  
  default_tags = merge(
    var.tags,
    {
      Environment = var.environment
      ManagedBy   = "terraform"
      Project     = var.project_name
    }
  )

  node_pool_name_prefix = "np"
}