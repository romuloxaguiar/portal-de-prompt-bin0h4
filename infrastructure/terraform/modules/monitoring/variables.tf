# Core project variables
variable "project_name" {
  description = "Name of the project for resource naming"
  type        = string
  default     = "prompts-portal"
}

variable "environment" {
  description = "Deployment environment (dev/staging/prod)"
  type        = string
  
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "region" {
  description = "Cloud region for resource deployment"
  type        = string
}

# Monitoring namespace and tags
variable "monitoring_namespace" {
  description = "Kubernetes namespace for monitoring components"
  type        = string
  default     = "monitoring"
}

variable "monitoring_tags" {
  description = "Tags to apply to monitoring resources"
  type        = map(string)
  default = {
    component  = "monitoring"
    managed-by = "terraform"
  }
}

# Helm chart versions
variable "prometheus_version" {
  description = "Version of Prometheus Helm chart to deploy"
  type        = string
  default     = "15.10.0"  # Specify version for production readiness
}

variable "grafana_version" {
  description = "Version of Grafana Helm chart to deploy"
  type        = string
  default     = "6.50.0"  # Specify version for production readiness
}

variable "alertmanager_version" {
  description = "Version of AlertManager Helm chart to deploy"
  type        = string
  default     = "0.24.0"  # Specify version for production readiness
}

# Monitoring configuration
variable "retention_period" {
  description = "Data retention period in days for Prometheus"
  type        = number
  default     = 15

  validation {
    condition     = var.retention_period >= 7 && var.retention_period <= 90
    error_message = "Retention period must be between 7 and 90 days"
  }
}

variable "scrape_interval" {
  description = "Interval in seconds between metric scrapes"
  type        = number
  default     = 15

  validation {
    condition     = var.scrape_interval >= 10 && var.scrape_interval <= 300
    error_message = "Scrape interval must be between 10 and 300 seconds"
  }
}

variable "enable_alerting" {
  description = "Whether to enable AlertManager deployment"
  type        = bool
  default     = true
}

# Sensitive variables
variable "grafana_admin_password" {
  description = "Admin password for Grafana"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.grafana_admin_password) >= 12
    error_message = "Grafana admin password must be at least 12 characters long"
  }
}

# Optional monitoring customization
variable "custom_scrape_configs" {
  description = "Additional scrape configurations for Prometheus"
  type        = list(map(string))
  default     = []
}

variable "grafana_plugins" {
  description = "List of Grafana plugins to install"
  type        = list(string)
  default     = [
    "grafana-piechart-panel",
    "grafana-clock-panel"
  ]
}

variable "alert_receiver_configs" {
  description = "Alert receiver configurations for AlertManager"
  type        = map(any)
  default     = {}
  sensitive   = true
}

# Performance monitoring thresholds
variable "performance_thresholds" {
  description = "Performance monitoring thresholds for alerts"
  type = object({
    response_time_threshold = number
    error_rate_threshold   = number
    cpu_threshold         = number
    memory_threshold      = number
  })
  default = {
    response_time_threshold = 2     # 2 seconds as per requirements
    error_rate_threshold   = 0.001  # 0.1% error rate
    cpu_threshold         = 80      # 80% CPU utilization
    memory_threshold      = 85      # 85% memory utilization
  }
}