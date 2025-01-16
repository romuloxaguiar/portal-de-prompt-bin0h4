# Configure Terraform required providers with version constraints
terraform {
  required_version = "~> 1.5.0"
  
  required_providers {
    # Azure Resource Manager provider for primary cloud infrastructure
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.75.0"
    }
    
    # Google Cloud Platform provider for secondary cloud infrastructure
    google = {
      source  = "hashicorp/google"
      version = "~> 4.84.0"
    }
    
    # Kubernetes provider for container orchestration
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23.0"
    }
    
    # Helm provider for package management
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11.0"
    }
  }
}

# Azure provider configuration with enhanced security features and multi-region support
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
      recover_soft_deleted_key_vaults = true
    }
    virtual_machine {
      delete_os_disk_on_deletion = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }

  subscription_id = data.terraform_remote_state.core.outputs.subscription_id
  tenant_id       = data.terraform_remote_state.core.outputs.tenant_id
  environment     = var.environment
  
  # Ensure explicit provider registration
  skip_provider_registration = false
}

# Google Cloud Platform provider configuration
provider "google" {
  project = var.project_name
  region  = var.region
  zone    = "${var.region}-a"
  
  # Enable user project override for proper billing
  user_project_override = true
  billing_project      = var.project_name
}

# Kubernetes provider configuration with Azure AKS integration
provider "kubernetes" {
  host = data.terraform_remote_state.cluster.outputs.kubernetes_cluster_endpoint
  
  cluster_ca_certificate = base64decode(data.terraform_remote_state.cluster.outputs.cluster_ca_certificate)
  token                 = data.terraform_remote_state.cluster.outputs.service_account_token
  
  # Azure AKS authentication configuration
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "azure"
    args = [
      "aks",
      "get-credentials",
      "--resource-group",
      var.resource_group_name,
      "--name",
      var.cluster_name
    ]
  }
}

# Helm provider configuration for Kubernetes package management
provider "helm" {
  kubernetes {
    host = data.terraform_remote_state.cluster.outputs.kubernetes_cluster_endpoint
    
    cluster_ca_certificate = base64decode(data.terraform_remote_state.cluster.outputs.cluster_ca_certificate)
    token                 = data.terraform_remote_state.cluster.outputs.service_account_token
  }
  
  # Configure Helm registry settings
  registry {
    url = "https://charts.helm.sh/stable"
    username = var.helm_registry_username
    password = var.helm_registry_password
  }
}