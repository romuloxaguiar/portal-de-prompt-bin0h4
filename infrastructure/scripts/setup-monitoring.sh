#!/bin/bash

# Setup Monitoring Infrastructure Script
# Version: 1.0.0
# Description: Automates the setup of a production-ready monitoring stack with HA and DR capabilities
# Dependencies:
# - kubectl (latest)
# - yq (latest)

set -euo pipefail

# Global variables
readonly MONITORING_NAMESPACE="monitoring"
readonly PROMETHEUS_VERSION="v2.45.0"
readonly GRAFANA_VERSION="9.5.3"
readonly ALERTMANAGER_VERSION="v0.25.0"
readonly BACKUP_RETENTION_DAYS="30"
readonly HA_REPLICA_COUNT="3"
readonly RESOURCE_QUOTA_CPU="8"
readonly RESOURCE_QUOTA_MEMORY="16Gi"
readonly STORAGE_CLASS="premium-rwo"

# Logging functions
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_warning() {
    echo "[WARNING] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Error handling function
handle_error() {
    local exit_code=$?
    log_error "An error occurred on line $1"
    exit $exit_code
}

trap 'handle_error $LINENO' ERR

# Validate prerequisites
validate_prerequisites() {
    log_info "Validating prerequisites..."
    
    # Check kubectl installation
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        return 1
    fi

    # Check yq installation
    if ! command -v yq &> /dev/null; then
        log_error "yq is not installed"
        return 1
    }

    # Verify cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Unable to access Kubernetes cluster"
        return 1
    }

    # Check RBAC permissions
    if ! kubectl auth can-i create namespace &> /dev/null; then
        log_error "Insufficient permissions to create namespace"
        return 1
    }

    # Verify storage class existence
    if ! kubectl get storageclass "${STORAGE_CLASS}" &> /dev/null; then
        log_error "Storage class ${STORAGE_CLASS} not found"
        return 1
    }

    log_info "Prerequisites validation completed successfully"
    return 0
}

# Create and configure monitoring namespace
create_namespace() {
    log_info "Creating monitoring namespace..."

    # Create namespace if it doesn't exist
    if ! kubectl get namespace "${MONITORING_NAMESPACE}" &> /dev/null; then
        kubectl create namespace "${MONITORING_NAMESPACE}"
    fi

    # Apply resource quota
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: monitoring-quota
  namespace: ${MONITORING_NAMESPACE}
spec:
  hard:
    cpu: "${RESOURCE_QUOTA_CPU}"
    memory: "${RESOURCE_QUOTA_MEMORY}"
EOF

    # Apply network policy
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-network-policy
  namespace: ${MONITORING_NAMESPACE}
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: default
  egress:
  - to:
    - namespaceSelector: {}
EOF

    log_info "Namespace configuration completed"
}

# Setup Prometheus
setup_prometheus() {
    log_info "Setting up Prometheus..."

    # Apply Prometheus manifests
    kubectl apply -f ../kubernetes/monitoring/prometheus.yaml

    # Wait for Prometheus pods to be ready
    kubectl wait --for=condition=ready pod -l app=prometheus -n "${MONITORING_NAMESPACE}" --timeout=300s

    # Verify Prometheus deployment
    if ! kubectl get statefulset prometheus -n "${MONITORING_NAMESPACE}" &> /dev/null; then
        log_error "Prometheus deployment failed"
        return 1
    }

    log_info "Prometheus setup completed"
}

# Setup Grafana
setup_grafana() {
    log_info "Setting up Grafana..."

    # Generate secure admin password if not provided
    local grafana_password
    grafana_password=$(openssl rand -base64 32)

    # Update Grafana admin password in manifest
    sed "s/\${ADMIN_PASSWORD}/$(echo -n "${grafana_password}" | base64)/" ../kubernetes/monitoring/grafana.yaml | kubectl apply -f -

    # Wait for Grafana deployment
    kubectl wait --for=condition=ready pod -l app=grafana -n "${MONITORING_NAMESPACE}" --timeout=300s

    # Store Grafana credentials securely
    log_info "Grafana admin password: ${grafana_password}"
    
    log_info "Grafana setup completed"
}

# Setup AlertManager
setup_alertmanager() {
    log_info "Setting up AlertManager..."

    # Apply AlertManager manifests
    kubectl apply -f ../kubernetes/monitoring/alertmanager.yaml

    # Wait for AlertManager pods to be ready
    kubectl wait --for=condition=ready pod -l app=alertmanager -n "${MONITORING_NAMESPACE}" --timeout=300s

    log_info "AlertManager setup completed"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying monitoring stack deployment..."

    local failed=0

    # Check all components
    for component in prometheus grafana alertmanager; do
        if ! kubectl get pods -l app="${component}" -n "${MONITORING_NAMESPACE}" | grep -q Running; then
            log_error "${component} pods are not running"
            failed=1
        fi
    done

    # Verify service endpoints
    for service in prometheus grafana alertmanager; do
        if ! kubectl get service "${service}" -n "${MONITORING_NAMESPACE}" &> /dev/null; then
            log_error "${service} service not found"
            failed=1
        fi
    done

    # Check persistent volumes
    if ! kubectl get pvc -n "${MONITORING_NAMESPACE}" | grep -q Bound; then
        log_warning "Some persistent volume claims are not bound"
        failed=1
    fi

    if [ $failed -eq 1 ]; then
        log_error "Deployment verification failed"
        return 1
    fi

    log_info "Deployment verification completed successfully"
    return 0
}

# Main execution
main() {
    log_info "Starting monitoring stack setup..."

    # Run setup steps
    validate_prerequisites || exit 1
    create_namespace || exit 1
    setup_prometheus || exit 1
    setup_grafana || exit 1
    setup_alertmanager || exit 1
    verify_deployment || exit 1

    log_info "Monitoring stack setup completed successfully"
}

# Execute main function
main "$@"