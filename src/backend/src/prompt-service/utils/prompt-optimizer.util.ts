import { IPrompt } from '../interfaces/prompt.interface';
import { AIIntegrationService } from '../services/ai-integration.service';
import { parseTemplate } from './template-parser.util';
import { get } from 'lodash'; // v4.17.21
import { Cache } from 'cache-manager'; // v5.0.0

/**
 * Constants for optimization configuration
 */
const OPTIMIZATION_RULES = {
  MAX_LENGTH: 4000,
  MIN_LENGTH: 10,
  MAX_VARIABLES: 10,
  REQUIRED_SECTIONS: ['context', 'instruction', 'output_format'],
  SECURITY_CHECKS: ['xss', 'injection', 'sensitive_data'],
  PERFORMANCE_THRESHOLDS: {
    response_time: 2000,
    token_count: 500,
    success_rate: 0.8
  }
};

const OPTIMIZATION_WEIGHTS = {
  clarity: 0.25,
  specificity: 0.25,
  context: 0.2,
  format: 0.15,
  security: 0.15
};

const CACHE_CONFIG = {
  ttl: 3600,
  max: 1000,
  checkPeriod: 600
};

/**
 * Interface for optimization analysis results
 */
export interface IOptimizationResult {
  optimizedContent: string;
  score: number;
  suggestions: string[];
  metrics: Record<string, number>;
  performance: PerformanceMetrics;
  modelTests: ModelTestResults[];
}

/**
 * Interface for optimization configuration
 */
export interface IOptimizationOptions {
  autoApply: boolean;
  focusAreas: string[];
  weights: Record<string, number>;
  enableCache: boolean;
  securityChecks: string[];
  testModels: string[];
  performanceThresholds: PerformanceConfig;
}

interface PerformanceMetrics {
  responseTime: number;
  tokenCount: number;
  successRate: number;
  costEstimate: number;
}

interface PerformanceConfig {
  maxResponseTime: number;
  maxTokenCount: number;
  minSuccessRate: number;
}

interface ModelTestResults {
  model: string;
  success: boolean;
  responseTime: number;
  suggestions: string[];
}

/**
 * Optimizes prompt content using AI-driven analysis and multi-model testing
 */
export async function optimizePrompt(
  prompt: IPrompt,
  options: IOptimizationOptions
): Promise<IOptimizationResult> {
  const startTime = Date.now();
  const aiService = new AIIntegrationService();
  let optimizedContent = prompt.content;
  const suggestions: string[] = [];
  const modelTests: ModelTestResults[] = [];

  try {
    // Analyze prompt structure
    const structureAnalysis = await analyzePromptStructure(prompt.content, options);

    // Security validation
    const securityIssues = validateSecurity(prompt.content, options.securityChecks);
    if (securityIssues.length > 0) {
      suggestions.push(...securityIssues.map(issue => `Security concern: ${issue}`));
    }

    // Multi-model testing
    for (const model of options.testModels) {
      const testStart = Date.now();
      try {
        const testResult = await aiService.testOptimization({
          content: optimizedContent,
          model,
          maxTokens: options.performanceThresholds.maxTokenCount
        });

        modelTests.push({
          model,
          success: testResult.success,
          responseTime: Date.now() - testStart,
          suggestions: testResult.suggestions || []
        });

        if (testResult.optimizedContent && options.autoApply) {
          optimizedContent = testResult.optimizedContent;
        }
      } catch (error) {
        modelTests.push({
          model,
          success: false,
          responseTime: Date.now() - testStart,
          suggestions: [`Failed to test with model ${model}: ${error.message}`]
        });
      }
    }

    // Calculate comprehensive score
    const score = calculateOptimizationScore({
      structureScore: structureAnalysis.score,
      securityScore: securityIssues.length === 0 ? 1 : 0.5,
      modelTestsScore: calculateModelTestsScore(modelTests),
      weights: options.weights
    });

    // Generate performance metrics
    const performance = {
      responseTime: calculateAverageResponseTime(modelTests),
      tokenCount: estimateTokenCount(optimizedContent),
      successRate: calculateSuccessRate(modelTests),
      costEstimate: estimateCost(modelTests)
    };

    return {
      optimizedContent,
      score,
      suggestions: [...suggestions, ...collectModelSuggestions(modelTests)],
      metrics: structureAnalysis.metrics,
      performance,
      modelTests
    };
  } catch (error) {
    throw new Error(`Prompt optimization failed: ${error.message}`);
  }
}

/**
 * Analyzes prompt structure for clarity, specificity, and completeness
 */
