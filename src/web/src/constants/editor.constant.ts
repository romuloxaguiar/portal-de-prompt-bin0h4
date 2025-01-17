/**
 * Editor layout and typography configuration following Material Design 3.0 specifications
 * Implements consistent spacing and custom prompt-specific components
 */
export const EDITOR_CONFIG = {
  maxHeight: '600px',
  minHeight: '200px',
  padding: '16px',
  fontSize: '16px',
  lineHeight: 1.5,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  borderRadius: '8px',
  spacing: {
    unit: 8,      // Base spacing unit in pixels
    small: 8,     // For tight spacing
    medium: 16,   // For standard spacing
    large: 24     // For generous spacing
  }
} as const;

/**
 * Variable placeholder syntax and parsing configuration
 * Defines the markers and regex patterns for template variables
 */
export const VARIABLE_MARKERS = {
  start: '{{',                                    // Opening marker for variables
  end: '}}',                                      // Closing marker for variables
  regex: /\{\{([^}]+)\}\}/g,                     // Pattern to match variables
  escapeRegex: /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,  // Pattern to escape special characters
  validationRegex: /^[a-zA-Z][a-zA-Z0-9_]*$/     // Pattern for valid variable names
} as const;

/**
 * Maximum allowed length for prompt content
 * Ensures prompts remain within processable limits
 */
export const MAX_PROMPT_LENGTH = 4000;

/**
 * Editor action button configuration with i18n support
 * Defines available actions, their icons, shortcuts and labels
 */
export const EDITOR_ACTIONS = {
  save: {
    id: 'save',
    label: 'Save Prompt',
    icon: 'save',
    shortcut: 'Ctrl+S',
    i18nKey: 'editor.actions.save'
  },
  test: {
    id: 'test',
    label: 'Test Prompt',
    icon: 'play_arrow',
    shortcut: 'Ctrl+Enter',
    i18nKey: 'editor.actions.test'
  },
  clear: {
    id: 'clear',
    label: 'Clear Editor',
    icon: 'clear',
    shortcut: 'Ctrl+Delete',
    i18nKey: 'editor.actions.clear'
  },
  optimize: {
    id: 'optimize',
    label: 'Optimize Prompt',
    icon: 'auto_fix',
    shortcut: 'Ctrl+O',
    i18nKey: 'editor.actions.optimize'
  }
} as const;

/**
 * Editor content validation rules and constraints
 * Defines limits and patterns for content validation
 */
export const EDITOR_VALIDATION = {
  minLength: 10,                                  // Minimum prompt length
  maxVariables: 10,                              // Maximum number of variables allowed
  maxNestedDepth: 3,                             // Maximum nesting level for variables
  variableNamePattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, // Pattern for valid variable names
  contentRules: {
    maxLineLength: 120,                          // Maximum characters per line
    maxParagraphs: 50,                           // Maximum number of paragraphs
    allowedTags: ['p', 'br', 'strong', 'em'],    // Allowed HTML tags
    sanitization: {
      enabled: true,
      allowedAttributes: ['class', 'id', 'data-*'] // Allowed HTML attributes
    }
  }
} as const;