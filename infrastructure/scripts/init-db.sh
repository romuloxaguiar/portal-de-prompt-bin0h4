#!/bin/bash

# Database Initialization Script for Prompts Portal
# Version: 1.0.0
# Initializes and configures Cosmos DB and Cloud Firestore for the Prompts Portal
# with comprehensive error handling, validation, and monitoring capabilities

set -euo pipefail

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Global Variables
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME=$(basename "$0")
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly LOG_DIR="./logs/database"
readonly LOG_FILE="${LOG_DIR}/init-db-${TIMESTAMP}.log"

# Environment-specific settings
ENVIRONMENT=${ENVIRONMENT:-"development"}
RESOURCE_GROUP=${RESOURCE_GROUP:-"prompts-portal-${ENVIRONMENT}"}
LOG_LEVEL=${LOG_LEVEL:-"INFO"}
BACKUP_RETENTION_DAYS=30
MONITORING_ENABLED=true

# Create log directory if it doesn't exist
mkdir -p "${LOG_DIR}"

# Logging function
log() {
    local level=$1
    shift
    local message=$*
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

# Validation function
validate_prerequisites() {
    log "INFO" "Validating prerequisites..."
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        log "ERROR" "Azure CLI is not installed"
        exit 1
    fi
    
    # Check Google Cloud SDK
    if ! command -v gcloud &> /dev/null; then
        log "ERROR" "Google Cloud SDK is not installed"
        exit 1
    }
    
    # Validate Azure login
    if ! az account show &> /dev/null; then
        log "ERROR" "Not logged into Azure. Please run 'az login'"
        exit 1
    }
    
    # Validate Google Cloud login
    if ! gcloud auth list --filter=status:ACTIVE --format="none" &> /dev/null; then
        log "ERROR" "Not logged into Google Cloud. Please run 'gcloud auth login'"
        exit 1
    }
}

# Initialize Cosmos DB
init_cosmos_db() {
    local resource_group=$1
    local db_name=$2
    local location=$3
    local environment=$4
    
    log "INFO" "Initializing Cosmos DB for ${environment} environment..."
    
    # Create resource group if it doesn't exist
    az group create --name "${resource_group}" --location "${location}" --tags \
        Environment="${environment}" \
        Application="PromptsPortal" \
        CreatedBy="${SCRIPT_NAME}" \
        CreatedOn="$(date +%Y-%m-%d)"
    
    # Create Cosmos DB account with environment-specific settings
    local consistency_level="Session"
    local backup_type="Periodic"
    local backup_interval=24
    
    if [ "${environment}" = "production" ]; then
        consistency_level="Strong"
        backup_type="Continuous"
        backup_interval=12
    fi
    
    az cosmosdb create \
        --name "${db_name}" \
        --resource-group "${resource_group}" \
        --locations regionName="${location}" failoverPriority=0 \
        --default-consistency-level "${consistency_level}" \
        --enable-automatic-failover true \
        --backup-policy-type "${backup_type}" \
        --backup-interval "${backup_interval}" \
        --backup-retention "${BACKUP_RETENTION_DAYS}" \
        --enable-analytical-storage true
    
    # Create database
    az cosmosdb database create \
        --name "${db_name}" \
        --resource-group "${resource_group}" \
        --db-name "prompts-portal"
    
    # Create containers with optimized indexes
    local containers=("prompts" "workspaces" "users" "templates")
    for container in "${containers[@]}"; do
        az cosmosdb collection create \
            --resource-group "${resource_group}" \
            --collection-name "${container}" \
            --database-name "prompts-portal" \
            --name "${db_name}" \
            --partition-key-path "/id" \
            --throughput 400
    done
    
    # Configure monitoring
    if [ "${MONITORING_ENABLED}" = true ]; then
        az monitor diagnostic-settings create \
            --name "${db_name}-diagnostics" \
            --resource "${db_name}" \
            --resource-group "${resource_group}" \
            --resource-type "Microsoft.DocumentDB/databaseAccounts" \
            --logs '[{"category": "DataPlaneRequests","enabled": true},{"category": "QueryRuntimeStatistics","enabled": true}]' \
            --metrics '[{"category": "Requests","enabled": true},{"category": "Latency","enabled": true}]'
    fi
    
    log "INFO" "Cosmos DB initialization completed successfully"
    return 0
}

# Initialize Cloud Firestore
init_firestore() {
    local project_id=$1
    local location=$2
    local environment=$3
    
    log "INFO" "Initializing Cloud Firestore for ${environment} environment..."
    
    # Set the project
    gcloud config set project "${project_id}"
    
    # Create Firestore database
    gcloud firestore databases create \
        --location="${location}" \
        --type=firestore-native
    
    # Configure security rules
    cat > firestore.rules << EOF
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
EOF
    
    # Deploy security rules
    gcloud firestore security-rules deploy firestore.rules
    
    # Create composite indexes for analytics queries
    gcloud firestore indexes composite create \
        --collection-group="analytics_metrics" \
        --field-config="field_path=timestamp,order=DESCENDING" \
        --field-config="field_path=metric_type,order=ASCENDING"
    
    # Configure backup schedule for production
    if [ "${environment}" = "production" ]; then
        gcloud firestore export \
            gs://"${project_id}-firestore-backups" \
            --collection-ids="analytics_metrics,analytics_reports"
    fi
    
    log "INFO" "Cloud Firestore initialization completed successfully"
    return 0
}

# Setup database migrations
setup_migrations() {
    local db_type=$1
    local environment=$2
    
    log "INFO" "Setting up database migrations for ${db_type}..."
    
    # Create migrations directory structure
    local migrations_dir="./migrations/${db_type}/${environment}"
    mkdir -p "${migrations_dir}"/{up,down,state}
    
    # Create migration tracking table
    if [ "${db_type}" = "cosmos" ]; then
        az cosmosdb collection create \
            --resource-group "${RESOURCE_GROUP}" \
            --collection-name "migrations" \
            --database-name "prompts-portal" \
            --name "${db_type}" \
            --partition-key-path "/id"
    fi
    
    # Initialize migration state file
    cat > "${migrations_dir}/state/current.json" << EOF
{
    "current_version": "0",
    "last_migration": null,
    "environment": "${environment}",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    
    log "INFO" "Migration setup completed for ${db_type}"
    return 0
}

# Main execution function
main() {
    log "INFO" "Starting database initialization script v${SCRIPT_VERSION}"
    
    # Validate prerequisites
    validate_prerequisites
    
    # Initialize Cosmos DB
    init_cosmos_db \
        "${RESOURCE_GROUP}" \
        "prompts-portal-${ENVIRONMENT}" \
        "${AZURE_REGION:-eastus}" \
        "${ENVIRONMENT}" || exit 1
    
    # Initialize Cloud Firestore
    init_firestore \
        "${GOOGLE_CLOUD_PROJECT}" \
        "${GOOGLE_CLOUD_REGION:-us-east1}" \
        "${ENVIRONMENT}" || exit 1
    
    # Setup migrations for both databases
    setup_migrations "cosmos" "${ENVIRONMENT}" || exit 1
    setup_migrations "firestore" "${ENVIRONMENT}" || exit 1
    
    log "INFO" "Database initialization completed successfully"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi