import fs from 'fs';

export function loadFeatureConfig() {
  try {
    const data = fs.readFileSync('data/feature-config.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading feature config:', error);
    return null;
  }
}

export function isFeatureEnabled(featureName) {
  const config = loadFeatureConfig();
  if (!config || !config.features || !config.features[featureName]) {
    return true; // Default to enabled if config missing
  }
  return config.features[featureName].enabled;
}

export function getFeature(featureName) {
  const config = loadFeatureConfig();
  if (!config || !config.features) return null;
  return config.features[featureName] || null;
}
