import { 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete, 
    Body, 
    Param, 
    Query, 
    UseGuards, 
    UseInterceptors,
    Logger,
    BadRequestException,
    NotFoundException
} from '@nestjs/common'; // ^10.0.0
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger'; // ^7.0.0
import { RateLimit } from '@nestjs/throttler'; // ^5.0.0
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager'; // ^5.0.0

import { PromptService } from '../services/prompt.service';
import { IPrompt, PromptStatus } from '../interfaces/prompt.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { 
    CreatePromptDto, 
    UpdatePromptDto, 
    ExecutePromptDto, 
    OptimizePromptDto 
} from '../dto/prompt.dto';
import { SuccessResponse } from '../../common/interfaces/response.interface';

/**
 * Controller handling HTTP requests for prompt management with comprehensive
 * security, caching, and monitoring capabilities.
 * @version 1.0.0
 */
@Controller('prompts')
@ApiTags('prompts')
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
export class PromptController {
    private readonly logger = new Logger(PromptController.name);

    constructor(private readonly promptService: PromptService) {}

    /**
     * Creates a new prompt with enhanced validation and security
     */
    @Post()
    @ApiOperation({ summary: 'Create new prompt' })
    @ApiResponse({ status: 201, description: 'Prompt created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid prompt data' })
    @ApiSecurity('jwt')
    @RateLimit({ points: 10, duration: 60 })
    async createPrompt(
        @Body() promptData: CreatePromptDto
    ): Promise<SuccessResponse<IPrompt>> {
        try {
            const prompt = await this.promptService.createPrompt(
                promptData,
                promptData.teamId
            );
            
            return {
                success: true,
                data: prompt,
                message: 'Prompt created successfully'
            };
        } catch (error) {
            this.logger.error(`Error creating prompt: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Retrieves prompts for a team with caching
     */
    @Get('team/:teamId')
    @ApiOperation({ summary: 'Get team prompts' })
    @ApiResponse({ status: 200, description: 'Prompts retrieved successfully' })
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(300)
    async getPromptsByTeam(
        @Param('teamId') teamId: string,
        @Query('status') status?: PromptStatus,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20
    ): Promise<SuccessResponse<IPrompt[]>> {
        try {
            const prompts = await this.promptService.getPromptsByTeam(
                teamId,
                status,
                { page, limit }
            );
            
            return {
                success: true,
                data: prompts,
                message: 'Prompts retrieved successfully'
            };
        } catch (error) {
            this.logger.error(`Error retrieving prompts: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Updates an existing prompt with version control
     */
    @Put(':id')
    @ApiOperation({ summary: 'Update prompt' })
    @ApiResponse({ status: 200, description: 'Prompt updated successfully' })
    @ApiSecurity('jwt')
    @RateLimit({ points: 20, duration: 60 })
    async updatePrompt(
        @Param('id') id: string,
        @Body() updateData: UpdatePromptDto
    ): Promise<SuccessResponse<IPrompt>> {
        try {
            const prompt = await this.promptService.updatePrompt(
                id,
                updateData,
                updateData.teamId
            );
            
            return {
                success: true,
                data: prompt,
                message: 'Prompt updated successfully'
            };
        } catch (error) {
            this.logger.error(`Error updating prompt: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Executes a prompt with AI integration
     */
    @Post(':id/execute')
    @ApiOperation({ summary: 'Execute prompt' })
    @ApiResponse({ status: 200, description: 'Prompt executed successfully' })
    @ApiSecurity('jwt')
    @RateLimit({ points: 100, duration: 60 })
    async executePrompt(
        @Param('id') id: string,
        @Body() executeData: ExecutePromptDto
    ): Promise<SuccessResponse<any>> {
        try {
            const result = await this.promptService.executePrompt(
                id,
                executeData,
                executeData.teamId
            );
            
            return {
                success: true,
                data: result,
                message: 'Prompt executed successfully'
            };
        } catch (error) {
            this.logger.error(`Error executing prompt: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Optimizes a prompt using AI-powered suggestions
     */
    @Post(':id/optimize')
    @ApiOperation({ summary: 'Optimize prompt' })
    @ApiResponse({ status: 200, description: 'Prompt optimization suggestions generated' })
    @ApiSecurity('jwt')
    @RateLimit({ points: 50, duration: 60 })
    async optimizePrompt(
        @Param('id') id: string,
        @Body() optimizeData: OptimizePromptDto
    ): Promise<SuccessResponse<any>> {
        try {
            const suggestions = await this.promptService.optimizePrompt(
                id,
                optimizeData,
                optimizeData.teamId
            );
            
            return {
                success: true,
                data: suggestions,
                message: 'Optimization suggestions generated successfully'
            };
        } catch (error) {
            this.logger.error(`Error optimizing prompt: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Archives a prompt
     */
    @Delete(':id')
    @ApiOperation({ summary: 'Archive prompt' })
    @ApiResponse({ status: 200, description: 'Prompt archived successfully' })
    @ApiSecurity('jwt')
    async archivePrompt(
        @Param('id') id: string,
        @Body('teamId') teamId: string
    ): Promise<SuccessResponse<void>> {
        try {
            await this.promptService.updatePromptStatus(
                id,
                PromptStatus.ARCHIVED,
                teamId
            );
            
            return {
                success: true,
                message: 'Prompt archived successfully'
            };
        } catch (error) {
            this.logger.error(`Error archiving prompt: ${error.message}`, error.stack);
            throw error;
        }
    }
}