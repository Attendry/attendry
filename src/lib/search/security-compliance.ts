/**
 * Security & Compliance
 * 
 * Implements robots.txt compliance, PII hygiene, and security measures
 */

export interface RobotsTxtRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

export interface SecurityConfig {
  respectRobotsTxt: boolean;
  maxPagesPerDomain: number;
  userAgent: string;
  crawlDelayMs: number;
  allowedDomains: string[];
  blockedDomains: string[];
  maxContentSize: number;
  sanitizeHtml: boolean;
  redactPII: boolean;
}

export interface ComplianceViolation {
  type: 'robots_txt' | 'rate_limit' | 'pii_detected' | 'malicious_content' | 'size_limit';
  domain: string;
  url: string;
  reason: string;
  timestamp: Date;
}

/**
 * Default security configuration
 */
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  respectRobotsTxt: true,
  maxPagesPerDomain: 100,
  userAgent: 'AttendryBot/1.0 (+https://attendry.com/bot)',
  crawlDelayMs: 1000,
  allowedDomains: [],
  blockedDomains: [
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'linkedin.com',
    'youtube.com',
    'tiktok.com',
    'reddit.com',
    '4chan.org',
    '8kun.top'
  ],
  maxContentSize: 10 * 1024 * 1024, // 10MB
  sanitizeHtml: true,
  redactPII: true
};

/**
 * Robots.txt Compliance Manager
 */
export class RobotsTxtManager {
  private cache = new Map<string, { rules: RobotsTxtRule[]; timestamp: number }>();
  private config: SecurityConfig;

  constructor(config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
    this.config = config;
  }

  /**
   * Check if URL is allowed by robots.txt
   */
  async isUrlAllowed(url: string): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.config.respectRobotsTxt) {
      return { allowed: true };
    }

    try {
      const domain = new URL(url).hostname;
      const robotsTxt = await this.getRobotsTxt(domain);
      
      if (!robotsTxt) {
        return { allowed: true }; // No robots.txt, allow by default
      }

      // Check against all rules
      for (const rule of robotsTxt) {
        if (this.matchesUserAgent(rule.userAgent)) {
          const allowed = this.checkUrlAgainstRule(url, rule);
          if (!allowed.allowed) {
            return { allowed: false, reason: `Robots.txt disallows: ${allowed.reason}` };
          }
        }
      }

      return { allowed: true };
    } catch (error) {
      console.warn(`Error checking robots.txt for ${url}:`, error);
      return { allowed: true }; // Allow on error
    }
  }

  /**
   * Get robots.txt for domain
   */
  private async getRobotsTxt(domain: string): Promise<RobotsTxtRule[] | null> {
    const cached = this.cache.get(domain);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24 hours
      return cached.rules;
    }

    try {
      const robotsUrl = `https://${domain}/robots.txt`;
      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': this.config.userAgent },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      const rules = this.parseRobotsTxt(text);
      
      this.cache.set(domain, { rules, timestamp: Date.now() });
      return rules;
    } catch (error) {
      console.warn(`Failed to fetch robots.txt for ${domain}:`, error);
      return null;
    }
  }

  /**
   * Parse robots.txt content
   */
  private parseRobotsTxt(content: string): RobotsTxtRule[] {
    const rules: RobotsTxtRule[] = [];
    const lines = content.split('\n');
    let currentRule: RobotsTxtRule | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [directive, value] = trimmed.split(':', 2);
      if (!directive || !value) continue;

      const lowerDirective = directive.toLowerCase().trim();
      const lowerValue = value.toLowerCase().trim();

      if (lowerDirective === 'user-agent') {
        if (currentRule) {
          rules.push(currentRule);
        }
        currentRule = {
          userAgent: lowerValue,
          allow: [],
          disallow: []
        };
      } else if (currentRule) {
        if (lowerDirective === 'allow') {
          currentRule.allow.push(lowerValue);
        } else if (lowerDirective === 'disallow') {
          currentRule.disallow.push(lowerValue);
        } else if (lowerDirective === 'crawl-delay') {
          currentRule.crawlDelay = parseInt(lowerValue);
        }
      }
    }

    if (currentRule) {
      rules.push(currentRule);
    }

    return rules;
  }

  /**
   * Check if user agent matches rule
   */
  private matchesUserAgent(ruleUserAgent: string): boolean {
    if (ruleUserAgent === '*') return true;
    return this.config.userAgent.toLowerCase().includes(ruleUserAgent);
  }

  /**
   * Check URL against specific rule
   */
  private checkUrlAgainstRule(url: string, rule: RobotsTxtRule): { allowed: boolean; reason?: string } {
    const urlPath = new URL(url).pathname;

    // Check disallow rules first
    for (const disallow of rule.disallow) {
      if (this.pathMatches(urlPath, disallow)) {
        return { allowed: false, reason: `Disallowed by pattern: ${disallow}` };
      }
    }

    // Check allow rules
    for (const allow of rule.allow) {
      if (this.pathMatches(urlPath, allow)) {
        return { allowed: true };
      }
    }

    // Default to allowed if no specific rules match
    return { allowed: true };
  }

  /**
   * Check if path matches pattern
   */
  private pathMatches(path: string, pattern: string): boolean {
    if (pattern === '/') return true;
    if (pattern === '') return false;

    // Simple pattern matching (can be enhanced with regex)
    return path.startsWith(pattern);
  }
}

