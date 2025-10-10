import { getTemplateByKey, type CaseResearchTemplateKey } from './caseResearchTemplateUtils';

const templateCache = new Map<CaseResearchTemplateKey, any>();

export const getCachedTemplate = (templateKey: CaseResearchTemplateKey) => {
  if (templateCache.has(templateKey)) {
    console.log(`✅ Template cache hit: ${templateKey}`);
    return templateCache.get(templateKey);
  }
  
  const template = getTemplateByKey(templateKey);
  
  // Keep cache reasonable - LRU style
  if (templateCache.size >= 30) {
    // Get and delete the first (oldest) entry
    const firstKey = Array.from(templateCache.keys())[0];
    templateCache.delete(firstKey);
  }
  
  templateCache.set(templateKey, template);
  
  console.log(`📝 Template cached: ${templateKey}`);
  return template;
};
