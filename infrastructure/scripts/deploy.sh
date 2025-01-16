#!/usr/bin/env bash

# Prompts Portal Deployment Script
# Version: 1.0.0
# This script handles deployment automation for the Prompts Portal platform
# with environment-specific strategies and comprehensive error handling

set -euo pipefail
IFS=$'\n\t'

# Global Constants
readonly ENVIRONMENTS=("dev" "staging" "prod")
readonly NAMESPACES=("default" "monitoring" "ingress")
readonly DEPLOYMENT_TIMEOUT="300s"
readonly ROLLBACK_TIMEOUT="180s"
declare -A VALIDATION_INTERVALS=(
    ["dev"]="30s"
    ["staging"]="60s"
    ["prod"]="120s"
)

# Logging Configuration
setup_logging() {
    local log_file="/var/log/prompts-portal/deploy-$(date +%Y%m%d-%H%M%S).log"
    mkdir -p "$(dirname "$log_file")"
    exec 1> >(tee -a "$log_file")
    exec 2> >(tee -a "$log_file" >&2)
}

# Log message with timestamp and level
log() {
    local level=$1
    shift
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $*"
}

# Prerequisite Checks
check_prerequisites() {
    log "INFO" "Checking deployment prerequisites..."
    
    # Check kubectl version and connectivity
    if ! kubectl version --client &>/dev/null; then
        log "ERROR" "kubectl not found or not properly configured"
        return 1
    fi

    # Check helm version and repositories
    if ! helm version &>/dev/null; then
        log "ERROR" "helm not found or not properly configured"
        return 1
    }

    # Verify cluster access
    if ! kubectl cluster-info &>/dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        return 1
    }

    # Check required namespaces
    for ns in "${NAMESPACES[@]}"; do
        if ! kubectl get namespace "$ns" &>/dev/null; then
            log "INFO" "Creating namespace: $ns"
            kubectl create namespace "$ns"
        fi
    done

    return 0
}

# Deploy Monitoring Infrastructure
deploy_monitoring() {
    local environment=$1
    log "INFO" "Deploying monitoring infrastructure for $environment environment"

    # Apply Prometheus configuration
    kubectl apply -f ../kubernetes/monitoring/prometheus.yaml -n monitoring

    # Wait for Prometheus deployment
    if ! kubectl rollout status statefulset/prometheus -n monitoring --timeout="${DEPLOYMENT_TIMEOUT}"; then
        log "ERROR" "Prometheus deployment failed"
        return 1
    }

    # Configure environment-specific alert rules
    local alert_rules="../kubernetes/monitoring/rules-${environment}.yaml"
    if [[ -f "$alert_rules" ]]; then
        kubectl apply -f "$alert_rules" -n monitoring
    fi

    return 0
}

# Deploy Backend Services
deploy_backend() {
    local environment=$1
    log "INFO" "Deploying backend services for $environment environment"

    # Apply ConfigMaps and Secrets first
    kubectl apply -f ../kubernetes/backend/configmap.yaml

    # Deploy backend services based on environment strategy
    case $environment in
        "prod")
            deploy_canary_backend
            ;;
        "staging")
            deploy_blue_green_backend
            ;;
        "dev")
            deploy_direct_backend
            ;;
    esac
}

# Production Canary Deployment
deploy_canary_backend() {
    log "INFO" "Executing canary deployment for production"

    # Deploy canary version (10% traffic)
    sed 's/replicas: 3/replicas: 1/' ../kubernetes/backend/deployment.yaml | kubectl apply -f -
    
    # Validate canary deployment
    if ! validate_deployment "backend" "prod" "canary"; then
        log "ERROR" "Canary validation failed, initiating rollback"
        rollback_deployment "backend" "prod"
        return 1
    fi

    # Gradually increase traffic
    for percentage in 25 50 75 100; do
        log "INFO" "Scaling canary to ${percentage}% traffic"
        kubectl scale deployment/prompts-portal-backend --replicas=$((percentage * 3 / 100))
        sleep "${VALIDATION_INTERVALS[prod]}"
        
        if ! validate_deployment "backend" "prod" "canary"; then
            log "ERROR" "Canary validation failed at ${percentage}%, initiating rollback"
            rollback_deployment "backend" "prod"
            return 1
        fi
    done
}

