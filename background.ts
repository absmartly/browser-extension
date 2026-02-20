/**
 * Background Script - Plasmo Entry Point
 *
 * This is the entry point file that Plasmo expects.
 * All functionality is implemented in modular files under background/
 *
 * This approach keeps the code modular and testable while being compatible
 * with Plasmo's bundling system.
 */

import { initializeBackgroundScript } from './background/main'

// Initialize the background script
initializeBackgroundScript()
