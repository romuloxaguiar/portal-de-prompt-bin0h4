#!/bin/bash

# Prompts Portal Database Backup Script
# Version: 1.0.0
# Dependencies:
# - azure-cli v2.50+
# - mongodb-database-tools v100.7+

set -euo pipefail

# Global constants
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BACKUP_ROOT="/var/backups/prompts-portal"
readonly LOG_FILE="/var/log/prompts-portal/backup.log"
readonly ENVIRONMENTS=("development" "staging" "production")
declare -A RETENTION_DAYS=(
    ["development"]=7
    ["staging"]=30
    ["production"]=90
)

# Required environment variables check
required_vars=(
    "AZURE_STORAGE_ACCOUNT"
    "AZURE_STORAGE_KEY"
    "BACKUP_ENCRYPTION_KEY"
    "COSMOS_DB_CONNECTION_STRING"
    "ENVIRONMENT"
)

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "${timestamp}|${level}|backup|${message}" | tee -a "$LOG_FILE"
}

# Validate environment and prerequisites
validate_environment() {
    local environment="$1"
    
    # Verify environment is valid
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${environment} " ]]; then
        log "ERROR" "Invalid environment: ${environment}"
        return 1
    }

    # Check required environment variables
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log "ERROR" "Missing required environment variable: ${var}"
            return 1
        fi
    done

    # Verify Azure CLI installation and authentication
    if ! command -v az >/dev/null 2>&1; then
        log "ERROR" "Azure CLI not found"
        return 1
    fi

    # Verify mongodump installation
    if ! command -v mongodump >/dev/null 2>&1; then
        log "ERROR" "mongodump not found"
        return 1
    fi

    # Verify backup directory exists and is writable
    if [[ ! -d "$BACKUP_ROOT" ]]; then
        mkdir -p "$BACKUP_ROOT" || {
            log "ERROR" "Failed to create backup directory: ${BACKUP_ROOT}"
            return 1
        }
    fi

    # Verify encryption key format
    if [[ ! "${BACKUP_ENCRYPTION_KEY}" =~ ^[A-Fa-f0-9]{64}$ ]]; then
        log "ERROR" "Invalid encryption key format"
        return 1
    }

    return 0
}

# Create encrypted backup
create_backup() {
    local environment="$1"
    local backup_path="$2"
    local timestamp=$(date -u +"%Y%m%d_%H%M%S")
    local backup_id="backup_${environment}_${timestamp}"
    local temp_dir="${BACKUP_ROOT}/temp_${backup_id}"
    local metadata_file="${backup_path}/${backup_id}.meta"

    log "INFO" "Starting backup creation: ${backup_id}"

    # Create temporary directory
    mkdir -p "$temp_dir"

    # Execute mongodump with compression
    if ! mongodump \
        --uri="$COSMOS_DB_CONNECTION_STRING" \
        --gzip \
        --archive="${temp_dir}/${backup_id}.archive" \
        --quiet; then
        log "ERROR" "Mongodump failed for ${backup_id}"
        rm -rf "$temp_dir"
        return 1
    fi

    # Generate backup checksum
    local checksum=$(sha256sum "${temp_dir}/${backup_id}.archive" | cut -d' ' -f1)

    # Generate IV for encryption
    local iv=$(openssl rand -hex 16)

    # Encrypt backup
    if ! openssl enc -aes-256-gcm \
        -K "$BACKUP_ENCRYPTION_KEY" \
        -iv "$iv" \
        -in "${temp_dir}/${backup_id}.archive" \
        -out "${backup_path}/${backup_id}.enc"; then
        log "ERROR" "Encryption failed for ${backup_id}"
        rm -rf "$temp_dir"
        return 1
    fi

    # Create metadata file
    cat > "$metadata_file" << EOF
backup_id: ${backup_id}
timestamp: ${timestamp}
environment: ${environment}
checksum: ${checksum}
iv: ${iv}
encryption: aes-256-gcm
EOF

    # Cleanup temporary files
    rm -rf "$temp_dir"

    log "INFO" "Backup created successfully: ${backup_id}"
    echo "${backup_path}/${backup_id}.enc"
    return 0
}

