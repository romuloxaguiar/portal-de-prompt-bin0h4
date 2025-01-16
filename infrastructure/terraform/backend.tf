# Backend configuration for Terraform state management
# Version: azurerm ~> 3.0
# Purpose: Configures secure remote state storage with managed identity authentication,
# state locking, and cross-region replication support

terraform {
  backend "azurerm" {
    # Resource group and storage account names are dynamically constructed using project and environment variables
    resource_group_name  = "${var.project_name}-tfstate-${var.environment}"
    storage_account_name = "${var.project_name}tfstate${var.environment}"
    container_name      = "tfstate"
    key                 = "terraform.tfstate"

    # Security configuration
    use_msi                    = true
    enable_blob_encryption     = true
    enable_https_traffic_only  = true
    min_tls_version           = "TLS1_2"
    allow_blob_public_access   = false

    # Cross-region replication and redundancy
    account_replication_type = "GRS"
    account_tier            = "Standard"
    
    # State locking configuration for concurrent access control
    lock_enabled = true
  }
}

# Remote state data source for core infrastructure
data "terraform_remote_state" "core" {
  backend = "azurerm"
  
  config = {
    resource_group_name  = "${var.project_name}-tfstate-${var.environment}"
    storage_account_name = "${var.project_name}tfstate${var.environment}"
    container_name      = "tfstate"
    key                 = "core.tfstate"
    
    # Security configuration
    use_msi                    = true
    enable_blob_encryption     = true
    enable_https_traffic_only  = true
    min_tls_version           = "TLS1_2"
    allow_blob_public_access   = false

    # Subscription and tenant details from core state
    subscription_id = data.terraform_remote_state.core.outputs.subscription_id
    tenant_id      = data.terraform_remote_state.core.outputs.tenant_id
  }
}