# Staging Blue/Green Deployment
deploy_blue_green_backend() {
    log "INFO" "Executing blue/green deployment for staging"

    # Deploy green version
    kubectl apply -f ../kubernetes/backend/deployment.yaml --namespace=staging-green

    # Validate green deployment
    if ! validate_deployment "backend" "staging" "green"; then
        log "ERROR" "Green deployment validation failed"
        return 1
    fi

    # Switch traffic to green
    kubectl patch service prompts-portal-backend -p '{"spec":{"selector":{"environment":"green"}}}'
    
    # Verify traffic switch
    sleep "${VALIDATION_INTERVALS[staging]}"
    if ! validate_deployment "backend" "staging" "green"; then
        log "ERROR" "Traffic switch validation failed, rolling back"
        kubectl patch service prompts-portal-backend -p '{"spec":{"selector":{"environment":"blue"}}}'
        return 1
    fi

    # Remove blue deployment
    kubectl delete deployment prompts-portal-backend-blue --namespace=staging
}

# Development Direct Deployment
deploy_direct_backend() {
    log "INFO" "Executing direct deployment for development"
    
    kubectl apply -f ../kubernetes/backend/deployment.yaml
    
    if ! kubectl rollout status deployment/prompts-portal-backend --timeout="${DEPLOYMENT_TIMEOUT}"; then
        log "ERROR" "Development deployment failed"
        return 1
    fi
}

# Deployment Validation
validate_deployment() {
    local component=$1
    local environment=$2
    local deployment_type=$3
    
    log "INFO" "Validating $component deployment in $environment ($deployment_type)"

    # Check pod health
    if ! kubectl get pods -l app=prompts-portal,component="$component" \
        -o jsonpath='{.items[*].status.containerStatuses[*].ready}' | grep -q "true"; then
        log "ERROR" "Pod health check failed"
        return 1
    fi

    # Verify resource metrics
    if ! check_resource_metrics "$component" "$environment"; then
        log "ERROR" "Resource metrics validation failed"
        return 1
    }

    # Validate endpoints
    if ! check_endpoints "$component" "$environment"; then
        log "ERROR" "Endpoint validation failed"
        return 1
    }

    return 0
}

# Resource Metrics Validation
check_resource_metrics() {
    local component=$1
    local environment=$2
    
    # Check CPU and Memory usage
    local cpu_usage
    cpu_usage=$(kubectl top pod -l app=prompts-portal,component="$component" --no-headers | awk '{print $2}' | sed 's/m//')
    
    if [[ $cpu_usage -gt 800 ]]; then
        log "WARNING" "High CPU usage detected: ${cpu_usage}m"
        return 1
    fi
    
    return 0
}

# Endpoint Health Validation
check_endpoints() {
    local component=$1
    local environment=$2
    
    # Get service endpoint
    local endpoint
    endpoint=$(kubectl get service prompts-portal-"$component" -o jsonpath='{.spec.clusterIP}')
    
    # Check health endpoint
    if ! curl -sf "http://${endpoint}:3000/health" &>/dev/null; then
        log "ERROR" "Health endpoint check failed"
        return 1
    }
    
    return 0
}

# Deployment Rollback
rollback_deployment() {
    local component=$1
    local environment=$2
    
    log "WARNING" "Initiating rollback for $component in $environment"
    
    kubectl rollout undo deployment/prompts-portal-"$component"
    
    if ! kubectl rollout status deployment/prompts-portal-"$component" --timeout="${ROLLBACK_TIMEOUT}"; then
        log "ERROR" "Rollback failed"
        return 1
    }
    
    log "INFO" "Rollback completed successfully"
    return 0
}

# Main Deployment Function
main() {
    local environment=$1
    
    if [[ ! " ${ENVIRONMENTS[*]} " =~ ${environment} ]]; then
        log "ERROR" "Invalid environment: $environment"
        exit 1
    }
    
    setup_logging
    
    log "INFO" "Starting deployment for $environment environment"
    
    if ! check_prerequisites; then
        log "ERROR" "Prerequisites check failed"
        exit 1
    }
    
    if ! deploy_monitoring "$environment"; then
        log "ERROR" "Monitoring deployment failed"
        exit 1
    }
    
    if ! deploy_backend "$environment"; then
        log "ERROR" "Backend deployment failed"
        exit 1
    }
    
    log "INFO" "Deployment completed successfully for $environment environment"
}

# Script Entry Point
if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <environment>"
    echo "Available environments: ${ENVIRONMENTS[*]}"
    exit 1
fi

main "$1"