/**
 * PII Detection and Redaction
 */
export class PIIDetector {
  private config: SecurityConfig;

  constructor(config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
    this.config = config;
  }

  /**
   * Detect and redact PII in content
   */
  redactPII(content: string): { content: string; violations: ComplianceViolation[] } {
    if (!this.config.redactPII) {
      return { content, violations: [] };
    }

    let redactedContent = content;
    const violations: ComplianceViolation[] = [];

    // Email patterns
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailPattern);
    if (emails) {
      redactedContent = redactedContent.replace(emailPattern, '[EMAIL_REDACTED]');
      violations.push({
        type: 'pii_detected',
        domain: 'unknown',
        url: 'unknown',
        reason: `Detected ${emails.length} email addresses`,
        timestamp: new Date()
      });
    }

    // Phone patterns (various formats)
    const phonePatterns = [
      /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g, // US
      /\b(?:\+44[-.\s]?)?(?:0)?([0-9]{2,4})[-.\s]?([0-9]{3,4})[-.\s]?([0-9]{3,4})\b/g, // UK
      /\b(?:\+49[-.\s]?)?(?:0)?([0-9]{2,4})[-.\s]?([0-9]{3,4})[-.\s]?([0-9]{3,4})\b/g, // DE
      /\b(?:\+33[-.\s]?)?(?:0)?([0-9]{2,4})[-.\s]?([0-9]{3,4})[-.\s]?([0-9]{3,4})\b/g  // FR
    ];

    for (const pattern of phonePatterns) {
      const phones = redactedContent.match(pattern);
      if (phones) {
        redactedContent = redactedContent.replace(pattern, '[PHONE_REDACTED]');
        violations.push({
          type: 'pii_detected',
          domain: 'unknown',
          url: 'unknown',
          reason: `Detected ${phones.length} phone numbers`,
          timestamp: new Date()
        });
      }
    }

    // Credit card patterns (basic)
    const cardPattern = /\b[0-9]{4}[-.\s]?[0-9]{4}[-.\s]?[0-9]{4}[-.\s]?[0-9]{4}\b/g;
    const cards = redactedContent.match(cardPattern);
    if (cards) {
      redactedContent = redactedContent.replace(cardPattern, '[CARD_REDACTED]');
      violations.push({
        type: 'pii_detected',
        domain: 'unknown',
        url: 'unknown',
        reason: `Detected ${cards.length} credit card numbers`,
        timestamp: new Date()
      });
    }

    // Social Security Numbers (US)
    const ssnPattern = /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g;
    const ssns = redactedContent.match(ssnPattern);
    if (ssns) {
      redactedContent = redactedContent.replace(ssnPattern, '[SSN_REDACTED]');
      violations.push({
        type: 'pii_detected',
        domain: 'unknown',
        url: 'unknown',
        reason: `Detected ${ssns.length} SSNs`,
        timestamp: new Date()
      });
    }

