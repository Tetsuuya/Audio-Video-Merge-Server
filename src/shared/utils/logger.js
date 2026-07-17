/**
 * LOGGER UTILITY
 * Colored terminal output using ANSI escape codes — no dependencies needed.
 */

const c = {
  reset:   '\x1b[0m',

  // Normal (non-bold) colors
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
};

const LABELS = {
  info:    `\x1b[44;37m INFO  \x1b[0m`,   // white on blue
  success: `\x1b[42;30m OK    \x1b[0m`,   // black on green
  step:    `\x1b[46;30m STEP  \x1b[0m`,   // black on cyan
  warn:    `\x1b[43;30m WARN  \x1b[0m`,   // black on yellow
  error:   `\x1b[41;37m ERR   \x1b[0m`,   // white on red
  job:     `\x1b[45;37m JOB   \x1b[0m`,   // white on magenta
};

function timestamp() {
  return `${c.cyan}[${new Date().toISOString()}]${c.reset}`;
}

const logger = {
  info(msg) {
    console.log(`${timestamp()} ${LABELS.info} ${c.white}${msg}${c.reset}`);
  },
  success(msg) {
    console.log(`${timestamp()} ${LABELS.success} ${c.green}${msg}${c.reset}`);
  },
  step(msg) {
    console.log(`${timestamp()} ${LABELS.step} ${c.cyan}${msg}${c.reset}`);
  },
  detail(msg) {
    console.log(`             ${c.yellow}${msg}${c.reset}`);
  },
  warn(msg) {
    console.warn(`${timestamp()} ${LABELS.warn} ${c.yellow}${msg}${c.reset}`);
  },
  error(msg) {
    console.error(`${timestamp()} ${LABELS.error} ${c.red}${msg}${c.reset}`);
  },
  section(title) {
    const line = '─'.repeat(44);
    console.log(`\n${c.magenta}${line}${c.reset}`);
    console.log(`${c.white}  ${title}${c.reset}`);
    console.log(`${c.magenta}${line}${c.reset}`);
  },
  job(jobId, msg) {
    console.log(`${timestamp()} ${LABELS.job} ${c.magenta}[${jobId}]${c.reset} ${c.white}${msg}${c.reset}`);
  },
};

module.exports = logger;
