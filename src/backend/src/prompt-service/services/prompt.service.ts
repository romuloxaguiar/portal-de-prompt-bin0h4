import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CircuitBreaker } from '@nestjs/circuit-breaker';
import { CacheService } from '@nestjs/cache-manager';
import { AnalyticsService } from '@nestjs/analytics';
import { IPrompt, PromptStatus, IPromptVariable, IPromptMetadata } from '../interfaces/prompt.interface';
import { IVersion, IVersionChanges } from '../interfaces/version.interface';
import { ITemplate, ITemplateVariable } from '../interfaces/template.interface';

/**
 * Enhanced service for managing prompts with comprehensive security, performance,
 * and monitoring capabilities in the Prompts Portal system.
 * @version 1.0.0
 */
@Injectable()
export class PromptService {
    private readonly logger = new Logger(PromptService.name);
    private readonly circuitBreaker: CircuitBreaker;

    constructor(
        @InjectModel('Prompt') private readonly promptModel: Model<IPrompt>,
        @InjectModel('Template') private readonly templateModel: Model<ITemplate>,
        private readonly aiService: AIIntegrationService,
        private readonly cacheService: CacheService,
        private readonly analyticsService: AnalyticsService
    ) {
        this.circuitBreaker = new CircuitBreaker({
            timeout: 5000,
            errorThreshold: 50,
            resetTimeout: 30000
        });
    }

    /**
     * Creates a new prompt with comprehensive validation and security checks
     */
    async createPrompt(
        promptData: CreatePromptDto,
        teamId: string
    ): Promise<IPrompt> {
        try {
            // Validate template compatibility
            const template = await this.templateModel.findById(promptData.templateId);
            if (!template) {
                throw new NotFoundException('Template not found');
            }

            // Validate and sanitize variables
            this.validatePromptVariables(promptData.variables, template.variables);

            // Create initial version
            const initialVersion: IVersion = {
                id: undefined, // Will be set by MongoDB
                promptId: undefined, // Will be set after prompt creation
                content: promptData.content,
                versionNumber: 1,
                changes: {
                    addedContent: [promptData.content],
                    removedContent: [],
                    modifiedVariables: [],
                    description: 'Initial version',
                    timestamp: new Date()
                },
                createdBy: promptData.creatorId,
                createdAt: new Date()
            };

            // Create prompt metadata
            const metadata: IPromptMetadata = {
                usageCount: 0,
                successRate: 0,
                lastUsed: null,
                aiModel: promptData.aiModel,
                averageResponseTime: 0
            };

            // Create and save prompt
            const prompt = new this.promptModel({
                ...promptData,
                teamId,
                status: PromptStatus.ACTIVE,
                currentVersion: initialVersion,
                metadata,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const savedPrompt = await prompt.save();

            // Cache the prompt
            await this.cacheService.set(
                `prompt:${savedPrompt.id}`,
                savedPrompt,
                { ttl: 3600 }
            );

            // Track creation metrics
            await this.analyticsService.trackEvent('prompt_created', {
                promptId: savedPrompt.id,
                teamId,
                templateId: promptData.templateId
            });

            return savedPrompt;
        } catch (error) {
            this.logger.error(`Error creating prompt: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Executes a prompt with enhanced error handling and monitoring
     */
    async executePrompt(
        promptId: string,
        options: ExecutePromptDto,
        teamId: string
    ): Promise<AIResponse> {
        const cacheKey = `execution:${promptId}:${JSON.stringify(options)}`;

        try {
            // Check cache
            const cachedResponse = await this.cacheService.get(cacheKey);
            if (cachedResponse) {
                return cachedResponse;
            }

            // Get and validate prompt
            const prompt = await this.getPromptWithValidation(promptId, teamId);

            // Process variables
            const processedContent = await this.processPromptVariables(
                prompt.content,
                options.variables
            );

            // Execute via circuit breaker
            const startTime = Date.now();
            const response = await this.circuitBreaker.fire(
                () => this.aiService.executePrompt(processedContent, options)
            );
            const executionTime = Date.now() - startTime;

            // Update metrics
            await this.updateExecutionMetrics(prompt, response, executionTime);

            // Cache successful response
            await this.cacheService.set(cacheKey, response, { ttl: 1800 });

            return response;
        } catch (error) {
            this.logger.error(`Error executing prompt: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Updates a prompt with version control and validation
     */
    async updatePrompt(
        promptId: string,
        updateData: UpdatePromptDto,
        teamId: string
    ): Promise<IPrompt> {
        try {
            const prompt = await this.getPromptWithValidation(promptId, teamId);

            // Create new version
            const newVersion: IVersion = {
                id: undefined,
                promptId: promptId,
                content: updateData.content,
                versionNumber: prompt.currentVersion.versionNumber + 1,
                changes: this.generateVersionChanges(prompt.content, updateData),
                createdBy: updateData.userId,
                createdAt: new Date()
            };

            // Update prompt
            const updatedPrompt = await this.promptModel.findByIdAndUpdate(
                promptId,
                {
                    ...updateData,
                    currentVersion: newVersion,
                    updatedAt: new Date()
                },
                { new: true }
            );

            // Invalidate cache
            await this.cacheService.del(`prompt:${promptId}`);

            // Track update metrics
            await this.analyticsService.trackEvent('prompt_updated', {
                promptId,
                teamId,
                versionNumber: newVersion.versionNumber
            });

            return updatedPrompt;
        } catch (error) {
            this.logger.error(`Error updating prompt: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Validates prompt variables against template requirements
     */
    private validatePromptVariables(
        promptVariables: IPromptVariable[],
        templateVariables: ITemplateVariable[]
    ): void {
        for (const templateVar of templateVariables) {
            const promptVar = promptVariables.find(v => v.name === templateVar.name);
            
            if (templateVar.required && !promptVar) {
                throw new BadRequestException(
                    `Required variable ${templateVar.name} is missing`
                );
            }

            if (promptVar) {
                this.validateVariableValue(promptVar, templateVar);
            }
        }
    }

    /**
     * Generates version changes for update tracking
     */
    private generateVersionChanges(
        oldContent: string,
        updateData: UpdatePromptDto
    ): IVersionChanges {
        return {
            addedContent: this.diffContent(oldContent, updateData.content).added,
            removedContent: this.diffContent(oldContent, updateData.content).removed,
            modifiedVariables: this.diffVariables(
                updateData.oldVariables,
                updateData.variables
            ),
            description: updateData.changeDescription || 'Content updated',
            timestamp: new Date()
        };
    }

    /**
     * Updates execution metrics after prompt execution
     */
    private async updateExecutionMetrics(
        prompt: IPrompt,
        response: AIResponse,
        executionTime: number
    ): Promise<void> {
        const newMetadata: IPromptMetadata = {
            ...prompt.metadata,
            usageCount: prompt.metadata.usageCount + 1,
            lastUsed: new Date(),
            averageResponseTime: this.calculateNewAverage(
                prompt.metadata.averageResponseTime,
                executionTime,
                prompt.metadata.usageCount
            ),
            successRate: this.calculateNewSuccessRate(
                prompt.metadata.successRate,
                response.success,
                prompt.metadata.usageCount
            )
        };

        await this.promptModel.findByIdAndUpdate(
            prompt.id,
            { metadata: newMetadata },
            { new: true }
        );

        await this.analyticsService.trackMetrics('prompt_execution', {
            promptId: prompt.id,
            executionTime,
            success: response.success,
            modelUsed: prompt.metadata.aiModel
        });
    }
}