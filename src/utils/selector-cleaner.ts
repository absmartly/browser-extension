/**
 * Cleans CSS selectors by removing temporary state classes
 * that are often added dynamically on hover/focus/active states
 */

const TEMPORARY_STATE_CLASSES = [
  'hover',
  'active', 
  'focus',
  'focused',
  'selected',
  'disabled',
  'loading',
  'animating',
  'transitioning',
  'entering',
  'leaving',
  'is-hovered',
  'is-active',
  'is-focused',
  'is-selected',
  'framer-hover',
  'framer-active',
  'framer-v-hover',
  'framer-v-active',
  'framer-v-focus'
]

const TEMPORARY_STATE_PATTERNS = [
  /^hover[-_]/i,
  /^active[-_]/i,
  /^focus[-_]/i,
  /[-_]hover$/i,
  /[-_]active$/i,
  /[-_]focus$/i,
  /^framer-v-/  // Framer variant states
]

export function cleanSelector(selector: string): string {
  // Split the selector by spaces to handle descendant selectors
  const parts = selector.split(/\s+/).map(part => {
    // Handle each part of the selector
    if (part.includes('.')) {
      // Split by dots to get individual classes
      const [tagOrFirst, ...classes] = part.split('.')
      
      // Filter out temporary state classes
      const cleanedClasses = classes.filter(cls => {
        // Check if it's a known temporary class
        if (TEMPORARY_STATE_CLASSES.includes(cls)) {
          return false
        }
        
        // Check if it matches a temporary pattern
        for (const pattern of TEMPORARY_STATE_PATTERNS) {
          if (pattern.test(cls)) {
            return false
          }
        }
        
        return true
      })
      
      // Reconstruct the selector part
      if (cleanedClasses.length > 0) {
        return tagOrFirst + '.' + cleanedClasses.join('.')
      } else if (tagOrFirst && !tagOrFirst.includes('#') && !tagOrFirst.includes('[')) {
        // If we removed all classes and there's a tag name, keep just the tag
        return tagOrFirst
      } else {
        // If no tag and all classes removed, this part becomes invalid
        return ''
      }
    }
    
    // Return non-class selectors as-is
    return part
  })
  
  // Filter out empty parts and join back
  return parts.filter(p => p).join(' ')
}

export function detectTemporaryClasses(selector: string): string[] {
  const temporaryFound: string[] = []
  
  // Extract all classes from the selector
  const classMatches = selector.match(/\.[\w-]+/g) || []
  
  classMatches.forEach(classWithDot => {
    const className = classWithDot.substring(1) // Remove the dot
    
    // Check if it's a known temporary class
    if (TEMPORARY_STATE_CLASSES.includes(className)) {
      temporaryFound.push(className)
    } else {
      // Check patterns
      for (const pattern of TEMPORARY_STATE_PATTERNS) {
        if (pattern.test(className)) {
          temporaryFound.push(className)
          break
        }
      }
    }
  })
  
  return temporaryFound
}

export function suggestCleanedSelector(selector: string): {
  original: string
  cleaned: string
  removedClasses: string[]
  hasChanges: boolean
} {
  const cleaned = cleanSelector(selector)
  const removedClasses = detectTemporaryClasses(selector)
  
  return {
    original: selector,
    cleaned,
    removedClasses,
    hasChanges: selector !== cleaned
  }
}