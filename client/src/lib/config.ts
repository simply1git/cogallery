// Configuration Service for CoGallery
// Centralizes environment variables, feature flags, and runtime configuration

import { validateEnv } from './env';
import { isFeatureEnabled, getAllFeatureFlags } from './featureFlags';

/**
 * Application configuration
 */
export class Config {
  private static _instance: Config;
  private readonly _env: ImportMetaEnv;
  private readonly _featureFlags: Record<string, boolean>;

  private constructor() {
    // Validate environment variables on instantiation
    validateEnv();

    // Store environment variables
    this._env = import.meta.env;

    // Load feature flags
    this._featureFlags = getAllFeatureFlags();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): Config {
    if (!Config._instance) {
      Config._instance = new Config();
    }
    return Config._instance;
  }

  /**
   * Get environment variable
   * @param key Environment variable key
   * @param defaultValue Default value if not found
   */
  public get<T = string>(key: string, defaultValue?: T): T | string {
    const value = this._env[`VITE_${key}`] as T | undefined;
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Check if running in development mode
   */
  public get isDev(): boolean {
    return this._env.DEV === true;
  }

  /**
   * Check if running in production mode
   */
  public get isProd(): boolean {
    return this._env.PROD === true;
  }

  /**
   * Check if a feature is enabled
   * @param featureKey Feature flag key
   */
  public isFeatureEnabled(featureKey: string): boolean {
    return isFeatureEnabled(featureKey);
  }

  /**
   * Get all feature flags
   */
  public getAllFeatureFlags(): Record<string, boolean> {
    return { ...this._featureFlags };
  }

  /**
   * Get Supabase configuration
   */
  public getSupabaseConfig() {
    return {
      url: this.get<string>('SUPABASE_URL'),
      anonKey: this.get<string>('SUPABASE_ANON_KEY'),
    };
  }

  /**
   * Get API configuration
   */
  public getApiConfig() {
    return {
      backendUrl: this.get<string>('BACKEND_URL', '/'),
    };
  }

  /**
   * Validate that required configuration is present
   */
  public validate(): string[] {
    const errors: string[] = [];

    const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    for (const varName of requiredVars) {
      if (!this.get(varName)) {
        errors.push(`Missing required environment variable: VITE_${varName}`);
      }
    }

    return errors;
  }
}

// Export singleton instance
export const config = Config.getInstance();

// Export the class for advanced usage
export type { Config };