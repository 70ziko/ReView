import chalk from "chalk";
import util from "util";

type LogLevel = "debug" | "info" | "warn" | "error";

const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

interface FormatOptions {
  showTimestamp: boolean;
  showLevel: boolean;
  colors: boolean;
}

const defaultOptions: FormatOptions = {
  showTimestamp: true,
  showLevel: true,
  colors: true,
};

function formatMessage(
  level: LogLevel,
  message: any,
  options: FormatOptions = defaultOptions
): string {
  const parts: string[] = [];

  if (options.showTimestamp) {
    const timestamp = new Date().toLocaleTimeString();
    parts.push(options.colors ? chalk.gray(timestamp) : timestamp);
  }

  if (options.showLevel) {
    const levelMap = {
      debug: options.colors ? chalk.blue("DEBUG") : "DEBUG",
      info: options.colors ? chalk.green("INFO") : "INFO",
      warn: options.colors ? chalk.yellow("WARN") : "WARN",
      error: options.colors ? chalk.red("ERROR") : "ERROR",
    };
    parts.push(`[${levelMap[level]}]`);
  }

  const formattedMessage =
    typeof message === "string"
      ? message
      : util.inspect(message, { colors: options.colors, depth: null });

  return parts.join(" ") + " " + formattedMessage;
}

function createLogFn(level: LogLevel, originalFn: Function) {
  return function (...args: any[]) {
    const formattedArgs = args.map((arg) => formatMessage(level, arg));
    originalFn.apply(console, formattedArgs);
  };
}

console.log = createLogFn("info", originalConsole.log);
console.info = createLogFn("info", originalConsole.info);
console.warn = createLogFn("warn", originalConsole.warn);
console.error = createLogFn("error", originalConsole.error);
console.debug = createLogFn("debug", originalConsole.debug);

export const prettyLog = {
  debug: createLogFn("debug", originalConsole.debug),
  info: createLogFn("info", originalConsole.info),
  log: createLogFn("info", originalConsole.log),
  warn: createLogFn("warn", originalConsole.warn),
  error: createLogFn("error", originalConsole.error),

  restore: () => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  },

  configure: (options: Partial<FormatOptions>) => {
    Object.assign(defaultOptions, options);
  },
};

export default prettyLog;
