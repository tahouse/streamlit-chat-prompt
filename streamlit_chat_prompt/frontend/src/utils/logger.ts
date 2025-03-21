// logger.ts
type LogCategory = "component" | "state" | "images" | "events" | "files"

interface LogConfig {
  enabled: boolean
  categories: {
    [key in LogCategory]: boolean
  }
  level: "none" | "error" | "warn" | "info" | "debug"
}

export class Logger {
  private static config: LogConfig = {
    enabled: false,
    categories: {
      component: true,
      state: true,
      images: true,
      events: true,
      files: true,
    },
    level: "none",
  }

  static configure(options: Partial<LogConfig>) {
    Logger.config = { ...Logger.config, ...options }
  }

  private static formatMessage(category: LogCategory, message: string): string {
    return `[${new Date().toISOString()}] [${category.toUpperCase()}] ${message}`
  }

  static getConfiguration(): LogConfig {
    return { ...Logger.config }
  }

  private static shouldLog(
    category: LogCategory,
    level: "error" | "warn" | "info" | "debug"
  ): boolean {
    if (!Logger.config.enabled) return false
    if (!Logger.config.categories[category]) return false
    if (Logger.config.level === "none") return false

    const levels = ["error", "warn", "info", "debug"] // Reversed order - error highest priority, debug lowest
    const configLevelIndex = levels.indexOf(Logger.config.level)
    const messageLevelIndex = levels.indexOf(level)

    // Return true if message level is same or lower priority than config level
    return messageLevelIndex <= configLevelIndex
  }

  static debug(category: LogCategory, message: string, ...args: any[]) {
    if (this.shouldLog(category, "debug")) {
      console.debug(this.formatMessage(category, message), ...args)
    }
  }

  static info(category: LogCategory, message: string, ...args: any[]) {
    if (this.shouldLog(category, "info")) {
      console.log(this.formatMessage(category, message), ...args)
    }
  }

  static warn(category: LogCategory, message: string, ...args: any[]) {
    if (this.shouldLog(category, "warn")) {
      console.warn(this.formatMessage(category, message), ...args)
    }
  }

  static error(category: LogCategory, message: string, ...args: any[]) {
    if (this.shouldLog(category, "error")) {
      console.error(this.formatMessage(category, message), ...args)
    }
  }

  static group(category: LogCategory, label: string) {
    if (this.shouldLog(category, "debug")) {
      console.group(this.formatMessage(category, label))
    }
  }

  static groupEnd(category: LogCategory) {
    if (this.shouldLog(category, "debug")) {
      console.groupEnd()
    }
  }
}