const { execSync } = require('child_process');

function setupGitHooks() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    execSync('git config --local core.hooksPath .githooks', { stdio: 'ignore' });
  } catch (error) {
    // Ignore environments without a git checkout.
  }
}

setupGitHooks();
