enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVELS = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL as keyof typeof LOG_LEVELS] || LogLevel.INFO;

const logger = {
  debug: (message: string, meta?: any) => {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  },
  info: (message: string, meta?: any) => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  },
  warn: (message: string, meta?: any) => {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  },
  error: (message: string, error?: any) => {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, error ? (error.stack || JSON.stringify(error)) : '');
    }
  },
};

export default logger;