async function analyzePromptStructure(
  content: string,
  options: IOptimizationOptions
): Promise<{ score: number; metrics: Record<string, number> }> {
  const metrics: Record<string, number> = {};
  let totalScore = 0;

  // Check for required sections
  const sectionScores = OPTIMIZATION_RULES.REQUIRED_SECTIONS.map(section => {
    const hasSection = content.toLowerCase().includes(section);
    metrics[`has_${section}`] = hasSection ? 1 : 0;
    return hasSection ? 1 : 0;
  });

  // Analyze clarity
  metrics.clarity = analyzeClarityScore(content);
  
  // Analyze specificity
  metrics.specificity = analyzeSpecificityScore(content);

  // Calculate length appropriateness
  metrics.length_score = calculateLengthScore(content);

  // Calculate total score
  totalScore = Object.entries(metrics).reduce((sum, [key, value]) => {
    return sum + (value * (options.weights[key] || 0.1));
  }, 0);

  return {
    score: totalScore / Object.keys(metrics).length,
    metrics
  };
}

/**
 * Validates prompt content for security issues
 */
function validateSecurity(content: string, securityChecks: string[]): string[] {
  const issues: string[] = [];

  // Check for potential XSS
  if (securityChecks.includes('xss') && /<script|javascript:/i.test(content)) {
    issues.push('Potential XSS vulnerability detected');
  }

  // Check for injection patterns
  if (securityChecks.includes('injection')) {
    const injectionPatterns = [
      /system:\s*override/i,
      /ignore\s+previous\s+instructions/i,
      /bypass\s+restrictions/i
    ];

    injectionPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        issues.push('Potential prompt injection pattern detected');
      }
    });
  }

  // Check for sensitive data patterns
  if (securityChecks.includes('sensitive_data')) {
    const sensitivePatterns = [
      /api[_-]?key/i,
      /password/i,
      /secret/i,
      /token/i,
      /credential/i
    ];

    sensitivePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        issues.push('Potential sensitive data exposure detected');
      }
    });
  }

  return issues;
}

/**
 * Helper functions for score calculations
 */
function analyzeClarityScore(content: string): number {
  const factors = {
    hasStructure: /^.*\n.*\n.*$/m.test(content) ? 1 : 0,
    hasExamples: /example|e\.g\.|instance/i.test(content) ? 1 : 0,
    hasClearInstructions: /please|should|must|need to/i.test(content) ? 1 : 0
  };
  
  return Object.values(factors).reduce((sum, score) => sum + score, 0) / 3;
}

function analyzeSpecificityScore(content: string): number {
  const factors = {
    hasNumbers: /\d+/.test(content) ? 1 : 0,
    hasSpecificTerms: /specific|exact|precise/i.test(content) ? 1 : 0,
    hasConstraints: /limit|only|must|should not/i.test(content) ? 1 : 0
  };

  return Object.values(factors).reduce((sum, score) => sum + score, 0) / 3;
}

function calculateLengthScore(content: string): number {
  const length = content.length;
  if (length < OPTIMIZATION_RULES.MIN_LENGTH) return 0;
  if (length > OPTIMIZATION_RULES.MAX_LENGTH) return 0;
  return 1 - (Math.abs(length - 500) / OPTIMIZATION_RULES.MAX_LENGTH);
}

function calculateModelTestsScore(tests: ModelTestResults[]): number {
  if (tests.length === 0) return 0;
  return tests.reduce((sum, test) => sum + (test.success ? 1 : 0), 0) / tests.length;
}

function calculateAverageResponseTime(tests: ModelTestResults[]): number {
  if (tests.length === 0) return 0;
  return tests.reduce((sum, test) => sum + test.responseTime, 0) / tests.length;
}

function calculateSuccessRate(tests: ModelTestResults[]): number {
  if (tests.length === 0) return 0;
  return tests.filter(test => test.success).length / tests.length;
}

function estimateTokenCount(content: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(content.length / 4);
}

function estimateCost(tests: ModelTestResults[]): number {
  // Simplified cost estimation
  const costPerToken = 0.00002;
  return tests.length * estimateTokenCount(tests[0]?.model || '') * costPerToken;
}

function collectModelSuggestions(tests: ModelTestResults[]): string[] {
  return tests.flatMap(test => test.suggestions);
}

function calculateOptimizationScore(params: {
  structureScore: number;
  securityScore: number;
  modelTestsScore: number;
  weights: Record<string, number>;
}): number {
  return (
    params.structureScore * params.weights.structure +
    params.securityScore * params.weights.security +
    params.modelTestsScore * params.weights.modelTests
  );
}