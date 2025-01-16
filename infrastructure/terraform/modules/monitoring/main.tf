# Terraform configuration for monitoring infrastructure setup
# Implements comprehensive monitoring stack with Prometheus, Grafana, and AlertManager

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

# Create dedicated namespace for monitoring components
resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = var.monitoring_namespace
    
    labels = {
      name        = var.monitoring_namespace
      environment = var.environment
      managed-by  = "terraform"
      project     = var.project_name
    }

    annotations = {
      "network.policy"  = "restricted"
      "backup.policy"   = "enabled"
      "security.policy" = "restricted"
    }
  }
}

# Deploy Prometheus stack using Helm
resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus"
  version    = var.prometheus_version
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    yamlencode({
      server = {
        replicaCount = 2
        retention    = "${var.retention_period}d"
        global = {
          scrape_interval = "${var.scrape_interval}s"
          evaluation_interval = "15s"
        }
        resources = {
          requests = {
            cpu    = "500m"
            memory = "2Gi"
          }
          limits = {
            cpu    = "1000m"
            memory = "4Gi"
          }
        }
        persistentVolume = {
          size         = "50Gi"
          storageClass = "managed-premium"
        }
        podAntiAffinity = {
          preferredDuringSchedulingIgnoredDuringExecution = [{
            weight = 100
            podAffinityTerm = {
              labelSelector = {
                matchExpressions = [{
                  key      = "app"
                  operator = "In"
                  values   = ["prometheus"]
                }]
              }
              topologyKey = "kubernetes.io/hostname"
            }
          }]
        }
        securityContext = {
          runAsNonRoot = true
          runAsUser    = 65534
          fsGroup      = 65534
        }
        serviceMonitor = {
          enabled  = true
          interval = "15s"
        }
        additionalScrapeConfigs = var.custom_scrape_configs
      }
      alertmanager = {
        enabled = var.enable_alerting
        config = {
          global = {
            resolve_timeout = "5m"
          }
          route = {
            group_by    = ["alertname", "severity"]
            group_wait  = "30s"
            group_interval = "5m"
            repeat_interval = "12h"
            receiver = "default"
          }
          receivers = [{
            name = "default"
          }]
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.monitoring]
}

# Deploy Grafana using Helm
resource "helm_release" "grafana" {
  name       = "grafana"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  version    = var.grafana_version
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    yamlencode({
      replicaCount = 2
      adminPassword = var.grafana_admin_password
      
      resources = {
        requests = {
          cpu    = "200m"
          memory = "512Mi"
        }
        limits = {
          cpu    = "500m"
          memory = "1Gi"
        }
      }
      
      persistentVolume = {
        size         = "10Gi"
        storageClass = "managed-premium"
      }
      
      podAntiAffinity = {
        preferredDuringSchedulingIgnoredDuringExecution = [{
          weight = 100
          podAffinityTerm = {
            labelSelector = {
              matchExpressions = [{
                key      = "app"
                operator = "In"
                values   = ["grafana"]
              }]
            }
            topologyKey = "kubernetes.io/hostname"
          }
        }]
      }
      
      securityContext = {
        runAsNonRoot = true
        runAsUser    = 472
        fsGroup      = 472
      }
      
      datasources = {
        "datasources.yaml" = {
          apiVersion = 1
          datasources = [{
            name      = "Prometheus"
            type      = "prometheus"
            url       = "http://prometheus-server:9090"
            access    = "proxy"
            isDefault = true
          }]
        }
      }
      
      dashboardProviders = {
        "dashboardproviders.yaml" = {
          apiVersion = 1
          providers = [{
            name            = "default"
            orgId           = 1
            folder         = ""
            type           = "file"
            disableDeletion = false
            editable       = true
            options = {
              path = "/var/lib/grafana/dashboards/default"
            }
          }]
        }
      }
      
      plugins = var.grafana_plugins
      
      backup = {
        enabled  = true
        schedule = "0 0 * * *"
        storage = {
          storageClass = "managed-premium"
          size        = "5Gi"
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.monitoring, helm_release.prometheus]
}

# Deploy AlertManager if enabled
resource "helm_release" "alertmanager" {
  count      = var.enable_alerting ? 1 : 0
  name       = "alertmanager"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "alertmanager"
  version    = var.alertmanager_version
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    yamlencode({
      replicaCount = 2
      
      resources = {
        requests = {
          cpu    = "100m"
          memory = "256Mi"
        }
        limits = {
          cpu    = "200m"
          memory = "512Mi"
        }
      }
      
      persistentVolume = {
        size         = "5Gi"
        storageClass = "managed-premium"
      }
      
      podAntiAffinity = {
        preferredDuringSchedulingIgnoredDuringExecution = [{
          weight = 100
          podAffinityTerm = {
            labelSelector = {
              matchExpressions = [{
                key      = "app"
                operator = "In"
                values   = ["alertmanager"]
              }]
            }
            topologyKey = "kubernetes.io/hostname"
          }
        }]
      }
      
      securityContext = {
        runAsNonRoot = true
        runAsUser    = 65534
        fsGroup      = 65534
      }
      
      config = {
        global = {
          resolve_timeout = "5m"
        }
        receivers = concat([{
          name = "default"
        }], values(var.alert_receiver_configs))
        route = {
          group_by = ["alertname", "severity"]
          group_wait = "30s"
          group_interval = "5m"
          repeat_interval = "12h"
          receiver = "default"
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.monitoring, helm_release.prometheus]
}

# Output monitoring endpoints
output "prometheus_endpoint" {
  description = "Internal endpoint for Prometheus service"
  value       = "http://prometheus-server.${var.monitoring_namespace}.svc.cluster.local:9090"
}

output "grafana_endpoint" {
  description = "Internal endpoint for Grafana service"
  value       = "http://grafana.${var.monitoring_namespace}.svc.cluster.local:3000"
}

output "alertmanager_endpoint" {
  description = "Internal endpoint for AlertManager service"
  value       = var.enable_alerting ? "http://alertmanager.${var.monitoring_namespace}.svc.cluster.local:9093" : null
}

output "monitoring_namespace" {
  description = "Namespace where monitoring components are deployed"
  value       = kubernetes_namespace.monitoring.metadata[0].name
}