# Upload backup to Azure storage
upload_backup() {
    local backup_file="$1"
    local environment="$2"
    local container_name="backups-${environment}"
    local retry_count=0
    local max_retries=3

    log "INFO" "Starting upload of ${backup_file}"

    # Ensure container exists
    az storage container create \
        --name "$container_name" \
        --account-name "$AZURE_STORAGE_ACCOUNT" \
        --account-key "$AZURE_STORAGE_KEY" \
        --fail-on-exist \
        >/dev/null 2>&1 || true

    # Upload with retry logic
    while [[ $retry_count -lt $max_retries ]]; do
        if az storage blob upload \
            --container-name "$container_name" \
            --file "$backup_file" \
            --name "$(basename "$backup_file")" \
            --account-name "$AZURE_STORAGE_ACCOUNT" \
            --account-key "$AZURE_STORAGE_KEY"; then
            log "INFO" "Upload successful: $(basename "$backup_file")"
            return 0
        fi

        retry_count=$((retry_count + 1))
        if [[ $retry_count -lt $max_retries ]]; then
            sleep $((2 ** retry_count))
        fi
    done

    log "ERROR" "Upload failed after ${max_retries} attempts: ${backup_file}"
    return 1
}

# Cleanup old backups
cleanup_old_backups() {
    local environment="$1"
    local retention_days="${RETENTION_DAYS[$environment]}"
    local cutoff_date=$(date -d "${retention_days} days ago" +%Y%m%d)

    log "INFO" "Starting cleanup for ${environment} backups older than ${retention_days} days"

    # Cleanup local backups
    find "${BACKUP_ROOT}/${environment}" -type f \
        -name "backup_${environment}_*.enc" \
        -o -name "backup_${environment}_*.meta" \
        | while read -r file; do
        backup_date=$(echo "$file" | grep -oP "\\d{8}")
        if [[ "$backup_date" < "$cutoff_date" ]]; then
            rm -f "$file"
            log "INFO" "Removed local backup: $(basename "$file")"
        fi
    done

    # Cleanup cloud backups
    az storage blob list \
        --container-name "backups-${environment}" \
        --account-name "$AZURE_STORAGE_ACCOUNT" \
        --account-key "$AZURE_STORAGE_KEY" \
        --query "[?contains(name, 'backup_${environment}_')]" \
        | while read -r blob; do
        blob_date=$(echo "$blob" | grep -oP "\\d{8}")
        if [[ "$blob_date" < "$cutoff_date" ]]; then
            az storage blob delete \
                --container-name "backups-${environment}" \
                --name "$blob" \
                --account-name "$AZURE_STORAGE_ACCOUNT" \
                --account-key "$AZURE_STORAGE_KEY"
            log "INFO" "Removed cloud backup: ${blob}"
        fi
    done

    return 0
}

main() {
    local environment="${ENVIRONMENT,,}"
    local backup_dir="${BACKUP_ROOT}/${environment}"

    # Validate environment
    if ! validate_environment "$environment"; then
        log "ERROR" "Environment validation failed"
        exit 1
    }

    # Create backup directory if it doesn't exist
    mkdir -p "$backup_dir"

    # Create backup
    local backup_file
    if ! backup_file=$(create_backup "$environment" "$backup_dir"); then
        log "ERROR" "Backup creation failed"
        exit 1
    fi

    # Upload backup
    if ! upload_backup "$backup_file" "$environment"; then
        log "ERROR" "Backup upload failed"
        exit 1
    fi

    # Cleanup old backups
    if ! cleanup_old_backups "$environment"; then
        log "WARN" "Backup cleanup failed"
    fi

    log "INFO" "Backup process completed successfully"
    exit 0
}

# Execute main function
main