    return { content: redactedContent, violations };
  }

  /**
   * Check if content contains PII
   */
  containsPII(content: string): boolean {
    const { violations } = this.redactPII(content);
    return violations.length > 0;
  }
}

/**
 * HTML Sanitizer
 */
export class HTMLSanitizer {
  private config: SecurityConfig;

  constructor(config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
    this.config = config;
  }

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(html: string): string {
    if (!this.config.sanitizeHtml) {
      return html;
    }

    // Allowed tags and attributes
    const allowedTags = [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img'
    ];

    const allowedAttributes = {
      'a': ['href', 'title'],
      'img': ['src', 'alt', 'title', 'width', 'height']
    };

    // Remove script tags and event handlers
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');

    // Remove dangerous attributes
    sanitized = sanitized.replace(/\s*(javascript:|data:|vbscript:)/gi, '');

    // Remove style attributes that could contain malicious CSS
    sanitized = sanitized.replace(/\s*style="[^"]*"/gi, '');

    return sanitized;
  }
}

/**
 * URL Safety Checker
 */
export class URLSafetyChecker {
  private config: SecurityConfig;

  constructor(config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
    this.config = config;
  }

  /**
   * Check if URL is safe to crawl
   */
  async isUrlSafe(url: string): Promise<{ safe: boolean; violations: ComplianceViolation[] }> {
    const violations: ComplianceViolation[] = [];

    try {
      const parsedUrl = new URL(url);

      // Check protocol
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        violations.push({
          type: 'malicious_content',
          domain: parsedUrl.hostname,
          url,
          reason: `Unsafe protocol: ${parsedUrl.protocol}`,
          timestamp: new Date()
        });
      }

      // Check blocked domains
      if (this.config.blockedDomains.some(domain => parsedUrl.hostname.includes(domain))) {
        violations.push({
          type: 'malicious_content',
          domain: parsedUrl.hostname,
          url,
          reason: `Blocked domain: ${parsedUrl.hostname}`,
          timestamp: new Date()
        });
      }

      // Check allowed domains (if specified)
      if (this.config.allowedDomains.length > 0) {
        const isAllowed = this.config.allowedDomains.some(domain => 
          parsedUrl.hostname.includes(domain)
        );
        if (!isAllowed) {
          violations.push({
            type: 'malicious_content',
            domain: parsedUrl.hostname,
            url,
            reason: `Domain not in allowlist: ${parsedUrl.hostname}`,
            timestamp: new Date()
          });
        }
      }

      // Check for suspicious patterns
      if (this.hasSuspiciousPatterns(url)) {
        violations.push({
          type: 'malicious_content',
          domain: parsedUrl.hostname,
          url,
          reason: 'Suspicious URL patterns detected',
          timestamp: new Date()
        });
      }

      return {
        safe: violations.length === 0,
        violations
      };
    } catch (error) {
      violations.push({
        type: 'malicious_content',
        domain: 'unknown',
        url,
        reason: `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      });

      return { safe: false, violations };
    }
  }

  /**
   * Check for suspicious URL patterns
   */
  private hasSuspiciousPatterns(url: string): boolean {
    const suspiciousPatterns = [
      /\.exe$/i,
      /\.zip$/i,
      /\.rar$/i,
      /\.pdf$/i,
      /\.doc$/i,
      /\.docx$/i,
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /<script/i,
      /%3Cscript/i,
      /%3C%2Fscript/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(url));
  }
}

/**
 * SSRF Protection
 */
export class SSRFProtection {
  private blockedHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '169.254.169.254', // AWS metadata
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ];

  /**
   * Check if URL is safe from SSRF
   */
  isUrlSafeFromSSRF(url: string): { safe: boolean; reason?: string } {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();

      // Check against blocked hosts
      for (const blockedHost of this.blockedHosts) {
        if (hostname === blockedHost || hostname.includes(blockedHost)) {
          return { safe: false, reason: `Blocked host: ${blockedHost}` };
        }
      }

      // Check for IP addresses
      if (this.isIPAddress(hostname)) {
        return { safe: false, reason: 'IP addresses not allowed' };
      }

      return { safe: true };
    } catch (error) {
      return { safe: false, reason: 'Invalid URL' };
    }
  }

  /**
   * Check if string is an IP address
   */
  private isIPAddress(hostname: string): boolean {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname);
  }
}

/**
 * Security Compliance Manager
 */
export class SecurityComplianceManager {
  private config: SecurityConfig;
  private robotsTxtManager: RobotsTxtManager;
  private piiDetector: PIIDetector;
  private htmlSanitizer: HTMLSanitizer;
  private urlSafetyChecker: URLSafetyChecker;
  private ssrfProtection: SSRFProtection;
  private violations: ComplianceViolation[] = [];

  constructor(config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
    this.config = config;
    this.robotsTxtManager = new RobotsTxtManager(config);
    this.piiDetector = new PIIDetector(config);
    this.htmlSanitizer = new HTMLSanitizer(config);
    this.urlSafetyChecker = new URLSafetyChecker(config);
    this.ssrfProtection = new SSRFProtection();
  }

  /**
   * Check URL for compliance
   */
  async checkUrlCompliance(url: string): Promise<{
    compliant: boolean;
    violations: ComplianceViolation[];
    sanitizedUrl?: string;
  }> {
    const violations: ComplianceViolation[] = [];

    // Check SSRF protection
    const ssrfCheck = this.ssrfProtection.isUrlSafeFromSSRF(url);
    if (!ssrfCheck.safe) {
      violations.push({
        type: 'malicious_content',
        domain: 'unknown',
        url,
        reason: `SSRF protection: ${ssrfCheck.reason}`,
        timestamp: new Date()
      });
    }

    // Check URL safety
    const safetyCheck = await this.urlSafetyChecker.isUrlSafe(url);
    violations.push(...safetyCheck.violations);

    // Check robots.txt compliance
    const robotsCheck = await this.robotsTxtManager.isUrlAllowed(url);
    if (!robotsCheck.allowed) {
      violations.push({
        type: 'robots_txt',
        domain: new URL(url).hostname,
        url,
        reason: robotsCheck.reason || 'Robots.txt disallows',
        timestamp: new Date()
      });
    }

    // Store violations
    this.violations.push(...violations);

    return {
      compliant: violations.length === 0,
      violations,
      sanitizedUrl: violations.length === 0 ? url : undefined
    };
  }

  /**
   * Sanitize content
   */
  sanitizeContent(content: string, url: string): {
    content: string;
    violations: ComplianceViolation[];
  } {
    const violations: ComplianceViolation[] = [];

    // Check content size
    if (content.length > this.config.maxContentSize) {
      violations.push({
        type: 'size_limit',
        domain: new URL(url).hostname,
        url,
        reason: `Content too large: ${content.length} bytes`,
        timestamp: new Date()
      });
    }

    // Sanitize HTML
    let sanitizedContent = this.htmlSanitizer.sanitizeHtml(content);

    // Redact PII
    const piiResult = this.piiDetector.redactPII(sanitizedContent);
    sanitizedContent = piiResult.content;
    violations.push(...piiResult.violations);

    // Store violations
    this.violations.push(...violations);

    return {
      content: sanitizedContent,
      violations
    };
  }

  /**
   * Get compliance violations
   */
  getViolations(): ComplianceViolation[] {
    return [...this.violations];
  }

  /**
   * Clear violations
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Get compliance summary
   */
  getComplianceSummary(): {
    totalViolations: number;
    violationsByType: Record<string, number>;
    violationsByDomain: Record<string, number>;
  } {
    const violationsByType: Record<string, number> = {};
    const violationsByDomain: Record<string, number> = {};

    for (const violation of this.violations) {
      violationsByType[violation.type] = (violationsByType[violation.type] || 0) + 1;
      violationsByDomain[violation.domain] = (violationsByDomain[violation.domain] || 0) + 1;
    }

    return {
      totalViolations: this.violations.length,
      violationsByType,
      violationsByDomain
    };
  }
}

/**
 * Global security compliance manager
 */
export const securityCompliance = new SecurityComplianceManager();
